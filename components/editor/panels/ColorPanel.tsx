"use client";

import { DEFAULT_COLOR_ADJUST, type ColorAdjust } from "@/lib/types";
import type { EditorState } from "./../useEditorState";

const SLIDERS: { key: keyof ColorAdjust; label: string }[] = [
  { key: "brightness", label: "亮度" },
  { key: "contrast", label: "对比度" },
  { key: "saturation", label: "饱和度" },
  { key: "temperature", label: "色温" },
  { key: "tint", label: "色调" },
  { key: "highlights", label: "高光" },
  { key: "shadows", label: "阴影" },
  { key: "sharpness", label: "锐化" },
];

/** F-13 基础调色:8 参数滑块,预览区实时状态变化 */
export default function ColorPanel({ editor }: { editor: EditorState }) {
  const { draft, apply, pushHistory } = editor;
  if (!draft) return null;

  const changed = SLIDERS.some((s) => draft.colorAdjust[s.key] !== 0);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {SLIDERS.map(({ key, label }) => (
        <div key={key}>
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>{label}</span>
            <span className={draft.colorAdjust[key] !== 0 ? "text-[#ff2442]" : ""}>
              {draft.colorAdjust[key] > 0 ? "+" : ""}
              {draft.colorAdjust[key]}
            </span>
          </div>
          <input
            type="range"
            min={-50}
            max={50}
            value={draft.colorAdjust[key]}
            onPointerDown={pushHistory}
            onChange={(e) =>
              apply(
                { colorAdjust: { ...draft.colorAdjust, [key]: Number(e.target.value) } },
                { undoable: false }
              )
            }
            className="w-full accent-[#ff2442]"
          />
        </div>
      ))}
      <button
        type="button"
        disabled={!changed}
        onClick={() => apply({ colorAdjust: { ...DEFAULT_COLOR_ADJUST } })}
        className="mt-1 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        重置全部
      </button>
      <p className="text-[11px] leading-4 text-zinc-600">
        Alpha 为预览态调色,导出时的真实调色渲染在 Step 3 接入
      </p>
    </div>
  );
}
