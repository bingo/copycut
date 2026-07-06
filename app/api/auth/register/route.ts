import {
  createUser,
  getUserByEmail,
  getUserByUsername,
  hashPassword,
} from "@/lib/server/users";
import { sendActivationEmail } from "@/lib/server/mailer";

/**
 * 注册:email + username + password,创建 emailVerified=false 的用户,
 * 签发 24h 有效的激活 token 并发送激活邮件。激活成功前不允许密码登录。
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 用户名:2-24 位字母/数字/下划线/中划线;禁止 @,登录时以 @ 区分邮箱 */
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{2,24}$/;

function validate(email: string, username: string, password: string): string | null {
  if (!email || !username || !password) return "请填写邮箱、用户名和密码";
  if (!EMAIL_PATTERN.test(email)) return "邮箱格式不正确";
  if (!USERNAME_PATTERN.test(username)) {
    return "用户名需为 2-24 位字母、数字、下划线或中划线";
  }
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "密码至少 8 位,且需同时包含字母和数字";
  }
  return null;
}

export async function POST(request: Request) {
  let email = "";
  let username = "";
  let password = "";
  try {
    const body = (await request.json()) as {
      email?: unknown;
      username?: unknown;
      password?: unknown;
    };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    username = typeof body.username === "string" ? body.username.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const invalid = validate(email, username, password);
  if (invalid) {
    return Response.json({ error: invalid }, { status: 400 });
  }
  if (getUserByEmail(email)) {
    return Response.json({ error: "该邮箱已注册" }, { status: 409 });
  }
  if (getUserByUsername(username)) {
    return Response.json({ error: "该用户名已被占用" }, { status: 409 });
  }

  const user = createUser({
    email,
    username,
    passwordHash: hashPassword(password),
    emailVerified: false,
    identities: [`password:${username}`],
  });

  try {
    const mail = await sendActivationEmail(user, new URL(request.url).origin);
    return Response.json(
      {
        ok: true,
        email,
        // 本地开发(未配置 RESEND_API_KEY)时直接返回激活链接
        devActivationUrl: mail.devActivationUrl,
      },
      { status: 201 }
    );
  } catch (err) {
    // 账号已创建但邮件发送失败,引导用户走"重发激活邮件"
    const message = err instanceof Error ? err.message : "激活邮件发送失败";
    return Response.json(
      { ok: true, email, mailError: `${message},可稍后在登录页重发` },
      { status: 201 }
    );
  }
}
