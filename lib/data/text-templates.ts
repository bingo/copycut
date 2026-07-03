/** 文字模板库(画面文字 + 封面文字通用,Step 3 接入真实资产管理)。 */
export interface TextTemplate {
  id: string;
  name: string;
  /** 适用场景 */
  scene: "画面" | "封面";
  sample: string;
  style: {
    color: string;
    background?: string;
    fontWeight: "normal" | "bold";
    fontSize: number;
  };
}

export const TEXT_TEMPLATES: TextTemplate[] = [
  { id: "t-title-red", name: "标题红底", scene: "画面", sample: "今日份好物", style: { color: "#ffffff", background: "#ff2442", fontWeight: "bold", fontSize: 32 } },
  { id: "t-title-black", name: "黑底白字", scene: "画面", sample: "干货预警", style: { color: "#ffffff", background: "#111111", fontWeight: "bold", fontSize: 30 } },
  { id: "t-note", name: "笔记体", scene: "画面", sample: "记录一下～", style: { color: "#333333", background: "#fff7e0", fontWeight: "normal", fontSize: 24 } },
  { id: "t-clean", name: "简约白字", scene: "画面", sample: "分享日常", style: { color: "#ffffff", fontWeight: "normal", fontSize: 26 } },
  { id: "t-yellow-mark", name: "黄色荧光", scene: "画面", sample: "重点!!", style: { color: "#111111", background: "#ffe234", fontWeight: "bold", fontSize: 28 } },
  { id: "t-pink", name: "少女粉", scene: "画面", sample: "被种草了", style: { color: "#ffffff", background: "#ff8ab5", fontWeight: "bold", fontSize: 26 } },
  { id: "c-big-title", name: "封面大标题", scene: "封面", sample: "3个技巧\n学会剪辑", style: { color: "#ffffff", fontWeight: "bold", fontSize: 44 } },
  { id: "c-red-strip", name: "红条封面", scene: "封面", sample: "新手必看", style: { color: "#ffffff", background: "#ff2442", fontWeight: "bold", fontSize: 36 } },
  { id: "c-white-card", name: "白卡片", scene: "封面", sample: "保姆级教程", style: { color: "#111111", background: "#ffffff", fontWeight: "bold", fontSize: 34 } },
  { id: "c-outline", name: "描边标题", scene: "封面", sample: "沉浸式体验", style: { color: "#ffe234", fontWeight: "bold", fontSize: 40 } },
  { id: "c-sub", name: "副标题", scene: "封面", sample: "跟我一起做", style: { color: "#ffffff", background: "rgba(0,0,0,0.5)", fontWeight: "normal", fontSize: 24 } },
];

export function getTextTemplate(id: string | undefined): TextTemplate | undefined {
  return TEXT_TEMPLATES.find((t) => t.id === id);
}
