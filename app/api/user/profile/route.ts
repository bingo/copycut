import type { Session } from "@/lib/types";
import { createSession } from "@/lib/server/session";
import { requireUser, sanitizeUser } from "@/lib/server/current-user";
import { updateUser, type UserRecord } from "@/lib/server/users";
import { ownerKeyOf } from "@/lib/services/auth";

/**
 * 当前用户资料:
 * GET   返回资料(已剔除敏感字段)
 * PATCH 更新 name / bio / avatarUrl / username;
 *       改 username 会同步刷新 Session cookie(草稿 ownerKey 含 username,
 *       历史草稿会与新账号脱钩,界面上已作警告)
 */

const USERNAME_MAX = 30;
const NAME_MAX = 30;
const BIO_MAX = 200;

export async function GET() {
  const ctx = await requireUser();
  if (!ctx) return Response.json({ error: "未登录" }, { status: 401 });
  return Response.json({ user: sanitizeUser(ctx.user) });
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function PATCH(request: Request) {
  const ctx = await requireUser();
  if (!ctx) return Response.json({ error: "未登录" }, { status: 401 });
  const { session, user } = ctx;

  let body: { name?: unknown; bio?: unknown; avatarUrl?: unknown; username?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const patch: Partial<Omit<UserRecord, "id" | "createdAt">> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return Response.json({ error: "昵称格式错误" }, { status: 400 });
    }
    const name = body.name.trim();
    if (name.length > NAME_MAX) {
      return Response.json({ error: `昵称最多 ${NAME_MAX} 个字符` }, { status: 400 });
    }
    patch.name = name || undefined;
  }

  if (body.bio !== undefined) {
    if (typeof body.bio !== "string") {
      return Response.json({ error: "简介格式错误" }, { status: 400 });
    }
    const bio = body.bio.trim();
    if (bio.length > BIO_MAX) {
      return Response.json({ error: `简介最多 ${BIO_MAX} 个字符` }, { status: 400 });
    }
    patch.bio = bio || undefined;
  }

  if (body.avatarUrl !== undefined) {
    if (typeof body.avatarUrl !== "string") {
      return Response.json({ error: "头像地址格式错误" }, { status: 400 });
    }
    const avatarUrl = body.avatarUrl.trim();
    if (avatarUrl && !isValidHttpUrl(avatarUrl)) {
      return Response.json({ error: "头像地址需为 http(s) 链接" }, { status: 400 });
    }
    patch.avatarUrl = avatarUrl || undefined;
  }

  let usernameChanged = false;
  if (body.username !== undefined) {
    if (typeof body.username !== "string") {
      return Response.json({ error: "用户名格式错误" }, { status: 400 });
    }
    const username = body.username.trim();
    if (!username) {
      return Response.json({ error: "用户名不能为空" }, { status: 400 });
    }
    if (username.length > USERNAME_MAX) {
      return Response.json({ error: `用户名最多 ${USERNAME_MAX} 个字符` }, { status: 400 });
    }
    if (username !== user.username) {
      patch.username = username;
      usernameChanged = true;
    }
  }

  let updated: UserRecord;
  try {
    if (usernameChanged && patch.username) {
      // 用户名变了,登录身份("provider:username")跟着变,追加新身份保留旧记录可查
      const newSession: Session = { ...session, username: patch.username };
      const identity = ownerKeyOf(newSession);
      if (!user.identities.includes(identity)) {
        patch.identities = [...user.identities, identity];
      }
    }
    updated = updateUser(user.id, patch);
  } catch (err) {
    // 唯一性冲突等业务错误(如"该用户名已被占用")
    return Response.json(
      { error: err instanceof Error ? err.message : "保存失败" },
      { status: 409 }
    );
  }

  // 同步刷新会话 cookie,保证首页用户区、草稿 ownerKey 立即用上新资料
  const nextSession: Session = {
    ...session,
    userId: updated.id,
    username: updated.username,
    name: updated.name,
    avatarUrl: updated.avatarUrl,
  };
  await createSession(nextSession);

  return Response.json({ user: sanitizeUser(updated), session: nextSession });
}
