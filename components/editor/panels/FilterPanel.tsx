"use client";

import { useState } from "react";
import { FILTERS, FILTER_CATEGORIES, filterToCss } from "@/lib/data/filters";
import type { EditorState } from "./../useEditorState";

/** F-12 滤镜库:分类展示、点击应用、强度滑块(CSS filter 实时预览) */
export default function FilterPanel({ editor }: { editor: EditorState }) {
  const { draft, apply } = editor;
  const [category, setCategory] = useState<string>(FILTER_CATEGORIES[0]);

  if (!draft) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <CategoryTabs
        categories={FILTER_CATEGORIES}
        active={category}
        onChange={setCategory}
      />

      <div className="grid flex-1 auto-rows-min grid-cols-3 gap-2 overflow-y-auto p-3">
        <button
          type="button"
          onClick={() => apply({ filterId: undefined })}
          className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 ${
            !draft.filterId ? "border-[#ff2442]" : "border-zinc-800 hover:border-zinc-600"
          }`}
        >
          <div className="flex aspect-square w-full items-center justify-center rounded bg-zinc-800 text-lg text-zinc-500">
            ∅
          </div>
          <span className="text-[11px] text-zinc-400">原图</span>
        </button>
        {FILTERS.filter((f) => f.category === category).map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => apply({ filterId: filter.id })}
            className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 ${
              draft.filterId === filter.id
                ? "border-[#ff2442]"
                : "border-zinc-800 hover:border-zinc-600"
            }`}
          >
            {/* 用渐变色块承载 CSS filter 作为滤镜效果预览 */}
            <div
              className="aspect-square w-full rounded bg-gradient-to-br from-rose-300 via-amber-200 to-sky-400"
              style={{ filter: filterToCss(filter, 100) }}
            />
            <span className="text-[11px] text-zinc-400">{filter.name}</span>
          </button>
        ))}
      </div>

      {draft.filterId && (
        <div className="border-t border-zinc-800 p-3">
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>强度</span>
            <span>{draft.filterStrength}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={draft.filterStrength}
            onChange={(e) => apply({ filterStrength: Number(e.target.value) }, { undoable: false })}
            className="w-full accent-[#ff2442]"
          />
        </div>
      )}
    </div>
  );
}

export function CategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: readonly string[];
  active: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-zinc-800 px-3 py-2">
      {categories.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
            active === c ? "bg-[#ff2442] text-white" : "text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
