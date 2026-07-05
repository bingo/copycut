/**
 * 背景音乐库:CC0 / 公有领域曲目(源自 FreePD 曲库镜像),
 * 文件打包在 public/music/,试听用 <audio>,导出走 decodeAudioData 混音。
 */
export interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  /** 秒(真实文件时长) */
  duration: number;
  category: string;
  /** 氛围标签(F-64:按内容气质选歌,与曲风分类正交) */
  mood: MusicMood;
  /** 站内音频路径 */
  url: string;
}

export const MUSIC_CATEGORIES = ["轻快", "治愈", "节奏", "氛围", "爵士复古"] as const;

/** 氛围维度(F-64:小红书生活感场景,按笔记气质筛选配乐) */
export const MUSIC_MOODS = ["慵懒午后", "治愈", "城市漫步", "氛围感", "轻快日常"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

const CC0 = "CC0 公有领域";

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "m-ukulele", name: "Happy Whistling Ukulele", artist: CC0, duration: 123, category: "轻快", mood: "轻快日常", url: "/music/happy-whistling-ukulele.m4a" },
  { id: "m-sunshine", name: "City Sunshine", artist: CC0, duration: 185, category: "轻快", mood: "城市漫步", url: "/music/city-sunshine.m4a" },
  { id: "m-pickled", name: "Pickled Pink", artist: CC0, duration: 175, category: "轻快", mood: "轻快日常", url: "/music/pickled-pink.m4a" },
  { id: "m-piano", name: "Lovely Piano Song", artist: CC0, duration: 96, category: "治愈", mood: "治愈", url: "/music/lovely-piano-song.m4a" },
  { id: "m-study", name: "Study and Relax", artist: CC0, duration: 223, category: "治愈", mood: "慵懒午后", url: "/music/study-and-relax.m4a" },
  { id: "m-river", name: "River Meditation", artist: CC0, duration: 167, category: "治愈", mood: "治愈", url: "/music/river-meditation.m4a" },
  { id: "m-funk", name: "Funkeriffic", artist: CC0, duration: 210, category: "节奏", mood: "城市漫步", url: "/music/funkeriffic.m4a" },
  { id: "m-backbeat", name: "Backbeat", artist: CC0, duration: 46, category: "节奏", mood: "轻快日常", url: "/music/backbeat.m4a" },
  { id: "m-peace", name: "Infinite Peace", artist: CC0, duration: 76, category: "氛围", mood: "氛围感", url: "/music/infinite-peace.m4a" },
  { id: "m-bongos", name: "Ambient Bongos", artist: CC0, duration: 88, category: "氛围", mood: "氛围感", url: "/music/ambient-bongos.m4a" },
  { id: "m-jazz", name: "Bass Meant Jazz", artist: CC0, duration: 280, category: "爵士复古", mood: "慵懒午后", url: "/music/bass-meant-jazz.m4a" },
  { id: "m-ballet", name: "Barroom Ballet", artist: CC0, duration: 56, category: "爵士复古", mood: "慵懒午后", url: "/music/barroom-ballet.m4a" },
];

export function getTrack(id: string | undefined): MusicTrack | undefined {
  return MUSIC_TRACKS.find((t) => t.id === id);
}
