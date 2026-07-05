/** 文字模板库(画面文字 + 封面文字通用,Step 3 接入真实资产管理)。 */
export interface TextTemplate {
  id: string;
  name: string;
  /** 适用场景 */
  scene: "画面" | "封面";
  /** 画面文字的风格分类,缺省视为「基础」 */
  category?: string;
  sample: string;
  style: {
    color: string;
    background?: string;
    /** 文字框边框色,可为空 */
    borderColor?: string;
    fontWeight: "normal" | "bold";
    fontSize: number;
    /** 字体预设 id(lib/data/fonts.ts),缺省为默认黑体 */
    fontFamily?: string;
  };
}

/** 画面文字模板分类(F-64:小红书风与剪映抖音风形成差异) */
export const TEXT_TEMPLATE_CATEGORIES = ["基础", "小红书风"] as const;

export const TEXT_TEMPLATES: TextTemplate[] = [
  { id: "t-title-red", name: "标题红底", scene: "画面", sample: "今日份好物", style: { color: "#ffffff", background: "#ff2442", fontWeight: "bold", fontSize: 32 } },
  { id: "t-title-black", name: "黑底白字", scene: "画面", sample: "干货预警", style: { color: "#ffffff", background: "#111111", fontWeight: "bold", fontSize: 30 } },
  { id: "t-note", name: "笔记体", scene: "画面", sample: "记录一下～", style: { color: "#333333", background: "#fff7e0", fontWeight: "normal", fontSize: 24 } },
  { id: "t-clean", name: "简约白字", scene: "画面", sample: "分享日常", style: { color: "#ffffff", fontWeight: "normal", fontSize: 26 } },
  { id: "t-yellow-mark", name: "黄色荧光", scene: "画面", sample: "重点!!", style: { color: "#111111", background: "#ffe234", fontWeight: "bold", fontSize: 28 } },
  { id: "t-pink", name: "少女粉", scene: "画面", sample: "被种草了", style: { color: "#ffffff", background: "#ff8ab5", fontWeight: "bold", fontSize: 26 } },
  // —— 小红书风(F-64):留白、低饱和、精致不商业化,复用现有系统字体 ——
  { id: "x-hand-note", name: "手写体标注", scene: "画面", category: "小红书风", sample: "生活碎片,随手记", style: { color: "#6b6459", fontWeight: "normal", fontSize: 26, fontFamily: "kaiti" } },
  { id: "x-serif-title", name: "衬线大标题", scene: "画面", category: "小红书风", sample: "慢生活提案", style: { color: "#f5f1e8", fontWeight: "bold", fontSize: 36, fontFamily: "songti" } },
  { id: "x-quote", name: "留白引用", scene: "画面", category: "小红书风", sample: "「把日子过成喜欢的样子」", style: { color: "#4a453e", background: "#faf7f0", borderColor: "#d8d0c0", fontWeight: "normal", fontSize: 24, fontFamily: "songti" } },
  { id: "x-diary", name: "日记体", scene: "画面", category: "小红书风", sample: "七月五日 · 晴", style: { color: "#5a544b", background: "#f6f2e9", fontWeight: "normal", fontSize: 22, fontFamily: "kaiti" } },
  { id: "x-list", name: "清单体", scene: "画面", category: "小红书风", sample: "① 今日小事", style: { color: "#3d3a35", background: "#f3efe6", fontWeight: "normal", fontSize: 22 } },
  { id: "x-morandi", name: "莫兰迪标签", scene: "画面", category: "小红书风", sample: "治愈系日常", style: { color: "#fdfcf9", background: "#a8b5a2", fontWeight: "normal", fontSize: 22, fontFamily: "yuanti" } },
  { id: "x-mist-blue", name: "雾蓝注脚", scene: "画面", category: "小红书风", sample: "小城漫步日志", style: { color: "#f0f3f5", background: "#8fa3b3", fontWeight: "normal", fontSize: 20, fontFamily: "songti" } },
  { id: "x-cream", name: "奶油便签", scene: "画面", category: "小红书风", sample: "今日份治愈", style: { color: "#7a6a55", background: "#fdf6ec", fontWeight: "normal", fontSize: 24, fontFamily: "yuanti" } },
  { id: "x-serif-small", name: "衬线小注", scene: "画面", category: "小红书风", sample: "认真生活的人先享受世界", style: { color: "#e8e2d6", fontWeight: "normal", fontSize: 18, fontFamily: "songti" } },
  { id: "c-big-title", name: "封面大标题", scene: "封面", sample: "3个技巧\n学会剪辑", style: { color: "#ffffff", fontWeight: "bold", fontSize: 44 } },
  { id: "c-red-strip", name: "红条封面", scene: "封面", sample: "新手必看", style: { color: "#ffffff", background: "#ff2442", fontWeight: "bold", fontSize: 36 } },
  { id: "c-white-card", name: "白卡片", scene: "封面", sample: "保姆级教程", style: { color: "#111111", background: "#ffffff", fontWeight: "bold", fontSize: 34 } },
  { id: "c-outline", name: "描边标题", scene: "封面", sample: "沉浸式体验", style: { color: "#ffe234", fontWeight: "bold", fontSize: 40 } },
  { id: "c-sub", name: "副标题", scene: "封面", sample: "跟我一起做", style: { color: "#ffffff", background: "rgba(0,0,0,0.5)", fontWeight: "normal", fontSize: 24 } },
];

export function getTextTemplate(id: string | undefined): TextTemplate | undefined {
  return TEXT_TEMPLATES.find((t) => t.id === id);
}
