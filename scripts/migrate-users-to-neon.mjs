import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("DATABASE_URL is required. Pull it with `vercel env pull .env.local` or export it.");
  process.exit(1);
}

const dataFile = join(process.cwd(), ".data", "users.json");

if (!existsSync(dataFile)) {
  console.log("No .data/users.json found; nothing to migrate.");
  process.exit(0);
}

const users = JSON.parse(readFileSync(dataFile, "utf8"));
if (!Array.isArray(users)) {
  console.error(".data/users.json must contain a JSON array.");
  process.exit(1);
}

const sql = neon(databaseUrl);

await sql`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    username TEXT NOT NULL UNIQUE,
    name TEXT,
    avatar_url TEXT,
    bio TEXT,
    password_hash TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token_hash TEXT,
    verification_expires_at BIGINT,
    verification_plain_token TEXT,
    identities TEXT[] NOT NULL DEFAULT '{}',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS users_verification_token_hash_idx
  ON users (verification_token_hash)
`;

await sql`
  CREATE INDEX IF NOT EXISTS users_identities_gin_idx
  ON users USING GIN (identities)
`;

let migrated = 0;

for (const user of users) {
  if (!user?.id || !user?.username) {
    console.warn("Skipping invalid user record without id/username.");
    continue;
  }

  const tokenHash =
    user.verification?.tokenHash ??
    (user.verification?.token
      ? createHash("sha256").update(user.verification.token).digest("hex")
      : null);

  await sql`
    INSERT INTO users (
      id, email, username, name, avatar_url, bio, password_hash, email_verified,
      verification_token_hash, verification_expires_at, verification_plain_token,
      identities, created_at, updated_at
    )
    VALUES (
      ${user.id},
      ${user.email?.trim().toLowerCase() || null},
      ${user.username},
      ${user.name ?? null},
      ${user.avatarUrl ?? null},
      ${user.bio ?? null},
      ${user.passwordHash ?? null},
      ${Boolean(user.emailVerified)},
      ${tokenHash},
      ${user.verification?.expiresAt ?? null},
      ${null},
      ${Array.isArray(user.identities) ? user.identities : []},
      ${Number(user.createdAt ?? Date.now())},
      ${Number(user.updatedAt ?? Date.now())}
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
      verification_plain_token = NULL,
      identities = EXCLUDED.identities,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at
  `;
  migrated += 1;
}

console.log(`Migrated ${migrated} user record(s) to Neon Postgres.`);
