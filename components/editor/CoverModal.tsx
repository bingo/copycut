"use client";

import { useState } from "react";
import { TEXT_TEMPLATES, getTextTemplate } from "@/lib/data/text-templates";
import { exportCoverJpg } from "@/lib/engine/export-images";
import { downloadBlob } from "@/lib/engine/compose-image";
import type { CoverConfig, Draft } from "@/lib/types";
import type { EditorState } from "./useEditorState";

/**
 * 封面模块:帧预览器选帧(F-19)+ 封面文字/模板叠加(F-20)+
 * 全分辨率封面 JPG 合成导出。
 */
export default function CoverModal({
  editor,
  onClose,
}: {
  editor: EditorState;
  onClose: () => void;
}) {
  const { draft, clips, apply } = editor;
  const [cover, setCover] = useState<CoverConfig>(draft?.cover ?? {});
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!draft) return null;

  // 帧候选:各片段入点帧;导出时按 assetId + assetTime 全分辨率重新抽帧
  const frames = clips
    .filter((c) => c.thumbnail)
    .map((c, i) => {
      const offset = clips.slice(0, i).reduce((sum, x) => sum + (x.end - x.start), 0);
      return {
        time: offset,
        thumbnail: c.thumbnail!,
        name: c.name,
        assetId: c.assetId,
        assetTime: c.start,
      };
    });

  const template = getTextTemplate(cover.templateId);

  function save() {
    apply({ cover }, { undoable: false });
    onClose();
  }

  async function exportJpg() {
    if (!draft) return;
    setExporting(true);
    setError(null);
    try {
      const blob = await exportCoverJpg({ ...draft, cover });
      downloadBlob(blob, `${draft.title}-封面.jpg`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "封面导出失败");
    } finally {
      setExporting(false);
    }
  }

  const ratioClass: Record<Draft["aspectRatio"], string> = {
    "9:16": "aspect-[3/4]", // 小红书封面常用 3:4 展示区
    "1:1": "aspect-square",
    "16:9": "aspect-video",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h2 className="text-base font-semibold text-zinc-100">封面制作</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 gap-4 overflow-y-auto p-5">
          {/* 封面预览 */}
          <div className="w-52 shrink-0">
            <div
              className={`relative flex items-center justify-center overflow-hidden rounded-lg bg-black ${ratioClass[draft.aspectRatio]}`}
            >
              {cover.frameThumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover.frameThumbnail} alt="封面帧" className="h-full w-full object-cover" />
              ) : (
                <p className="px-4 text-center text-xs text-zinc-600">从下方帧预览器选取封面帧</p>
              )}
              {cover.text && (
                <span
                  className="absolute left-1/2 top-1/2 max-w-[90%] -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap rounded px-2 py-1 text-center leading-snug"
                  style={{
                    color: template?.style.color ?? "#ffffff",
                    background: template?.style.background,
                    fontWeight: template?.style.fontWeight ?? "bold",
                    fontSize: (template?.style.fontSize ?? 32) * 0.45,
                  }}
                >
                  {cover.text}
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] leading-4 text-zinc-600">
              导出时按所选帧全分辨率合成 JPG
            </p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* F-19 帧预览器 */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-400">帧预览器</p>
              {frames.length === 0 ? (
                <p className="rounded-lg bg-zinc-800/60 px-3 py-2 text-xs text-zinc-500">
                  时间轴还没有带画面的片段,先导入素材
                </p>
              ) : (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {frames.map((f) => (
                    <button
                      key={f.time}
                      type="button"
                      onClick={() =>
                        setCover({
                          ...cover,
                          frameTime: f.time,
                          frameThumbnail: f.thumbnail,
                          assetId: f.assetId,
                          assetTime: f.assetTime,
                        })
                      }
                      className={`relative h-16 w-12 shrink-0 overflow-hidden rounded border-2 ${
                        cover.frameTime === f.time ? "border-[#ff2442]" : "border-transparent hover:border-zinc-600"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.thumbnail} alt={f.name} className="h-full w-full object-cover" />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-zinc-300">
                        {f.time.toFixed(1)}s
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* F-20 封面文字 */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-400">封面文字</p>
              <input
                value={cover.text ?? ""}
                onChange={(e) => setCover({ ...cover, text: e.target.value })}
                placeholder="输入封面标题文字"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#ff2442]"
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-zinc-400">封面文字模板</p>
              <div className="grid grid-cols-3 gap-2">
                {TEXT_TEMPLATES.filter((t) => t.scene === "封面").map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setCover({
                        ...cover,
                        templateId: cover.templateId === t.id ? undefined : t.id,
                        text: cover.text || t.sample,
                      })
                    }
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 ${
                      cover.templateId === t.id ? "border-[#ff2442]" : "border-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    <span
                      className="flex h-10 w-full items-center justify-center overflow-hidden rounded bg-zinc-800 px-1 text-center text-[10px]"
                      style={{ color: t.style.color, fontWeight: t.style.fontWeight }}
                    >
                      <span className="rounded px-1 py-0.5" style={{ background: t.style.background }}>
                        {t.sample.split("\n")[0]}
                      </span>
                    </span>
                    <span className="text-[10px] text-zinc-500">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-800 px-5 py-3">
          {error && <span className="mr-auto text-xs text-red-400">{error}</span>}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
          >
            取消
          </button>
          <button
            type="button"
            onClick={exportJpg}
            disabled={exporting || (!cover.frameThumbnail && !cover.assetId)}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exporting ? "导出中…" : "导出封面 JPG"}
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-[#ff2442] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            使用此封面
          </button>
        </div>
      </div>
    </div>
  );
}
