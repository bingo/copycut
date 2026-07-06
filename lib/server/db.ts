import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

let sqlClient: Sql | null = null;
let schemaReady: Promise<void> | null = null;

export function getSql(): Sql {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error("DATABASE_URL 未配置,请先在 Vercel Marketplace 安装 Neon Postgres");
    }
    sqlClient = neon(url);
  }
  return sqlClient;
}

export async function ensureUserSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = (async () => {
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
    })();
  }
  return schemaReady;
}
