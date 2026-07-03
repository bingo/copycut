import type { Session } from "../types";

/**
 * 认证服务接口。Step 2 用 localStorage mock，Step 3 替换为真实后端实现，
 * UI 层只依赖此接口。
 */
export interface AuthService {
  login(username: string, password: string): Promise<Session>;
  logout(): Promise<void>;
  getSession(): Session | null;
}

const SESSION_KEY = "copycut.session";

class LocalAuthService implements AuthService {
  async login(username: string, password: string): Promise<Session> {
    if (!username.trim() || !password.trim()) {
      throw new Error("请输入用户名和密码");
    }
    const session: Session = { username: username.trim(), loginAt: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  async logout(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
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

export const authService: AuthService = new LocalAuthService();
