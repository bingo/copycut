import type { Session } from "@/lib/types";
import { createSession } from "@/lib/server/session";
import {
  getUserByEmail,
  getUserByUsername,
  hashPassword,
  verifyPassword,
} from "@/lib/server/users";

/**
 * 账号密码登录:支持用 email 或 username(含 @ 视为邮箱)+ 密码,
 * 从用户存储(lib/server/users.ts)校验。统一错误消息防止账号枚举;
 * 账号不存在时也跑一次等价的 scrypt 校验,保持耗时一致防时序泄露。
 */

/** 账号不存在时用来"空跑"密码校验的哈希,保证与真实校验耗时一致 */
const DUMMY_HASH = hashPassword("copycut-timing-dummy");

const UNIFIED_ERROR = "账号或密码错误";

export async function POST(request: Request) {
  let account = "";
  let password = "";
  try {
    const body = (await request.json()) as {
      username?: unknown;
      password?: unknown;
    };
    account = typeof body.username === "string" ? body.username.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!account || !password) {
    return Response.json({ error: "请输入账号和密码" }, { status: 400 });
  }

  // 含 @ 视为邮箱,否则视为用户名(注册时用户名禁止含 @)
  const user = account.includes("@")
    ? getUserByEmail(account)
    : getUserByUsername(account);

  // 无论用户是否存在都执行一次 scrypt 校验;纯 OAuth 账号无密码,同样空跑
  const passwordOk = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !passwordOk) {
    return Response.json({ error: UNIFIED_ERROR }, { status: 401 });
  }

  // 密码正确但邮箱未激活:拒绝登录,前端据此提供"重发激活邮件"入口
  if (!user.emailVerified) {
    return Response.json(
      {
        error: "请先查收邮件激活账号",
        needsVerification: true,
        email: user.email,
      },
      { status: 403 }
    );
  }

  const session: Session = {
    username: user.username,
    loginAt: Date.now(),
    provider: "password",
    userId: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
  await createSession(session);
  return Response.json({ session });
}
