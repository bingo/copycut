export type AspectRatio = "9:16" | "1:1" | "16:9";

export const ASPECT_RATIOS: { value: AspectRatio; label: string; hint: string }[] = [
  { value: "9:16", label: "9:16 竖屏", hint: "小红书视频推荐" },
  { value: "1:1", label: "1:1 方形", hint: "图文封面常用" },
  { value: "16:9", label: "16:9 横屏", hint: "横版视频" },
];

/** 项目模式:视频剪辑 / 图文轮播 */
export type ProjectMode = "video" | "gallery";

export const PROJECT_MODES: { value: ProjectMode; label: string; hint: string }[] = [
  { value: "video", label: "视频剪辑", hint: "导入视频/图片剪辑成片" },
  { value: "gallery", label: "图文轮播", hint: "多图排序 + 每图文字" },
];

/**
 * 素材。Step 3 起文件本体持久化在 OPFS,元数据存 IndexedDB,
 * `url` 为会话内从 OPFS 文件创建的 object URL。
 */
export interface MediaAsset {
  id: string;
  name: string;
  type: "video" | "image";
  /** 时长,秒;图片默认 3s */
  duration: number;
  /** 会话内 object URL(从 OPFS File 创建,不持久化) */
  url: string;
  /** 小尺寸缩略图 dataURL */
  thumbnail: string;
  /** 原始像素尺寸,导出分辨率适配用 */
  width: number;
  height: number;
}

/** 时间轴片段。Step 2 仅保存元数据,Step 3 关联真实媒体。 */
export interface Clip {
  id: string;
  name: string;
  /** 相对素材的入点,秒 */
  start: number;
  /** 相对素材的出点,秒 */
  end: number;
  /** 来源素材 id(素材本体不持久化) */
  assetId?: string;
  assetType: "video" | "image";
  /** 缩略图 dataURL,随草稿持久化用于 mock 展示 */
  thumbnail?: string;
  /** 片段之后的转场 id */
  transitionAfter?: string;
}

/** 基础调色 8 参数,取值 -50 ~ 50,0 为无调整 */
export interface ColorAdjust {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  sharpness: number;
}

export const DEFAULT_COLOR_ADJUST: ColorAdjust = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  sharpness: 0,
};

/** 画面文字叠层 */
export interface TextOverlay {
  id: string;
  content: string;
  /** 时间轴上的出现时间,秒;缺省(旧草稿)表示从 0 开始 */
  start?: number;
  /** 时间轴上的消失时间,秒;缺省(旧草稿)表示显示到片尾 */
  end?: number;
  /** 位置,画布百分比 0-100 */
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: "normal" | "bold";
  /** 字体预设 id(lib/data/fonts.ts),缺省为默认黑体 */
  fontFamily?: string;
  /** 来源模板 id */
  templateId?: string;
  /** 背景色,可为空 */
  background?: string;
  /** 文字框边框色,可为空 */
  borderColor?: string;
}

/** 背景音乐配置 */
export interface MusicConfig {
  trackId: string;
  /** 0-100 */
  volume: number;
  fadeIn: boolean;
  fadeOut: boolean;
}

/** 封面配置 */
export interface CoverConfig {
  /** 选取的帧对应时间轴时间,秒 */
  frameTime?: number;
  /** 封面帧缩略图 dataURL(界面展示用) */
  frameThumbnail?: string;
  text?: string;
  /** 封面文字模板 id */
  templateId?: string;
  /** 封面模板 id(lib/data/cover-templates.ts,小红书风格模板库) */
  coverTemplateId?: string;
  /** 模板应用后物化的分层标题(与画面文字同结构),可手动微调 */
  coverTexts?: TextOverlay[];
  /** 帧来源素材与素材内时间,导出时全分辨率重新抽帧 */
  assetId?: string;
  assetTime?: number;
}

/** 发布准备信息 */
export interface PublishInfo {
  title: string;
  body: string;
  topics: string[];
  /** 参与的活动/Event,选填 */
  event?: string;
}

/** 图文轮播模式的单张图片 */
/** 图文轮播单页文字样式;缺省(旧草稿)= 底部居中白字黑底 */
export interface CaptionStyle {
  /** 中心点,画布百分比 0-100 */
  x: number;
  y: number;
  /** 与 TextOverlay 同标尺:导出按 canvasHeight/1000 换算 px */
  fontSize: number;
  color: string;
  fontWeight: "normal" | "bold";
  /** 字体预设 id(lib/data/fonts.ts),缺省为默认黑体 */
  fontFamily?: string;
  /** 背景色;空串表示明确去掉背景(undefined 会在持久化后丢失、被缺省值顶回) */
  background?: string;
}

export interface GalleryImage {
  id: string;
  name: string;
  /** 缩略图 dataURL,随草稿持久化 */
  thumbnail: string;
  caption: string;
  /** 文字样式,缺省用 DEFAULT_CAPTION_STYLE(lib/engine/compose-image.ts) */
  captionStyle?: CaptionStyle;
  /** 全尺寸原图的素材 id(OPFS),导出与大图预览用 */
  assetId?: string;
}

export interface Draft {
  id: string;
  /** 归属用户,格式 "provider:username";多用户上线前的旧草稿没有此字段 */
  owner?: string;
  title: string;
  mode: ProjectMode;
  aspectRatio: AspectRatio;
  clips: Clip[];
  texts: TextOverlay[];
  /** 全局滤镜(Step 2 应用于整个预览) */
  filterId?: string;
  /** 滤镜强度 0-100 */
  filterStrength: number;
  colorAdjust: ColorAdjust;
  music?: MusicConfig;
  cover?: CoverConfig;
  publish?: PublishInfo;
  /** 图文轮播模式的图片序列 */
  gallery: GalleryImage[];
  /** 素材面板里的素材 id(文件在 OPFS),重开草稿时恢复 */
  assetIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type AuthProvider = "password" | "google" | "github" | "facebook";
export type OAuthProviderId = Exclude<AuthProvider, "password">;

export interface Session {
  username: string;
  loginAt: number;
  /** 服务端用户记录 id(lib/server/users.ts);旧会话/未建档时为空 */
  userId?: string;
  /** 登录方式;旧 localStorage 会话没有此字段,视为 password */
  provider?: AuthProvider;
  name?: string;
  email?: string;
  avatarUrl?: string;
}
