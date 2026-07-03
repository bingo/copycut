"use client";

import { useRef, useState } from "react";
import { getTransition } from "@/lib/data/transitions";
import { getTrack } from "@/lib/data/music";
import { formatDuration } from "@/lib/media";
import type { EditorState } from "./useEditorState";

const PX_PER_SEC = 48;

/**
 * 时间轴:主轨片段排列(F-04)、分割(F-05)、拖拽修剪(F-06)、
 * 删除吸合(F-07)、拖拽排序(F-08)、播放头联动(F-10)、
 * 转场标记(F-14)、音乐轨(F-17)。
 */
export default function Timeline({ editor }: { editor: EditorState }) {
  const {
    draft,
    clips,
    selection,
    setSelection,
    playhead,
    setPlayhead,
    setPlaying,
    totalDuration,
    pushHistory,
    undo,
    redo,
    splitAtPlayhead,
    trimClip,
    deleteClip,
    reorderClip,
    apply,
  } = editor;

  const trackRef = useRef<HTMLDivElement>(null);
  const trim = useRef<{ clipId: string; edge: "start" | "end"; baseValue: number; baseX: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const selectedClipId = selection?.type === "clip" ? selection.id : null;

  function seekFromEvent(e: React.PointerEvent) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left + track.scrollLeft;
    setPlaying(false);
    setPlayhead(Math.max(0, Math.min(totalDuration, x / PX_PER_SEC)));
  }

  function onTrimPointerDown(
    e: React.PointerEvent,
    clipId: string,
    edge: "start" | "end",
    baseValue: number
  ) {
    e.stopPropagation();
    pushHistory();
    trim.current = { clipId, edge, baseValue, baseX: e.clientX };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onTrimPointerMove(e: React.PointerEvent) {
    const t = trim.current;
    if (!t) return;
    const delta = (e.clientX - t.baseX) / PX_PER_SEC;
    trimClip(t.clipId, t.edge, t.baseValue + delta, { undoable: false });
  }

  function onTrimPointerUp() {
    trim.current = null;
  }

  if (!draft) return null;

  const musicTrack = draft.music ? getTrack(draft.music.trackId) : undefined;

  return (
    <footer className="flex h-52 shrink-0 flex-col border-t border-zinc-800">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 border-b border-zinc-800/60 px-3 py-1.5 text-xs text-zinc-400">
        <ToolButton onClick={undo} title="撤销 (⌘Z)">↩ 撤销</ToolButton>
        <ToolButton onClick={redo} title="重做 (⌘⇧Z)">↪ 重做</ToolButton>
        <span className="mx-1 text-zinc-700">|</span>
        <ToolButton onClick={splitAtPlayhead} title="在播放头处分割选中片段">✂ 分割</ToolButton>
        <ToolButton
          onClick={() => selectedClipId && deleteClip(selectedClipId)}
          title="删除选中片段"
        >
          🗑 删除
        </ToolButton>
        <span className="ml-auto font-mono text-zinc-500">
          {formatDuration(playhead)} / {formatDuration(totalDuration)}
        </span>
      </div>

      {/* 轨道区 */}
      <div ref={trackRef} className="relative flex-1 overflow-x-auto overflow-y-hidden">
        <div
          className="relative flex h-full min-w-full flex-col gap-1.5 px-3 py-2"
          style={{ width: totalDuration * PX_PER_SEC + 120 }}
        >
          {/* 刻度尺,点击/拖动定位播放头 */}
          <div
            className="relative h-5 shrink-0 cursor-pointer select-none"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              seekFromEvent(e);
            }}
            onPointerMove={(e) => e.buttons === 1 && seekFromEvent(e)}
          >
            {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
              <span
                key={i}
                className="absolute top-0 border-l border-zinc-700 pl-1 text-[10px] text-zinc-600"
                style={{ left: i * PX_PER_SEC }}
              >
                {i % 5 === 0 ? `${i}s` : ""}
              </span>
            ))}
          </div>

          {/* 主轨道 */}
          {clips.length === 0 ? (
            <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-600">
              主轨道 · 从左侧素材面板添加片段
            </div>
          ) : (
            <div className="flex h-16 shrink-0 items-stretch">
              {clips.map((clip, index) => {
                const dur = clip.end - clip.start;
                const selected = clip.id === selectedClipId;
                const transition = getTransition(clip.transitionAfter);
                return (
                  <div key={clip.id} className="flex items-stretch">
                    <div
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragEnd={() => {
                        if (dragIndex !== null && dropIndex !== null) reorderClip(dragIndex, dropIndex);
                        setDragIndex(null);
                        setDropIndex(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDropIndex(index);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelection({ type: "clip", id: clip.id });
                      }}
                      className={`relative shrink-0 cursor-grab overflow-hidden rounded-md border-2 bg-zinc-800 active:cursor-grabbing ${
                        selected ? "border-[#ff2442]" : "border-zinc-700 hover:border-zinc-500"
                      } ${dropIndex === index && dragIndex !== null && dragIndex !== index ? "outline outline-2 outline-[#ff2442]/60" : ""}`}
                      style={{ width: Math.max(dur * PX_PER_SEC, 24) }}
                    >
                      {clip.thumbnail && (
                        <div
                          className="absolute inset-0 opacity-70"
                          style={{
                            backgroundImage: `url(${clip.thumbnail})`,
                            backgroundSize: "auto 100%",
                            backgroundRepeat: "repeat-x",
                          }}
                        />
                      )}
                      <span className="absolute bottom-0.5 left-1 right-1 truncate text-[10px] text-zinc-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                        {clip.name} · {dur.toFixed(1)}s
                      </span>
                      {selected && (
                        <>
                          <TrimHandle
                            side="left"
                            onPointerDown={(e) => onTrimPointerDown(e, clip.id, "start", clip.start)}
                            onPointerMove={onTrimPointerMove}
                            onPointerUp={onTrimPointerUp}
                          />
                          <TrimHandle
                            side="right"
                            onPointerDown={(e) => onTrimPointerDown(e, clip.id, "end", clip.end)}
                            onPointerMove={onTrimPointerMove}
                            onPointerUp={onTrimPointerUp}
                          />
                        </>
                      )}
                    </div>
                    {/* 片段间转场标记(最后一个片段后不显示) */}
                    {index < clips.length - 1 && (
                      <button
                        type="button"
                        title={transition ? `转场:${transition.name}(点击移除)` : "在转场面板中为选中片段添加转场"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (transition) {
                            apply({
                              clips: clips.map((c) =>
                                c.id === clip.id ? { ...c, transitionAfter: undefined } : c
                              ),
                            });
                          } else {
                            setSelection({ type: "clip", id: clip.id });
                          }
                        }}
                        className={`z-10 -mx-2 my-auto flex h-5 w-5 items-center justify-center self-center rounded-full border text-[10px] ${
                          transition
                            ? "border-[#ff2442] bg-[#ff2442] text-white"
                            : "border-zinc-600 bg-zinc-900 text-zinc-500 hover:border-zinc-400"
                        }`}
                      >
                        {transition ? transition.icon : "+"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 音乐轨(F-17/F-18) */}
          {musicTrack && (
            <div
              className="flex h-7 shrink-0 items-center gap-2 overflow-hidden rounded-md bg-emerald-900/60 px-2 text-[11px] text-emerald-300"
              style={{ width: Math.min(musicTrack.duration, Math.max(totalDuration, 1)) * PX_PER_SEC }}
            >
              ♪ {musicTrack.name}
              {draft.music?.fadeIn && <span className="text-emerald-500">⟋淡入</span>}
              {draft.music?.fadeOut && <span className="text-emerald-500">淡出⟍</span>}
              <span className="ml-auto">{draft.music?.volume}%</span>
            </div>
          )}

          {/* 播放头 */}
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-[#ff2442]"
            style={{ left: playhead * PX_PER_SEC + 12 }}
          >
            <div className="-ml-[5px] h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-[#ff2442]" />
          </div>
        </div>
      </div>
    </footer>
  );
}

function ToolButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded px-2 py-1 hover:bg-zinc-800 hover:text-zinc-200"
    >
      {children}
    </button>
  );
}

function TrimHandle({
  side,
  ...handlers
}: {
  side: "left" | "right";
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
}) {
  return (
    <div
      {...handlers}
      className={`absolute bottom-0 top-0 z-10 flex w-2.5 cursor-ew-resize touch-none items-center justify-center bg-[#ff2442] ${
        side === "left" ? "left-0 rounded-l" : "right-0 rounded-r"
      }`}
    >
      <div className="h-6 w-0.5 rounded bg-white/80" />
    </div>
  );
}
