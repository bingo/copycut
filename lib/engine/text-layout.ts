import type { CSSProperties } from "react";

/**
 * 统一文字布局(T4 所见即所得):预览 DOM 与导出 canvas 共用同一套
 * 盒模型度量(字号/内边距/圆角/行高/边框/自动换行),彻底消除两端渲染差异。
 *
 * 标尺约定:fontSize 等草稿字段以「画布高 = 1000」为标尺,
 * 换算到目标画布(预览实测像素高 / 导出分辨率高)后传入 sizePx。
 */

/** 行高倍数 */
export const TEXT_LINE_HEIGHT = 1.35;
/** 水平内边距,em(相对字号) */
export const TEXT_PAD_X_EM = 0.4;
/** 垂直内边距,em */
export const TEXT_PAD_Y_EM = 0.2;
/** 背景框圆角,em */
export const TEXT_RADIUS_EM = 0.15;
/** 边框宽度,相对画布高(2px @ 500px 高预览画布) */
export const TEXT_BORDER_FRAC = 0.004;
/** 自动换行的最大内容宽度,相对画布宽 */
export const TEXT_MAX_WIDTH_FRAC = 0.9;

export interface TextLayoutInput {
  content: string;
  /** 字号,px(已按目标画布高换算) */
  sizePx: number;
  fontWeight: "normal" | "bold";
  /** CSS font-family 栈 */
  fontFamily: string;
}

export interface TextLayout {
  /** 换行结果(手动 \n + 按最大宽度自动折行),预览与导出逐行一致 */
  lines: string[];
  /** canvas ctx.font 字符串,与测量时完全一致 */
  font: string;
  sizePx: number;
  lineHeightPx: number;
  padXPx: number;
  padYPx: number;
  radiusPx: number;
  borderPx: number;
  /** 背景框尺寸(内容 + 内边距;边框画在框内,不外扩) */
  boxWPx: number;
  boxHPx: number;
}

let measureCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;

/** 共享测量上下文;预览 DOM 与导出走同一测量,保证折行一致 */
function getMeasureCtx() {
  if (!measureCtx) {
    measureCtx =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(1, 1).getContext("2d")
        : document.createElement("canvas").getContext("2d");
  }
  return measureCtx!;
}

/** 断行分段:CJK 逐字可断,拉丁词/连续空白作为整体 */
const SEGMENT_RE =
  /\s+|[\u2e80-\u9fff\u3000-\u303f\uf900-\ufaff\uff00-\uffef]|[^\s\u2e80-\u9fff\u3000-\u303f\uf900-\ufaff\uff00-\uffef]+/g;

/** 按最大宽度折行;返回的行在预览端用 whitespace-pre 原样渲染,两端不再各自折行 */
export function wrapText(content: string, font: string, maxWidthPx: number): string[] {
  const ctx = getMeasureCtx();
  ctx.font = font;
  const out: string[] = [];
  for (const hard of content.split("\n")) {
    if (hard === "" || ctx.measureText(hard).width <= maxWidthPx) {
      out.push(hard);
      continue;
    }
    let line = "";
    for (const seg of hard.match(SEGMENT_RE) ?? []) {
      if (line && ctx.measureText(line + seg).width > maxWidthPx) {
        out.push(line.trimEnd());
        line = seg.trimStart();
        // 单段本身超宽(超长英文词/URL):逐字符硬断
        while (line.length > 1 && ctx.measureText(line).width > maxWidthPx) {
          let i = 1;
          while (i < line.length && ctx.measureText(line.slice(0, i + 1)).width <= maxWidthPx) i++;
          out.push(line.slice(0, i));
          line = line.slice(i);
        }
      } else {
        line += seg;
      }
    }
    if (line.trimEnd()) out.push(line.trimEnd());
  }
  return out.length > 0 ? out : [""];
}

export function layoutText(
  input: TextLayoutInput,
  canvasW: number,
  canvasH: number
): TextLayout {
  const { sizePx } = input;
  const font = `${input.fontWeight === "bold" ? "700" : "400"} ${sizePx}px ${input.fontFamily}`;
  const padXPx = sizePx * TEXT_PAD_X_EM;
  const padYPx = sizePx * TEXT_PAD_Y_EM;
  const maxContentW = Math.max(sizePx, canvasW * TEXT_MAX_WIDTH_FRAC - padXPx * 2);
  const lines = wrapText(input.content, font, maxContentW);
  const ctx = getMeasureCtx();
  ctx.font = font;
  const maxLineW = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
  const lineHeightPx = sizePx * TEXT_LINE_HEIGHT;
  return {
    lines,
    font,
    sizePx,
    lineHeightPx,
    padXPx,
    padYPx,
    radiusPx: sizePx * TEXT_RADIUS_EM,
    borderPx: Math.max(1, canvasH * TEXT_BORDER_FRAC),
    boxWPx: maxLineW + padXPx * 2,
    boxHPx: lines.length * lineHeightPx + padYPx * 2,
  };
}

export interface TextLayerColors {
  color: string;
  background?: string;
  borderColor?: string;
}

/**
 * 预览 DOM 样式:与 drawTextBox 的 canvas 绘制一一对应。
 * 边框用 inset box-shadow(画在盒内),对应 canvas 内描边,盒子总尺寸两端一致;
 * whitespace-pre 保证 DOM 不再自行折行,行由 layout.lines 决定。
 */
export function textLayerCss(colors: TextLayerColors, layout: TextLayout): CSSProperties {
  return {
    color: colors.color,
    background: colors.background || undefined,
    boxShadow: colors.borderColor
      ? `inset 0 0 0 ${layout.borderPx}px ${colors.borderColor}`
      : undefined,
    fontSize: `${layout.sizePx}px`,
    lineHeight: `${layout.lineHeightPx}px`,
    fontWeight: layout.font.startsWith("700") ? 700 : 400,
    fontFamily: layout.font.slice(layout.font.indexOf("px ") + 3),
    padding: `${layout.padYPx}px ${layout.padXPx}px`,
    borderRadius: `${layout.radiusPx}px`,
    whiteSpace: "pre",
    textAlign: "center",
  };
}

/** 在 canvas 上按 layout 绘制一个文字盒(中心点 cx/cy,px),与 textLayerCss 严格对应 */
export function drawTextBox(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  colors: TextLayerColors,
  layout: TextLayout,
  cx: number,
  cy: number
): void {
  const x = cx - layout.boxWPx / 2;
  const y = cy - layout.boxHPx / 2;
  if (colors.background || colors.borderColor) {
    if (colors.background) {
      ctx.beginPath();
      ctx.roundRect(x, y, layout.boxWPx, layout.boxHPx, layout.radiusPx);
      ctx.fillStyle = colors.background;
      ctx.fill();
    }
    if (colors.borderColor) {
      // 内描边:与预览 inset box-shadow 对齐,不外扩盒子
      const b = layout.borderPx;
      ctx.beginPath();
      ctx.roundRect(
        x + b / 2,
        y + b / 2,
        layout.boxWPx - b,
        layout.boxHPx - b,
        Math.max(0, layout.radiusPx - b / 2)
      );
      ctx.strokeStyle = colors.borderColor;
      ctx.lineWidth = b;
      ctx.stroke();
    }
  }
  ctx.font = layout.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = colors.color;
  // 行中心对称分布在 cy 两侧,与 DOM 行盒的垂直居中一致
  const startY = cy - ((layout.lines.length - 1) * layout.lineHeightPx) / 2;
  layout.lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * layout.lineHeightPx));
}
