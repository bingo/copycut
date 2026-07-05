"use client";

import { useState } from "react";
import { getFont } from "@/lib/data/fonts";
import { TEXT_TEMPLATES, TEXT_TEMPLATE_CATEGORIES } from "@/lib/data/text-templates";
import type { TextOverlay } from "@/lib/types";
import { CategoryTabs } from "./FilterPanel";
import type { EditorState } from "./../useEditorState";

/** F-15 文字添加 + F-16 文字模板库(F-64 新增「小红书风」分类) */
export default function TextPanel({ editor }: { editor: EditorState }) {
  const { draft, apply, setSelection, playhead, totalDuration } = editor;
  const [category, setCategory] = useState<string>(TEXT_TEMPLATE_CATEGORIES[0]);
  if (!draft) return null;

  function addText(partial?: Partial<TextOverlay>) {
    if (!draft) return;
    // 从播放头处出现,默认 3s;贴近片尾时向前让出最小显示时长
    const start =
      totalDuration > 0 ? Math.min(playhead, Math.max(totalDuration - 0.5, 0)) : 0;
    const end = totalDuration > 0 ? Math.min(start + 3, totalDuration) : start + 3;
    const overlay: TextOverlay = {
      id: crypto.randomUUID(),
      content: "点击输入文字",
      start,
      end,
      x: 50,
      y: 50,
      fontSize: 28,
      color: "#ffffff",
      fontWeight: "normal",
      ...partial,
    };
    apply({ texts: [...draft.texts, overlay] });
    setSelection({ type: "text", id: overlay.id });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="p-3">
        <button
          type="button"
          onClick={() => addText()}
          className="w-full rounded-lg bg-[#ff2442] py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          + 添加文字
        </button>
        <p className="mt-2 text-[11px] text-zinc-600">
          添加后在预览区拖动调整位置,在右侧属性面板编辑样式,在时间轴文字轨调整出现时间
        </p>
      </div>

      <div className="border-t border-zinc-800 px-3 pt-2 text-xs font-medium text-zinc-400">
        文字模板
      </div>
      <CategoryTabs
        categories={TEXT_TEMPLATE_CATEGORIES}
        active={category}
        onChange={setCategory}
      />
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3">
        {TEXT_TEMPLATES.filter(
          (t) => t.scene === "画面" && (t.category ?? TEXT_TEMPLATE_CATEGORIES[0]) === category
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              addText({
                content: t.sample,
                color: t.style.color,
                background: t.style.background,
                borderColor: t.style.borderColor,
                fontWeight: t.style.fontWeight,
                fontSize: t.style.fontSize,
                fontFamily: t.style.fontFamily,
                templateId: t.id,
              })
            }
            className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 p-2 hover:border-zinc-600"
          >
            <span
              className="flex h-12 w-full items-center justify-center overflow-hidden rounded bg-zinc-800 px-1 text-center"
              style={{
                color: t.style.color,
                fontWeight: t.style.fontWeight,
                fontFamily: getFont(t.style.fontFamily).css,
              }}
            >
              <span
                className="rounded px-1.5 py-0.5 text-xs"
                style={{
                  background: t.style.background,
                  border: t.style.borderColor ? `1px solid ${t.style.borderColor}` : undefined,
                }}
              >
                {t.sample}
              </span>
            </span>
            <span className="text-[11px] text-zinc-500">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
