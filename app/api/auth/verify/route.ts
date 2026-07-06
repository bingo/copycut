import { getUserByVerificationToken, updateUser } from "@/lib/server/users";

/**
 * 邮箱激活:校验 token 有效且未过期 → 置 emailVerified=true 并清除 token。
 * 邮件里的链接指向页面 /verify?token=xxx,由页面调用本接口并展示结果。
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return Response.json({ error: "缺少激活令牌" }, { status: 400 });
  }

  const user = getUserByVerificationToken(token);
  if (!user) {
    return Response.json(
      { error: "激活链接无效,可能已被使用或已重新发送过激活邮件" },
      { status: 400 }
    );
  }
  if (!user.verification || user.verification.expiresAt < Date.now()) {
    return Response.json(
      {
        error: "激活链接已过期,请重新发送激活邮件",
        expired: true,
        email: user.email,
      },
      { status: 410 }
    );
  }

  updateUser(user.id, { emailVerified: true, verification: undefined });
  return Response.json({ ok: true, email: user.email });
}
