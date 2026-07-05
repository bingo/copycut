import type { CaptionStyle } from "../types";

/**
 * 图文排版模板库(F-62 / S3):字体/字号/颜色/背景/位置的成套组合,
 * 在图文轮播模式一键应用到当前图。排版模板自带位置(排版即位置),
 * 应用时会连同 x/y 一起覆盖;仅复用样式请用「我的风格」。
 */
export interface GalleryStyleTemplate {
  id: string;
  name: string;
  /** 缩略预览用示例文案(应用时不替换用户已有文字) */
  sample: string;
  style: CaptionStyle;
}

export const GALLERY_STYLE_TEMPLATES: GalleryStyleTemplate[] = [
  {
    id: "g-top-title",
    name: "顶部大标题",
    sample: "秋日穿搭",
    style: { x: 50, y: 12, fontSize: 46, color: "#ffffff", fontWeight: "bold", fontFamily: "default", background: "" },
  },
  {
    id: "g-white-card",
    name: "白卡标题",
    sample: "保姆级教程",
    style: { x: 50, y: 20, fontSize: 34, color: "#111111", fontWeight: "bold", fontFamily: "default", background: "#ffffff" },
  },
  {
    id: "g-center-quote",
    name: "居中引用",
    sample: "生活需要仪式感",
    style: { x: 50, y: 50, fontSize: 30, color: "#ffffff", fontWeight: "normal", fontFamily: "songti", background: "rgba(0,0,0,0.45)" },
  },
  {
    id: "g-corner-tag",
    name: "左上角标签",
    sample: "好物分享",
    style: { x: 14, y: 8, fontSize: 20, color: "#ffffff", fontWeight: "bold", fontFamily: "default", background: "#ff2442" },
  },
  {
    id: "g-highlight",
    name: "荧光划重点",
    sample: "划重点!!",
    style: { x: 50, y: 82, fontSize: 28, color: "#111111", fontWeight: "bold", fontFamily: "default", background: "#ffe234" },
  },
  {
    id: "g-cream-note",
    name: "奶油笔记",
    sample: "记录一下今天",
    style: { x: 50, y: 86, fontSize: 24, color: "#5b4636", fontWeight: "normal", fontFamily: "kaiti", background: "#fff7e0" },
  },
  {
    id: "g-bottom-note",
    name: "底部标注",
    sample: "第 1 步 · 准备食材",
    style: { x: 50, y: 92, fontSize: 22, color: "#ffffff", fontWeight: "normal", fontFamily: "default", background: "rgba(0,0,0,0.6)" },
  },
  {
    id: "g-corner-sign",
    name: "右下署名",
    sample: "@我的小红书",
    style: { x: 82, y: 94, fontSize: 16, color: "#ffffff", fontWeight: "normal", fontFamily: "mono", background: "" },
  },
];
