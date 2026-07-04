import { timingSafeEqual } from "node:crypto";
import type { Session } from "@/lib/types";
import { createSession } from "@/lib/server/session";

/** 测试用预设账号,仅此一组可用密码登录 */
const PRESET_USERNAME = "admin";
const PRESET_PASSWORD = "passw0rd";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function POST(request: Request) {
  let username = "";
  let password = "";
  try {
    const body = (await request.json()) as {
      username?: unknown;
      password?: unknown;
    };
    username = typeof body.username === "string" ? body.username.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!username || !password) {
    return Response.json({ error: "请输入用户名和密码" }, { status: 400 });
  }
  if (!safeEqual(username, PRESET_USERNAME) || !safeEqual(password, PRESET_PASSWORD)) {
    return Response.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  const session: Session = {
    username: PRESET_USERNAME,
    loginAt: Date.now(),
    provider: "password",
  };
  await createSession(session);
  return Response.json({ session });
}
