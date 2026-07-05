import type { TextOverlay } from "../types";

/**
 * 小红书风格封面模板库(F-61 / 策略 S2):
 * 奶白 / 莫兰迪低饱和 / 活泼撞色三类配色 × 标题分层排版。
 * 模板层与画面文字 TextOverlay 同标尺(位置百分比 + fontSize×画布高/1000),
 * 应用时物化为 cover.coverTexts,创作者可继续手动微调。
 */

/** 模板文字层样式:直接复用 TextOverlay 的样式字段 */
export type CoverLayerStyle = Pick<
  TextOverlay,
  "x" | "y" | "fontSize" | "color" | "fontWeight" | "fontFamily" | "background" | "borderColor"
>;

/** 模板里的一层标题(主标题 / 副标题) */
export interface CoverTemplateLayer extends CoverLayerStyle {
  role: "main" | "sub";
  /** 示例文字,应用模板且该层还没有内容时作为占位 */
  sample: string;
}

export type CoverPaletteId = "milk" | "morandi" | "pop";

export const COVER_PALETTES: { id: CoverPaletteId; name: string; hint: string }[] = [
  { id: "milk", name: "奶白系", hint: "奶油底色,留白呼吸感" },
  { id: "morandi", name: "莫兰迪低饱和系", hint: "灰调低饱和,高级感" },
  { id: "pop", name: "活泼撞色系", hint: "高对比撞色,信息流里抓眼球" },
];

export interface CoverTemplate {
  id: string;
  name: string;
  palette: CoverPaletteId;
  /** 缩略预览的底色,模拟封面画面基调(不参与导出) */
  previewBackground: string;
  layers: CoverTemplateLayer[];
}

export const COVER_TEMPLATES: CoverTemplate[] = [
  // —— 奶白系 ——
  {
    id: "cv-milk-cream",
    name: "奶白清单",
    palette: "milk",
    previewBackground: "#f6f1e7",
    layers: [
      { role: "main", sample: "秋日穿搭\n合集", x: 50, y: 32, fontSize: 64, color: "#6b5844", fontWeight: "bold", fontFamily: "songti" },
      { role: "sub", sample: "5 套通勤不重样", x: 50, y: 47, fontSize: 28, color: "#fff8ee", fontWeight: "normal", background: "#b59a7c" },
    ],
  },
  {
    id: "cv-milk-diary",
    name: "奶油日记",
    palette: "milk",
    previewBackground: "#efe6d8",
    layers: [
      { role: "main", sample: "周末烘焙日记", x: 50, y: 66, fontSize: 56, color: "#7a6350", fontWeight: "bold", fontFamily: "kaiti", background: "#fffdf6" },
      { role: "sub", sample: "零失败戚风攻略", x: 50, y: 79, fontSize: 26, color: "#a08b76", fontWeight: "normal", fontFamily: "kaiti" },
    ],
  },
  {
    id: "cv-milk-latte",
    name: "燕麦拿铁",
    palette: "milk",
    previewBackground: "#e9dcc9",
    layers: [
      { role: "main", sample: "新手咖啡\n入门指南", x: 50, y: 34, fontSize: 62, color: "#5f4a33", fontWeight: "bold", borderColor: "#5f4a33" },
      { role: "sub", sample: "在家复刻拿铁", x: 50, y: 52, fontSize: 26, color: "#8c7357", fontWeight: "normal" },
    ],
  },
  // —— 莫兰迪低饱和系 ——
  {
    id: "cv-morandi-fog",
    name: "雾霾蓝",
    palette: "morandi",
    previewBackground: "#8fa1ad",
    layers: [
      { role: "main", sample: "极简房间\n改造记", x: 50, y: 34, fontSize: 64, color: "#f2f5f6", fontWeight: "bold" },
      { role: "sub", sample: "低成本高质感", x: 50, y: 51, fontSize: 28, color: "#e3eaee", fontWeight: "normal", borderColor: "#e3eaee" },
    ],
  },
  {
    id: "cv-morandi-sage",
    name: "灰豆绿",
    palette: "morandi",
    previewBackground: "#aab5a4",
    layers: [
      { role: "main", sample: "植物系生活指南", x: 50, y: 64, fontSize: 54, color: "#3f4a3c", fontWeight: "bold", fontFamily: "songti", background: "#e7eae2" },
      { role: "sub", sample: "把春天搬回家", x: 50, y: 78, fontSize: 26, color: "#eef0ea", fontWeight: "normal", fontFamily: "songti" },
    ],
  },
  {
    id: "cv-morandi-rose",
    name: "藕粉灰",
    palette: "morandi",
    previewBackground: "#c5a8a8",
    layers: [
      { role: "main", sample: "淡颜系妆容\n教程", x: 50, y: 30, fontSize: 60, color: "#fdf5f3", fontWeight: "bold", fontFamily: "kaiti" },
      { role: "sub", sample: "手残党也能学会", x: 50, y: 46, fontSize: 28, color: "#6e5252", fontWeight: "normal", background: "#f3e6e3" },
    ],
  },
  // —— 活泼撞色系 ——
  {
    id: "cv-pop-alert",
    name: "红黄预警",
    palette: "pop",
    previewBackground: "#ffe234",
    layers: [
      { role: "main", sample: "踩雷预警!!", x: 50, y: 32, fontSize: 66, color: "#ffffff", fontWeight: "bold", background: "#ff2442" },
      { role: "sub", sample: "这 3 个千万别买", x: 50, y: 47, fontSize: 30, color: "#111111", fontWeight: "bold", background: "#ffffff" },
    ],
  },
  {
    id: "cv-pop-klein",
    name: "克莱因蓝",
    palette: "pop",
    previewBackground: "#2b4bdf",
    layers: [
      { role: "main", sample: "效率神器\nTOP5", x: 50, y: 38, fontSize: 64, color: "#ffe234", fontWeight: "bold" },
      { role: "sub", sample: "打工人必备清单", x: 50, y: 55, fontSize: 28, color: "#ffffff", fontWeight: "normal", borderColor: "#ffe234" },
    ],
  },
  {
    id: "cv-pop-mint",
    name: "紫拼薄荷",
    palette: "pop",
    previewBackground: "#bff2df",
    layers: [
      { role: "main", sample: "自律 21 天\n挑战", x: 50, y: 62, fontSize: 60, color: "#ffffff", fontWeight: "bold", background: "#6a3df5" },
      { role: "sub", sample: "作息表直接抄", x: 50, y: 78, fontSize: 28, color: "#4a2bb0", fontWeight: "bold", fontFamily: "yuanti" },
    ],
  },
];

export function getCoverTemplate(id: string | undefined): CoverTemplate | undefined {
  return COVER_TEMPLATES.find((t) => t.id === id);
}

/**
 * 模板层 → 封面文字叠层(物化,之后可自由微调)。
 * 同 role 的层已有内容时保留创作者改过的文字,只换排版样式。
 */
export function coverTemplateToOverlays(
  template: CoverTemplate,
  prev?: Pick<TextOverlay, "id" | "content">[]
): TextOverlay[] {
  return template.layers.map((l) => {
    const { role, sample, ...style } = l;
    const existing = prev?.find((t) => t.id === `cover-${role}`);
    return { id: `cover-${role}`, content: existing?.content || sample, templateId: template.id, ...style };
  });
}
