"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { draftService } from "@/lib/services/drafts";
import type { Draft } from "@/lib/types";

type SaveState = "saved" | "saving" | "idle";

/** 预览画布按项目比例的样式 */
const CANVAS_RATIO: Record<Draft["aspectRatio"], string> = {
  "9:16": "aspect-[9/16] h-full max-h-full",
  "1:1": "aspect-square h-full max-h-full",
  "16:9": "aspect-video w-full max-w-full",
};

function Editor({ id }: { id: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    draftService.get(id).then((d) => (d ? setDraft(d) : setNotFound(true)));
  }, [id]);

  function handleTitleChange(title: string) {
    if (!draft) return;
    setDraft({ ...draft, title });
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await draftService.update(id, { title });
      setSaveState("saved");
    }, 600);
  }

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-400">
        <p>草稿不存在或已删除</p>
        <Link href="/" className="text-sm text-[#ff2442] hover:underline">
          返回首页
        </Link>
      </div>
    );
  }

  if (!draft) return null;

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-200">
      {/* 顶栏 */}
      <header className="flex shrink-0 items-center gap-4 border-b border-zinc-800 px-4 py-2.5">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          ← 首页
        </button>
        <input
          value={draft.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-64 rounded border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition-colors hover:border-zinc-700 focus:border-[#ff2442]"
        />
        <span className="text-xs text-zinc-500">
          {saveState === "saving" ? "保存中…" : saveState === "saved" ? "已保存" : ""}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
            {draft.aspectRatio}
          </span>
          <button
            type="button"
            disabled
            title="Step 3 接入真实导出"
            className="cursor-not-allowed rounded-lg bg-[#ff2442]/40 px-4 py-1.5 text-sm font-medium text-white/60"
          >
            导出
          </button>
        </div>
      </header>

      {/* 主区域：素材面板 / 预览 / 属性面板 */}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800">
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-medium">素材</div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
            <div className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-700 py-10">
              <p className="text-sm text-zinc-500">拖入视频 / 图片</p>
              <p className="text-xs text-zinc-600">素材导入将在下一迭代开放</p>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 items-center justify-center p-8">
          <div
            className={`flex items-center justify-center rounded-lg bg-black shadow-lg ${CANVAS_RATIO[draft.aspectRatio]}`}
          >
            <p className="px-6 text-center text-sm text-zinc-600">
              预览区（{draft.aspectRatio}）
              <br />
              导入素材后显示画面
            </p>
          </div>
        </main>

        <aside className="flex w-72 shrink-0 flex-col border-l border-zinc-800">
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-medium">属性</div>
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-center text-sm text-zinc-600">
              选中片段后
              <br />
              在此调整属性
            </p>
          </div>
        </aside>
      </div>

      {/* 时间轴 */}
      <footer className="h-44 shrink-0 border-t border-zinc-800">
        <div className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2 text-xs text-zinc-500">
          <span>时间轴</span>
          <span className="text-zinc-700">|</span>
          <span>00:00.0</span>
        </div>
        <div className="flex h-[calc(100%-33px)] items-center px-4">
          <div className="flex h-16 w-full items-center justify-center rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-600">
            主轨道 · 导入素材后在此排列片段
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard>
      <Editor id={id} />
    </AuthGuard>
  );
}
