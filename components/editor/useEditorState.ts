"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { draftService } from "@/lib/services/drafts";
import { assetService } from "@/lib/services/assets";
import { IMAGE_CLIP_DURATION } from "@/lib/media";
import type {
  Clip,
  ColorAdjust,
  Draft,
  GalleryImage,
  MediaAsset,
  MusicConfig,
  TextOverlay,
} from "@/lib/types";

/** 可撤销的编辑状态子集(标题/封面/发布信息不进撤销栈) */
export interface EditorSnapshot {
  clips: Clip[];
  texts: TextOverlay[];
  filterId?: string;
  filterStrength: number;
  colorAdjust: ColorAdjust;
  music?: MusicConfig;
  gallery: GalleryImage[];
}

export type Selection =
  | { type: "clip"; id: string }
  | { type: "text"; id: string }
  | null;

export type SaveState = "saved" | "saving" | "idle";

function toSnapshot(draft: Draft): EditorSnapshot {
  return {
    clips: draft.clips,
    texts: draft.texts,
    filterId: draft.filterId,
    filterStrength: draft.filterStrength,
    colorAdjust: draft.colorAdjust,
    music: draft.music,
    gallery: draft.gallery,
  };
}

const MIN_CLIP_DURATION = 0.2;
const MAX_HISTORY = 50;

export function useEditorState(id: string) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);

  const undoStack = useRef<EditorSnapshot[]>([]);
  const redoStack = useRef<EditorSnapshot[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<Draft | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    draftService.get(id).then((d) => {
      if (!d) {
        setNotFound(true);
        return;
      }
      setDraft(d);
      // 从 OPFS 恢复素材面板(失效的 id 静默丢弃)
      Promise.all(d.assetIds.map((assetId) => assetService.load(assetId))).then(
        (loaded) => setAssets(loaded.filter((a): a is MediaAsset => a !== null))
      );
    });
  }, [id]);

  /** 防抖持久化 */
  const persist = useCallback(
    (next: Draft) => {
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await draftService.update(id, next);
        setSaveState("saved");
      }, 500);
    },
    [id]
  );

  /** 手势(拖拽修剪等)开始时压入一次历史,过程中的连续更新用 undoable:false */
  const pushHistory = useCallback(() => {
    const current = draftRef.current;
    if (!current) return;
    undoStack.current.push(toSnapshot(current));
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  /** 更新草稿;undoable 时记录历史 */
  const apply = useCallback(
    (patch: Partial<Draft>, options?: { undoable?: boolean }) => {
      const current = draftRef.current;
      if (!current) return;
      if (options?.undoable !== false) {
        undoStack.current.push(toSnapshot(current));
        if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
        redoStack.current = [];
      }
      const next = { ...current, ...patch, updatedAt: Date.now() };
      setDraft(next);
      persist(next);
    },
    [persist]
  );

  const undo = useCallback(() => {
    const current = draftRef.current;
    const snapshot = undoStack.current.pop();
    if (!current || !snapshot) return;
    redoStack.current.push(toSnapshot(current));
    const next = { ...current, ...snapshot, updatedAt: Date.now() };
    setDraft(next);
    persist(next);
  }, [persist]);

  const redo = useCallback(() => {
    const current = draftRef.current;
    const snapshot = redoStack.current.pop();
    if (!current || !snapshot) return;
    undoStack.current.push(toSnapshot(current));
    const next = { ...current, ...snapshot, updatedAt: Date.now() };
    setDraft(next);
    persist(next);
  }, [persist]);

  // F-09 撤销/重做快捷键
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const totalDuration = useMemo(
    () => (draft?.clips ?? []).reduce((sum, c) => sum + (c.end - c.start), 0),
    [draft?.clips]
  );

  // F-10 播放时钟:rAF 推进播放头,预览区的 <video>/<audio> 跟随此时钟同步
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPlayhead((t) => {
        if (t + dt >= totalDuration) {
          setPlaying(false);
          return totalDuration;
        }
        return t + dt;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, totalDuration]);

  // ---- 素材 ----

  /** 导入文件:写入 OPFS 并加入素材面板(随草稿持久化) */
  const importAssets = useCallback(async (files: File[]): Promise<void> => {
    const supported = files.filter(
      (f) => f.type.startsWith("video/") || f.type.startsWith("image/")
    );
    if (supported.length === 0) return;
    const imported = await Promise.all(supported.map((f) => assetService.importFile(f)));
    setAssets((prev) => [...prev, ...imported]);
    const current = draftRef.current;
    if (current) {
      const next = {
        ...current,
        assetIds: [...current.assetIds, ...imported.map((a) => a.id)],
        updatedAt: Date.now(),
      };
      setDraft(next);
      persist(next);
    }
  }, [persist]);

  // ---- 时间轴操作 ----

  const clips = draft?.clips ?? [];

  const addClipFromAsset = useCallback(
    (asset: MediaAsset) => {
      const current = draftRef.current;
      if (!current) return;
      const clip: Clip = {
        id: crypto.randomUUID(),
        name: asset.name,
        start: 0,
        end: asset.type === "image" ? IMAGE_CLIP_DURATION : asset.duration,
        assetId: asset.id,
        assetType: asset.type,
        thumbnail: asset.thumbnail,
      };
      apply({ clips: [...current.clips, clip] });
      setSelection({ type: "clip", id: clip.id });
    },
    [apply]
  );

  /** 播放头落在哪个片段上:返回 [clip, 片段内偏移秒, 序号] */
  const clipAtPlayhead = useCallback((): [Clip, number, number] | null => {
    const current = draftRef.current;
    if (!current) return null;
    let acc = 0;
    for (let i = 0; i < current.clips.length; i++) {
      const clip = current.clips[i];
      const dur = clip.end - clip.start;
      if (playhead < acc + dur) return [clip, playhead - acc, i];
      acc += dur;
    }
    return null;
  }, [playhead]);

  // F-05 在播放头处分割
  const splitAtPlayhead = useCallback(() => {
    const current = draftRef.current;
    const hit = clipAtPlayhead();
    if (!current || !hit) return;
    const [clip, offset, index] = hit;
    if (offset < MIN_CLIP_DURATION || clip.end - clip.start - offset < MIN_CLIP_DURATION)
      return;
    const first: Clip = { ...clip, id: crypto.randomUUID(), end: clip.start + offset, transitionAfter: undefined };
    const second: Clip = { ...clip, id: crypto.randomUUID(), start: clip.start + offset };
    const next = [...current.clips];
    next.splice(index, 1, first, second);
    apply({ clips: next });
    setSelection({ type: "clip", id: second.id });
  }, [apply, clipAtPlayhead]);

  // F-06 修剪入/出点(拖拽过程 undoable:false,手势开始时调 pushHistory)
  const trimClip = useCallback(
    (clipId: string, edge: "start" | "end", value: number, options?: { undoable?: boolean }) => {
      const current = draftRef.current;
      if (!current) return;
      apply({
        clips: current.clips.map((c) => {
          if (c.id !== clipId) return c;
          if (edge === "start")
            return { ...c, start: Math.min(Math.max(0, value), c.end - MIN_CLIP_DURATION) };
          const maxEnd = c.assetType === "image" ? Number.POSITIVE_INFINITY : getAssetDuration(c);
          return { ...c, end: Math.max(c.start + MIN_CLIP_DURATION, Math.min(value, maxEnd)) };
        }),
      }, options);

      function getAssetDuration(c: Clip) {
        return assets.find((a) => a.id === c.assetId)?.duration ?? c.end;
      }
    },
    [apply, assets]
  );

  // F-07 删除(flex 布局天然自动吸合)
  const deleteClip = useCallback(
    (clipId: string) => {
      const current = draftRef.current;
      if (!current) return;
      apply({ clips: current.clips.filter((c) => c.id !== clipId) });
      setSelection((s) => (s?.type === "clip" && s.id === clipId ? null : s));
    },
    [apply]
  );

  // F-08 拖拽排序
  const reorderClip = useCallback(
    (fromIndex: number, toIndex: number) => {
      const current = draftRef.current;
      if (!current || fromIndex === toIndex) return;
      const next = [...current.clips];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      apply({ clips: next });
    },
    [apply]
  );

  return {
    draft,
    notFound,
    saveState,
    assets,
    importAssets,
    selection,
    setSelection,
    playhead,
    setPlayhead,
    playing,
    setPlaying,
    totalDuration,
    clips,
    apply,
    pushHistory,
    undo,
    redo,
    addClipFromAsset,
    clipAtPlayhead,
    splitAtPlayhead,
    trimClip,
    deleteClip,
    reorderClip,
  };
}

export type EditorState = ReturnType<typeof useEditorState>;
