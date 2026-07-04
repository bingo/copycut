"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authService, type OAuthProviderId } from "@/lib/services/auth";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  not_configured: "该登录方式尚未配置(缺少 Client ID/Secret 环境变量)",
  oauth_denied: "已取消授权",
  oauth_state_mismatch: "登录状态校验失败,请重试",
  oauth_exchange_failed: "第三方登录失败,请重试",
};

const PROVIDER_NAMES: Record<OAuthProviderId, string> = {
  google: "Google",
  github: "GitHub",
  facebook: "Facebook",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.49 5.92.43.38.82 1.11.82 2.24v3.32c0 .32.21.7.83.58A12 12 0 0 0 12 .3z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12z"
      />
    </svg>
  );
}

const PROVIDER_ICONS: Record<OAuthProviderId, () => React.ReactNode> = {
  google: GoogleIcon,
  github: GitHubIcon,
  facebook: FacebookIcon,
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  // OAuth 回调会带着服务端会话落回本页:先同步会话,已登录则直接进首页;
  // 同时把回调携带的 error 参数展示出来
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const errorCode = query.get("error");
    let oauthError = "";
    if (errorCode) {
      const provider = query.get("provider") as OAuthProviderId | null;
      const name = provider ? (PROVIDER_NAMES[provider] ?? provider) : "";
      const message = OAUTH_ERROR_MESSAGES[errorCode] ?? "登录失败,请重试";
      oauthError = name ? `${name} 登录失败:${message}` : message;
      window.history.replaceState(null, "", "/login");
    }
    let cancelled = false;
    authService
      .syncFromServer()
      .then((session) => {
        if (cancelled) return;
        if (session) {
          router.replace("/");
          return;
        }
        if (oauthError) setError(oauthError);
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        if (oauthError) setError(oauthError);
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await authService.login(username, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Copy<span className="text-[#ff2442]">Cut</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500">小红书创作者的轻量剪辑工具</p>
        </div>

        <div className="flex flex-col gap-3">
          {(Object.keys(PROVIDER_NAMES) as OAuthProviderId[]).map((provider) => {
            const Icon = PROVIDER_ICONS[provider];
            return (
              <button
                key={provider}
                type="button"
                disabled={checking}
                onClick={() => authService.loginWithProvider(provider)}
                className="flex items-center justify-center gap-2.5 rounded-lg border border-zinc-300 py-2.5 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <Icon />
                使用 {PROVIDER_NAMES[provider]} 登录
              </button>
            );
          })}
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          或使用账号密码登录
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">用户名</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              autoComplete="username"
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-colors focus:border-[#ff2442] dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-colors focus:border-[#ff2442] dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>

          {error && <p className="text-sm text-[#ff2442]">{error}</p>}

          <button
            type="submit"
            disabled={submitting || checking}
            className="mt-2 rounded-lg bg-[#ff2442] py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400">Alpha 演示版</p>
      </div>
    </div>
  );
}
