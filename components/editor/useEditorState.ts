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
  /** F-65/T1 编辑器内部剪贴板(片段或文字快照,不跨草稿) */
  const clipboard = useRef<
    { kind: "clip"; clip: Clip } | { kind: "text"; text: TextOverlay } | null
  >(null);
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

  // F-09 撤销/重做快捷键的绑定已集中到 useEditorShortcuts(F-65),此处只提供 undo/redo action

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

  /** 播放/暂停;已播到末尾时再次播放从头开始(与播放按钮同一逻辑,供 F-65 空格键复用) */
  const togglePlay = useCallback(() => {
    if (totalDuration === 0) return;
    if (!playing && playhead >= totalDuration) setPlayhead(0);
    setPlaying(!playing);
  }, [playing, playhead, totalDuration]);

  /** F-65 播放头微移(方向键逐帧 / Shift 大步),自动暂停以便精确定位 */
  const seekBy = useCallback(
    (delta: number) => {
      setPlaying(false);
      setPlayhead((t) => Math.max(0, Math.min(totalDuration, t + delta)));
    },
    [totalDuration]
  );

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

  // F-65/T1 复制选中对象(片段或文字)到内部剪贴板
  const copySelected = useCallback(() => {
    const current = draftRef.current;
    if (!current || !selection) return;
    if (selection.type === "clip") {
      const clip = current.clips.find((c) => c.id === selection.id);
      if (clip) clipboard.current = { kind: "clip", clip: { ...clip } };
    } else {
      const text = current.texts.find((t) => t.id === selection.id);
      if (text) clipboard.current = { kind: "text", text: { ...text } };
    }
  }, [selection]);

  /** T1 粘贴文字:新 id + 位置偏移避免完全重叠,保留样式与时间范围 */
  const pasteText = useCallback(
    (source: TextOverlay) => {
      const current = draftRef.current;
      if (!current) return;
      const text: TextOverlay = {
        ...source,
        id: crypto.randomUUID(),
        x: Math.min(98, source.x + 3),
        y: Math.min(98, source.y + 3),
      };
      apply({ texts: [...current.texts, text] });
      setSelection({ type: "text", id: text.id });
    },
    [apply]
  );

  // F-65/T1 粘贴:片段插到选中片段之后(无选中追加到末尾),文字加为新图层
  const paste = useCallback(() => {
    const current = draftRef.current;
    const copied = clipboard.current;
    if (!current || !copied) return;
    if (copied.kind === "text") {
      pasteText(copied.text);
      return;
    }
    const clip: Clip = { ...copied.clip, id: crypto.randomUUID(), transitionAfter: undefined };
    const at =
      selection?.type === "clip"
        ? current.clips.findIndex((c) => c.id === selection.id)
        : -1;
    const next = [...current.clips];
    next.splice(at === -1 ? next.length : at + 1, 0, clip);
    apply({ clips: next });
    setSelection({ type: "clip", id: clip.id });
  }, [apply, selection, pasteText]);

  // T1 ⌘/Ctrl+D 原位复制选中对象,不经过剪贴板
  const duplicateSelected = useCallback(() => {
    const current = draftRef.current;
    if (!current || !selection) return;
    if (selection.type === "text") {
      const text = current.texts.find((t) => t.id === selection.id);
      if (text) pasteText(text);
      return;
    }
    const source = current.clips.find((c) => c.id === selection.id);
    if (!source) return;
    const clip: Clip = { ...source, id: crypto.randomUUID(), transitionAfter: undefined };
    const at = current.clips.findIndex((c) => c.id === selection.id);
    const next = [...current.clips];
    next.splice(at + 1, 0, clip);
    apply({ clips: next });
    setSelection({ type: "clip", id: clip.id });
  }, [apply, selection, pasteText]);

  // F-65 删除当前选中(片段或文字),Delete 快捷键与时间轴删除按钮共用
  const deleteSelected = useCallback(() => {
    const current = draftRef.current;
    if (!current || !selection) return;
    if (selection.type === "clip") {
      deleteClip(selection.id);
    } else {
      apply({ texts: current.texts.filter((t) => t.id !== selection.id) });
      setSelection(null);
    }
  }, [selection, deleteClip, apply]);

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
    togglePlay,
    seekBy,
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
    copySelected,
    paste,
    duplicateSelected,
    deleteSelected,
    reorderClip,
  };
}

export type EditorState = ReturnType<typeof useEditorState>;
