"use client";

import { useRef, useState } from "react";
import { filterToCss, getFilter } from "@/lib/data/filters";
import { colorAdjustToCss } from "@/lib/color";
import { formatDuration } from "@/lib/media";
import type { Draft } from "@/lib/types";
import type { EditorState } from "./useEditorState";

const CANVAS_RATIO: Record<Draft["aspectRatio"], string> = {
  "9:16": "aspect-[9/16] h-full max-h-full",
  "1:1": "aspect-square h-full max-h-full",
  "16:9": "aspect-video w-full max-w-full",
};

/**
 * 预览区:当前帧画面(F-10 播放联动)+ 滤镜/调色实时样式 +
 * 文字叠层拖拽 + 手机预览框(F-11)。
 */
export default function PreviewArea({ editor }: { editor: EditorState }) {
  const {
    draft,
    assets,
    playhead,
    setPlayhead,
    playing,
    setPlaying,
    totalDuration,
    clipAtPlayhead,
    selection,
    setSelection,
    apply,
  } = editor;
  const [phoneFrame, setPhoneFrame] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragText = useRef<{ id: string; startX: number; startY: number } | null>(null);

  if (!draft) return null;

  const hit = clipAtPlayhead();
  const currentClip = hit?.[0] ?? draft.clips[0];
  const asset = assets.find((a) => a.id === currentClip?.assetId);
  const frameSrc = asset?.thumbnail ?? currentClip?.thumbnail;

  const cssFilter = [
    filterToCss(getFilter(draft.filterId), draft.filterStrength),
    colorAdjustToCss(draft.colorAdjust),
  ]
    .filter(Boolean)
    .join(" ");

  function onTextPointerDown(e: React.PointerEvent, textId: string) {
    e.stopPropagation();
    setSelection({ type: "text", id: textId });
    dragText.current = { id: textId, startX: e.clientX, startY: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onTextPointerMove(e: React.PointerEvent) {
    const drag = dragText.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas || !draft) return;
    const rect = canvas.getBoundingClientRect();
    const dx = ((e.clientX - drag.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.startY) / rect.height) * 100;
    if (dx === 0 && dy === 0) return;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    // 拖拽过程不进撤销栈,松手时的位置即最终状态
    apply(
      {
        texts: draft.texts.map((t) =>
          t.id === drag.id
            ? { ...t, x: Math.max(2, Math.min(98, t.x + dx)), y: Math.max(2, Math.min(98, t.y + dy)) }
            : t
        ),
      },
      { undoable: false }
    );
  }

  function onTextPointerUp() {
    dragText.current = null;
  }

  const canvas = (
    <div
      ref={canvasRef}
      className={`relative flex items-center justify-center overflow-hidden bg-black ${
        phoneFrame ? "h-full w-full rounded-[28px]" : `rounded-lg shadow-lg ${CANVAS_RATIO[draft.aspectRatio]}`
      }`}
      onClick={() => setSelection(null)}
    >
      {frameSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={frameSrc}
          alt="当前画面"
          className="h-full w-full object-contain"
          style={cssFilter ? { filter: cssFilter } : undefined}
          draggable={false}
        />
      ) : (
        <p className="px-6 text-center text-sm text-zinc-600">
          预览区({draft.aspectRatio})
          <br />
          导入素材后显示画面
        </p>
      )}

      {/* F-15 文字叠层 */}
      {draft.texts.map((t) => (
        <div
          key={t.id}
          onPointerDown={(e) => onTextPointerDown(e, t.id)}
          onPointerMove={onTextPointerMove}
          onPointerUp={onTextPointerUp}
          className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move touch-none select-none whitespace-pre-wrap rounded px-2 py-0.5 text-center leading-snug ${
            selection?.type === "text" && selection.id === t.id
              ? "ring-2 ring-[#ff2442]"
              : "hover:ring-1 hover:ring-zinc-500"
          }`}
          style={{
            left: `${t.x}%`,
            top: `${t.y}%`,
            color: t.color,
            background: t.background,
            fontWeight: t.fontWeight,
            fontSize: `${t.fontSize * 0.5}px`,
          }}
        >
          {t.content}
        </div>
      ))}
    </div>
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        {phoneFrame ? (
          // F-11 手机边框样式(9:16 机身,含刘海和底部条)
          <div className="relative flex aspect-[9/19] h-full max-h-full flex-col rounded-[36px] border-[6px] border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl">
            <div className="absolute left-1/2 top-2.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-zinc-800" />
            <div className="min-h-0 flex-1 overflow-hidden rounded-[28px]">{canvas}</div>
            <div className="absolute bottom-2 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-zinc-600" />
          </div>
        ) : (
          canvas
        )}
      </div>

      {/* 播放控制条 */}
      <div className="flex shrink-0 items-center justify-center gap-4 pb-3">
        <span className="w-24 text-right font-mono text-xs text-zinc-500">
          {formatDuration(playhead)} / {formatDuration(totalDuration)}
        </span>
        <button
          type="button"
          onClick={() => {
            if (totalDuration === 0) return;
            if (!playing && playhead >= totalDuration) setPlayhead(0);
            setPlaying(!playing);
          }}
          disabled={totalDuration === 0}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          title={playing ? "暂停" : "播放"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          onClick={() => setPhoneFrame(!phoneFrame)}
          className={`w-24 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
            phoneFrame
              ? "border-[#ff2442] text-[#ff2442]"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
          }`}
        >
          {phoneFrame ? "退出手机预览" : "手机预览"}
        </button>
      </div>
    </main>
  );
}
