"use client";

import { useRef, useState } from "react";
import { loadAsset } from "@/lib/media";
import { filterToCss, getFilter, FILTERS } from "@/lib/data/filters";
import type { GalleryImage } from "@/lib/types";
import type { EditorState } from "./useEditorState";

/**
 * 图文轮播模式(F-36):多图上传 + 拖拽排序 + 每图文字;
 * F-37 统一滤镜一键应用到全部图片(预览态)。
 */
export default function GalleryEditor({ editor }: { editor: EditorState }) {
  const { draft, apply } = editor;
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);

  if (!draft) return null;
  const images = draft.gallery;
  const active = images.find((g) => g.id === activeId) ?? images[0];
  const cssFilter = filterToCss(getFilter(draft.filterId), draft.filterStrength);

  async function importFiles(files: FileList) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0 || !draft) return;
    setImporting(true);
    try {
      const assets = await Promise.all(list.map(loadAsset));
      const added: GalleryImage[] = assets.map((a) => ({
        id: a.id,
        name: a.name,
        thumbnail: a.thumbnail,
        caption: "",
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
            <div className="relative flex max-h-[70%] items-center justify-center overflow-hidden rounded-lg bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.thumbnail}
                alt={active.name}
                className="max-h-full max-w-full object-contain"
                style={cssFilter ? { filter: cssFilter } : undefined}
              />
              {active.caption && (
                <span className="absolute bottom-3 left-1/2 max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-2 py-1 text-center text-sm text-white">
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
