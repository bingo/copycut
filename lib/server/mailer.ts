import { randomBytes } from "node:crypto";
import { hashVerificationToken, updateUser, type UserRecord } from "./users";
import { getAppOrigin } from "./url";

/**
 * 激活邮件发送:
 * 1. 配置 RESEND_API_KEY 时优先走 Resend HTTP API。
 * 2. 未配置 Resend 但配置 Gmail OAuth 时,用 Gmail API 发临时小流量邮件。
 * 3. 都未配置时(本地开发)把激活链接打印到服务端 console,并通过返回值
 *    透出给接口,方便本地走通注册→激活闭环。
 */

/** 激活 token 有效期:24 小时 */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const RESEND_API_URL = "https://api.resend.com/emails";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

/** 未配置 MAIL_FROM 时用 Resend 的测试发件地址(仅能发给自己账号的邮箱) */
const DEFAULT_MAIL_FROM = "CopyCut <onboarding@resend.dev>";
const DEFAULT_GMAIL_FROM_NAME = "CopyCut";

export interface ActivationResult {
  /** 是否经由真实邮件服务发出 */
  delivered: boolean;
  /** 真实发信通道 */
  provider?: "resend" | "gmail";
  /** 未配置邮件服务时返回激活链接,便于本地开发直接点击激活 */
  devActivationUrl?: string;
}

interface ActivationEmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * 为用户签发新的激活 token(覆盖旧 token)并发送激活邮件。
 * @param requestUrl 当前请求 URL,用于在未配置 APP_URL 时拼激活链接
 */
export async function sendActivationEmail(
  user: UserRecord,
  requestUrl: string
): Promise<ActivationResult> {
  if (!user.email) throw new Error("该账号没有邮箱,无法发送激活邮件");

  const token = randomBytes(32).toString("hex");
  await updateUser(user.id, {
    verification: { tokenHash: hashVerificationToken(token), expiresAt: Date.now() + TOKEN_TTL_MS },
  });
  const activationUrl = `${getAppOrigin(requestUrl)}/verify?token=${token}`;
  const content = buildActivationEmail(user, activationUrl);

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    await sendWithResend(apiKey, user.email, content);
    return { delivered: true, provider: "resend" };
  }

  if (hasAnyGmailConfig()) {
    await sendWithGmail(user.email, content);
    return { delivered: true, provider: "gmail" };
  }

  {
    console.log(
      `[mailer] 未配置 RESEND_API_KEY 或 Gmail 发信配置,不发真实邮件。${user.email} 的激活链接:\n  ${activationUrl}`
    );
    return { delivered: false, devActivationUrl: activationUrl };
  }
}

async function sendWithResend(
  apiKey: string,
  recipient: string,
  content: ActivationEmailContent
): Promise<void> {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? DEFAULT_MAIL_FROM,
      to: [recipient],
      subject: content.subject,
      html: content.html,
      text: content.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[mailer] Resend 发送失败(${res.status}):${detail}`);
    throw new Error("激活邮件发送失败,请稍后重试");
  }
}

async function sendWithGmail(
  recipient: string,
  content: ActivationEmailContent
): Promise<void> {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();
  const fromEmail = process.env.GMAIL_FROM?.trim();

  if (!clientId || !clientSecret || !refreshToken || !fromEmail) {
    throw new Error(
      "Gmail 激活邮件配置不完整,请配置 GMAIL_OAUTH_CLIENT_ID/GMAIL_OAUTH_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/GMAIL_FROM"
    );
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => "");
    console.error(`[mailer] Gmail token 刷新失败(${tokenRes.status}):${detail}`);
    throw new Error("Gmail 激活邮件发送失败,请检查 OAuth 配置");
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    console.error("[mailer] Gmail token 响应缺少 access_token");
    throw new Error("Gmail 激活邮件发送失败,请检查 OAuth 配置");
  }

  const sendRes = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: base64UrlEncode(
        buildMimeMessage({
          from: formatAddress(process.env.GMAIL_FROM_NAME ?? DEFAULT_GMAIL_FROM_NAME, fromEmail),
          to: recipient,
          subject: content.subject,
          text: content.text,
          html: content.html,
        })
      ),
    }),
  });
  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => "");
    console.error(`[mailer] Gmail 发送失败(${sendRes.status}):${detail}`);
    throw new Error("Gmail 激活邮件发送失败,请稍后重试");
  }
}

function hasAnyGmailConfig(): boolean {
  return Boolean(
    process.env.GMAIL_OAUTH_CLIENT_ID ||
      process.env.GMAIL_OAUTH_CLIENT_SECRET ||
      process.env.GMAIL_REFRESH_TOKEN ||
      process.env.GMAIL_FROM
  );
}

function buildActivationEmail(user: UserRecord, activationUrl: string): ActivationEmailContent {
  const subject = "激活你的 CopyCut 账号";
  const html = [
    `<p>你好${user.username ? `,${escapeHtml(user.username)}` : ""}:</p>`,
    `<p>感谢注册 CopyCut(小红书创作者的轻量剪辑工具)。请点击下方链接激活账号,链接 24 小时内有效:</p>`,
    `<p><a href="${activationUrl}">${activationUrl}</a></p>`,
    `<p>如果这不是你的操作,请忽略本邮件。</p>`,
  ].join("\n");
  const text = `请打开以下链接激活你的 CopyCut 账号(24 小时内有效):\n${activationUrl}\n\n如果这不是你的操作,请忽略本邮件。`;

  return { subject, html, text };
}

function buildMimeMessage(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): string {
  const boundary = `copycut-${randomBytes(12).toString("hex")}`;
  return [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function formatAddress(name: string, email: string): string {
  const safeName = name.replace(/[\r\n"]/g, "").trim();
  return safeName ? `${encodeMimeHeader(safeName)} <${email}>` : email;
}

function encodeMimeHeader(value: string): string {
  return /^[\x00-\x7F]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/** 用户名会拼进 HTML 邮件正文,转义防注入 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
