/** 文字字体库。css 栈由预览(style.fontFamily)与导出(canvas ctx.font)共用,保证观感一致。 */
export interface FontPreset {
  id: string;
  name: string;
  /** CSS font-family 栈,兼顾 macOS / Windows 系统字体 */
  css: string;
}

export const FONTS: FontPreset[] = [
  { id: "default", name: "默认黑体", css: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { id: "songti", name: "宋体", css: '"Songti SC", SimSun, serif' },
  { id: "kaiti", name: "楷体", css: '"Kaiti SC", STKaiti, KaiTi, serif' },
  { id: "yuanti", name: "圆体", css: '"Yuanti SC", YouYuan, "Microsoft YaHei", sans-serif' },
  { id: "mono", name: "等宽", css: '"SF Mono", Menlo, Consolas, monospace' },
];

/** 缺省或 id 不存在时回退默认黑体(与加字体项之前的渲染一致) */
export function getFont(id: string | undefined): FontPreset {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}
