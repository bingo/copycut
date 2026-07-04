import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  VideoSampleSink,
  getFirstEncodableAudioCodec,
  type VideoSample,
} from "mediabunny";
import { assetService } from "../services/assets";
import { getFilter } from "../data/filters";
import { computeGrade, isIdentityGrade, ColorGrader } from "./colorgrade";
import { drawFitted, drawTextLayers, loadImageElement, overlayToRenderText } from "./compose-image";
import { TRANSITION_DURATION, drawTransitionFrame, type TransitionSource } from "./transitions";
import { mixTimelineAudio } from "./audio-mix";
import type { Draft } from "../types";

export interface VideoExportSettings {
  width: number;
  height: number;
  fps: number;
}

interface PreparedClip {
  timelineStart: number;
  timelineEnd: number;
  /** 素材内入点 */
  sourceStart: number;
  sourceEnd: number;
  kind: "video" | "image";
  sink?: VideoSampleSink;
  input?: Input;
  image?: HTMLImageElement;
  imageW?: number;
  imageH?: number;
}

interface Boundary {
  /** 边界在时间轴上的时刻 */
  time: number;
  type: string;
  /** 前片段末帧 / 后片段首帧(已按画布 fit 绘制) */
  prevFrame: OffscreenCanvas;
  nextFrame: OffscreenCanvas;
}

class ExportAbortError extends Error {
  constructor() {
    super("导出已取消");
    this.name = "ExportAbortError";
  }
}

export function isExportAbort(e: unknown): boolean {
  return e instanceof ExportAbortError;
}

/**
 * 视频导出管线:Mediabunny 解码 → Canvas 合成(转场/调色/文字)→
 * WebCodecs 编码(H.264 + AAC)→ MP4。全程本地,无上传。
 */
export async function exportVideoMp4(options: {
  draft: Draft;
  totalDuration: number;
  settings: VideoExportSettings;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const { draft, totalDuration, settings, onProgress, signal } = options;
  const { width, height, fps } = settings;
  if (draft.clips.length === 0 || totalDuration <= 0) throw new Error("时间轴为空,无法导出");

  const throwIfAborted = () => {
    if (signal?.aborted) throw new ExportAbortError();
  };

  // ---- 准备素材输入 ----
  const prepared: PreparedClip[] = [];
  let acc = 0;
  for (const clip of draft.clips) {
    const dur = clip.end - clip.start;
    const item: PreparedClip = {
      timelineStart: acc,
      timelineEnd: acc + dur,
      sourceStart: clip.start,
      sourceEnd: clip.end,
      kind: clip.assetType,
    };
    if (!clip.assetId) throw new Error(`片段「${clip.name}」缺少素材来源`);
    const file = await assetService.getFile(clip.assetId);
    if (!file) throw new Error(`片段「${clip.name}」的素材文件不可用,请重新导入`);
    if (clip.assetType === "video") {
      const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error(`「${clip.name}」中没有视频轨`);
      item.input = input;
      item.sink = new VideoSampleSink(track);
    } else {
      const img = await loadImageElement(URL.createObjectURL(file));
      item.image = img;
      item.imageW = img.naturalWidth;
      item.imageH = img.naturalHeight;
    }
    prepared.push(item);
    acc += dur;
  }

  // ---- 画布与调色 ----
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  const baseCanvas = new OffscreenCanvas(width, height);
  const baseCtx = baseCanvas.getContext("2d")!;
  const grade = computeGrade(getFilter(draft.filterId), draft.filterStrength, draft.colorAdjust);
  const grader = isIdentityGrade(grade) ? null : new ColorGrader(width, height);
  // 文字带时间范围,逐帧过滤;旧草稿缺省视为覆盖全片
  const renderTexts = draft.texts.map((t) => ({
    start: t.start ?? 0,
    end: t.end ?? Number.POSITIVE_INFINITY,
    text: overlayToRenderText(t, height),
  }));

  const drawSampleFitted = (target: OffscreenCanvasRenderingContext2D, sample: VideoSample) => {
    const sw = sample.displayWidth;
    const sh = sample.displayHeight;
    const scale = Math.min(width / sw, height / sh);
    const w = sw * scale;
    const h = sh * scale;
    target.fillStyle = "#000";
    target.fillRect(0, 0, width, height);
    sample.draw(target, (width - w) / 2, (height - h) / 2, w, h);
  };

  // ---- 预取转场边界帧 ----
  const boundaries: Boundary[] = [];
  for (let i = 0; i < draft.clips.length - 1; i++) {
    const type = draft.clips[i].transitionAfter;
    if (!type) continue;
    const a = prepared[i];
    const b = prepared[i + 1];
    const frameOf = async (p: PreparedClip, time: number): Promise<OffscreenCanvas> => {
      const frame = new OffscreenCanvas(width, height);
      const fctx = frame.getContext("2d")!;
      fctx.fillStyle = "#000";
      fctx.fillRect(0, 0, width, height);
      if (p.kind === "video" && p.sink) {
        const sample = await p.sink.getSample(time);
        if (sample) {
          drawSampleFitted(fctx, sample);
          sample.close();
        }
      } else if (p.image) {
        drawFitted(fctx, p.image, p.imageW!, p.imageH!, width, height, "contain");
      }
      return frame;
    };
    boundaries.push({
      time: a.timelineEnd,
      type,
      prevFrame: await frameOf(a, Math.max(a.sourceStart, a.sourceEnd - 0.05)),
      nextFrame: await frameOf(b, b.sourceStart),
    });
    throwIfAborted();
  }

  // ---- 输出与编码器 ----
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });
  const videoSource = new CanvasSource(canvas, { codec: "avc", bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  const audioCodec =
    "AudioEncoder" in globalThis
      ? await getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: 2, sampleRate: 48000 })
      : null;
  if (audioCodec) {
    audioSource = new AudioBufferSource({ codec: audioCodec, bitrate: 128_000 });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  try {
    // ---- 逐帧渲染 ----
    const totalFrames = Math.max(1, Math.ceil(totalDuration * fps));
    let frame = 0;
    for (const item of prepared) {
      const startFrame = Math.ceil(item.timelineStart * fps - 1e-6);
      const endFrame = Math.min(totalFrames, Math.ceil(item.timelineEnd * fps - 1e-6));
      if (endFrame <= startFrame) continue;

      // 该片段每个输出帧对应的素材内时间(单调递增,供优化解码管线)
      const sourceTimes: number[] = [];
      for (let i = startFrame; i < endFrame; i++) {
        const t = i / fps;
        sourceTimes.push(
          Math.min(item.sourceEnd - 1e-4, Math.max(item.sourceStart, item.sourceStart + (t - item.timelineStart)))
        );
      }

      const renderFrame = async (i: number) => {
        const t = i / fps;
        // 合成:底帧 → 转场 → 调色 → 文字
        ctx.drawImage(baseCanvas, 0, 0);
        const b = activeBoundary(boundaries, t);
        if (b) {
          // 正在实时解码的一侧用活帧,另一侧用预取的边界静帧
          const live: TransitionSource = { image: baseCanvas, width, height };
          const progress = (t - (b.time - TRANSITION_DURATION / 2)) / TRANSITION_DURATION;
          drawTransitionFrame(
            ctx,
            b.type,
            progress,
            t < b.time ? live : { image: b.prevFrame, width, height },
            t < b.time ? { image: b.nextFrame, width, height } : live,
            width,
            height
          );
        }
        if (grader) {
          const graded = grader.apply(canvas, grade);
          ctx.drawImage(graded, 0, 0);
        }
        const visibleTexts = renderTexts.filter((rt) => t >= rt.start && t < rt.end);
        if (visibleTexts.length)
          drawTextLayers(ctx, visibleTexts.map((rt) => rt.text), width, height);
        await videoSource.add(t, 1 / fps);
        frame++;
        if (frame % 5 === 0) onProgress?.((frame / totalFrames) * 0.85);
        throwIfAborted();
      };

      if (item.kind === "video" && item.sink) {
        let i = startFrame;
        for await (const sample of item.sink.samplesAtTimestamps(sourceTimes)) {
          if (sample) {
            drawSampleFitted(baseCtx, sample);
            sample.close();
          }
          await renderFrame(i);
          i++;
        }
      } else if (item.image) {
        baseCtx.fillStyle = "#000";
        baseCtx.fillRect(0, 0, width, height);
        drawFitted(baseCtx, item.image, item.imageW!, item.imageH!, width, height, "contain");
        for (let i = startFrame; i < endFrame; i++) await renderFrame(i);
      }
    }

    // ---- 音频 ----
    if (audioSource) {
      onProgress?.(0.88);
      const mixed = await mixTimelineAudio({
        clips: draft.clips,
        music: draft.music,
        totalDuration,
      });
      throwIfAborted();
      await audioSource.add(mixed);
      audioSource.close();
    }

    onProgress?.(0.95);
    await output.finalize();
    onProgress?.(1);

    const buffer = output.target.buffer;
    if (!buffer) throw new Error("导出失败:未生成文件");
    return new Blob([buffer], { type: "video/mp4" });
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  } finally {
    grader?.dispose();
  }
}

/** 播放时刻命中的转场边界(片段短于窗口重叠时取最近的) */
function activeBoundary(boundaries: Boundary[], t: number): Boundary | null {
  const half = TRANSITION_DURATION / 2;
  let best: Boundary | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const b of boundaries) {
    const dist = Math.abs(t - b.time);
    if (t >= b.time - half && t < b.time + half && dist < bestDist) {
      best = b;
      bestDist = dist;
    }
  }
  return best;
}
