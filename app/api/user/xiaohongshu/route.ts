import { requireUser, sanitizeUser } from "@/lib/server/current-user";
import { updateUser, type XiaohongshuAccount } from "@/lib/server/users";

/**
 * 小红书账号绑定(为后续"直接发布到小红书"集成打基础):
 * POST   绑定,body { nickname, xhsUserId?, credential? };
 *        credential(cookie 等登录凭证)只存服务端,任何响应都不回传
 * DELETE 解绑
 */

const NICKNAME_MAX = 30;

export async function POST(request: Request) {
  const ctx = await requireUser();
  if (!ctx) return Response.json({ error: "未登录" }, { status: 401 });
  const { user } = ctx;

  let body: { nickname?: unknown; xhsUserId?: unknown; credential?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  if (!nickname) {
    return Response.json({ error: "请填写小红书昵称" }, { status: 400 });
  }
  if (nickname.length > NICKNAME_MAX) {
    return Response.json({ error: `昵称最多 ${NICKNAME_MAX} 个字符` }, { status: 400 });
  }
  const xhsUserId =
    typeof body.xhsUserId === "string" ? body.xhsUserId.trim() : "";
  const credential =
    typeof body.credential === "string" ? body.credential.trim() : "";

  const account: XiaohongshuAccount = {
    nickname,
    xhsUserId: xhsUserId || undefined,
    credential: credential || undefined,
    boundAt: Date.now(),
  };
  const updated = updateUser(user.id, { xiaohongshu: account });
  // sanitizeUser 已剔除 credential,凭证永不回传
  return Response.json({ user: sanitizeUser(updated) });
}

export async function DELETE() {
  const ctx = await requireUser();
  if (!ctx) return Response.json({ error: "未登录" }, { status: 401 });
  const { user } = ctx;

  if (!user.xiaohongshu) {
    return Response.json({ error: "尚未绑定小红书账号" }, { status: 400 });
  }
  const updated = updateUser(user.id, { xiaohongshu: undefined });
  return Response.json({ user: sanitizeUser(updated) });
}
