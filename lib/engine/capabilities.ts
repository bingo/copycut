/**
 * 导出能力检测。预览/剪辑功能全浏览器可用,
 * 视频导出依赖 WebCodecs(Chrome/Edge 94+、Safari 26+)。
 */
export interface ExportCapabilities {
  video: boolean;
  /** AudioEncoder 缺失时可导出无声视频 */
  audio: boolean;
  opfs: boolean;
}

export function detectCapabilities(): ExportCapabilities {
  if (typeof window === "undefined") return { video: false, audio: false, opfs: false };
  return {
    video: "VideoEncoder" in window,
    audio: "AudioEncoder" in window,
    opfs: !!navigator.storage?.getDirectory,
  };
}

export const UNSUPPORTED_HINT = "当前浏览器不支持视频导出,请使用 Chrome / Edge / Safari 26+";
