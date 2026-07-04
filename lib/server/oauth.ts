import type { OAuthProviderId, Session } from "../types";

/**
 * OAuth 2.0 授权码流程的提供方配置。凭据来自环境变量:
 * GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET、GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET、
 * FACEBOOK_CLIENT_ID/FACEBOOK_CLIENT_SECRET。见 .env.example。
 */

/** OAuth state 防 CSRF 校验用的临时 cookie 名 */
export const STATE_COOKIE = "copycut_oauth_state";

export interface OAuthProfile {
  id: string;
  username: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  /** 额外的 authorize 查询参数 */
  authorizeParams?: Record<string, string>;
  fetchProfile: (accessToken: string) => Promise<OAuthProfile>;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`${url} 返回 ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const providers: Record<OAuthProviderId, ProviderConfig> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    authorizeParams: { access_type: "online", prompt: "select_account" },
    async fetchProfile(accessToken) {
      const u = (await fetchJson(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )) as { sub: string; name?: string; email?: string; picture?: string };
      return {
        id: u.sub,
        username: u.email ?? `google:${u.sub}`,
        name: u.name,
        email: u.email,
        avatarUrl: u.picture,
      };
    },
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    clientId: () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
    async fetchProfile(accessToken) {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      };
      const u = (await fetchJson("https://api.github.com/user", {
        headers,
      })) as {
        id: number;
        login: string;
        name?: string | null;
        email?: string | null;
        avatar_url?: string;
      };
      let email = u.email ?? undefined;
      if (!email) {
        // 公开邮箱为空时再查一次 emails 端点
        try {
          const emails = (await fetchJson("https://api.github.com/user/emails", {
            headers,
          })) as Array<{ email: string; primary: boolean; verified: boolean }>;
          email = emails.find((e) => e.primary && e.verified)?.email;
        } catch {
          // 无权限时忽略,email 保持为空
        }
      }
      return {
        id: String(u.id),
        username: u.login,
        name: u.name ?? undefined,
        email,
        avatarUrl: u.avatar_url,
      };
    },
  },
  facebook: {
    authorizeUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scope: "public_profile,email",
    clientId: () => process.env.FACEBOOK_CLIENT_ID,
    clientSecret: () => process.env.FACEBOOK_CLIENT_SECRET,
    async fetchProfile(accessToken) {
      const u = (await fetchJson(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`
      )) as {
        id: string;
        name?: string;
        email?: string;
        picture?: { data?: { url?: string } };
      };
      return {
        id: u.id,
        username: u.email ?? `facebook:${u.id}`,
        name: u.name,
        email: u.email,
        avatarUrl: u.picture?.data?.url,
      };
    },
  },
};

export function isOAuthProvider(value: string): value is OAuthProviderId {
  return value === "google" || value === "github" || value === "facebook";
}

export function isProviderConfigured(provider: OAuthProviderId): boolean {
  const p = providers[provider];
  return Boolean(p.clientId() && p.clientSecret());
}

export function buildAuthorizeUrl(
  provider: OAuthProviderId,
  redirectUri: string,
  state: string
): string {
  const p = providers[provider];
  const url = new URL(p.authorizeUrl);
  url.searchParams.set("client_id", p.clientId() ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", p.scope);
  url.searchParams.set("state", state);
  for (const [k, v] of Object.entries(p.authorizeParams ?? {})) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export async function exchangeCodeForProfile(
  provider: OAuthProviderId,
  code: string,
  redirectUri: string
): Promise<OAuthProfile> {
  const p = providers[provider];
  const body = new URLSearchParams({
    client_id: p.clientId() ?? "",
    client_secret: p.clientSecret() ?? "",
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const token = (await fetchJson(p.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  })) as { access_token?: string; error?: string; error_description?: string };
  if (!token.access_token) {
    throw new Error(token.error_description ?? token.error ?? "未获取到 access_token");
  }
  return p.fetchProfile(token.access_token);
}

export function profileToSession(
  provider: OAuthProviderId,
  profile: OAuthProfile
): Session {
  return {
    username: profile.username,
    loginAt: Date.now(),
    provider,
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
  };
}
