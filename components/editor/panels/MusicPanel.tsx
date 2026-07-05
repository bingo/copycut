"use client";

import { useEffect, useRef, useState } from "react";
import { MUSIC_CATEGORIES, MUSIC_MOODS, MUSIC_TRACKS, type MusicMood } from "@/lib/data/music";
import { formatDuration } from "@/lib/media";
import { CategoryTabs } from "./FilterPanel";
import type { EditorState } from "./../useEditorState";

/** F-17 背景音乐库(真实音频试听/添加)+ F-18 音量与淡入淡出 + F-64 氛围筛选 */
export default function MusicPanel({ editor }: { editor: EditorState }) {
  const { draft, apply, pushHistory } = editor;
  const [category, setCategory] = useState<string>(MUSIC_CATEGORIES[0]);
  /** 氛围维度筛选,null 表示全部 */
  const [mood, setMood] = useState<MusicMood | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 卸载面板时停掉试听
  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    []
  );

  if (!draft) return null;
  const music = draft.music;
  const tracks = MUSIC_TRACKS.filter(
    (t) => t.category === category && (!mood || t.mood === mood)
  );

  function preview(trackId: string) {
    const track = MUSIC_TRACKS.find((t) => t.id === trackId);
    if (!track) return;
    audioRef.current?.pause();
    if (previewing === trackId) {
      setPreviewing(null);
      return;
    }
    const audio = new Audio(track.url);
    audio.volume = 0.7;
    audio.onended = () => setPreviewing((p) => (p === trackId ? null : p));
    audio.play().catch(() => {});
    audioRef.current = audio;
    setPreviewing(trackId);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <CategoryTabs categories={MUSIC_CATEGORIES} active={category} onChange={setCategory} />

      {/* F-64:氛围维度筛选,与曲风分类叠加生效 */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 px-3 py-2">
        <span className="shrink-0 pr-1 text-[11px] text-zinc-600">氛围</span>
        {([null, ...MUSIC_MOODS] as const).map((m) => (
          <button
            key={m ?? "all"}
            type="button"
            onClick={() => setMood(m)}
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${
              mood === m
                ? "border-[#ff2442] text-[#ff2442]"
                : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {m ?? "全部"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tracks.length === 0 && (
          <p className="mb-2 rounded-lg bg-zinc-800/60 px-3 py-2 text-xs leading-5 text-zinc-500">
            该曲风下暂无「{mood}」氛围的曲目,试试其他氛围或切换曲风
          </p>
        )}
        {tracks.map((track) => {
          const inUse = music?.trackId === track.id;
          return (
            <div
              key={track.id}
              className={`mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 ${
                inUse ? "border-[#ff2442]/60 bg-[#ff2442]/5" : "border-zinc-800"
              }`}
            >
              <button
                type="button"
                onClick={() => preview(track.id)}
                title="试听"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700"
              >
                {previewing === track.id ? "⏸" : "▶"}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-200">{track.name}</p>
                <p className="text-[11px] text-zinc-500">
                  {track.artist} · {formatDuration(track.duration)} · {track.mood}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  apply({
                    music: inUse
                      ? undefined
                      : { trackId: track.id, volume: 60, fadeIn: false, fadeOut: false },
                  })
                }
                className={`shrink-0 rounded px-2 py-1 text-xs ${
                  inUse
                    ? "text-zinc-400 hover:bg-zinc-800"
                    : "bg-[#ff2442] text-white hover:opacity-90"
                }`}
              >
                {inUse ? "移除" : "使用"}
              </button>
            </div>
          );
        })}
        <p className="text-[11px] leading-4 text-zinc-600">
          曲库为 CC0 公有领域音乐,可免版权商用
        </p>
      </div>

      {music && (
        <div className="border-t border-zinc-800 p-3">
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>音量</span>
            <span>{music.volume}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={music.volume}
            onPointerDown={pushHistory}
            onChange={(e) =>
              apply({ music: { ...music, volume: Number(e.target.value) } }, { undoable: false })
            }
            className="w-full accent-[#ff2442]"
          />
          <div className="mt-2 flex gap-4">
            {(
              [
                ["fadeIn", "淡入"],
                ["fadeOut", "淡出"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={music[key]}
                  onChange={(e) => apply({ music: { ...music, [key]: e.target.checked } })}
                  className="accent-[#ff2442]"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
