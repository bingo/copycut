"use client";

import { useEffect, useRef, useState } from "react";
import { TEXT_TEMPLATES, getTextTemplate } from "@/lib/data/text-templates";
import {
  COVER_PALETTES,
  COVER_TEMPLATES,
  coverTemplateToOverlays,
  type CoverTemplate,
} from "@/lib/data/cover-templates";
import { getFont } from "@/lib/data/fonts";
import { exportCoverJpg } from "@/lib/engine/export-images";
import { downloadBlob } from "@/lib/engine/compose-image";
import type { CoverConfig, Draft, TextOverlay } from "@/lib/types";
import type { EditorState } from "./useEditorState";
import { Field, FontSelect, OptionalColorField } from "./fields";

/**
 * 封面模块:帧预览器选帧(F-19)+ 封面文字/模板叠加(F-20)+
 * 小红书风格封面模板库与瀑布流安全区预览(F-61)+ 全分辨率封面 JPG 合成导出。
 */

/** 封面导出画幅(与 export-images 的 COVER_SIZE 一致),瀑布流卡片按此模拟 3:4 裁切 */
const COVER_RATIO_CSS: Record<Draft["aspectRatio"], string> = {
  "9:16": "3 / 4",
  "1:1": "1 / 1",
  "16:9": "16 / 9",
};

/** 跟踪元素实高:文字字号按 fontSize × 高/1000 换算,与导出同标尺 */
function useElementHeight<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  });
  return [ref, h];
}

/** 封面上的文字层(旧单条文字 + 模板分层标题),编辑视图传 onDragLayer 支持拖拽定位 */
function CoverTextLayers({
  cover,
  heightPx,
  onDragLayer,
}: {
  cover: CoverConfig;
  heightPx: number;
  onDragLayer?: (id: string, dxPct: number, dyPct: number) => void;
}) {
  const drag = useRef<{ id: string; x: number; y: number } | null>(null);
  const legacy = getTextTemplate(cover.templateId);
  return (
    <>
      {cover.text && (
        <span
          className="absolute left-1/2 top-1/2 max-w-[90%] -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap rounded px-2 py-1 text-center leading-snug"
          style={{
            color: legacy?.style.color ?? "#ffffff",
            background: legacy?.style.background,
            fontWeight: legacy?.style.fontWeight ?? "bold",
            fontSize: Math.max(9, ((legacy?.style.fontSize ?? 36) * heightPx) / 600),
          }}
        >
          {cover.text}
        </span>
      )}
      {(cover.coverTexts ?? []).map((t) => (
        <span
          key={t.id}
          onPointerDown={
            onDragLayer
              ? (e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = { id: t.id, x: e.clientX, y: e.clientY };
                }
              : undefined
          }
          onPointerMove={
            onDragLayer
              ? (e) => {
                  const d = drag.current;
                  const box = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!d || d.id !== t.id || !box) return;
                  onDragLayer(
                    t.id,
                    ((e.clientX - d.x) / box.width) * 100,
                    ((e.clientY - d.y) / box.height) * 100
                  );
                  drag.current = { id: t.id, x: e.clientX, y: e.clientY };
                }
              : undefined
          }
          onPointerUp={() => (drag.current = null)}
          className={`absolute max-w-[92%] -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap rounded px-1.5 py-0.5 text-center leading-snug ${
            onDragLayer ? "cursor-move touch-none select-none hover:ring-1 hover:ring-zinc-400" : ""
          }`}
          style={{
            left: `${t.x}%`,
            top: `${t.y}%`,
            color: t.color,
            background: t.background || undefined,
            border: t.borderColor ? `1.5px solid ${t.borderColor}` : undefined,
            fontWeight: t.fontWeight,
            fontFamily: getFont(t.fontFamily).css,
            fontSize: Math.max(8, (t.fontSize * heightPx) / 1000),
          }}
        >
          {t.content}
        </span>
      ))}
    </>
  );
}

/** 模板缩略预览:底色 + 按百分比缩放的分层标题 */
function TemplateThumb({
  template,
  selected,
  onClick,
}: {
  template: CoverTemplate;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 ${
        selected ? "border-[#ff2442]" : "border-zinc-800 hover:border-zinc-600"
      }`}
    >
      <span
        className="relative block w-full overflow-hidden rounded aspect-[3/4]"
        style={{ background: template.previewBackground }}
      >
        {template.layers.map((l) => (
          <span
            key={l.role}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap rounded-[2px] px-0.5 text-center leading-tight"
            style={{
              left: `${l.x}%`,
              top: `${l.y}%`,
              color: l.color,
              background: l.background || undefined,
              border: l.borderColor ? `1px solid ${l.borderColor}` : undefined,
              fontWeight: l.fontWeight,
              fontFamily: getFont(l.fontFamily).css,
              fontSize: Math.max(6, l.fontSize * 0.16),
            }}
          >
            {l.sample}
          </span>
        ))}
      </span>
      <span className="text-[10px] text-zinc-500">{template.name}</span>
    </button>
  );
}

/** 瀑布流里的灰色占位卡片 */
function GhostCard({ tall }: { tall?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg bg-zinc-900">
      <div className={`${tall ? "aspect-[3/4]" : "aspect-square"} bg-zinc-800`} />
      <div className="flex flex-col gap-1.5 p-2">
        <div className="h-2 w-full rounded bg-zinc-800" />
        <div className="h-2 w-2/3 rounded bg-zinc-800" />
        <div className="mt-1 flex items-center gap-1.5">
          <div className="h-3.5 w-3.5 rounded-full bg-zinc-800" />
          <div className="h-2 w-12 rounded bg-zinc-800" />
          <div className="ml-auto h-2 w-6 rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

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
  const [view, setView] = useState<"edit" | "feed">("edit");
  const [previewRef, previewH] = useElementHeight<HTMLDivElement>();
  const [cardRef, cardH] = useElementHeight<HTMLDivElement>();

  if (!draft) return null;

  // 帧候选:时间轴模式取各片段入点帧,导出时按 assetId + assetTime 全分辨率重新抽帧;
  // 图文轮播模式没有时间轴,候选为轮播图片序列(time 存序号,仅用于选中态与标注)
  const isGallery = draft.mode === "gallery";
  const frames = isGallery
    ? draft.gallery.map((g, i) => ({
        time: i,
        thumbnail: g.thumbnail,
        name: g.name,
        label: `第${i + 1}张`,
        assetId: g.assetId,
        assetTime: undefined as number | undefined,
      }))
    : clips
        .filter((c) => c.thumbnail)
        .map((c, i) => {
          const offset = clips.slice(0, i).reduce((sum, x) => sum + (x.end - x.start), 0);
          return {
            time: offset,
            thumbnail: c.thumbnail!,
            name: c.name,
            label: `${offset.toFixed(1)}s`,
            assetId: c.assetId as string | undefined,
            assetTime: c.start as number | undefined,
          };
        });

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

  /** 应用/取消小红书风格封面模板;已有旧单条文字时迁移为主标题 */
  function applyCoverTemplate(t: CoverTemplate) {
    if (cover.coverTemplateId === t.id) {
      setCover({ ...cover, coverTemplateId: undefined, coverTexts: undefined });
      return;
    }
    const prev =
      cover.coverTexts ?? (cover.text ? [{ id: "cover-main", content: cover.text }] : undefined);
    setCover({
      ...cover,
      coverTemplateId: t.id,
      coverTexts: coverTemplateToOverlays(t, prev),
      text: undefined,
      templateId: undefined,
    });
  }

  function updateLayer(id: string, patch: Partial<TextOverlay>) {
    setCover((c) => ({
      ...c,
      coverTexts: c.coverTexts?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  function moveLayer(id: string, dx: number, dy: number) {
    setCover((c) => ({
      ...c,
      coverTexts: c.coverTexts?.map((t) =>
        t.id === id
          ? {
              ...t,
              x: Math.max(2, Math.min(98, t.x + dx)),
              y: Math.max(2, Math.min(98, t.y + dy)),
            }
          : t
      ),
    }));
  }

  const ratioClass: Record<Draft["aspectRatio"], string> = {
    "9:16": "aspect-[3/4]", // 小红书封面常用 3:4 展示区
    "1:1": "aspect-square",
    "16:9": "aspect-video",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-zinc-100">封面制作</h2>
            <div className="flex rounded-lg bg-zinc-800 p-0.5">
              {(
                [
                  { id: "edit", label: "封面编辑" },
                  { id: "feed", label: "瀑布流预览" },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    view === v.id ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            ✕
          </button>
        </div>

        {view === "feed" ? (
          /* F-61 瀑布流预览:模拟小红书首页双列信息流 + 3:4 裁切安全区 */
          <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto p-5">
            <div className="w-[360px] shrink-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="mb-3 flex items-center justify-center gap-6 text-xs text-zinc-500">
                <span>关注</span>
                <span className="relative font-semibold text-zinc-100">
                  发现
                  <span className="absolute -bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded bg-[#ff2442]" />
                </span>
                <span>附近</span>
              </div>
              <div className="grid grid-cols-2 items-start gap-2">
                <GhostCard tall />
                {/* 你的封面卡片 */}
                <div className="overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-[#ff2442]">
                  <div
                    ref={cardRef}
                    className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-black"
                  >
                    {cover.frameThumbnail ? (
                      <div
                        className="relative flex h-full shrink-0 items-center justify-center"
                        style={{ aspectRatio: COVER_RATIO_CSS[draft.aspectRatio] }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cover.frameThumbnail}
                          alt="封面帧"
                          className="h-full w-full object-cover"
                        />
                        <CoverTextLayers cover={cover} heightPx={cardH} />
                      </div>
                    ) : (
                      <p className="px-3 text-center text-[11px] text-zinc-600">
                        先在「封面编辑」里选取封面帧
                      </p>
                    )}
                    {/* 3:4 裁切安全区 */}
                    <div className="pointer-events-none absolute inset-[6%] rounded-md border border-dashed border-[#ff2442]/90" />
                    <span className="pointer-events-none absolute left-[6%] top-[6%] rounded-br bg-[#ff2442]/90 px-1 py-0.5 text-[9px] leading-none text-white">
                      安全区
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 p-2">
                    <p className="line-clamp-2 text-[11px] leading-4 text-zinc-300">
                      {draft.publish?.title || draft.title}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3.5 w-3.5 rounded-full bg-zinc-700" />
                      <div className="h-2 w-12 rounded bg-zinc-800" />
                      <span className="ml-auto text-[10px] text-zinc-600">♡ 99+</span>
                    </div>
                  </div>
                </div>
                <GhostCard />
                <GhostCard tall />
                <GhostCard tall />
                <GhostCard />
              </div>
            </div>
            <p className="max-w-[380px] text-center text-[11px] leading-4 text-zinc-500">
              首页信息流按 3:4 裁切展示封面,虚线框内为安全区:
              标题等关键信息请保持在框内,超出部分可能被裁掉或被圆角遮挡。
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-4 overflow-y-auto p-5">
            {/* 封面预览 */}
            <div className="w-52 shrink-0">
              <div
                ref={previewRef}
                className={`relative flex items-center justify-center overflow-hidden rounded-lg bg-black ${ratioClass[draft.aspectRatio]}`}
              >
                {cover.frameThumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover.frameThumbnail} alt="封面帧" className="h-full w-full object-cover" />
                ) : (
                  <p className="px-4 text-center text-xs text-zinc-600">
                    {isGallery ? "从右侧选择一张图片作为封面" : "从下方帧预览器选取封面帧"}
                  </p>
                )}
                <CoverTextLayers cover={cover} heightPx={previewH} onDragLayer={moveLayer} />
              </div>
              <p className="mt-2 text-[11px] leading-4 text-zinc-600">
                {cover.coverTexts?.length
                  ? "拖动预览上的标题可调整位置;导出时按所选帧全分辨率合成 JPG"
                  : "导出时按所选帧全分辨率合成 JPG"}
              </p>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-4">
              {/* F-19 帧预览器 */}
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-400">
                  {isGallery ? "选择封面图片" : "帧预览器"}
                </p>
                {frames.length === 0 ? (
                  <p className="rounded-lg bg-zinc-800/60 px-3 py-2 text-xs text-zinc-500">
                    {isGallery ? "轮播里还没有图片,先添加图片" : "时间轴还没有带画面的片段,先导入素材"}
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
                          {f.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* F-61 小红书风格封面模板库(按配色分组) */}
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-400">封面模板(小红书风格)</p>
                <div className="flex flex-col gap-3">
                  {COVER_PALETTES.map((p) => (
                    <div key={p.id}>
                      <p className="mb-1.5 text-[11px] text-zinc-500">
                        {p.name}
                        <span className="ml-1.5 text-zinc-600">{p.hint}</span>
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {COVER_TEMPLATES.filter((t) => t.palette === p.id).map((t) => (
                          <TemplateThumb
                            key={t.id}
                            template={t}
                            selected={cover.coverTemplateId === t.id}
                            onClick={() => applyCoverTemplate(t)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 模板标题微调 */}
              {cover.coverTexts?.length ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-400">标题微调</p>
                  <div className="flex flex-col gap-2.5">
                    {cover.coverTexts.map((t) => (
                      <div key={t.id} className="rounded-lg border border-zinc-800 p-2.5">
                        <p className="mb-1.5 text-[11px] text-zinc-500">
                          {t.id === "cover-main" ? "主标题" : "副标题"}
                        </p>
                        <textarea
                          value={t.content}
                          onChange={(e) => updateLayer(t.id, { content: e.target.value })}
                          rows={t.id === "cover-main" ? 2 : 1}
                          className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-[#ff2442]"
                        />
                        <div className="mt-2 flex items-center gap-3">
                          <Field label="字体">
                            <FontSelect
                              value={t.fontFamily}
                              onChange={(id) => updateLayer(t.id, { fontFamily: id })}
                            />
                          </Field>
                          <Field label={`字号 ${t.fontSize}`}>
                            <input
                              type="range"
                              min={20}
                              max={96}
                              value={t.fontSize}
                              onChange={(e) => updateLayer(t.id, { fontSize: Number(e.target.value) })}
                              className="w-full accent-[#ff2442]"
                            />
                          </Field>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <Field label="文字色">
                            <input
                              type="color"
                              value={t.color}
                              onChange={(e) => updateLayer(t.id, { color: e.target.value })}
                              className="h-8 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent"
                            />
                          </Field>
                          <OptionalColorField
                            label="背景色"
                            value={t.background || undefined}
                            fallback="#ffffff"
                            onChange={(v) => updateLayer(t.id, { background: v })}
                          />
                          <label className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400">
                            <input
                              type="checkbox"
                              checked={t.fontWeight === "bold"}
                              onChange={(e) =>
                                updateLayer(t.id, { fontWeight: e.target.checked ? "bold" : "normal" })
                              }
                              className="accent-[#ff2442]"
                            />
                            加粗
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* F-20 封面文字(未套用封面模板时的单条文字) */}
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
                </>
              )}
            </div>
          </div>
        )}

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
