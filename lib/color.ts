import type { ColorAdjust } from "./types";

/**
 * 基础调色 → CSS filter 近似映射(Step 2 实时预览用,Step 3 输出时真实调色)。
 * 色温/色调/高光/阴影/锐化没有精确 CSS 等价物,用近似组合模拟状态变化。
 */
export function colorAdjustToCss(adjust: ColorAdjust): string {
  const parts: string[] = [];
  const { brightness, contrast, saturation, temperature, tint, highlights, shadows, sharpness } =
    adjust;
  if (brightness) parts.push(`brightness(${(1 + brightness / 100).toFixed(3)})`);
  if (contrast) parts.push(`contrast(${(1 + contrast / 100).toFixed(3)})`);
  if (saturation) parts.push(`saturate(${(1 + saturation / 100).toFixed(3)})`);
  if (temperature > 0) parts.push(`sepia(${(temperature / 150).toFixed(3)})`);
  if (temperature < 0) parts.push(`hue-rotate(${(temperature * 0.4).toFixed(1)}deg)`);
  if (tint) parts.push(`hue-rotate(${(tint * 0.5).toFixed(1)}deg)`);
  if (highlights) parts.push(`brightness(${(1 + highlights / 300).toFixed(3)})`);
  if (shadows)
    parts.push(
      `contrast(${(1 - shadows / 250).toFixed(3)}) brightness(${(1 + shadows / 400).toFixed(3)})`
    );
  if (sharpness > 0) parts.push(`contrast(${(1 + sharpness / 400).toFixed(3)})`);
  return parts.join(" ");
}
