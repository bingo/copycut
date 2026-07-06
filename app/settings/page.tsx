"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { authService } from "@/lib/services/auth";
import type { SafeUser } from "@/lib/server/current-user";
import type { AuthProvider } from "@/lib/types";

/**
 * 用户设置页:基础信息 / 账号安全 两个分区,
 * 数据来自 /api/user/* 系列接口,每个分区独立保存。
 */

const PROVIDER_LABELS: Record<AuthProvider, string> = {
  password: "账号密码",
  google: "Google",
  github: "GitHub",
  facebook: "Facebook",
};

const USERNAME_WARNING =
  "修改用户名会使历史草稿与新账号脱钩,旧草稿将不再出现在草稿列表中";

type SectionId = "profile" | "security";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "profile", label: "基础信息" },
  { id: "security", label: "账号安全" },
];

/** 分区保存结果提示 */
type Feedback = { type: "success" | "error"; text: string } | null;

function FeedbackText({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p
      className={`text-sm ${
        feedback.type === "success" ? "text-emerald-600" : "text-[#ff2442]"
      }`}
    >
      {feedback.text}
    </p>
  );
}

const inputClass =
  "rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-colors focus:border-[#ff2442] dark:border-zinc-700 dark:bg-zinc-800";
const saveButtonClass =
  "self-start rounded-lg bg-[#ff2442] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50";
const cardClass =
  "rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900";

/** 提取接口错误信息(非 2xx 时优先用服务端返回的中文提示) */
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

function ProfileSection({
  user,
  onUpdated,
}: {
  user: SafeUser;
  onUpdated: (user: SafeUser) => void;
}) {
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [name, setName] = useState(user.name ?? "");
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const provider = (authService.getSession()?.provider ?? "password") as AuthProvider;
  const usernameChanged = username.trim() !== user.username;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (usernameChanged && !window.confirm(`${USERNAME_WARNING}。确定继续吗?`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl, name, username, bio }),
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: await readError(res, "保存失败,请重试") });
        return;
      }
      const data = (await res.json()) as { user: SafeUser };
      // 服务端已刷新会话 cookie,这里同步本地会话镜像
      await authService.syncFromServer();
      onUpdated(data.user);
      // 回填服务端归一化后的值(去首尾空格等)
      setAvatarUrl(data.user.avatarUrl ?? "");
      setName(data.user.name ?? "");
      setUsername(data.user.username);
      setBio(data.user.bio ?? "");
      setFeedback({ type: "success", text: "基础信息已保存" });
    } catch {
      setFeedback({ type: "error", text: "网络异常,保存失败" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-4`}>
      <h3 className="text-base font-semibold">基础信息</h3>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-xl font-semibold text-zinc-400 dark:bg-zinc-800">
          {avatarUrl.trim() ? (
            // 头像为任意外链,使用原生 img 预览
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl.trim()}
              alt="头像预览"
              className="h-full w-full object-cover"
            />
          ) : (
            (name || username || "?").slice(0, 1).toUpperCase()
          )}
        </div>
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium">头像 URL</span>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">昵称</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="展示用昵称"
          maxLength={30}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">用户名</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名"
          maxLength={30}
          className={inputClass}
        />
        <span
          className={`text-xs ${usernameChanged ? "text-amber-600" : "text-zinc-400"}`}
        >
          ⚠ {USERNAME_WARNING}
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">个人简介</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="介绍一下自己(200 字以内)"
          maxLength={200}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">邮箱</span>
          <p className="rounded-lg bg-zinc-100 px-3 py-2 text-zinc-500 dark:bg-zinc-800">
            {user.email ?? "未绑定"}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">登录方式</span>
          <p className="rounded-lg bg-zinc-100 px-3 py-2 text-zinc-500 dark:bg-zinc-800">
            {PROVIDER_LABELS[provider]}
          </p>
        </div>
      </div>

      <FeedbackText feedback={feedback} />
      <button type="submit" disabled={saving} className={saveButtonClass}>
        {saving ? "保存中…" : "保存基础信息"}
      </button>
    </form>
  );
}

function SecuritySection({
  hasPassword,
  onPasswordSet,
}: {
  hasPassword: boolean;
  onPasswordSet: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", text: "两次输入的新密码不一致" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: await readError(res, "保存失败,请重试") });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({
        type: "success",
        text: hasPassword ? "密码已修改" : "密码已设置,之后可用用户名+密码登录",
      });
      onPasswordSet();
    } catch {
      setFeedback({ type: "error", text: "网络异常,保存失败" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-4`}>
      <h3 className="text-base font-semibold">
        {hasPassword ? "修改密码" : "设置密码"}
      </h3>
      {!hasPassword && (
        <p className="text-sm text-zinc-500">
          当前账号通过第三方登录,尚未设置密码,可直接设置首个密码。
        </p>
      )}

      {hasPassword && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">当前密码</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">新密码</span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="至少 8 位,包含字母和数字"
          autoComplete="new-password"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">确认新密码</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="再次输入新密码"
          autoComplete="new-password"
          className={inputClass}
        />
      </label>

      <FeedbackText feedback={feedback} />
      <button type="submit" disabled={saving} className={saveButtonClass}>
        {saving ? "保存中…" : hasPassword ? "修改密码" : "设置密码"}
      </button>
    </form>
  );
}

function SettingsContent() {
  const router = useRouter();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loadError, setLoadError] = useState("");
  const [active, setActive] = useState<SectionId>("profile");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/profile")
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          setLoadError("加载用户资料失败,请刷新重试");
          return;
        }
        const data = (await res.json()) as { user: SafeUser };
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setLoadError("网络异常,加载用户资料失败");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ← 返回首页
          </Link>
          <h1 className="text-xl font-bold tracking-tight">设置</h1>
        </div>
        <span className="text-sm text-zinc-500">
          {authService.getSession()?.username}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8 sm:flex-row">
        {/* 左侧分区导航 */}
        <nav className="flex shrink-0 gap-2 sm:w-40 sm:flex-col">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActive(section.id)}
              className={`rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors ${
                active === section.id
                  ? "bg-[#ff2442]/10 text-[#ff2442]"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="flex-1">
          {loadError && <p className="text-sm text-[#ff2442]">{loadError}</p>}
          {!user && !loadError && (
            <p className="text-sm text-zinc-400">加载中…</p>
          )}
          {user && active === "profile" && (
            <ProfileSection user={user} onUpdated={setUser} />
          )}
          {user && active === "security" && (
            <SecuritySection
              hasPassword={user.hasPassword}
              onPasswordSet={() => setUser({ ...user, hasPassword: true })}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
