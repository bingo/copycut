/**
 * 滤镜预设库(Step 2:CSS filter 实时预览,Step 3 输出时真实渲染)。
 * 参数为满强度值,强度滑块按线性插值回归到 1(无效果)。
 */
export interface FilterPreset {
  id: string;
  name: string;
  category: string;
  params: {
    brightness?: number;
    contrast?: number;
    saturate?: number;
    sepia?: number;
    grayscale?: number;
    /** 度数 */
    hueRotate?: number;
  };
}

export const FILTER_CATEGORIES = ["小红书风", "人像", "美食", "风景", "复古"] as const;

export const FILTERS: FilterPreset[] = [
  // 小红书风
  { id: "xhs-milk", name: "奶油白", category: "小红书风", params: { brightness: 1.08, saturate: 0.92, contrast: 0.95, sepia: 0.08 } },
  { id: "xhs-clean", name: "清透感", category: "小红书风", params: { brightness: 1.06, saturate: 1.12, contrast: 1.02 } },
  { id: "xhs-blush", name: "落日脸红", category: "小红书风", params: { brightness: 1.04, saturate: 1.18, sepia: 0.12, hueRotate: -8 } },
  { id: "xhs-fog", name: "雾面高级", category: "小红书风", params: { brightness: 1.03, saturate: 0.8, contrast: 0.9 } },
  // 人像
  { id: "por-soft", name: "柔肤", category: "人像", params: { brightness: 1.1, saturate: 0.95, contrast: 0.92 } },
  { id: "por-warm", name: "暖调人像", category: "人像", params: { brightness: 1.05, sepia: 0.18, saturate: 1.05 } },
  { id: "por-cool", name: "冷白皮", category: "人像", params: { brightness: 1.08, saturate: 0.9, hueRotate: 8 } },
  // 美食
  { id: "food-hot", name: "热气腾腾", category: "美食", params: { saturate: 1.3, contrast: 1.08, brightness: 1.02 } },
  { id: "food-fresh", name: "生鲜感", category: "美食", params: { saturate: 1.2, brightness: 1.05, hueRotate: -5 } },
  // 风景
  { id: "land-vivid", name: "浓郁风景", category: "风景", params: { saturate: 1.35, contrast: 1.12 } },
  { id: "land-teal", name: "青橙", category: "风景", params: { saturate: 1.15, contrast: 1.1, hueRotate: 10 } },
  // 复古
  { id: "retro-film", name: "胶片", category: "复古", params: { sepia: 0.35, contrast: 1.08, saturate: 0.85 } },
  { id: "retro-bw", name: "黑白", category: "复古", params: { grayscale: 1, contrast: 1.1 } },
  { id: "retro-fade", name: "褪色回忆", category: "复古", params: { sepia: 0.25, brightness: 1.06, saturate: 0.7, contrast: 0.88 } },
];

export function getFilter(id: string | undefined): FilterPreset | undefined {
  return FILTERS.find((f) => f.id === id);
}

/** 按强度(0-100)插值生成 CSS filter 字符串 */
export function filterToCss(filter: FilterPreset | undefined, strength: number): string {
  if (!filter) return "";
  const s = Math.max(0, Math.min(100, strength)) / 100;
  const lerp = (v: number, identity: number) => identity + (v - identity) * s;
  const p = filter.params;
  const parts: string[] = [];
  if (p.brightness !== undefined) parts.push(`brightness(${lerp(p.brightness, 1).toFixed(3)})`);
  if (p.contrast !== undefined) parts.push(`contrast(${lerp(p.contrast, 1).toFixed(3)})`);
  if (p.saturate !== undefined) parts.push(`saturate(${lerp(p.saturate, 1).toFixed(3)})`);
  if (p.sepia !== undefined) parts.push(`sepia(${lerp(p.sepia, 0).toFixed(3)})`);
  if (p.grayscale !== undefined) parts.push(`grayscale(${lerp(p.grayscale, 0).toFixed(3)})`);
  if (p.hueRotate !== undefined) parts.push(`hue-rotate(${lerp(p.hueRotate, 0).toFixed(1)}deg)`);
  return parts.join(" ");
}
