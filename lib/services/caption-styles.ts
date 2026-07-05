import type { CaptionStyle } from "../types";
import { authService } from "./auth";

/**
 * 个人风格模板服务(F-62 / S3):把图文轮播里调好的文字样式组合
 * (字体/字号/颜色/背景/加粗 + 位置快照,不含文字内容)存入 localStorage,
 * 跨草稿复用,保证账号视觉一致性。按登录用户隔离(同 drafts 的 owner 规则)。
 */
export interface SavedCaptionStyle {
  id: string;
  name: string;
  /** 归属用户,authService.getOwnerKey() */
  owner: string;
  /** 样式快照;x/y 一并保存,应用时是否覆盖位置由界面开关决定 */
  style: CaptionStyle;
  createdAt: number;
}

const STORAGE_KEY = "copycut.captionStyles";

function readAll(): SavedCaptionStyle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedCaptionStyle[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: SavedCaptionStyle[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const captionStyleService = {
  /** 当前用户的风格列表,新保存的在前;未登录返回空 */
  list(): SavedCaptionStyle[] {
    const owner = authService.getOwnerKey();
    if (!owner) return [];
    return readAll()
      .filter((s) => s.owner === owner)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  /** 保存一条风格;未登录返回 null */
  save(name: string, style: CaptionStyle): SavedCaptionStyle | null {
    const owner = authService.getOwnerKey();
    if (!owner) return null;
    const entry: SavedCaptionStyle = {
      id: crypto.randomUUID(),
      name,
      owner,
      style: { ...style },
      createdAt: Date.now(),
    };
    writeAll([...readAll(), entry]);
    return entry;
  },

  remove(id: string): void {
    writeAll(readAll().filter((s) => s.id !== id));
  },
};
