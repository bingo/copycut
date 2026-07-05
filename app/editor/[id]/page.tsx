"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import SidePanel from "@/components/editor/SidePanel";
import PreviewArea from "@/components/editor/PreviewArea";
import PropertiesPanel from "@/components/editor/PropertiesPanel";
import Timeline from "@/components/editor/Timeline";
import GalleryEditor from "@/components/editor/GalleryEditor";
import CoverModal from "@/components/editor/CoverModal";
import ExportModal from "@/components/editor/ExportModal";
import PublishPanel from "@/components/editor/PublishPanel";
import ShortcutsModal from "@/components/editor/ShortcutsModal";
import { useEditorState } from "@/components/editor/useEditorState";
import { useEditorShortcuts } from "@/components/editor/useEditorShortcuts";

type Modal = "cover" | "export" | "publish" | null;

function Editor({ id }: { id: string }) {
  const router = useRouter();
  const editor = useEditorState(id);
  const { draft, notFound, saveState, apply } = editor;
  const [modal, setModal] = useState<Modal>(null);
  // F-65 编辑器全局快捷键;弹窗打开时挂起
  const { helpOpen, openHelp, closeHelp } = useEditorShortcuts(editor, {
    modalOpen: modal !== null,
  });
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function handleTitleChange(title: string) {
    if (titleTimer.current) clearTimeout(titleTimer.current);
    // 标题修改防抖保存,不进撤销栈(与剪辑操作区分)
    titleTimer.current = setTimeout(() => apply({ title }, { undoable: false }), 400);
  }

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
          defaultValue={draft.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-64 rounded border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition-colors hover:border-zinc-700 focus:border-[#ff2442]"
        />
        <span className="text-xs text-zinc-500">
          {saveState === "saving" ? "保存中…" : saveState === "saved" ? "已保存" : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={openHelp}
            title="键盘快捷键 (?)"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 text-xs text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
          >
            ?
          </button>
          <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
            {draft.mode === "gallery" ? "图文" : draft.aspectRatio}
          </span>
          <HeaderButton onClick={() => setModal("cover")}>封面</HeaderButton>
          <HeaderButton onClick={() => setModal("publish")}>发布准备</HeaderButton>
          <button
            type="button"
            onClick={() => setModal("export")}
            className="rounded-lg bg-[#ff2442] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            导出
          </button>
        </div>
      </header>

      {draft.mode === "gallery" ? (
        <GalleryEditor editor={editor} />
      ) : (
        <>
          {/* 主区域:功能面板 / 预览 / 属性面板 */}
          <div className="flex min-h-0 flex-1">
            <SidePanel editor={editor} />
            <PreviewArea editor={editor} />
            <PropertiesPanel editor={editor} />
          </div>
          <Timeline editor={editor} />
        </>
      )}

      {modal === "cover" && <CoverModal editor={editor} onClose={() => setModal(null)} />}
      {modal === "export" && <ExportModal editor={editor} onClose={() => setModal(null)} />}
      {modal === "publish" && <PublishPanel editor={editor} onClose={() => setModal(null)} />}
      {helpOpen && <ShortcutsModal onClose={closeHelp} />}
    </div>
  );
}

function HeaderButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500"
    >
      {children}
    </button>
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
