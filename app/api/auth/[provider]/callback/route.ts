import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  STATE_COOKIE,
  exchangeCodeForProfile,
  isOAuthProvider,
  profileToSession,
} from "@/lib/server/oauth";
import { createSession } from "@/lib/server/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const origin = request.nextUrl.origin;
  const fail = (error: string) =>
    Response.redirect(`${origin}/login?error=${error}&provider=${provider}`, 302);

  if (!isOAuthProvider(provider)) {
    return Response.json({ error: "未知的登录方式" }, { status: 404 });
  }

  const query = request.nextUrl.searchParams;
  if (query.get("error")) {
    // 用户在授权页取消,或提供方返回错误
    return fail("oauth_denied");
  }

  const code = query.get("code");
  const state = query.get("state");
  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  if (!code || !state || expectedState !== `${provider}:${state}`) {
    return fail("oauth_state_mismatch");
  }

  try {
    const redirectUri = `${origin}/api/auth/${provider}/callback`;
    const profile = await exchangeCodeForProfile(provider, code, redirectUri);
    await createSession(profileToSession(provider, profile));
  } catch (err) {
    console.error(`[auth] ${provider} 回调失败:`, err);
    return fail("oauth_exchange_failed");
  }

  // 登录页挂载时会从服务端同步会话到本地镜像,再跳转回首页
  return Response.redirect(`${origin}/login`, 302);
}
