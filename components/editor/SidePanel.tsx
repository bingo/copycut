"use client";

import { useState } from "react";
import MediaPanel from "./MediaPanel";
import TextPanel from "./panels/TextPanel";
import MusicPanel from "./panels/MusicPanel";
import TransitionPanel from "./panels/TransitionPanel";
import FilterPanel from "./panels/FilterPanel";
import ColorPanel from "./panels/ColorPanel";
import type { EditorState } from "./useEditorState";

const TABS = [
  { id: "media", label: "素材", icon: "🎬" },
  { id: "text", label: "文字", icon: "T" },
  { id: "music", label: "音乐", icon: "♪" },
  { id: "transition", label: "转场", icon: "⇄" },
  { id: "filter", label: "滤镜", icon: "◐" },
  { id: "color", label: "调色", icon: "☀" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** 左侧功能面板:素材/文字/音乐/转场/滤镜/调色 */
export default function SidePanel({ editor }: { editor: EditorState }) {
  const [tab, setTab] = useState<TabId>("media");

  return (
    <aside className="flex w-[340px] shrink-0 border-r border-zinc-800">
      {/* 竖向选项卡 */}
      <nav className="flex w-16 shrink-0 flex-col gap-1 border-r border-zinc-800 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`mx-1.5 flex flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] ${
              tab === t.id
                ? "bg-zinc-800 text-[#ff2442]"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {tab === "media" && <MediaPanel editor={editor} />}
        {tab === "text" && <TextPanel editor={editor} />}
        {tab === "music" && <MusicPanel editor={editor} />}
        {tab === "transition" && <TransitionPanel editor={editor} />}
        {tab === "filter" && <FilterPanel editor={editor} />}
        {tab === "color" && <ColorPanel editor={editor} />}
      </div>
    </aside>
  );
}
