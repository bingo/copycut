"use client";

import { useEffect, useRef, useState } from "react";
import { getFont } from "@/lib/data/fonts";
import { drawTextLayers, type RenderText } from "@/lib/engine/compose-image";
import { layoutText, textLayerCss } from "@/lib/engine/text-layout";

/**
 * T4 所见即所得自检页(仅开发用):同一组文字分别用
 * 预览 DOM 路径与导出 canvas 路径渲染,并排比对盒模型/折行/字号是否逐像素一致。
 * 访问 /dev/text-parity 查看。
 */

const W = 360;
const H = 640;
/** canvas 侧按 2x 绘制再缩回,模拟高分辨率导出 */
const SCALE = 2;

interface Sample {
  content: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  background?: string;
  borderColor?: string;
  fontWeight: "normal" | "bold";
  fontFamily?: string;
  stroke?: { color: string; width: number };
  shadow?: { color: string; blur: number; x: number; y: number };
  letterSpacing?: number;
  opacity?: number;
}

const SAMPLES: Sample[] = [
  { content: "今日份好物", x: 50, y: 7, fontSize: 30, color: "#ffffff", background: "#ff2442", fontWeight: "bold" },
  { content: "「把日子过成喜欢的样子」", x: 50, y: 17, fontSize: 22, color: "#4a453e", background: "#faf7f0", borderColor: "#d8d0c0", fontWeight: "normal", fontFamily: "songti" },
  { content: "3个技巧\n学会剪辑", x: 50, y: 31, fontSize: 40, color: "#ffffff", fontWeight: "bold" },
  {
    content: "这是一段特别长的说明文字用来验证预览和导出的自动换行是否逐行一致不会溢出画面",
    x: 50, y: 48, fontSize: 24, color: "#111111", background: "#ffe234", fontWeight: "bold",
  },
  // T2 专业样式:描边 / 阴影 / 字间距 / 透明度
  { content: "综艺花字", x: 50, y: 63, fontSize: 34, color: "#ffe234", fontWeight: "bold", stroke: { color: "#000000", width: 0.12 }, shadow: { color: "rgba(0,0,0,0.5)", blur: 0.08, x: 0.04, y: 0.06 } },
  { content: "NIGHT VIBES", x: 50, y: 74, fontSize: 26, color: "#ffffff", fontWeight: "bold", letterSpacing: 0.12, shadow: { color: "#ff2fb0", blur: 0.3, x: 0, y: 0 } },
  { content: "半透明字幕", x: 50, y: 84, fontSize: 22, color: "#ffffff", background: "rgba(0,0,0,0.6)", fontWeight: "normal", opacity: 0.7 },
  { content: "mixed 中英 wrapping abcdefg 测试", x: 50, y: 93, fontSize: 18, color: "#e8e2d6", fontWeight: "normal", fontFamily: "kaiti" },
];

export default function TextParityPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    if (!fontsReady) return;
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext("2d");
    if (!cvs || !ctx) return;
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    const texts: RenderText[] = SAMPLES.map((s) => ({
      content: s.content,
      xPct: s.x,
      yPct: s.y,
      sizePx: (s.fontSize * H * SCALE) / 1000,
      color: s.color,
      background: s.background,
      borderColor: s.borderColor,
      fontWeight: s.fontWeight,
      fontFamily: getFont(s.fontFamily).css,
      stroke: s.stroke,
      shadow: s.shadow,
      letterSpacing: s.letterSpacing,
      opacity: s.opacity,
    }));
    drawTextLayers(ctx, texts, W * SCALE, H * SCALE);
  }, [fontsReady]);

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-200">
      <h1 className="mb-1 text-lg font-semibold">文字渲染一致性自检(T4)</h1>
      <p className="mb-6 text-sm text-zinc-500">
        左:预览 DOM 路径(textLayerCss)/ 右:导出 canvas 路径(drawTextLayers,2x 绘制缩回)。
        两侧盒子大小、折行、内边距应逐像素一致。
      </p>
      <div className="flex gap-6">
        <figure>
          <figcaption className="mb-2 text-xs text-zinc-500">预览 DOM</figcaption>
          <div className="relative overflow-hidden bg-zinc-900" style={{ width: W, height: H }}>
            {fontsReady &&
              SAMPLES.map((s, i) => {
                const layout = layoutText(
                  {
                    content: s.content,
                    sizePx: (s.fontSize * H) / 1000,
                    fontWeight: s.fontWeight,
                    fontFamily: getFont(s.fontFamily).css,
                    letterSpacingEm: s.letterSpacing,
                  },
                  W,
                  H
                );
                return (
                  <div
                    key={i}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${s.x}%`,
                      top: `${s.y}%`,
                      ...textLayerCss(
                        {
                          color: s.color,
                          background: s.background,
                          borderColor: s.borderColor,
                          stroke: s.stroke,
                          shadow: s.shadow,
                          opacity: s.opacity,
                        },
                        layout
                      ),
                    }}
                  >
                    {layout.lines.join("\n")}
                  </div>
                );
              })}
          </div>
        </figure>
        <figure>
          <figcaption className="mb-2 text-xs text-zinc-500">导出 canvas</figcaption>
          <canvas
            ref={canvasRef}
            width={W * SCALE}
            height={H * SCALE}
            style={{ width: W, height: H }}
          />
        </figure>
      </div>
    </div>
  );
}
