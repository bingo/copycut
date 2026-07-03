/**
 * 背景音乐库(Step 2:mock 元数据 + WebAudio 合成试听音,Step 3 接入真实版权音乐源)。
 */
export interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  /** 秒 */
  duration: number;
  category: string;
  /** 试听合成音的根音频率,Hz */
  tone: number;
}

export const MUSIC_CATEGORIES = ["轻快", "治愈", "节奏", "氛围", "国风"] as const;

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "m-sunny", name: "Sunny Side", artist: "Mock Studio", duration: 96, category: "轻快", tone: 392 },
  { id: "m-picnic", name: "野餐日记", artist: "Mock Studio", duration: 84, category: "轻快", tone: 440 },
  { id: "m-bubble", name: "气泡水", artist: "Demo Lab", duration: 72, category: "轻快", tone: 494 },
  { id: "m-cloud", name: "云朵软糖", artist: "Demo Lab", duration: 108, category: "治愈", tone: 330 },
  { id: "m-evening", name: "傍晚散步", artist: "Mock Studio", duration: 120, category: "治愈", tone: 294 },
  { id: "m-rain", name: "雨后初晴", artist: "Sample Works", duration: 90, category: "治愈", tone: 349 },
  { id: "m-beat", name: "Urban Beat", artist: "Sample Works", duration: 66, category: "节奏", tone: 262 },
  { id: "m-swing", name: "摇摆节拍", artist: "Demo Lab", duration: 78, category: "节奏", tone: 233 },
  { id: "m-night", name: "夜车", artist: "Sample Works", duration: 102, category: "氛围", tone: 208 },
  { id: "m-space", name: "浮空", artist: "Mock Studio", duration: 132, category: "氛围", tone: 196 },
  { id: "m-guofeng", name: "青瓷", artist: "Demo Lab", duration: 114, category: "国风", tone: 587 },
  { id: "m-bamboo", name: "竹林闲", artist: "Sample Works", duration: 88, category: "国风", tone: 523 },
];

export function getTrack(id: string | undefined): MusicTrack | undefined {
  return MUSIC_TRACKS.find((t) => t.id === id);
}

let audioCtx: AudioContext | null = null;
let stopCurrent: (() => void) | null = null;

/**
 * 试听:用 WebAudio 合成 2 秒琶音代替真实音频(Alpha 无版权音乐源)。
 * 返回停止函数;再次调用会先停掉上一段。
 */
export function previewTone(track: MusicTrack): () => void {
  stopCurrent?.();
  if (typeof window === "undefined") return () => {};
  audioCtx ??= new AudioContext();
  const ctx = audioCtx;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
  gain.connect(ctx.destination);
  const ratios = [1, 5 / 4, 3 / 2, 2];
  const oscs = ratios.map((r, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = track.tone * r;
    osc.connect(gain);
    osc.start(ctx.currentTime + i * 0.18);
    osc.stop(ctx.currentTime + 2);
    return osc;
  });
  const stop = () => {
    oscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* 已停止 */
      }
    });
    gain.disconnect();
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  return stop;
}
