import { strToU8, zip } from "fflate";
import { assetService } from "../services/assets";
import { getTextTemplate } from "../data/text-templates";
import { getFilter } from "../data/filters";
import { computeGrade } from "./colorgrade";
import {
  canvasToJpeg,
  captionToRenderText,
  composeToCanvas,
  extractVideoFrame,
  loadImageElement,
  type RenderText,
} from "./compose-image";
import type { AspectRatio, Draft } from "../types";

/** 封面导出尺寸(小红书封面 3:4 优先) */
const COVER_SIZE: Record<AspectRatio, [number, number]> = {
  "9:16": [1080, 1440],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
};

/** 图文导出的最长边 */
const GALLERY_MAX_EDGE = 1440;

interface BaseImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/** 优先从 OPFS 素材取全分辨率画面,退化到缩略图 */
async function resolveBase(
  assetId: string | undefined,
  assetTime: number | undefined,
  fallbackThumbnail: string | undefined
): Promise<BaseImage | null> {
  if (assetId) {
    const asset = await assetService.load(assetId);
    if (asset) {
      if (asset.type === "video") {
        const frame = await extractVideoFrame(asset.url, assetTime ?? 0);
        return { source: frame, width: frame.width, height: frame.height };
      }
      const img = await loadImageElement(asset.url);
      return { source: img, width: img.naturalWidth, height: img.naturalHeight };
    }
  }
  if (fallbackThumbnail) {
    const img = await loadImageElement(fallbackThumbnail);
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  }
  return null;
}

/** F-19/20 real:封面 JPG 合成导出 */
export async function exportCoverJpg(draft: Draft): Promise<Blob> {
  const cover = draft.cover;
  if (!cover?.frameThumbnail && !cover?.assetId) throw new Error("尚未选取封面帧");
  const base = await resolveBase(cover.assetId, cover.assetTime, cover.frameThumbnail);
  if (!base) throw new Error("封面帧素材不可用");

  const [width, height] = COVER_SIZE[draft.aspectRatio];
  const texts: RenderText[] = [];
  if (cover.text) {
    const template = getTextTemplate(cover.templateId);
    texts.push({
      content: cover.text,
      xPct: 50,
      yPct: 50,
      sizePx: ((template?.style.fontSize ?? 36) * height) / 600,
      color: template?.style.color ?? "#ffffff",
      background: template?.style.background,
      fontWeight: template?.style.fontWeight ?? "bold",
    });
  }

  const canvas = composeToCanvas({
    base: base.source,
    baseWidth: base.width,
    baseHeight: base.height,
    width,
    height,
    fit: "cover",
    texts,
  });
  return canvasToJpeg(canvas);
}

/** 发布信息 txt:随导出包附带标题/正文/话题/活动,发布时直接复制粘贴 */
export function buildPublishInfoText(draft: Draft): string {
  const p = draft.publish;
  const sections = [
    `标题:${(p?.title || draft.title).trim()}`,
    p?.body.trim() && `正文:\n${p.body.trim()}`,
    p?.topics.length && `话题:${p.topics.map((t) => `#${t}`).join(" ")}`,
    p?.event?.trim() && `活动:${p.event.trim()}`,
  ].filter(Boolean);
  return sections.join("\n\n") + "\n";
}

function zipEntries(entries: Record<string, Uint8Array>): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // JPEG/MP4 已压缩,zip 用存储级即可
    zip(entries, { level: 0 }, (err, data) =>
      err ? reject(err) : resolve(new Blob([data as BlobPart], { type: "application/zip" }))
    );
  });
}

/** 视频导出:MP4 与发布信息 txt 打包为 ZIP */
export async function packVideoZip(draft: Draft, video: Blob): Promise<Blob> {
  return zipEntries({
    [`${draft.title}.mp4`]: new Uint8Array(await video.arrayBuffer()),
    "发布信息.txt": strToU8(buildPublishInfoText(draft)),
  });
}

/** F-36/37 real:图文序列合成 → ZIP */
export async function exportGalleryZip(
  draft: Draft,
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  if (draft.gallery.length === 0) throw new Error("没有可导出的图片");
  const grade = computeGrade(getFilter(draft.filterId), draft.filterStrength, draft.colorAdjust);

  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < draft.gallery.length; i++) {
    const item = draft.gallery[i];
    const base = await resolveBase(item.assetId, undefined, item.thumbnail);
    if (!base) continue;
    const scale = Math.min(1, GALLERY_MAX_EDGE / Math.max(base.width, base.height));
    const height = Math.round(base.height * scale);
    const captionText = captionToRenderText(item, height);
    const canvas = composeToCanvas({
      base: base.source,
      baseWidth: base.width,
      baseHeight: base.height,
      width: Math.round(base.width * scale),
      height,
      fit: "contain",
      grade,
      texts: captionText ? [captionText] : undefined,
    });
    const blob = await canvasToJpeg(canvas);
    entries[`${String(i + 1).padStart(2, "0")}.jpg`] = new Uint8Array(
      await blob.arrayBuffer()
    );
    onProgress?.(i + 1, draft.gallery.length);
  }
  entries["发布信息.txt"] = strToU8(buildPublishInfoText(draft));

  return zipEntries(entries);
}
