"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import NewProjectModal from "@/components/NewProjectModal";
import { authService } from "@/lib/services/auth";
import { draftService } from "@/lib/services/drafts";
import type { AspectRatio, Draft, ProjectMode } from "@/lib/types";

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DraftList() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const reload = useCallback(() => {
    draftService.list().then((list) => {
      setDrafts(list);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleCreate(ratio: AspectRatio, mode: ProjectMode) {
    const draft = await draftService.create(ratio, mode);
    router.push(`/editor/${draft.id}`);
  }

  async function handleDelete(id: string) {
    await draftService.remove(id);
    reload();
  }

  async function handleLogout() {
    await authService.logout();
    router.replace("/login");
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold tracking-tight">
          Copy<span className="text-[#ff2442]">Cut</span>
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">
            {authService.getSession()?.username}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            退出
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">我的草稿</h2>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-[#ff2442] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            + 新建项目
          </button>
        </div>

        {loaded && drafts.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 py-20 text-center dark:border-zinc-800">
            <p className="text-zinc-400">还没有草稿</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="text-sm font-medium text-[#ff2442] hover:underline"
            >
              创建第一个项目 →
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="group cursor-pointer overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              onClick={() => router.push(`/editor/${draft.id}`)}
            >
              <div className="relative flex aspect-square items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                {/* mock 缩略图：按项目比例显示占位框 */}
                <div
                  className={`rounded-md bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700 ${
                    draft.aspectRatio === "9:16"
                      ? "h-3/4 w-[42%]"
                      : draft.aspectRatio === "1:1"
                        ? "h-3/5 w-3/5"
                        : "h-[42%] w-3/4"
                  }`}
                />
                <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                  {draft.mode === "gallery" ? "图文" : draft.aspectRatio}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(draft.id);
                  }}
                  className="absolute right-2 top-2 hidden rounded bg-black/60 px-1.5 py-0.5 text-xs text-white hover:bg-black/80 group-hover:block"
                >
                  删除
                </button>
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{draft.title}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {formatTime(draft.updatedAt)} ·{" "}
                  {draft.mode === "gallery"
                    ? `${draft.gallery.length} 张图片`
                    : `${draft.clips.length} 个片段`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {showModal && (
        <NewProjectModal
          onConfirm={handleCreate}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <DraftList />
    </AuthGuard>
  );
}
