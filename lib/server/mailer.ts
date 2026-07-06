import { randomBytes } from "node:crypto";
import { updateUser, type UserRecord } from "./users";

/**
 * 激活邮件发送:配置了 RESEND_API_KEY 时直接 fetch Resend HTTP API
 * 发真实邮件(不引入依赖包);未配置时(本地开发)把激活链接打印到
 * 服务端 console,并通过返回值透出给接口,方便本地走通注册→激活闭环。
 */

/** 激活 token 有效期:24 小时 */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const RESEND_API_URL = "https://api.resend.com/emails";

/** 未配置 MAIL_FROM 时用 Resend 的测试发件地址(仅能发给自己账号的邮箱) */
const DEFAULT_MAIL_FROM = "CopyCut <onboarding@resend.dev>";

export interface ActivationResult {
  /** 是否经由 Resend 真实发出 */
  delivered: boolean;
  /** 未配置邮件服务时返回激活链接,便于本地开发直接点击激活 */
  devActivationUrl?: string;
}

/**
 * 为用户签发新的激活 token(覆盖旧 token)并发送激活邮件。
 * @param origin 站点源地址(如 http://localhost:3000),用于拼激活链接
 */
export async function sendActivationEmail(
  user: UserRecord,
  origin: string
): Promise<ActivationResult> {
  if (!user.email) throw new Error("该账号没有邮箱,无法发送激活邮件");

  const token = randomBytes(32).toString("hex");
  updateUser(user.id, {
    verification: { token, expiresAt: Date.now() + TOKEN_TTL_MS },
  });
  const activationUrl = `${origin}/verify?token=${token}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[mailer] 未配置 RESEND_API_KEY,不发真实邮件。${user.email} 的激活链接:\n  ${activationUrl}`
    );
    return { delivered: false, devActivationUrl: activationUrl };
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? DEFAULT_MAIL_FROM,
      to: [user.email],
      subject: "激活你的 CopyCut 账号",
      html: [
        `<p>你好${user.username ? `,${escapeHtml(user.username)}` : ""}:</p>`,
        `<p>感谢注册 CopyCut(小红书创作者的轻量剪辑工具)。请点击下方链接激活账号,链接 24 小时内有效:</p>`,
        `<p><a href="${activationUrl}">${activationUrl}</a></p>`,
        `<p>如果这不是你的操作,请忽略本邮件。</p>`,
      ].join("\n"),
      text: `请打开以下链接激活你的 CopyCut 账号(24 小时内有效):\n${activationUrl}\n\n如果这不是你的操作,请忽略本邮件。`,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[mailer] Resend 发送失败(${res.status}):${detail}`);
    throw new Error("激活邮件发送失败,请稍后重试");
  }
  return { delivered: true };
}

/** 用户名会拼进 HTML 邮件正文,转义防注入 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
