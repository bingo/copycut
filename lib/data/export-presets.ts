import type { AspectRatio } from "../types";

/** F-60 / S1:导出参数预设。小红书推荐参数依据见 00-PRD/06-competitive-strategy.md S1。 */
export type ExportPresetId = "xhs" | "custom";

export interface ExportPreset {
  id: ExportPresetId;
  name: string;
  hint: string;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  { id: "xhs", name: "小红书推荐", hint: "零画质损失" },
  { id: "custom", name: "自定义", hint: "手动选参数" },
];

/** 小红书推荐预设:按画布比例的导出像素尺寸(竖屏 9:16 = 1080×1920 优先) */
export const XHS_EXPORT_SIZE: Record<AspectRatio, [number, number]> = {
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
};

/** 小红书转码友好帧率(25–30fps 区间取 30) */
export const XHS_EXPORT_FPS = 30;

/** 码率安全档位(Mbps),8–12 Mbps 为小红书二次压缩损伤最小区间 */
export const XHS_BITRATES_MBPS = [8, 10, 12] as const;
export const XHS_DEFAULT_BITRATE_MBPS: (typeof XHS_BITRATES_MBPS)[number] = 10;

/** 「为什么是这些参数」——把玄学变成确定性 */
export const XHS_PRESET_REASONS = [
  "小红书会对上传视频二次压缩,源文件越贴近其转码规格,画质损失越小",
  "帧率 25–30fps、码率 8–12 Mbps 的源文件转码损伤最小,盲目拉高反而浪费体积",
  "分辨率超过 1080P 时,建议改用小红书网页端上传,画质保留更完整",
];
