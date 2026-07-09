import type {
  AspectRatio,
  ColorAdjust,
  MusicConfig,
  ProjectMode,
  TextOverlay,
} from "../types";
import { authService } from "./auth";

/**
 * 个人资产库(T1 重用与模板):文字样式 / 音乐预设 / 草稿模板,
 * localStorage 持久化、按登录用户隔离,跨草稿复用。
 * 与 caption-styles.ts(图文轮播个人风格)同一套模式。
 */

export interface UserAsset<T> {
  id: string;
  name: string;
  /** 归属用户,authService.getOwnerKey() */
  owner: string;
  data: T;
  createdAt: number;
}

/** 文字样式快照(不含内容/位置/时间) */
export type TextStyleSnapshot = Pick<
  TextOverlay,
  | "fontSize"
  | "color"
  | "fontWeight"
  | "fontFamily"
  | "background"
  | "borderColor"
  | "stroke"
  | "shadow"
  | "letterSpacing"
  | "opacity"
>;

/** 草稿模板:保留可复用的风格设定,不含素材/片段等内容 */
export interface DraftTemplateSnapshot {
  mode: ProjectMode;
  aspectRatio: AspectRatio;
  /** 文字图层(含位置/时间范围),从模板新建时整体带入 */
  texts: TextOverlay[];
  filterId?: string;
  filterStrength: number;
  colorAdjust: ColorAdjust;
  music?: MusicConfig;
}

function createStore<T>(storageKey: string) {
  const readAll = (): UserAsset<T>[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as UserAsset<T>[]) : [];
    } catch {
      return [];
    }
  };
  const writeAll = (list: UserAsset<T>[]): void => {
    localStorage.setItem(storageKey, JSON.stringify(list));
    // 同页面跨组件通知(storage 事件只在其他标签页触发)
    window.dispatchEvent(new Event(storageKey));
  };

  return {
    /** 订阅本 store 的变更(保存/删除),返回取消订阅函数 */
    subscribe(callback: () => void): () => void {
      window.addEventListener(storageKey, callback);
      return () => window.removeEventListener(storageKey, callback);
    },

    /** 当前用户的列表,新保存的在前;未登录返回空 */
    list(): UserAsset<T>[] {
      const owner = authService.getOwnerKey();
      if (!owner) return [];
      return readAll()
        .filter((s) => s.owner === owner)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    /** 保存一条;未登录返回 null */
    save(name: string, data: T): UserAsset<T> | null {
      const owner = authService.getOwnerKey();
      if (!owner) return null;
      const entry: UserAsset<T> = {
        id: crypto.randomUUID(),
        name,
        owner,
        data: JSON.parse(JSON.stringify(data)) as T,
        createdAt: Date.now(),
      };
      writeAll([...readAll(), entry]);
      return entry;
    },

    remove(id: string): void {
      writeAll(readAll().filter((s) => s.id !== id));
    },
  };
}

/** 「我的文字样式」:属性面板存,文字面板「我的」分类里复用 */
export const textStyleService = createStore<TextStyleSnapshot>("copycut.textStyles");

/** 「我的音乐预设」:曲目+音量+淡入淡出组合 */
export const musicPresetService = createStore<MusicConfig>("copycut.musicPresets");

/** 「我的项目模板」:草稿风格设定(文字图层/滤镜/调色/音乐/画幅) */
export const draftTemplateService = createStore<DraftTemplateSnapshot>(
  "copycut.draftTemplates"
);
