import {
  DEFAULT_COLOR_ADJUST,
  type AspectRatio,
  type Draft,
  type ProjectMode,
} from "../types";
import { authService } from "./auth";
import { getDB } from "./db";

/**
 * 草稿服务接口。Step 3 起用 IndexedDB 保存完整工程
 * (素材文件本体在 OPFS,见 assets.ts)。
 * 草稿按登录用户隔离:owner = "provider:username"(见 authService.getOwnerKey),
 * 所有读写只作用于当前用户的草稿。多用户上线前的无主旧草稿,
 * 由首个访问到它的登录用户认领。
 */
export interface DraftService {
  list(): Promise<Draft[]>;
  get(id: string): Promise<Draft | null>;
  create(aspectRatio: AspectRatio, mode?: ProjectMode): Promise<Draft>;
  update(
    id: string,
    patch: Partial<Omit<Draft, "id" | "createdAt" | "owner">>
  ): Promise<Draft>;
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

  private requireOwner(): string {
    const owner = authService.getOwnerKey();
    if (!owner) throw new Error("请先登录");
    return owner;
  }

  /** 无主旧草稿认领给当前用户并落库 */
  private async claim(draft: Draft, owner: string): Promise<Draft> {
    const claimed = { ...draft, owner };
    await (await getDB()).put("drafts", claimed);
    return claimed;
  }

  async list(): Promise<Draft[]> {
    await this.ensureMigrated();
    const owner = this.requireOwner();
    const drafts = await (await getDB()).getAll("drafts");
    const visible = await Promise.all(
      drafts
        .map(migrate)
        .filter((d) => !d.owner || d.owner === owner)
        .map((d) => (d.owner ? Promise.resolve(d) : this.claim(d, owner)))
    );
    return visible.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<Draft | null> {
    await this.ensureMigrated();
    const owner = this.requireOwner();
    const raw = await (await getDB()).get("drafts", id);
    if (!raw) return null;
    const draft = migrate(raw);
    if (!draft.owner) return this.claim(draft, owner);
    return draft.owner === owner ? draft : null;
  }

  async create(aspectRatio: AspectRatio, mode: ProjectMode = "video"): Promise<Draft> {
    await this.ensureMigrated();
    const owner = this.requireOwner();
    const now = Date.now();
    const draft: Draft = {
      id: crypto.randomUUID(),
      owner,
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
    patch: Partial<Omit<Draft, "id" | "createdAt" | "owner">>
  ): Promise<Draft> {
    const current = await this.get(id);
    if (!current) throw new Error(`草稿不存在: ${id}`);
    const updated: Draft = { ...current, ...patch, updatedAt: Date.now() };
    await (await getDB()).put("drafts", updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    // 复用 get 的归属校验,别人的草稿删不掉
    const current = await this.get(id);
    if (current) await (await getDB()).delete("drafts", id);
  }
}

export const draftService: DraftService = new IdbDraftService();
