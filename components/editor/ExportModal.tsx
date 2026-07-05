"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { detectCapabilities, UNSUPPORTED_HINT } from "@/lib/engine/capabilities";
import { exportVideoMp4, isExportAbort } from "@/lib/engine/export-video";
import { exportGalleryZip, packVideoZip } from "@/lib/engine/export-images";
import { downloadBlob } from "@/lib/engine/compose-image";
import {
  EXPORT_PRESETS,
  XHS_BITRATES_MBPS,
  XHS_DEFAULT_BITRATE_MBPS,
  XHS_EXPORT_FPS,
  XHS_EXPORT_SIZE,
  XHS_PRESET_REASONS,
  type ExportPresetId,
} from "@/lib/data/export-presets";
import type { AspectRatio } from "@/lib/types";
import type { EditorState } from "./useEditorState";

const RESOLUTIONS = ["720P", "1080P"] as const;
const FRAME_RATES = [24, 30, 60] as const;

type Resolution = (typeof RESOLUTIONS)[number];

/** 按画布比例换算导出像素尺寸 */
const EXPORT_SIZE: Record<AspectRatio, Record<Resolution, [number, number]>> = {
  "9:16": { "720P": [720, 1280], "1080P": [1080, 1920] },
  "1:1": { "720P": [720, 720], "1080P": [1080, 1080] },
  "16:9": { "720P": [1280, 720], "1080P": [1920, 1080] },
};

type Phase = "config" | "exporting" | "done" | "error";

/** F-21 real:视频 MP4 / 图文 ZIP 真实导出,进度与取消;F-60:小红书零画质损失导出预设 */
export default function ExportModal({
  editor,
  onClose,
}: {
  editor: EditorState;
  onClose: () => void;
}) {
  const { draft, totalDuration } = editor;
  const [presetId, setPresetId] = useState<ExportPresetId>("xhs");
  const [bitrateMbps, setBitrateMbps] =
    useState<(typeof XHS_BITRATES_MBPS)[number]>(XHS_DEFAULT_BITRATE_MBPS);
  const [resolution, setResolution] = useState<Resolution>("1080P");
  const [fps, setFps] = useState<(typeof FRAME_RATES)[number]>(30);
  const [phase, setPhase] = useState<Phase>("config");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Blob | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const capabilities = useMemo(() => detectCapabilities(), []);

  // 卸载时中断进行中的导出
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!draft) return null;
  const isGallery = draft.mode === "gallery";
  const canExport = isGallery ? draft.gallery.length > 0 : draft.clips.length > 0;
  const supported = isGallery || capabilities.video;
  // 当前生效的导出参数(预设 or 自定义)
  const isXhsPreset = presetId === "xhs";
  const [exportW, exportH] = isXhsPreset
    ? XHS_EXPORT_SIZE[draft.aspectRatio]
    : EXPORT_SIZE[draft.aspectRatio][resolution];
  const exportFps = isXhsPreset ? XHS_EXPORT_FPS : fps;

  async function startExport() {
    if (!draft) return;
    setPhase("exporting");
    setProgress(0);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      let blob: Blob;
      if (isGallery) {
        blob = await exportGalleryZip(draft, (done, total) => setProgress(done / total));
      } else {
        const mp4 = await exportVideoMp4({
          draft,
          totalDuration,
          settings: {
            width: exportW,
            height: exportH,
            fps: exportFps,
            bitrate: isXhsPreset ? bitrateMbps * 1_000_000 : undefined,
          },
          onProgress: setProgress,
          signal: abort.signal,
        });
        blob = await packVideoZip(draft, mp4);
      }
      setResult(blob);
      setPhase("done");
    } catch (e) {
      if (isExportAbort(e)) {
        setPhase("config");
        return;
      }
      console.error("[export]", e);
      setError(e instanceof Error ? e.message : "导出失败,请重试");
      setPhase("error");
    }
  }

  function download() {
    if (!draft || !result) return;
    downloadBlob(result, `${draft.title}.zip`);
  }

  const sizeLabel = result ? `${(result.size / 1024 / 1024).toFixed(1)} MB` : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={phase === "exporting" ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-100">
          {isGallery ? "导出图文(ZIP)" : "导出视频(MP4)"}
        </h2>

        {phase === "config" && (
          <>
            {!isGallery && (
              <>
                <div className="mt-4">
                  <p className="mb-2 text-xs text-zinc-500">导出预设</p>
                  <div className="flex gap-2">
                    {EXPORT_PRESETS.map((p) => (
                      <OptionButton key={p.id} active={presetId === p.id} onClick={() => setPresetId(p.id)}>
                        <span className="block">{p.name}</span>
                        <span className="block text-[10px] opacity-70">{p.hint}</span>
                      </OptionButton>
                    ))}
                  </div>
                </div>
                {isXhsPreset && (
                  <>
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-zinc-500">码率(8–12 Mbps 安全区间)</p>
                      <div className="flex gap-2">
                        {XHS_BITRATES_MBPS.map((m) => (
                          <OptionButton key={m} active={bitrateMbps === m} onClick={() => setBitrateMbps(m)}>
                            {m} Mbps
                          </OptionButton>
                        ))}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">
                      {exportW}×{exportH} · {XHS_EXPORT_FPS}fps · 按画布比例自动匹配
                    </p>
                    <div className="mt-3 rounded-lg bg-zinc-800/60 px-3 py-2">
                      <p className="text-[11px] font-medium text-zinc-300">为什么是这些参数</p>
                      <ul className="mt-1 space-y-1 text-[11px] leading-4 text-zinc-500">
                        {XHS_PRESET_REASONS.map((reason) => (
                          <li key={reason}>· {reason}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
                {!isXhsPreset && (
                  <>
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-zinc-500">分辨率</p>
                      <div className="flex gap-2">
                        {RESOLUTIONS.map((r) => (
                          <OptionButton key={r} active={resolution === r} onClick={() => setResolution(r)}>
                            {r}
                          </OptionButton>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-zinc-500">帧率</p>
                      <div className="flex gap-2">
                        {FRAME_RATES.map((f) => (
                          <OptionButton key={f} active={fps === f} onClick={() => setFps(f)}>
                            {f} fps
                          </OptionButton>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {!capabilities.audio && capabilities.video && (
                  <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-4 text-amber-500">
                    当前浏览器不支持音频编码,导出的视频将没有声音
                  </p>
                )}
              </>
            )}
            {isGallery ? (
              <p className="mt-4 text-sm text-zinc-400">
                将导出 {draft.gallery.length} 张图片(含文字与统一滤镜)+ 发布信息 txt,打包为 ZIP
              </p>
            ) : (
              <p className="mt-4 text-[11px] leading-4 text-zinc-600">
                MP4 与发布信息 txt(标题/正文/话题/活动)打包为 ZIP
              </p>
            )}
            {!supported && (
              <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] leading-4 text-red-400">
                {UNSUPPORTED_HINT}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800">
                取消
              </button>
              <button
                type="button"
                onClick={startExport}
                disabled={!canExport || !supported}
                className="rounded-lg bg-[#ff2442] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                开始导出
              </button>
            </div>
            {!canExport && (
              <p className="mt-2 text-right text-[11px] text-zinc-600">
                {isGallery ? "还没有上传图片,无法导出" : "时间轴为空,无法导出"}
              </p>
            )}
          </>
        )}

        {phase === "exporting" && (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-[#ff2442] transition-[width] duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-center text-sm text-zinc-400">
              正在导出… {Math.round(progress * 100)}%
            </p>
            <p className="mt-1 text-center text-[11px] text-zinc-600">
              {isGallery
                ? `${draft.gallery.length} 张图片`
                : `${exportW}×${exportH} · ${exportFps}fps${
                    isXhsPreset ? ` · ${bitrateMbps} Mbps` : ""
                  } · ${totalDuration.toFixed(1)}s · 本地渲染,不上传素材`}
            </p>
            {!isGallery && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400 hover:border-zinc-500"
                >
                  取消导出
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-400">
              ✓
            </span>
            <p className="text-sm text-zinc-200">导出完成</p>
            <p className="text-xs text-zinc-500">{sizeLabel}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={download}
                className="rounded-lg bg-[#ff2442] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                下载 ZIP
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
              >
                完成
              </button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl text-red-400">
              ✕
            </span>
            <p className="max-w-full break-words text-center text-sm text-red-400">{error}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPhase("config")}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
              >
                返回
              </button>
              <button
                type="button"
                onClick={startExport}
                className="rounded-lg bg-[#ff2442] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                重试
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border py-2 text-sm ${
        active
          ? "border-[#ff2442] bg-[#ff2442]/10 text-[#ff2442]"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}
