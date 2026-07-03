"use client";

import { TEXT_TEMPLATES } from "@/lib/data/text-templates";
import type { TextOverlay } from "@/lib/types";
import type { EditorState } from "./../useEditorState";

/** F-15 文字添加 + F-16 文字模板库 */
export default function TextPanel({ editor }: { editor: EditorState }) {
  const { draft, apply, setSelection } = editor;
  if (!draft) return null;

  function addText(partial?: Partial<TextOverlay>) {
    if (!draft) return;
    const overlay: TextOverlay = {
      id: crypto.randomUUID(),
      content: "点击输入文字",
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
          添加后在预览区拖动调整位置,在右侧属性面板编辑样式
        </p>
      </div>

      <div className="border-t border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-400">
        文字模板
      </div>
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3 pt-0">
        {TEXT_TEMPLATES.filter((t) => t.scene === "画面").map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              addText({
                content: t.sample,
                color: t.style.color,
                background: t.style.background,
                fontWeight: t.style.fontWeight,
                fontSize: t.style.fontSize,
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
              }}
            >
              <span
                className="rounded px-1.5 py-0.5 text-xs"
                style={{ background: t.style.background }}
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
