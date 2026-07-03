"use client";

import { useRef, useState } from "react";
import { formatDuration } from "@/lib/media";
import type { EditorState } from "./useEditorState";

/** F-02 本地素材导入:视频+图片,写入 OPFS 持久化,重开草稿自动恢复 */
export default function MediaPanel({ editor }: { editor: EditorState }) {
  const { assets, importAssets, addClipFromAsset } = editor;
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function importFiles(files: FileList | File[]) {
    setImporting(true);
    try {
      await importAssets(Array.from(files));
    } finally {
      setImporting(false);
    }
  }

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
