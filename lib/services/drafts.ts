import {
  DEFAULT_COLOR_ADJUST,
  type AspectRatio,
  type Draft,
  type ProjectMode,
} from "../types";
import { getDB } from "./db";

/**
 * 草稿服务接口。Step 3 起用 IndexedDB 保存完整工程
 * (素材文件本体在 OPFS,见 assets.ts)。
 */
export interface DraftService {
  list(): Promise<Draft[]>;
  get(id: string): Promise<Draft | null>;
  create(aspectRatio: AspectRatio, mode?: ProjectMode): Promise<Draft>;
  update(id: string, patch: Partial<Omit<Draft, "id" | "createdAt">>): Promise<Draft>;
  remove(id: string): Promise<void>;
}

const LEGACY_KEY = "copycut.drafts";
const MIGRATED_KEY = "copycut.drafts.migrated";

/** 补齐旧版本草稿缺失的字段 */
function migrate(draft: Draft): Draft {
  return {
    ...draft,
    mode: draft.mode ?? "video",
    texts: draft.texts ?? [],
    filterStrength: draft.filterStrength ?? 80,
    colorAdjust: draft.colorAdjust ?? { ...DEFAULT_COLOR_ADJUST },
    gallery: draft.gallery ?? [],
    assetIds: draft.assetIds ?? [],
  };
}

/** Step 2 localStorage 草稿一次性迁入 IndexedDB */
async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === "undefined" || localStorage.getItem(MIGRATED_KEY)) return;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (raw) {
    try {
      const drafts = JSON.parse(raw) as Draft[];
      const db = await getDB();
      const tx = db.transaction("drafts", "readwrite");
      await Promise.all(drafts.map((d) => tx.store.put(migrate(d))));
      await tx.done;
    } catch {
      // 迁移失败不阻塞,旧数据仍在 localStorage
    }
  }
  localStorage.setItem(MIGRATED_KEY, "1");
}

class IdbDraftService implements DraftService {
  private ready: Promise<void> | null = null;

  private ensureMigrated(): Promise<void> {
    this.ready ??= migrateFromLocalStorage();
    return this.ready;
  }

  async list(): Promise<Draft[]> {
    await this.ensureMigrated();
    const drafts = await (await getDB()).getAll("drafts");
    return drafts.map(migrate).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<Draft | null> {
    await this.ensureMigrated();
    const draft = await (await getDB()).get("drafts", id);
    return draft ? migrate(draft) : null;
  }

  async create(aspectRatio: AspectRatio, mode: ProjectMode = "video"): Promise<Draft> {
    await this.ensureMigrated();
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
      assetIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await (await getDB()).put("drafts", draft);
    return draft;
  }

  async update(
    id: string,
    patch: Partial<Omit<Draft, "id" | "createdAt">>
  ): Promise<Draft> {
    const db = await getDB();
    const current = await db.get("drafts", id);
    if (!current) throw new Error(`草稿不存在: ${id}`);
    const updated: Draft = { ...migrate(current), ...patch, updatedAt: Date.now() };
    await db.put("drafts", updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await (await getDB()).delete("drafts", id);
  }
}

export const draftService: DraftService = new IdbDraftService();
