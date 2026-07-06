import type { Session } from "../types";
import { readSession } from "./session";
import { getOrCreateUserForSession, type UserRecord } from "./users";

/**
 * 设置页等"当前用户"API 的公共辅助:
 * 由会话解析用户记录,并把 UserRecord 裁剪成可下发客户端的安全形态
 * (剔除 passwordHash、verification、小红书凭证等敏感字段)。
 */

/** 小红书绑定信息的安全形态:凭证永不下发,仅告知是否已填 */
export interface SafeXiaohongshu {
  nickname: string;
  xhsUserId?: string;
  boundAt: number;
  hasCredential: boolean;
}

/** 用户资料的安全形态(下发客户端用) */
export interface SafeUser {
  id: string;
  email?: string;
  username: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  emailVerified: boolean;
  identities: string[];
  /** 是否已设置密码(纯 OAuth 用户为 false,可直接设置首个密码) */
  hasPassword: boolean;
  xiaohongshu?: SafeXiaohongshu;
  createdAt: number;
  updatedAt: number;
}

export function sanitizeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    emailVerified: user.emailVerified,
    identities: user.identities,
    hasPassword: Boolean(user.passwordHash),
    xiaohongshu: user.xiaohongshu
      ? {
          nickname: user.xiaohongshu.nickname,
          xhsUserId: user.xiaohongshu.xhsUserId,
          boundAt: user.xiaohongshu.boundAt,
          hasCredential: Boolean(user.xiaohongshu.credential),
        }
      : undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** 读取当前会话并解析用户记录;未登录返回 null(调用方回 401) */
export async function requireUser(): Promise<{ session: Session; user: UserRecord } | null> {
  const session = await readSession();
  if (!session) return null;
  return { session, user: getOrCreateUserForSession(session) };
}
