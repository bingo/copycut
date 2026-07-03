import { getTrack } from "../data/music";
import { assetService } from "../services/assets";
import type { Clip, MusicConfig } from "../types";

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
/** BGM 淡入/淡出时长,秒 */
const FADE_DURATION = 1.5;

/**
 * 按时间轴离线混音:各视频片段原声(按入/出点截取、按时间偏移放置)
 * + BGM(音量/淡入淡出,循环铺满全片)。返回可直接送编码器的 AudioBuffer。
 */
export async function mixTimelineAudio(options: {
  clips: Clip[];
  music: MusicConfig | undefined;
  totalDuration: number;
}): Promise<AudioBuffer> {
  const { clips, music, totalDuration } = options;
  const ctx = new OfflineAudioContext(
    CHANNELS,
    Math.max(1, Math.ceil(totalDuration * SAMPLE_RATE)),
    SAMPLE_RATE
  );

  // 解码用临时 AudioContext 不可用于 Offline 调度以外,decodeAudioData 挂在 offline ctx 即可
  const decodeCache = new Map<string, Promise<AudioBuffer | null>>();
  const decodeAsset = (assetId: string): Promise<AudioBuffer | null> => {
    let cached = decodeCache.get(assetId);
    if (!cached) {
      cached = (async () => {
        const file = await assetService.getFile(assetId);
        if (!file) return null;
        try {
          return await ctx.decodeAudioData(await file.arrayBuffer());
        } catch {
          return null; // 无音轨/不支持的编码:静音处理
        }
      })();
      decodeCache.set(assetId, cached);
    }
    return cached;
  };

  // 片段原声
  let offset = 0;
  for (const clip of clips) {
    const clipDuration = clip.end - clip.start;
    if (clip.assetType === "video" && clip.assetId) {
      const buffer = await decodeAsset(clip.assetId);
      if (buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(offset, clip.start, clipDuration);
      }
    }
    offset += clipDuration;
  }

  // BGM
  const track = getTrack(music?.trackId);
  if (music && track) {
    try {
      const resp = await fetch(track.url);
      const bgmBuffer = await ctx.decodeAudioData(await resp.arrayBuffer());
      const source = ctx.createBufferSource();
      source.buffer = bgmBuffer;
      source.loop = true;
      const gain = ctx.createGain();
      const volume = music.volume / 100;
      if (music.fadeIn) {
        gain.gain.setValueAtTime(0, 0);
        gain.gain.linearRampToValueAtTime(volume, Math.min(FADE_DURATION, totalDuration));
      } else {
        gain.gain.setValueAtTime(volume, 0);
      }
      if (music.fadeOut && totalDuration > FADE_DURATION) {
        gain.gain.setValueAtTime(volume, totalDuration - FADE_DURATION);
        gain.gain.linearRampToValueAtTime(0, totalDuration);
      }
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
      source.stop(totalDuration);
    } catch {
      // BGM 加载失败不阻塞导出
    }
  }

  return ctx.startRendering();
}
