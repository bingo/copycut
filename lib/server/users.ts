import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Session } from "../types";
import { ownerKeyOf } from "../services/auth";

/**
 * 服务端用户存储:JSON 文件落盘于 .data/users.json(已 gitignore)。
 * 本地单进程使用,同步读写 + 临时文件原子替换,不考虑多进程并发。
 * 部署到无持久磁盘的环境(如 Vercel)前需替换为数据库。
 */

export interface XiaohongshuAccount {
  /** 小红书昵称(展示用) */
  nickname: string;
  /** 小红书用户 id,选填 */
  xhsUserId?: string;
  /** 登录态凭证(cookie 等),仅服务端保存,永不下发客户端 */
  credential?: string;
  boundAt: number;
}

export interface UserRecord {
  id: string;
  /** 小写归一;OAuth 用户可能没有邮箱 */
  email?: string;
  /** 登录名/展示名,唯一 */
  username: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  /** scrypt 格式 "saltHex:hashHex";纯 OAuth 用户为空 */
  passwordHash?: string;
  /** 邮箱是否已验证激活;false 时不允许密码登录 */
  emailVerified: boolean;
  /** 邮箱验证 token(注册激活/改绑邮箱用) */
  verification?: { token: string; expiresAt: number };
  /** 关联的登录身份,格式 "provider:username",与草稿 ownerKey 同构 */
  identities: string[];
  xiaohongshu?: XiaohongshuAccount;
  createdAt: number;
  updatedAt: number;
}

const DATA_FILE = join(process.cwd(), ".data", "users.json");

/** 测试用预设账号,与历史硬编码登录保持兼容 */
const PRESET_ADMIN: Omit<UserRecord, "createdAt" | "updatedAt"> = {
  id: "preset-admin",
  email: "admin@copycut.local",
  username: "admin",
  emailVerified: true,
  identities: ["password:admin"],
  passwordHash: hashPassword("passw0rd"),
};

function load(): UserRecord[] {
  try {
    const raw = readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw) as UserRecord[];
  } catch {
    const now = Date.now();
    const seeded = [{ ...PRESET_ADMIN, createdAt: now, updatedAt: now }];
    save(seeded);
    return seeded;
  }
}

function save(users: UserRecord[]): void {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(users, null, 2));
  renameSync(tmp, DATA_FILE);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function getUserById(id: string): UserRecord | null {
  return load().find((u) => u.id === id) ?? null;
}

export function getUserByEmail(email: string): UserRecord | null {
  const key = email.trim().toLowerCase();
  return load().find((u) => u.email === key) ?? null;
}

export function getUserByUsername(username: string): UserRecord | null {
  return load().find((u) => u.username === username) ?? null;
}

export function getUserByIdentity(identity: string): UserRecord | null {
  return load().find((u) => u.identities.includes(identity)) ?? null;
}

export function createUser(
  input: Omit<UserRecord, "id" | "createdAt" | "updatedAt">
): UserRecord {
  const users = load();
  const email = input.email?.trim().toLowerCase();
  if (email && users.some((u) => u.email === email)) {
    throw new Error("该邮箱已注册");
  }
  if (users.some((u) => u.username === input.username)) {
    throw new Error("该用户名已被占用");
  }
  const now = Date.now();
  const user: UserRecord = { ...input, email, id: randomUUID(), createdAt: now, updatedAt: now };
  users.push(user);
  save(users);
  return user;
}

export function updateUser(
  id: string,
  patch: Partial<Omit<UserRecord, "id" | "createdAt">>
): UserRecord {
  const users = load();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) throw new Error("用户不存在");
  if (patch.email) {
    const email = patch.email.trim().toLowerCase();
    if (users.some((u) => u.id !== id && u.email === email)) {
      throw new Error("该邮箱已被其他账号使用");
    }
    patch = { ...patch, email };
  }
  if (patch.username && users.some((u) => u.id !== id && u.username === patch.username)) {
    throw new Error("该用户名已被占用");
  }
  users[idx] = { ...users[idx], ...patch, updatedAt: Date.now() };
  save(users);
  return users[idx];
}

/**
 * 由当前会话解析用户记录;OAuth/预设账号首次访问时自动建档,
 * 保证设置页等功能对所有登录方式可用。
 */
export function getOrCreateUserForSession(session: Session): UserRecord {
  if (session.userId) {
    const byId = getUserById(session.userId);
    if (byId) return byId;
  }
  const identity = ownerKeyOf(session);
  const byIdentity = getUserByIdentity(identity);
  if (byIdentity) return byIdentity;
  if (session.email) {
    const byEmail = getUserByEmail(session.email);
    if (byEmail) {
      // 同邮箱的新登录方式,合并进已有账号
      return updateUser(byEmail.id, { identities: [...byEmail.identities, identity] });
    }
  }
  // 用户名冲突时加 provider 后缀保证唯一
  const base = session.username;
  const username = getUserByUsername(base) ? `${base}@${session.provider ?? "password"}` : base;
  return createUser({
    email: session.email,
    username,
    name: session.name,
    avatarUrl: session.avatarUrl,
    emailVerified: Boolean(session.email),
    identities: [identity],
  });
}
