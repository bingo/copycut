import { ColorGrader, isIdentityGrade, type GradeParams } from "./colorgrade";
import { getFont } from "../data/fonts";
import type { CaptionStyle, GalleryImage, TextOverlay } from "../types";

/** 画布上渲染的一条文字(像素坐标系) */
export interface RenderText {
  content: string;
  /** 中心点,画布百分比 0-100 */
  xPct: number;
  yPct: number;
  /** 字号,px */
  sizePx: number;
  color: string;
  background?: string;
  borderColor?: string;
  fontWeight: "normal" | "bold";
  /** CSS font-family 栈,缺省为默认黑体 */
  fontFamily?: string;
}

/**
 * 预览中文字字号是「fontSize × 0.5px @ ~500px 高预览画布」,
 * 导出按画布高度等比换算,保持与预览观感一致。
 */
export function overlayToRenderText(t: TextOverlay, canvasHeight: number): RenderText {
  return {
    content: t.content,
    xPct: t.x,
    yPct: t.y,
    sizePx: (t.fontSize * canvasHeight) / 1000,
    color: t.color,
    background: t.background,
    borderColor: t.borderColor,
    fontWeight: t.fontWeight,
    fontFamily: getFont(t.fontFamily).css,
  };
}

/** 图文轮播文字的缺省样式:底部居中白字黑底,与样式项加入前的渲染一致(旧草稿兜底) */
export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  x: 50,
  y: 92,
  fontSize: 32,
  color: "#ffffff",
  fontWeight: "normal",
  background: "rgba(0,0,0,0.6)",
};

/** 轮播图片的说明文字 → RenderText;无文字返回 null */
export function captionToRenderText(item: GalleryImage, canvasHeight: number): RenderText | null {
  if (!item.caption) return null;
  const s = { ...DEFAULT_CAPTION_STYLE, ...item.captionStyle };
  return {
    content: item.caption,
    xPct: s.x,
    yPct: s.y,
    sizePx: (s.fontSize * canvasHeight) / 1000,
    color: s.color,
    background: s.background || undefined,
    fontWeight: s.fontWeight,
    fontFamily: getFont(s.fontFamily).css,
  };
}

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = url;
  });
}

/** 从视频 URL 抽取指定时间的一帧(全分辨率) */
export function extractVideoFrame(url: string, time: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = url;
    video.onerror = () => reject(new Error("视频帧抽取失败"));
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.05));
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      video.src = "";
      resolve(canvas);
    };
  });
}

/** 按 contain/cover 规则把源画到目标画布 */
export function drawFitted(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  targetW: number,
  targetH: number,
  fit: "contain" | "cover"
): void {
  const scale =
    fit === "contain"
      ? Math.min(targetW / sourceW, targetH / sourceH)
      : Math.max(targetW / sourceW, targetH / sourceH);
  const w = sourceW * scale;
  const h = sourceH * scale;
  ctx.drawImage(source, (targetW - w) / 2, (targetH - h) / 2, w, h);
}

export function drawTextLayers(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  texts: RenderText[],
  canvasW: number,
  canvasH: number
): void {
  for (const t of texts) {
    const lines = t.content.split("\n");
    const lineHeight = t.sizePx * 1.35;
    const cx = (t.xPct / 100) * canvasW;
    const cy = (t.yPct / 100) * canvasH;
    ctx.font = `${t.fontWeight === "bold" ? "700" : "400"} ${t.sizePx}px ${t.fontFamily ?? getFont(undefined).css}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (t.background || t.borderColor) {
      const padX = t.sizePx * 0.4;
      const padY = t.sizePx * 0.2;
      const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const boxW = maxLineW + padX * 2;
      const boxH = lines.length * lineHeight + padY * 2;
      const r = t.sizePx * 0.15;
      const x = cx - boxW / 2;
      const y = cy - boxH / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, boxW, boxH, r);
      if (t.background) {
        ctx.fillStyle = t.background;
        ctx.fill();
      }
      if (t.borderColor) {
        // 预览边框 2px @ ~500px 高预览画布,导出按画布高度等比
        ctx.strokeStyle = t.borderColor;
        ctx.lineWidth = Math.max(1.5, canvasH * 0.004);
        ctx.stroke();
      }
    }

    ctx.fillStyle = t.color;
    const startY = cy - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lineHeight));
  }
}

export interface ComposeOptions {
  base: CanvasImageSource;
  baseWidth: number;
  baseHeight: number;
  width: number;
  height: number;
  fit: "contain" | "cover";
  texts?: RenderText[];
  grade?: GradeParams;
}

/** 合成单帧:底图 fit + 调色(WebGL)+ 文字层,返回结果 canvas */
export function composeToCanvas(options: ComposeOptions): OffscreenCanvas {
  const { width, height } = options;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  drawFitted(ctx, options.base, options.baseWidth, options.baseHeight, width, height, options.fit);

  // 调色只作用于画面,文字层叠加在调色之后(与预览一致)
  if (options.grade && !isIdentityGrade(options.grade)) {
    const grader = new ColorGrader(width, height);
    const graded = grader.apply(canvas, options.grade);
    ctx.drawImage(graded, 0, 0);
    grader.dispose();
  }

  if (options.texts?.length) drawTextLayers(ctx, options.texts, width, height);

  return canvas;
}

export async function canvasToJpeg(
  canvas: OffscreenCanvas,
  quality = 0.92
): Promise<Blob> {
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
