import { getUserByEmail } from "@/lib/server/users";
import { sendActivationEmail } from "@/lib/server/mailer";

/**
 * 重发激活邮件:按 email 查找未激活账号,重新签发 token 并发送。
 * 无论邮箱是否存在/是否已激活都返回同样的成功提示,防止账号枚举。
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_MS = 60 * 1000;
const resendAttempts = new Map<string, number>();

export async function POST(request: Request) {
  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
  if (!email) {
    return Response.json({ error: "请输入邮箱" }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return Response.json({ error: "邮箱格式不正确" }, { status: 400 });
  }

  const message = "若该邮箱已注册且未激活,激活邮件已重新发送,请查收";
  const lastSentAt = resendAttempts.get(email) ?? 0;
  if (Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
    return Response.json({ ok: true, message: "请求过于频繁,请稍后再试" });
  }

  const user = await getUserByEmail(email);
  if (!user || user.emailVerified) {
    return Response.json({ ok: true, message });
  }

  try {
    resendAttempts.set(email, Date.now());
    const mail = await sendActivationEmail(user, request.url);
    return Response.json({ ok: true, message, devActivationUrl: mail.devActivationUrl });
  } catch (err) {
    resendAttempts.delete(email);
    const detail = err instanceof Error ? err.message : "激活邮件发送失败";
    return Response.json({ error: detail }, { status: 502 });
  }
}
