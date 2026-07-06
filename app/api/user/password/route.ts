import { requireUser } from "@/lib/server/current-user";
import { hashPassword, updateUser, verifyPassword } from "@/lib/server/users";

/**
 * 修改/设置密码:
 * - 已有密码的账号必须先验证当前密码
 * - 纯 OAuth 用户(无 passwordHash)可直接设置首个密码
 * - 新密码至少 8 位且同时包含字母和数字
 */

function validateNewPassword(password: string): string | null {
  if (password.length < 8) return "新密码至少需要 8 位";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "新密码需同时包含字母和数字";
  }
  return null;
}

export async function POST(request: Request) {
  const ctx = await requireUser();
  if (!ctx) return Response.json({ error: "未登录" }, { status: 401 });
  const { user } = ctx;

  let currentPassword = "";
  let newPassword = "";
  try {
    const body = (await request.json()) as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };
    currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (user.passwordHash) {
    if (!currentPassword) {
      return Response.json({ error: "请输入当前密码" }, { status: 400 });
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return Response.json({ error: "当前密码错误" }, { status: 403 });
    }
  }

  const invalid = validateNewPassword(newPassword);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  updateUser(user.id, { passwordHash: hashPassword(newPassword) });
  return Response.json({ ok: true });
}
