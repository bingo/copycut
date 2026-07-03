"use client";

import { useState } from "react";
import { TRANSITIONS, TRANSITION_CATEGORIES } from "@/lib/data/transitions";
import { CategoryTabs } from "./FilterPanel";
import type { EditorState } from "./../useEditorState";

/** F-14 转场库:选中片段后点击,应用到该片段与下一片段之间 */
export default function TransitionPanel({ editor }: { editor: EditorState }) {
  const { draft, clips, selection, apply } = editor;
  const [category, setCategory] = useState<string>(TRANSITION_CATEGORIES[0]);

  if (!draft) return null;

  const selectedIndex =
    selection?.type === "clip" ? clips.findIndex((c) => c.id === selection.id) : -1;
  // 最后一个片段之后没有间隙可加转场
  const targetClip = selectedIndex >= 0 && selectedIndex < clips.length - 1 ? clips[selectedIndex] : null;

  function applyTransition(transitionId: string) {
    if (!targetClip) return;
    apply({
      clips: clips.map((c) =>
        c.id === targetClip.id
          ? { ...c, transitionAfter: c.transitionAfter === transitionId ? undefined : transitionId }
          : c
      ),
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <CategoryTabs categories={TRANSITION_CATEGORIES} active={category} onChange={setCategory} />

      {!targetClip && (
        <p className="mx-3 mt-3 rounded-lg bg-zinc-800/60 px-3 py-2 text-xs leading-5 text-zinc-500">
          {clips.length < 2
            ? "时间轴至少需要两个片段才能添加转场"
            : "先在时间轴选中一个片段,转场将添加到它和下一个片段之间"}
        </p>
      )}

      <div className="grid flex-1 auto-rows-min grid-cols-3 gap-2 overflow-y-auto p-3">
        {TRANSITIONS.filter((t) => t.category === category).map((t) => {
          const active = targetClip?.transitionAfter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={!targetClip}
              onClick={() => applyTransition(t.id)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? "border-[#ff2442]" : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <span className="flex aspect-square w-full items-center justify-center rounded bg-zinc-800 text-xl text-zinc-300">
                {t.icon}
              </span>
              <span className="text-[11px] text-zinc-400">{t.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
