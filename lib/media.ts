import type { MediaAsset } from "./types";

/** 图片素材的默认片段时长,秒 */
export const IMAGE_CLIP_DURATION = 3;

const THUMB_SIZE = 160;

function drawThumbnail(
  source: HTMLVideoElement | HTMLImageElement,
  width: number,
  height: number
): string {
  const canvas = document.createElement("canvas");
  const scale = Math.min(THUMB_SIZE / width, THUMB_SIZE / height, 1);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

function loadImageAsset(file: File, url: string): Promise<MediaAsset> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        type: "image",
        duration: IMAGE_CLIP_DURATION,
        url,
        thumbnail: drawThumbnail(img, img.naturalWidth, img.naturalHeight),
      });
    img.onerror = () => reject(new Error(`图片加载失败: ${file.name}`));
    img.src = url;
  });
}

function loadVideoAsset(file: File, url: string): Promise<MediaAsset> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = url;
    video.onerror = () => reject(new Error(`视频加载失败: ${file.name}`));
    video.onloadedmetadata = () => {
      // 定位到 0.5s(或时长一半)抽一帧作缩略图
      video.currentTime = Math.min(0.5, video.duration / 2);
    };
    video.onseeked = () =>
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        type: "video",
        duration: video.duration,
        url,
        thumbnail: drawThumbnail(video, video.videoWidth, video.videoHeight),
      });
  });
}

/**
 * 从本地文件创建素材(生成 object URL + 缩略图)。
 * object URL 仅会话内有效,符合 Alpha "素材不持久化"约束。
 */
export function loadAsset(file: File): Promise<MediaAsset> {
  const url = URL.createObjectURL(file);
  return file.type.startsWith("video/")
    ? loadVideoAsset(file, url)
    : loadImageAsset(file, url);
}

/** 秒 → "mm:ss.d" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${String(m).padStart(2, "0")}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}
