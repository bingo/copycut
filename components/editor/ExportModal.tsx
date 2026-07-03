"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorState } from "./useEditorState";

const RESOLUTIONS = ["720P", "1080P"] as const;
const FRAME_RATES = [24, 30, 60] as const;

type Phase = "config" | "exporting" | "done";

/** F-21 导出面板:分辨率/帧率选择 + mock 进度与成功态(真实渲染在 Step 3) */
export default function ExportModal({
  editor,
  onClose,
}: {
  editor: EditorState;
  onClose: () => void;
}) {
  const { draft, totalDuration } = editor;
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("1080P");
  const [fps, setFps] = useState<(typeof FRAME_RATES)[number]>(30);
  const [phase, setPhase] = useState<Phase>("config");
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  if (!draft) return null;

  function startExport() {
    setPhase("exporting");
    setProgress(0);
    timer.current = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 9 + 3;
        if (next >= 100) {
          if (timer.current) clearInterval(timer.current);
          setPhase("done");
          return 100;
        }
        return next;
      });
    }, 180);
  }

  function downloadMock() {
    if (!draft) return;
    // Alpha 约束:导出 mock 文件而非真实视频
    const content = [
      "CopyCut Alpha mock 导出文件",
      `项目:${draft.title}`,
      `比例:${draft.aspectRatio} · ${resolution} · ${fps}fps`,
      `时长:${totalDuration.toFixed(1)}s · 片段数:${draft.clips.length}`,
      "真实 MP4 渲染将在 Step 3 接入。",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.title}-mock.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={phase === "exporting" ? undefined : onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-100">导出</h2>

        {phase === "config" && (
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
            <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-4 text-amber-500">
              Alpha 演示版:导出为 mock 流程,不生成真实视频文件
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800">
                取消
              </button>
              <button
                type="button"
                onClick={startExport}
                disabled={draft.clips.length === 0}
                className="rounded-lg bg-[#ff2442] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                开始导出
              </button>
            </div>
            {draft.clips.length === 0 && (
              <p className="mt-2 text-right text-[11px] text-zinc-600">时间轴为空,无法导出</p>
            )}
          </>
        )}

        {phase === "exporting" && (
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-[#ff2442] transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-3 text-center text-sm text-zinc-400">
              正在导出… {Math.floor(progress)}%
            </p>
            <p className="mt-1 text-center text-[11px] text-zinc-600">
              {resolution} · {fps}fps · {totalDuration.toFixed(1)}s
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-400">
              ✓
            </span>
            <p className="text-sm text-zinc-200">导出完成(mock)</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={downloadMock}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
              >
                下载 mock 文件
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-[#ff2442] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                完成
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
