"use client";

import { useEffect, useRef, useState } from "react";
import { assetService } from "@/lib/services/assets";
import { filterToCss, getFilter, FILTERS } from "@/lib/data/filters";
import { getFont } from "@/lib/data/fonts";
import { DEFAULT_CAPTION_STYLE } from "@/lib/engine/compose-image";
import type { CaptionStyle, GalleryImage } from "@/lib/types";
import { Field, FontSelect, OptionalColorField } from "./fields";
import type { EditorState } from "./useEditorState";

/**
 * 图文轮播模式(F-36):多图上传(OPFS 持久化)+ 拖拽排序 + 每图文字;
 * F-37 统一滤镜一键应用到全部图片,导出时真实渲染。
 */
export default function GalleryEditor({ editor }: { editor: EditorState }) {
  const { draft, apply } = editor;
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  /** assetId → 全尺寸 object URL(大图预览用,缺失时退化到缩略图) */
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  /** 预览框实高,文字字号按 fontSize × 高/1000 换算(与导出同标尺) */
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewH, setPreviewH] = useState(0);
  const dragCaption = useRef<{ x: number; y: number } | null>(null);

  const gallery = draft?.gallery;
  useEffect(() => {
    if (!gallery) return;
    let cancelled = false;
    for (const item of gallery) {
      if (!item.assetId || fullUrls[item.assetId] !== undefined) continue;
      assetService.load(item.assetId).then((asset) => {
        if (!cancelled && asset)
          setFullUrls((prev) => ({ ...prev, [asset.id]: asset.url }));
      });
    }
    return () => {
      cancelled = true;
    };
    // fullUrls 仅作缓存,不触发重新加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery]);

  // 预览框随图片/窗口变化,持续跟踪实高保证文字比例与导出一致
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPreviewH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  });

  if (!draft) return null;
  const images = draft.gallery;
  const active = images.find((g) => g.id === activeId) ?? images[0];
  const cssFilter = filterToCss(getFilter(draft.filterId), draft.filterStrength);
  const activeUrl = (active?.assetId && fullUrls[active.assetId]) || active?.thumbnail;
  const captionStyle = { ...DEFAULT_CAPTION_STYLE, ...active?.captionStyle };

  async function importFiles(files: FileList) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0 || !draft) return;
    setImporting(true);
    try {
      const assets = await Promise.all(list.map((f) => assetService.importFile(f)));
      const added: GalleryImage[] = assets.map((a) => ({
        id: crypto.randomUUID(),
        name: a.name,
        thumbnail: a.thumbnail,
        caption: "",
        assetId: a.id,
      }));
      setFullUrls((prev) => ({
        ...prev,
        ...Object.fromEntries(assets.map((a) => [a.id, a.url])),
      }));
      apply({ gallery: [...draft.gallery, ...added] });
      setActiveId(added[0].id);
    } finally {
      setImporting(false);
    }
  }

  function move(from: number, to: number) {
    if (!draft || from === to) return;
    const next = [...draft.gallery];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    apply({ gallery: next });
  }

  function updateStyle(patch: Partial<CaptionStyle>, opts?: { undoable?: boolean }) {
    if (!draft || !active) return;
    apply(
      {
        gallery: images.map((g) =>
          g.id === active.id
            ? { ...g, captionStyle: { ...DEFAULT_CAPTION_STYLE, ...g.captionStyle, ...patch } }
            : g
        ),
      },
      opts
    );
  }

  function onCaptionPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragCaption.current = { x: e.clientX, y: e.clientY };
  }

  function onCaptionPointerMove(e: React.PointerEvent) {
    const drag = dragCaption.current;
    const box = previewRef.current?.getBoundingClientRect();
    if (!drag || !box) return;
    const dx = ((e.clientX - drag.x) / box.width) * 100;
    const dy = ((e.clientY - drag.y) / box.height) * 100;
    dragCaption.current = { x: e.clientX, y: e.clientY };
    updateStyle(
      {
        x: Math.max(2, Math.min(98, captionStyle.x + dx)),
        y: Math.max(2, Math.min(98, captionStyle.y + dy)),
      },
      { undoable: false }
    );
  }

  function onCaptionPointerUp() {
    dragCaption.current = null;
  }

  return (
    <div className="flex min-h-0 flex-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) importFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* 左:图片序列 */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="text-sm font-medium">图片序列({images.length})</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded bg-[#ff2442] px-2 py-1 text-xs text-white hover:opacity-90"
          >
            {importing ? "导入中…" : "+ 上传"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {images.length === 0 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-zinc-700 py-10 text-sm text-zinc-500 hover:border-zinc-500"
            >
              上传多张图片
              <span className="text-xs text-zinc-600">支持 JPG / PNG,可拖拽排序</span>
            </button>
          )}
          {images.map((img, index) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              onClick={() => setActiveId(img.id)}
              className={`mb-2 flex cursor-pointer items-center gap-2 rounded-lg border p-2 ${
                active?.id === img.id
                  ? "border-[#ff2442] bg-[#ff2442]/5"
                  : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <span className="w-5 text-center text-xs text-zinc-500">{index + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumbnail}
                alt={img.name}
                className="h-12 w-12 rounded object-cover"
                style={cssFilter ? { filter: cssFilter } : undefined}
                draggable={false}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-zinc-300">{img.name}</p>
                <p className="truncate text-[11px] text-zinc-500">{img.caption || "无文字"}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  apply({ gallery: images.filter((g) => g.id !== img.id) });
                }}
                className="text-xs text-zinc-600 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* 中:当前图预览 */}
      <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 p-6">
        {active ? (
          <>
            <div
              ref={previewRef}
              className="relative flex max-h-[70%] items-center justify-center overflow-hidden rounded-lg bg-black"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeUrl}
                alt={active.name}
                className="max-h-full max-w-full object-contain"
                style={cssFilter ? { filter: cssFilter } : undefined}
              />
              {active.caption && (
                <span
                  onPointerDown={onCaptionPointerDown}
                  onPointerMove={onCaptionPointerMove}
                  onPointerUp={onCaptionPointerUp}
                  className="absolute max-w-[90%] -translate-x-1/2 -translate-y-1/2 cursor-move touch-none select-none whitespace-pre-wrap rounded px-2 py-1 text-center leading-snug hover:ring-1 hover:ring-zinc-500"
                  style={{
                    left: `${captionStyle.x}%`,
                    top: `${captionStyle.y}%`,
                    color: captionStyle.color,
                    background: captionStyle.background || undefined,
                    fontWeight: captionStyle.fontWeight,
                    fontFamily: getFont(captionStyle.fontFamily).css,
                    fontSize: Math.max(9, (captionStyle.fontSize * previewH) / 1000),
                  }}
                >
                  {active.caption}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              第 {images.findIndex((g) => g.id === active.id) + 1} / {images.length} 张
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-600">上传图片后在此预览轮播效果</p>
        )}
      </main>

      {/* 右:每图文字 + 统一滤镜 */}
      <aside className="flex w-72 shrink-0 flex-col border-l border-zinc-800">
        <div className="border-b border-zinc-800 px-4 py-3 text-sm font-medium">图片设置</div>
        {active ? (
          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            <div>
              <p className="mb-1 text-xs text-zinc-500">本图文字</p>
              <textarea
                value={active.caption}
                onChange={(e) =>
                  apply(
                    {
                      gallery: images.map((g) =>
                        g.id === active.id ? { ...g, caption: e.target.value } : g
                      ),
                    },
                    { undoable: false }
                  )
                }
                placeholder="为这张图添加说明文字"
                rows={3}
                className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-[#ff2442]"
              />
              <p className="mt-1 text-[11px] leading-4 text-zinc-600">
                在中间预览图上拖动文字可调整位置
              </p>
            </div>

            <Field label="字体">
              <FontSelect
                value={captionStyle.fontFamily}
                onChange={(id) => updateStyle({ fontFamily: id })}
              />
            </Field>

            <Field label={`字号 ${captionStyle.fontSize}`}>
              <input
                type="range"
                min={12}
                max={72}
                value={captionStyle.fontSize}
                onChange={(e) =>
                  updateStyle({ fontSize: Number(e.target.value) }, { undoable: false })
                }
                className="w-full accent-[#ff2442]"
              />
            </Field>

            <div className="flex items-center gap-4">
              <Field label="文字色">
                <input
                  type="color"
                  value={captionStyle.color}
                  onChange={(e) => updateStyle({ color: e.target.value })}
                  className="h-8 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent"
                />
              </Field>
              <OptionalColorField
                label="背景色"
                value={captionStyle.background || undefined}
                fallback="#111111"
                onChange={(v) => updateStyle({ background: v ?? "" })}
              />
              <label className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={captionStyle.fontWeight === "bold"}
                  onChange={(e) =>
                    updateStyle({ fontWeight: e.target.checked ? "bold" : "normal" })
                  }
                  className="accent-[#ff2442]"
                />
                加粗
              </label>
            </div>

            <div>
              <p className="mb-2 text-xs text-zinc-500">统一滤镜(应用到全部图片)</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => apply({ filterId: undefined })}
                  className={`flex aspect-square items-center justify-center rounded-lg border text-lg text-zinc-500 ${
                    !draft.filterId ? "border-[#ff2442]" : "border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  ∅
                </button>
                {FILTERS.filter((f) => f.category === "小红书风").map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    title={f.name}
                    onClick={() => apply({ filterId: f.id })}
                    className={`aspect-square rounded-lg border bg-gradient-to-br from-rose-300 via-amber-200 to-sky-400 ${
                      draft.filterId === f.id ? "border-[#ff2442]" : "border-zinc-800 hover:border-zinc-600"
                    }`}
                    style={{ filter: filterToCss(f, 100) }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="p-4 text-center text-sm text-zinc-600">选择一张图片进行设置</p>
        )}
      </aside>
    </div>
  );
}
