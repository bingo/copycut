import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("DATABASE_URL is required. Pull it with `vercel env pull .env.local` or export it.");
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

console.log("users table is ready");
