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

function loadImageAsset(file: File, url: string, id: string): Promise<MediaAsset> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        id,
        name: file.name,
        type: "image",
        duration: IMAGE_CLIP_DURATION,
        url,
        thumbnail: drawThumbnail(img, img.naturalWidth, img.naturalHeight),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    img.onerror = () => reject(new Error(`图片加载失败: ${file.name}`));
    img.src = url;
  });
}

function loadVideoAsset(file: File, url: string, id: string): Promise<MediaAsset> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = url;
    // MediaRecorder 产物(webm)常缺时长元数据(duration=Infinity),
    // 需先 seek 到极大值逼出真实时长,再定位抽缩略图帧
    let probingDuration = false;
    const seekForThumbnail = () => {
      video.currentTime = Math.min(0.5, video.duration / 2);
    };
    video.onerror = () => reject(new Error(`视频加载失败: ${file.name}`));
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) {
        seekForThumbnail();
      } else {
        probingDuration = true;
        video.currentTime = 1e7;
      }
    };
    video.ondurationchange = () => {
      if (probingDuration && Number.isFinite(video.duration)) {
        probingDuration = false;
        seekForThumbnail();
      }
    };
    video.onseeked = () => {
      if (probingDuration || !Number.isFinite(video.duration)) return;
      resolve({
        id,
        name: file.name,
        type: "video",
        duration: video.duration,
        url,
        thumbnail: drawThumbnail(video, video.videoWidth, video.videoHeight),
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };
  });
}

/**
 * 从文件解析素材元数据(object URL + 缩略图 + 尺寸/时长)。
 * 文件持久化由 lib/services/assets.ts 负责。
 */
export function loadAsset(file: File, id: string = crypto.randomUUID()): Promise<MediaAsset> {
  const url = URL.createObjectURL(file);
  return file.type.startsWith("video/")
    ? loadVideoAsset(file, url, id)
    : loadImageAsset(file, url, id);
}

/** 秒 → "mm:ss.d" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${String(m).padStart(2, "0")}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}
