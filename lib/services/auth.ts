import type { OAuthProviderId, Session } from "../types";

export type { OAuthProviderId };

/**
 * 认证服务:真实会话在服务端 httpOnly cookie(见 lib/server/session.ts),
 * localStorage 仅存一份镜像供 AuthGuard 同步读取。
 * OAuth 登录跳转到 /api/auth/{provider}/start,回调落回 /login 后
 * 由 syncFromServer() 把服务端会话同步进镜像。
 */
export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export interface RegisterResult {
  email: string;
  /** 本地开发(服务端未配置邮件服务)时返回,可直接点击激活 */
  devActivationUrl?: string;
  /** 邮件发送失败时的提示(账号已创建,可稍后重发) */
  mailError?: string;
}

/** 登录被拒:密码正确但邮箱未激活,前端据此展示"重发激活邮件"入口 */
export class NeedsVerificationError extends Error {
  readonly email?: string;
  constructor(message: string, email?: string) {
    super(message);
    this.name = "NeedsVerificationError";
    this.email = email;
  }
}

export interface AuthService {
  login(username: string, password: string): Promise<Session>;
  /** 注册新账号,成功后需查收激活邮件;抛错消息可直接展示 */
  register(input: RegisterInput): Promise<RegisterResult>;
  /** 按邮箱重发激活邮件(服务端不区分邮箱是否存在,防枚举) */
  resendVerification(email: string): Promise<{ message: string; devActivationUrl?: string }>;
  loginWithProvider(provider: OAuthProviderId): void;
  /** 从服务端拉取会话并更新本地镜像;未登录返回 null */
  syncFromServer(): Promise<Session | null>;
  logout(): Promise<void>;
  getSession(): Session | null;
  /** 当前用户的稳定标识("provider:username"),本地数据按此隔离;未登录返回 null */
  getOwnerKey(): string | null;
}

export function ownerKeyOf(session: Session): string {
  return `${session.provider ?? "password"}:${session.username}`;
}

const SESSION_KEY = "copycut.session";

class ApiAuthService implements AuthService {
  async login(username: string, password: string): Promise<Session> {
    if (!username.trim() || !password.trim()) {
      throw new Error("请输入用户名和密码");
    }
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json()) as {
      session?: Session;
      error?: string;
      needsVerification?: boolean;
      email?: string;
    };
    if (!res.ok || !data.session) {
      if (data.needsVerification) {
        throw new NeedsVerificationError(data.error ?? "请先查收邮件激活账号", data.email);
      }
      throw new Error(data.error ?? "登录失败");
    }
    this.setMirror(data.session);
    return data.session;
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as RegisterResult & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "注册失败");
    }
    return { email: data.email, devActivationUrl: data.devActivationUrl, mailError: data.mailError };
  }

  async resendVerification(email: string): Promise<{ message: string; devActivationUrl?: string }> {
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      message?: string;
      devActivationUrl?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "发送失败,请稍后重试");
    }
    return { message: data.message ?? "激活邮件已发送", devActivationUrl: data.devActivationUrl };
  }

  loginWithProvider(provider: OAuthProviderId): void {
    window.location.assign(`/api/auth/${provider}/start`);
  }

  async syncFromServer(): Promise<Session | null> {
    const res = await fetch("/api/auth/session");
    if (!res.ok) return null;
    const data = (await res.json()) as { session?: Session | null };
    if (data.session) {
      this.setMirror(data.session);
      return data.session;
    }
    localStorage.removeItem(SESSION_KEY);
    return null;
  }

  async logout(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
    await fetch("/api/auth/logout", { method: "POST" });
  }

  private setMirror(session: Session): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  getOwnerKey(): string | null {
    const session = this.getSession();
    return session ? ownerKeyOf(session) : null;
  }

  // 按原始字符串缓存解析结果,保证同一 session 返回同一引用
  // (useSyncExternalStore 的 getSnapshot 要求稳定快照)
  private cacheRaw: string | null = null;
  private cacheSession: Session | null = null;

  getSession(): Session | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw !== this.cacheRaw) {
      this.cacheRaw = raw;
      try {
        this.cacheSession = raw ? (JSON.parse(raw) as Session) : null;
      } catch {
        this.cacheSession = null;
      }
    }
    return this.cacheSession;
  }
}

export const authService: AuthService = new ApiAuthService();
