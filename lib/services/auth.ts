import type { OAuthProviderId, Session } from "../types";

export type { OAuthProviderId };

/**
 * 认证服务:真实会话在服务端 httpOnly cookie(见 lib/server/session.ts),
 * localStorage 仅存一份镜像供 AuthGuard 同步读取。
 * OAuth 登录跳转到 /api/auth/{provider}/start,回调落回 /login 后
 * 由 syncFromServer() 把服务端会话同步进镜像。
 */
export interface AuthService {
  login(username: string, password: string): Promise<Session>;
  loginWithProvider(provider: OAuthProviderId): void;
  /** 从服务端拉取会话并更新本地镜像;未登录返回 null */
  syncFromServer(): Promise<Session | null>;
  logout(): Promise<void>;
  getSession(): Session | null;
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
    const data = (await res.json()) as { session?: Session; error?: string };
    if (!res.ok || !data.session) {
      throw new Error(data.error ?? "登录失败");
    }
    this.setMirror(data.session);
    return data.session;
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
