"use client";

import { useRef, useState } from "react";
import { formatDuration, loadAsset } from "@/lib/media";
import type { EditorState } from "./useEditorState";

/** F-02 本地素材导入:视频+图片,生成预览缩略图(素材仅会话内有效) */
export default function MediaPanel({ editor }: { editor: EditorState }) {
  const { assets, setAssets, addClipFromAsset, clips } = editor;
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function importFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(
      (f) => f.type.startsWith("video/") || f.type.startsWith("image/")
    );
    if (list.length === 0) return;
    setImporting(true);
    try {
      const loaded = await Promise.all(list.map(loadAsset));
      setAssets((prev) => [...prev, ...loaded]);
    } finally {
      setImporting(false);
    }
  }

  // 有片段引用了会话中不存在的素材 → 提示重新关联(PRD 技术约束)
  const needRelink =
    clips.some((c) => c.assetId && !assets.some((a) => a.id === c.assetId)) &&
    assets.length === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) importFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="p-3">
        <div
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed py-6 transition-colors ${
            dragOver
              ? "border-[#ff2442] bg-[#ff2442]/5"
              : "border-zinc-700 hover:border-zinc-500"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            importFiles(e.dataTransfer.files);
          }}
        >
          <p className="text-sm text-zinc-400">{importing ? "导入中…" : "点击或拖入视频 / 图片"}</p>
          <p className="text-xs text-zinc-600">MP4 / MOV / JPG / PNG</p>
        </div>
        {needRelink && (
          <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-500">
            该草稿的素材未随浏览器会话保留,请重新导入并关联素材(Alpha 阶段素材不持久化)
          </p>
        )}
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto px-3 pb-3">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
          >
            <div className="relative aspect-video bg-black">
              {/* 缩略图为小尺寸 dataURL,用 img 即可 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.thumbnail}
                alt={asset.name}
                className="h-full w-full object-contain"
              />
              <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-zinc-300">
                {asset.type === "video" ? formatDuration(asset.duration) : "图片"}
              </span>
              <button
                type="button"
                onClick={() => addClipFromAsset(asset)}
                className="absolute inset-0 hidden items-center justify-center bg-black/50 text-xs font-medium text-white group-hover:flex"
              >
                + 添加到时间轴
              </button>
            </div>
            <p className="truncate px-1.5 py-1 text-[11px] text-zinc-400">{asset.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
