import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { Session } from "../types";
import { ownerKeyOf } from "../services/auth";
import { ensureUserSchema, getSql } from "./db";

/**
 * 服务端用户存储:Neon Postgres 持久化,适配 Vercel Serverless。
 * 保持本模块对上层暴露的业务语义,避免路由层了解数据库细节。
 */

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
  /** 邮箱验证 token 哈希(注册激活/改绑邮箱用);不落盘保存明文 token */
  verification?: { tokenHash?: string; expiresAt: number; token?: string };
  /** 关联的登录身份,格式 "provider:username",与草稿 ownerKey 同构 */
  identities: string[];
  createdAt: number;
  updatedAt: number;
}

/** 测试用预设账号,与历史硬编码登录保持兼容 */
const PRESET_ADMIN: Omit<UserRecord, "createdAt" | "updatedAt"> = {
  id: "preset-admin",
  email: "admin@copycut.local",
  username: "admin",
  emailVerified: true,
  identities: ["password:admin"],
  passwordHash: hashPassword("passw0rd"),
};

type UserRow = {
  id: string;
  email: string | null;
  username: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  password_hash: string | null;
  email_verified: boolean;
  verification_token_hash: string | null;
  verification_expires_at: string | number | null;
  verification_plain_token: string | null;
  identities: string[] | null;
  created_at: string | number;
  updated_at: string | number;
};

let presetSeeded: Promise<void> | null = null;

function normalizeEmail(email: string | undefined): string | undefined {
  return email?.trim().toLowerCase() || undefined;
}

function rowToUser(row: UserRow): UserRecord {
  const verification =
    row.verification_token_hash || row.verification_plain_token || row.verification_expires_at
      ? {
          tokenHash: row.verification_token_hash ?? undefined,
          expiresAt: Number(row.verification_expires_at ?? 0),
          token: row.verification_plain_token ?? undefined,
        }
      : undefined;

  return {
    id: row.id,
    email: row.email ?? undefined,
    username: row.username,
    name: row.name ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    passwordHash: row.password_hash ?? undefined,
    emailVerified: row.email_verified,
    verification,
    identities: row.identities ?? [],
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

async function seedPresetAdmin(): Promise<void> {
  const now = Date.now();
  const sql = getSql();
  await sql`
    INSERT INTO users (
      id, email, username, password_hash, email_verified, identities, created_at, updated_at
    )
    VALUES (
      ${PRESET_ADMIN.id},
      ${PRESET_ADMIN.email ?? null},
      ${PRESET_ADMIN.username},
      ${PRESET_ADMIN.passwordHash ?? null},
      ${PRESET_ADMIN.emailVerified},
      ${PRESET_ADMIN.identities},
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

async function ready(): Promise<void> {
  await ensureUserSchema();
  presetSeeded ??= seedPresetAdmin();
  await presetSeeded;
}

async function findOne(query: Promise<Record<string, unknown>[]>): Promise<UserRecord | null> {
  const rows = await query;
  return rows[0] ? rowToUser(rows[0] as UserRow) : null;
}

function verificationColumns(verification: UserRecord["verification"] | undefined): {
  tokenHash: string | null;
  expiresAt: number | null;
  token: string | null;
} {
  return {
    tokenHash: verification?.tokenHash ?? null,
    expiresAt: verification?.expiresAt ?? null,
    token: verification?.token ?? null,
  };
}

export async function upsertUserForMigration(user: UserRecord): Promise<UserRecord> {
  await ready();
  const sql = getSql();
  const verification = verificationColumns(user.verification);
  const rows = await sql`
    INSERT INTO users (
      id, email, username, name, avatar_url, bio, password_hash, email_verified,
      verification_token_hash, verification_expires_at, verification_plain_token,
      identities, created_at, updated_at
    )
    VALUES (
      ${user.id},
      ${normalizeEmail(user.email) ?? null},
      ${user.username},
      ${user.name ?? null},
      ${user.avatarUrl ?? null},
      ${user.bio ?? null},
      ${user.passwordHash ?? null},
      ${user.emailVerified},
      ${verification.tokenHash},
      ${verification.expiresAt},
      ${verification.token},
      ${user.identities},
      ${user.createdAt},
      ${user.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      username = EXCLUDED.username,
      name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url,
      bio = EXCLUDED.bio,
      password_hash = EXCLUDED.password_hash,
      email_verified = EXCLUDED.email_verified,
      verification_token_hash = EXCLUDED.verification_token_hash,
      verification_expires_at = EXCLUDED.verification_expires_at,
      verification_plain_token = EXCLUDED.verification_plain_token,
      identities = EXCLUDED.identities,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `;
  return rowToUser(rows[0] as UserRow);
}

export async function hashLegacyPlainVerificationTokens(): Promise<number> {
  await ready();
  const sql = getSql();
  const rows = await sql`
    SELECT id, verification_plain_token
    FROM users
    WHERE verification_plain_token IS NOT NULL
      AND verification_token_hash IS NULL
  `;
  let migrated = 0;
  for (const row of rows as Array<{ id: string; verification_plain_token: string }>) {
    await sql`
      UPDATE users
      SET verification_token_hash = ${hashVerificationToken(row.verification_plain_token)},
          verification_plain_token = NULL,
          updated_at = ${Date.now()}
      WHERE id = ${row.id}
    `;
    migrated += 1;
  }
  return migrated;
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

export async function getUserById(id: string): Promise<UserRecord | null> {
  await ready();
  return findOne(getSql()`SELECT * FROM users WHERE id = ${id} LIMIT 1`);
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  await ready();
  const key = email.trim().toLowerCase();
  return findOne(getSql()`SELECT * FROM users WHERE email = ${key} LIMIT 1`);
}

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
  await ready();
  return findOne(getSql()`SELECT * FROM users WHERE username = ${username} LIMIT 1`);
}

export async function getUserByIdentity(identity: string): Promise<UserRecord | null> {
  await ready();
  return findOne(getSql()`SELECT * FROM users WHERE identities @> ${[identity]} LIMIT 1`);
}

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqualText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** 按邮箱验证 token 查找用户(注册激活用);timingSafeEqual 比较防时序泄露 */
export async function getUserByVerificationToken(token: string): Promise<UserRecord | null> {
  await ready();
  const targetHash = hashVerificationToken(token);
  const rows = await getSql()`
    SELECT * FROM users
    WHERE verification_token_hash = ${targetHash}
       OR verification_plain_token = ${token}
  `;
  return (
    (rows as UserRow[])
      .map(rowToUser)
      .find((u) => {
        if (!u.verification) return false;
        if (u.verification.tokenHash && safeEqualText(u.verification.tokenHash, targetHash)) {
          return true;
        }
        // 兼容历史本地数据:旧版本曾短暂保存明文 token。
        return Boolean(u.verification.token && safeEqualText(u.verification.token, token));
      }) ?? null
  );
}

export async function createUser(
  input: Omit<UserRecord, "id" | "createdAt" | "updatedAt">
): Promise<UserRecord> {
  await ready();
  const email = normalizeEmail(input.email);
  if (email && (await getUserByEmail(email))) {
    throw new Error("该邮箱已注册");
  }
  if (await getUserByUsername(input.username)) {
    throw new Error("该用户名已被占用");
  }
  const now = Date.now();
  const verification = verificationColumns(input.verification);
  const rows = await getSql()`
    INSERT INTO users (
      id, email, username, name, avatar_url, bio, password_hash, email_verified,
      verification_token_hash, verification_expires_at, verification_plain_token,
      identities, created_at, updated_at
    )
    VALUES (
      ${randomUUID()},
      ${email ?? null},
      ${input.username},
      ${input.name ?? null},
      ${input.avatarUrl ?? null},
      ${input.bio ?? null},
      ${input.passwordHash ?? null},
      ${input.emailVerified},
      ${verification.tokenHash},
      ${verification.expiresAt},
      ${verification.token},
      ${input.identities},
      ${now},
      ${now}
    )
    RETURNING *
  `;
  return rowToUser(rows[0] as UserRow);
}

export async function updateUser(
  id: string,
  patch: Partial<Omit<UserRecord, "id" | "createdAt">>
): Promise<UserRecord> {
  await ready();
  const existing = await getUserById(id);
  if (!existing) throw new Error("用户不存在");
  if (patch.email) {
    const email = patch.email.trim().toLowerCase();
    const owner = await getUserByEmail(email);
    if (owner && owner.id !== id) {
      throw new Error("该邮箱已被其他账号使用");
    }
    patch = { ...patch, email };
  }
  if (patch.username) {
    const owner = await getUserByUsername(patch.username);
    if (owner && owner.id !== id) {
      throw new Error("该用户名已被占用");
    }
  }

  const next: UserRecord = { ...existing, ...patch, updatedAt: Date.now() };
  const verification = verificationColumns(next.verification);
  const rows = await getSql()`
    UPDATE users
    SET
      email = ${next.email ?? null},
      username = ${next.username},
      name = ${next.name ?? null},
      avatar_url = ${next.avatarUrl ?? null},
      bio = ${next.bio ?? null},
      password_hash = ${next.passwordHash ?? null},
      email_verified = ${next.emailVerified},
      verification_token_hash = ${verification.tokenHash},
      verification_expires_at = ${verification.expiresAt},
      verification_plain_token = ${verification.token},
      identities = ${next.identities},
      updated_at = ${next.updatedAt}
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToUser(rows[0] as UserRow);
}

/**
 * 由当前会话解析用户记录;OAuth/预设账号首次访问时自动建档,
 * 保证设置页等功能对所有登录方式可用。
 */
export async function getOrCreateUserForSession(session: Session): Promise<UserRecord> {
  if (session.userId) {
    const byId = await getUserById(session.userId);
    if (byId) return byId;
  }
  const identity = ownerKeyOf(session);
  const byIdentity = await getUserByIdentity(identity);
  if (byIdentity) return byIdentity;
  if (session.email) {
    const byEmail = await getUserByEmail(session.email);
    if (byEmail) {
      // 同邮箱的新登录方式,合并进已有账号
      return updateUser(byEmail.id, { identities: [...byEmail.identities, identity] });
    }
  }
  // 用户名冲突时加 provider 后缀保证唯一
  const base = session.username;
  const username = (await getUserByUsername(base))
    ? `${base}@${session.provider ?? "password"}`
    : base;
  return createUser({
    email: session.email,
    username,
    name: session.name,
    avatarUrl: session.avatarUrl,
    emailVerified: Boolean(session.email),
    identities: [identity],
  });
}
