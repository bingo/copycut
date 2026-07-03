import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Draft, MediaAsset } from "../types";

/** 素材元数据(文件本体在 OPFS,url 不入库) */
export type AssetMeta = Omit<MediaAsset, "url">;

interface CopycutDB extends DBSchema {
  drafts: { key: string; value: Draft };
  assets: { key: string; value: AssetMeta };
}

let dbPromise: Promise<IDBPDatabase<CopycutDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<CopycutDB>> {
  dbPromise ??= openDB<CopycutDB>("copycut", 1, {
    upgrade(db) {
      db.createObjectStore("drafts", { keyPath: "id" });
      db.createObjectStore("assets", { keyPath: "id" });
    },
  });
  return dbPromise;
}
