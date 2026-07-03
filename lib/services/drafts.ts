import {
  DEFAULT_COLOR_ADJUST,
  type AspectRatio,
  type Draft,
  type ProjectMode,
} from "../types";

/**
 * 草稿服务接口。Step 2 用 localStorage 保存项目元数据(符合 Alpha 技术约束),
 * Step 3 替换为 IndexedDB / 后端实现。
 */
export interface DraftService {
  list(): Promise<Draft[]>;
  get(id: string): Promise<Draft | null>;
  create(aspectRatio: AspectRatio, mode?: ProjectMode): Promise<Draft>;
  update(id: string, patch: Partial<Omit<Draft, "id" | "createdAt">>): Promise<Draft>;
  remove(id: string): Promise<void>;
}

const DRAFTS_KEY = "copycut.drafts";

/** 补齐旧版本草稿缺失的字段 */
function migrate(draft: Draft): Draft {
  return {
    ...draft,
    mode: draft.mode ?? "video",
    texts: draft.texts ?? [],
    filterStrength: draft.filterStrength ?? 80,
    colorAdjust: draft.colorAdjust ?? { ...DEFAULT_COLOR_ADJUST },
    gallery: draft.gallery ?? [],
  };
}

function readAll(): Draft[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(DRAFTS_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Draft[]).map(migrate);
  } catch {
    return [];
  }
}

function writeAll(drafts: Draft[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

class LocalDraftService implements DraftService {
  async list(): Promise<Draft[]> {
    return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<Draft | null> {
    return readAll().find((d) => d.id === id) ?? null;
  }

  async create(aspectRatio: AspectRatio, mode: ProjectMode = "video"): Promise<Draft> {
    const now = Date.now();
    const draft: Draft = {
      id: crypto.randomUUID(),
      title: `未命名项目 ${new Date(now).toLocaleDateString("zh-CN")}`,
      mode,
      aspectRatio,
      clips: [],
      texts: [],
      filterStrength: 80,
      colorAdjust: { ...DEFAULT_COLOR_ADJUST },
      gallery: [],
      createdAt: now,
      updatedAt: now,
    };
    writeAll([...readAll(), draft]);
    return draft;
  }

  async update(
    id: string,
    patch: Partial<Omit<Draft, "id" | "createdAt">>
  ): Promise<Draft> {
    const drafts = readAll();
    const index = drafts.findIndex((d) => d.id === id);
    if (index === -1) throw new Error(`草稿不存在: ${id}`);
    const updated: Draft = { ...drafts[index], ...patch, updatedAt: Date.now() };
    drafts[index] = updated;
    writeAll(drafts);
    return updated;
  }

  async remove(id: string): Promise<void> {
    writeAll(readAll().filter((d) => d.id !== id));
  }
}

export const draftService: DraftService = new LocalDraftService();
