export type AspectRatio = "9:16" | "1:1" | "16:9";

export const ASPECT_RATIOS: { value: AspectRatio; label: string; hint: string }[] = [
  { value: "9:16", label: "9:16 竖屏", hint: "小红书视频推荐" },
  { value: "1:1", label: "1:1 方形", hint: "图文封面常用" },
  { value: "16:9", label: "16:9 横屏", hint: "横版视频" },
];

/** 时间轴片段。Step 2 仅保存元数据，Step 3 关联真实媒体。 */
export interface Clip {
  id: string;
  name: string;
  /** 入点，秒 */
  start: number;
  /** 出点，秒 */
  end: number;
}

export interface Draft {
  id: string;
  title: string;
  aspectRatio: AspectRatio;
  clips: Clip[];
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  username: string;
  loginAt: number;
}
