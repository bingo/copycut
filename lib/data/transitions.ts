/** 转场库。真实渲染见 lib/engine/transitions.ts(预览与导出共用)。 */
export interface TransitionPreset {
  id: string;
  name: string;
  icon: string;
  category: string;
}

export const TRANSITION_CATEGORIES = ["基础", "慢节奏", "运镜", "模糊", "光效", "创意"] as const;

export const TRANSITIONS: TransitionPreset[] = [
  // 基础
  { id: "fade", name: "叠化", icon: "◧", category: "基础" },
  { id: "black", name: "闪黑", icon: "■", category: "基础" },
  { id: "white", name: "闪白", icon: "□", category: "基础" },
  { id: "wipe-l", name: "左擦除", icon: "◀", category: "基础" },
  { id: "wipe-r", name: "右擦除", icon: "▶", category: "基础" },
  { id: "wipe-u", name: "上擦除", icon: "▲", category: "基础" },
  // 慢节奏(F-64:小红书审美,柔和不抢戏,与抖音风的强刺激转场形成差异)
  { id: "soft-fade", name: "柔和叠化", icon: "◐", category: "慢节奏" },
  { id: "mist", name: "雾化过渡", icon: "☁", category: "慢节奏" },
  { id: "breath", name: "呼吸感缩放", icon: "⊙", category: "慢节奏" },
  { id: "blank-fade", name: "留白渐隐", icon: "▢", category: "慢节奏" },
  // 运镜
  { id: "push-l", name: "左推", icon: "⇤", category: "运镜" },
  { id: "push-r", name: "右推", icon: "⇥", category: "运镜" },
  { id: "zoom-in", name: "放大", icon: "⊕", category: "运镜" },
  { id: "zoom-out", name: "缩小", icon: "⊖", category: "运镜" },
  { id: "spin", name: "旋转", icon: "↻", category: "运镜" },
  { id: "shake", name: "抖动", icon: "≋", category: "运镜" },
  // 模糊
  { id: "blur", name: "模糊过渡", icon: "◌", category: "模糊" },
  { id: "motion-blur", name: "动感模糊", icon: "〰", category: "模糊" },
  { id: "radial-blur", name: "径向模糊", icon: "◎", category: "模糊" },
  // 光效
  { id: "flash", name: "闪光", icon: "✦", category: "光效" },
  { id: "leak", name: "漏光", icon: "☀", category: "光效" },
  { id: "glow", name: "光晕", icon: "◍", category: "光效" },
  // 创意
  { id: "glitch", name: "故障", icon: "▚", category: "创意" },
  { id: "mosaic", name: "马赛克", icon: "▦", category: "创意" },
  { id: "heart", name: "爱心划过", icon: "♥", category: "创意" },
  { id: "page", name: "翻页", icon: "❐", category: "创意" },
];

export function getTransition(id: string | undefined): TransitionPreset | undefined {
  return TRANSITIONS.find((t) => t.id === id);
}
