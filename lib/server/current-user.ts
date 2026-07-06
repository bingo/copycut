import type { Session } from "../types";
import { readSession } from "./session";
import { getOrCreateUserForSession, type UserRecord } from "./users";

/**
 * 设置页等"当前用户"API 的公共辅助:
 * 由会话解析用户记录,并把 UserRecord 裁剪成可下发客户端的安全形态
 * (剔除 passwordHash、verification 等敏感字段)。
 */

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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** 读取当前会话并解析用户记录;未登录返回 null(调用方回 401) */
export async function requireUser(): Promise<{ session: Session; user: UserRecord } | null> {
  const session = await readSession();
  if (!session) return null;
  return { session, user: await getOrCreateUserForSession(session) };
}
