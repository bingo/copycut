"use client";

import { useState } from "react";
import { ASPECT_RATIOS, type AspectRatio } from "@/lib/types";

/** 比例预览小图标的宽高比样式 */
const RATIO_PREVIEW: Record<AspectRatio, string> = {
  "9:16": "h-10 w-[22px]",
  "1:1": "h-9 w-9",
  "16:9": "h-[22px] w-10",
};

export default function NewProjectModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (ratio: AspectRatio) => void;
  onClose: () => void;
}) {
  const [ratio, setRatio] = useState<AspectRatio>("9:16");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">新建项目</h2>
        <p className="mt-1 text-sm text-zinc-500">选择画布比例，创建后可在编辑器中切换</p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRatio(r.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                ratio === r.value
                  ? "border-[#ff2442] bg-[#ff2442]/5"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <span className="flex h-10 items-center">
                <span
                  className={`${RATIO_PREVIEW[r.value]} rounded-sm border-2 ${
                    ratio === r.value ? "border-[#ff2442]" : "border-zinc-400"
                  }`}
                />
              </span>
              <span className="text-sm font-medium">{r.label}</span>
              <span className="text-xs text-zinc-400">{r.hint}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(ratio)}
            className="rounded-lg bg-[#ff2442] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            创建项目
          </button>
        </div>
      </div>
    </div>
  );
}
