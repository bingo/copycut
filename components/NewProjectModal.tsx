"use client";

import { useState } from "react";
import {
  draftTemplateService,
  type DraftTemplateSnapshot,
  type UserAsset,
} from "@/lib/services/user-templates";
import {
  ASPECT_RATIOS,
  PROJECT_MODES,
  type AspectRatio,
  type ProjectMode,
} from "@/lib/types";

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
  onConfirm: (
    ratio: AspectRatio,
    mode: ProjectMode,
    template?: UserAsset<DraftTemplateSnapshot>
  ) => void;
  onClose: () => void;
}) {
  const [ratio, setRatio] = useState<AspectRatio>("9:16");
  const [mode, setMode] = useState<ProjectMode>("video");
  /** T1 从模板创建:草稿列表页「存模板」沉淀的风格设定(弹窗按需挂载,直接初始化) */
  const [templates, setTemplates] = useState<UserAsset<DraftTemplateSnapshot>[]>(() =>
    draftTemplateService.list()
  );
  const [templateId, setTemplateId] = useState<string | null>(null);
  const template = templates.find((t) => t.id === templateId);

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
        <p className="mt-1 text-sm text-zinc-500">选择创作模式与画布比例</p>

        {templates.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-zinc-500">从模板开始(带入文字/滤镜/音乐等风格设定)</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTemplateId(null)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  !templateId
                    ? "border-[#ff2442] text-[#ff2442]"
                    : "border-zinc-300 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
                }`}
              >
                空白项目
              </button>
              {templates.map((t) => (
                <span
                  key={t.id}
                  className={`group flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                    templateId === t.id
                      ? "border-[#ff2442] text-[#ff2442]"
                      : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
                  }`}
                >
                  <button type="button" onClick={() => setTemplateId(t.id)}>
                    {t.name}
                    <span className="ml-1 text-[10px] opacity-60">
                      {t.data.mode === "gallery" ? "图文" : t.data.aspectRatio}
                      {t.data.texts.length > 0 && ` · ${t.data.texts.length}条文字`}
                    </span>
                  </button>
                  <button
                    type="button"
                    title="删除此模板"
                    onClick={() => {
                      draftTemplateService.remove(t.id);
                      setTemplates(draftTemplateService.list());
                      if (templateId === t.id) setTemplateId(null);
                    }}
                    className="hidden text-zinc-500 hover:text-red-400 group-hover:inline"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {template ? (
          <p className="mt-4 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800">
            将按模板「{template.name}」创建:
            {template.data.mode === "gallery" ? "图文轮播" : `视频 ${template.data.aspectRatio}`}
            ,带入 {template.data.texts.length} 条文字
            {template.data.filterId ? "、滤镜" : ""}
            {template.data.music ? "、背景音乐" : ""}
            与调色设定
          </p>
        ) : (
        <>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {PROJECT_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors ${
                mode === m.value
                  ? "border-[#ff2442] bg-[#ff2442]/5"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <span className="text-sm font-medium">
                {m.value === "video" ? "🎬 " : "🖼 "}
                {m.label}
              </span>
              <span className="text-xs text-zinc-400">{m.hint}</span>
            </button>
          ))}
        </div>

        {mode === "video" && (
          <div className="mt-4 grid grid-cols-3 gap-3">
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
        )}
        </>
        )}

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
            onClick={() =>
              template
                ? onConfirm(template.data.aspectRatio, template.data.mode, template)
                : onConfirm(mode === "gallery" ? "1:1" : ratio, mode)
            }
            className="rounded-lg bg-[#ff2442] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            创建项目
          </button>
        </div>
      </div>
    </div>
  );
}
