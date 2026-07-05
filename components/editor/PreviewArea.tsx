"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { filterToCss, getFilter } from "@/lib/data/filters";
import { getFont } from "@/lib/data/fonts";
import { colorAdjustToCss } from "@/lib/color";
import { formatDuration } from "@/lib/media";
import { getTrack } from "@/lib/data/music";
import { extractVideoFrame, loadImageElement } from "@/lib/engine/compose-image";
import {
  TRANSITION_DURATION,
  drawTransitionFrame,
  type TransitionSource,
} from "@/lib/engine/transitions";
import type { Draft } from "@/lib/types";
import type { EditorState } from "./useEditorState";

const CANVAS_RATIO: Record<Draft["aspectRatio"], string> = {
  "9:16": "aspect-[9/16] h-full max-h-full",
  "1:1": "aspect-square h-full max-h-full",
  "16:9": "aspect-video w-full max-w-full",
};

/** 播放中允许的音画漂移,超过则纠偏 seek */
const DRIFT_TOLERANCE = 0.3;

/** 转场边界一侧的取帧点 */
interface FramePoint {
  assetId: string;
  time: number;
}

/** 预览转场边界:时间轴时刻 + 前后片段的取帧点 */
interface PreviewBoundary {
  time: number;
  type: string;
  prev: FramePoint;
  next: FramePoint;
}

/** 帧缓存键;时间取整到 0.1s,拖拽修剪过程中不至于每帧重新抽帧 */
const frameKey = (p: FramePoint) => `${p.assetId}@${p.time.toFixed(1)}`;

/**
 * 预览区:真实 <video>/<img> 播放(F-10),播放头由 rAF 时钟驱动、
 * 视频元素跟随同步;滤镜/调色为 CSS 实时预览(与导出 WebGL 数学等价);
 * 文字叠层拖拽 + 手机预览框(F-11)+ BGM 跟播。
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const dragText = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const transitionCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameCache = useRef(new Map<string, TransitionSource>());
  /** 抽帧完成后递增,触发转场层重绘(缓存本身放 ref 不重渲染) */
  const [framesVersion, setFramesVersion] = useState(0);

  const hit = clipAtPlayhead();
  const currentClip = hit?.[0] ?? draft?.clips[0];
  const clipOffset = hit?.[1] ?? 0;
  const asset = assets.find((a) => a.id === currentClip?.assetId);
  /** 素材未恢复时退化为片段缩略图静帧 */
  const fallbackFrame = currentClip?.thumbnail;
  const musicTrack = getTrack(draft?.music?.trackId);

  // 视频元素跟随播放头:播放时纠偏,暂停/拖动时精确 seek
  const expected = currentClip ? currentClip.start + clipOffset : 0;
  useEffect(() => {
    const video = videoRef.current;
    if (!video || asset?.type !== "video") return;
    if (playing) {
      if (video.paused) video.play().catch(() => {});
      if (Math.abs(video.currentTime - expected) > DRIFT_TOLERANCE)
        video.currentTime = expected;
    } else {
      if (!video.paused) video.pause();
      if (Math.abs(video.currentTime - expected) > 0.05) video.currentTime = expected;
    }
  }, [playing, expected, asset?.url, asset?.type]);

  // BGM 跟播(试听级:音量生效,淡入淡出在导出时体现)
  const playheadRef = useRef(playhead);
  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);
  useEffect(() => {
    const bgm = bgmRef.current;
    if (!bgm) return;
    bgm.volume = (draft?.music?.volume ?? 60) / 100;
    if (playing && musicTrack) {
      if (bgm.paused) {
        // 从播放头对应位置起播(BGM 自时间轴 0 点循环铺底)
        bgm.currentTime = playheadRef.current % Math.max(musicTrack.duration, 0.1);
        bgm.play().catch(() => {});
      }
    } else if (!bgm.paused) {
      bgm.pause();
    }
  }, [playing, musicTrack, draft?.music?.volume]);

  // ---- F-14 预览转场:边界前后各 0.25s 用预取的边界帧绘制真实转场 ----

  const clipList = draft?.clips;
  const boundaries = useMemo<PreviewBoundary[]>(() => {
    const list: PreviewBoundary[] = [];
    const cs = clipList ?? [];
    let acc = 0;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      acc += c.end - c.start;
      const n = cs[i + 1];
      if (!c.transitionAfter || !n || !c.assetId || !n.assetId) continue;
      list.push({
        time: acc,
        type: c.transitionAfter,
        prev: { assetId: c.assetId, time: Math.max(c.start, c.end - 0.05) },
        next: { assetId: n.assetId, time: n.start },
      });
    }
    return list;
  }, [clipList]);

  // 预取边界帧(防抖 300ms,避免拖拽修剪过程中反复抽帧)
  useEffect(() => {
    if (boundaries.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      for (const b of boundaries) {
        for (const point of [b.prev, b.next]) {
          const key = frameKey(point);
          if (frameCache.current.has(key)) continue;
          const pointAsset = assets.find((a) => a.id === point.assetId);
          if (!pointAsset) continue;
          try {
            const source: TransitionSource =
              pointAsset.type === "image"
                ? await loadImageElement(pointAsset.url).then((img) => ({
                    image: img,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  }))
                : await extractVideoFrame(pointAsset.url, point.time).then((cvs) => ({
                    image: cvs,
                    width: cvs.width,
                    height: cvs.height,
                  }));
            if (cancelled) return;
            frameCache.current.set(key, source);
            setFramesVersion((v) => v + 1);
          } catch {
            // 抽帧失败则该边界退化为硬切
          }
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [boundaries, assets]);

  // 播放头进入边界窗口时在叠层 canvas 上绘制转场帧,离开则清空
  useEffect(() => {
    const cvs = transitionCanvasRef.current;
    const g = cvs?.getContext("2d");
    if (!cvs || !g) return;
    const half = TRANSITION_DURATION / 2;
    let active: PreviewBoundary | null = null;
    let dist = Number.POSITIVE_INFINITY;
    for (const b of boundaries) {
      const d = Math.abs(playhead - b.time);
      if (playhead >= b.time - half && playhead < b.time + half && d < dist) {
        active = b;
        dist = d;
      }
    }
    const prevFrame = active && frameCache.current.get(frameKey(active.prev));
    const nextFrame = active && frameCache.current.get(frameKey(active.next));
    if (!active || !prevFrame || !nextFrame) {
      g.clearRect(0, 0, cvs.width, cvs.height);
      return;
    }
    const rect = cvs.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (cvs.width !== w || cvs.height !== h) {
      cvs.width = w;
      cvs.height = h;
    }
    const progress = (playhead - (active.time - half)) / TRANSITION_DURATION;
    drawTransitionFrame(g, active.type, progress, prevFrame, nextFrame, w, h);
  }, [playhead, boundaries, framesVersion]);

  if (!draft) return null;

  const cssFilter = [
    filterToCss(getFilter(draft.filterId), draft.filterStrength),
    colorAdjustToCss(draft.colorAdjust),
  ]
    .filter(Boolean)
    .join(" ");
  const mediaStyle = cssFilter ? { filter: cssFilter } : undefined;

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
      {asset?.type === "video" ? (
        <video
          ref={videoRef}
          src={asset.url}
          className="h-full w-full object-contain"
          style={mediaStyle}
          playsInline
          preload="auto"
        />
      ) : asset?.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.url}
          alt={currentClip?.name ?? "当前画面"}
          className="h-full w-full object-contain"
          style={mediaStyle}
          draggable={false}
        />
      ) : fallbackFrame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fallbackFrame}
          alt="当前画面"
          className="h-full w-full object-contain"
          style={mediaStyle}
          draggable={false}
        />
      ) : (
        <p className="px-6 text-center text-sm text-zinc-600">
          预览区({draft.aspectRatio})
          <br />
          导入素材后显示画面
        </p>
      )}

      {/* F-14 转场叠层:仅边界窗口内有内容,其余时间保持透明;
          顺带掩盖片段切换时 video 换源的加载间隙 */}
      <canvas
        ref={transitionCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={mediaStyle}
      />

      {/* F-15 文字叠层:只显示时间范围覆盖播放头的文字;暂停时选中的文字始终显示以便编辑 */}
      {draft.texts
        .filter(
          (t) =>
            (!playing && selection?.type === "text" && selection.id === t.id) ||
            (playhead >= (t.start ?? 0) && playhead <= (t.end ?? Number.POSITIVE_INFINITY))
        )
        .map((t) => (
        <div
          key={t.id}
          onPointerDown={(e) => onTextPointerDown(e, t.id)}
          onPointerMove={onTextPointerMove}
          onPointerUp={onTextPointerUp}
          // click 与 pointerdown 是独立事件,不拦截会冒泡到画布触发取消选中(属性面板一闪即逝)
          onClick={(e) => e.stopPropagation()}
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
            border: t.borderColor ? `2px solid ${t.borderColor}` : undefined,
            fontWeight: t.fontWeight,
            fontFamily: getFont(t.fontFamily).css,
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
      {musicTrack?.url && <audio ref={bgmRef} src={musicTrack.url} loop preload="auto" />}
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
