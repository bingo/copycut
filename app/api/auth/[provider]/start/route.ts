import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  STATE_COOKIE,
  buildAuthorizeUrl,
  isOAuthProvider,
  isProviderConfigured,
} from "@/lib/server/oauth";
import { getAppOrigin } from "@/lib/server/url";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (!isOAuthProvider(provider)) {
    return Response.json({ error: "未知的登录方式" }, { status: 404 });
  }

  const origin = getAppOrigin(request.url);
  if (!isProviderConfigured(provider)) {
    return Response.redirect(
      `${origin}/login?error=not_configured&provider=${provider}`,
      302
    );
  }

  // state 防 CSRF:随机值同时写入 cookie 与授权 URL,回调时比对
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(STATE_COOKIE, `${provider}:${state}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${origin}/api/auth/${provider}/callback`;
  return Response.redirect(buildAuthorizeUrl(provider, redirectUri, state), 302);
}
