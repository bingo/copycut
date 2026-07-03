"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/services/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">用户名</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="任意用户名"
              autoFocus
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-colors focus:border-[#ff2442] dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="任意密码"
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-colors focus:border-[#ff2442] dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>

          {error && <p className="text-sm text-[#ff2442]">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-[#ff2442] py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Alpha 演示版 · 任意用户名密码即可登录
        </p>
      </div>
    </div>
  );
}
