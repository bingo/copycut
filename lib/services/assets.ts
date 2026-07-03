import { loadAsset } from "../media";
import { getDB, type AssetMeta } from "./db";
import type { MediaAsset } from "../types";

/**
 * 素材服务:文件本体写入 OPFS(浏览器私有文件系统),
 * 元数据(时长/缩略图/尺寸)存 IndexedDB。刷新/重开草稿后素材可恢复。
 */
export interface AssetService {
  /** 导入文件:持久化并返回带会话 object URL 的素材 */
  importFile(file: File): Promise<MediaAsset>;
  /** 按 id 恢复素材(OPFS 读回文件并创建 object URL),不存在返回 null */
  load(id: string): Promise<MediaAsset | null>;
  /** 导出管线用:取原始 File */
  getFile(id: string): Promise<File | null>;
  remove(id: string): Promise<void>;
}

async function assetsDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle("assets", { create: true });
}

class OpfsAssetService implements AssetService {
  /** 会话内缓存,避免重复读 OPFS 与重复创建 object URL */
  private cache = new Map<string, MediaAsset>();

  async importFile(file: File): Promise<MediaAsset> {
    const id = crypto.randomUUID();
    // 先解析元数据(失败则不落盘)
    const asset = await loadAsset(file, id);
    const dir = await assetsDir();
    const handle = await dir.getFileHandle(id, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    const meta = { ...asset, name: file.name } as Partial<MediaAsset> & AssetMeta;
    delete meta.url;
    await (await getDB()).put("assets", meta);
    this.cache.set(id, asset);
    return asset;
  }

  async load(id: string): Promise<MediaAsset | null> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const meta: AssetMeta | undefined = await (await getDB()).get("assets", id);
    if (!meta) return null;
    const file = await this.readFile(id);
    if (!file) return null;
    const asset: MediaAsset = { ...meta, url: URL.createObjectURL(file) };
    this.cache.set(id, asset);
    return asset;
  }

  async getFile(id: string): Promise<File | null> {
    const file = await this.readFile(id);
    if (!file) return null;
    const meta = await (await getDB()).get("assets", id);
    // OPFS 文件名是 assetId,恢复原始文件名和 MIME
    return meta ? new File([file], meta.name, { type: file.type || guessMime(meta) }) : file;
  }

  async remove(id: string): Promise<void> {
    const cached = this.cache.get(id);
    if (cached) URL.revokeObjectURL(cached.url);
    this.cache.delete(id);
    await (await getDB()).delete("assets", id);
    const dir = await assetsDir();
    await dir.removeEntry(id).catch(() => {});
  }

  private async readFile(id: string): Promise<File | null> {
    try {
      const dir = await assetsDir();
      const handle = await dir.getFileHandle(id);
      return await handle.getFile();
    } catch {
      return null;
    }
  }
}

function guessMime(meta: AssetMeta): string {
  if (meta.type === "video") return "video/mp4";
  return meta.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

export const assetService: AssetService = new OpfsAssetService();
