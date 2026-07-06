"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { authService } from "@/lib/services/auth";

/**
 * 邮箱激活结果页:激活邮件里的链接指向 /verify?token=xxx,
 * 本页调用 GET /api/auth/verify 完成激活并展示结果;
 * token 无效/过期时提供"重发激活邮件"入口。
 */

type VerifyState =
  | { status: "loading" }
  | { status: "success"; email?: string }
  | { status: "error"; message: string; email?: string };

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-colors focus:border-[#ff2442] dark:border-zinc-700 dark:bg-zinc-800";

export default function VerifyPage() {
  const [state, setState] = useState<VerifyState>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [resendResult, setResendResult] = useState("");
  const [resendError, setResendError] = useState("");
  const [devActivationUrl, setDevActivationUrl] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    if (!token) {
      setState({ status: "error", message: "缺少激活令牌,请从邮件里的链接打开本页" });
      return;
    }
    let cancelled = false;
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = (await res.json()) as { ok?: boolean; error?: string; email?: string };
        if (cancelled) return;
        if (res.ok && data.ok) {
          setState({ status: "success", email: data.email });
        } else {
          setState({ status: "error", message: data.error ?? "激活失败,请重试", email: data.email });
          if (data.email) setEmail(data.email);
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "网络异常,请刷新重试" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleResend(e: FormEvent) {
    e.preventDefault();
    setResendError("");
    setResendResult("");
    setSending(true);
    try {
      const result = await authService.resendVerification(email);
      setResendResult(result.message);
      setDevActivationUrl(result.devActivationUrl ?? "");
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "发送失败,请稍后重试");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Copy<span className="text-[#ff2442]">Cut</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500">邮箱激活</p>
        </div>

        {state.status === "loading" && (
          <p className="text-center text-sm text-zinc-500">正在激活账号…</p>
        )}

        {state.status === "success" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl dark:bg-green-900/40">
              ✓
            </span>
            <p className="text-sm">
              激活成功!{state.email ? `账号 ${state.email} ` : ""}已可正常登录。
            </p>
            <Link
              href="/login"
              className="mt-2 w-full rounded-lg bg-[#ff2442] py-2.5 text-center font-medium text-white transition-opacity hover:opacity-90"
            >
              去登录
            </Link>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm text-[#ff2442]">{state.message}</p>

            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
              重发激活邮件
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
            </div>

            <form onSubmit={handleResend} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">注册邮箱</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={INPUT_CLASS}
                />
              </label>
              {resendError && <p className="text-sm text-[#ff2442]">{resendError}</p>}
              {resendResult && (
                <p className="text-sm text-green-600 dark:text-green-400">{resendResult}</p>
              )}
              {devActivationUrl && (
                <p className="break-all text-xs text-zinc-500">
                  本地开发未配置邮件服务,直接点击激活:
                  <a href={devActivationUrl} className="text-[#ff2442] underline">
                    {devActivationUrl}
                  </a>
                </p>
              )}
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="rounded-lg bg-[#ff2442] py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {sending ? "发送中…" : "重发激活邮件"}
              </button>
            </form>

            <Link href="/login" className="text-center text-xs text-zinc-400 hover:text-zinc-600">
              返回登录
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
