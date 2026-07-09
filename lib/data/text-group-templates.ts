import type { TextOverlay } from "../types";

/**
 * 文字组合模板(T2):一键投放一组预排版的文字图层(广告/种草/教程常用),
 * 每层带独立位置与专业样式,落地后可各自拖拽/微调。
 * 与封面模板(cover-templates)不同,这里作用于画面文字图层(draft.texts)。
 */

/** 组合中的一层:位置 + 内容 + 完整样式(不含 id/时间,应用时补齐) */
export type GroupLayer = Omit<TextOverlay, "id" | "start" | "end">;

export interface TextGroupTemplate {
  id: string;
  name: string;
  /** 一句话用途 */
  hint: string;
  layers: GroupLayer[];
}

export const TEXT_GROUP_TEMPLATES: TextGroupTemplate[] = [
  {
    id: "g-promo-burst",
    name: "促销爆款",
    hint: "主标题 + 卖点 + 价格标签",
    layers: [
      {
        content: "限时秒杀",
        x: 50,
        y: 22,
        fontSize: 46,
        color: "#ffe234",
        fontWeight: "bold",
        stroke: { color: "#000000", width: 0.12 },
        shadow: { color: "rgba(0,0,0,0.45)", blur: 0.06, x: 0.05, y: 0.07 },
      },
      {
        content: "错过再等一年",
        x: 50,
        y: 33,
        fontSize: 24,
        color: "#ffffff",
        fontWeight: "normal",
        stroke: { color: "#000000", width: 0.05 },
      },
      {
        content: "¥99",
        x: 78,
        y: 80,
        fontSize: 40,
        color: "#ffffff",
        background: "#ff2442",
        fontWeight: "bold",
      },
    ],
  },
  {
    id: "g-seeding",
    name: "好物种草",
    hint: "标题卡片 + 标签",
    layers: [
      {
        content: "本月回购 TOP1",
        x: 50,
        y: 18,
        fontSize: 30,
        color: "#4a453e",
        background: "#faf7f0",
        borderColor: "#d8d0c0",
        fontWeight: "bold",
        fontFamily: "songti",
      },
      {
        content: "· 亲测有效 ·",
        x: 50,
        y: 30,
        fontSize: 20,
        color: "#a8887a",
        fontWeight: "normal",
        letterSpacing: 0.1,
        fontFamily: "kaiti",
      },
    ],
  },
  {
    id: "g-tutorial",
    name: "教程步骤",
    hint: "步骤序号 + 步骤标题",
    layers: [
      {
        content: "STEP 01",
        x: 22,
        y: 16,
        fontSize: 22,
        color: "#ffffff",
        background: "#ff2442",
        fontWeight: "bold",
        letterSpacing: 0.08,
      },
      {
        content: "先把素材导入时间轴",
        x: 50,
        y: 88,
        fontSize: 26,
        color: "#ffffff",
        fontWeight: "normal",
        stroke: { color: "#000000", width: 0.05 },
        shadow: { color: "rgba(0,0,0,0.5)", blur: 0.05, x: 0, y: 0.04 },
      },
    ],
  },
  {
    id: "g-quote-card",
    name: "金句卡片",
    hint: "大标题 + 署名",
    layers: [
      {
        content: "把日子过成\n喜欢的样子",
        x: 50,
        y: 44,
        fontSize: 40,
        color: "#f5f1e8",
        fontWeight: "bold",
        fontFamily: "songti",
        shadow: { color: "rgba(0,0,0,0.35)", blur: 0.1, x: 0, y: 0.03 },
      },
      {
        content: "—— 记录生活的第 100 天",
        x: 50,
        y: 62,
        fontSize: 18,
        color: "#e8e2d6",
        fontWeight: "normal",
        fontFamily: "kaiti",
        letterSpacing: 0.05,
      },
    ],
  },
];
