import { drawFitted } from "./compose-image";

/** 转场总时长(跨越片段边界前后各一半),秒 */
export const TRANSITION_DURATION = 0.5;

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** 转场一侧的画面:原始尺寸的帧,绘制时按 contain 适配画布 */
export interface TransitionSource {
  image: CanvasImageSource;
  width: number;
  height: number;
}

const smooth = (p: number) => p * p * (3 - 2 * p);
/** 峰值包络:窗口两端 0,片段边界处 1 */
const peak = (p: number) => 1 - Math.abs(p - 0.5) * 2;

/** 确定性伪随机:同一进度产生同样的抖动/切片,预览与导出一致且可复现 */
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Safari 旧版本 2D 上下文无 filter,模糊类转场退化为叠化 */
const FILTER_SUPPORTED = (() => {
  try {
    return "filter" in new OffscreenCanvas(1, 1).getContext("2d")!;
  } catch {
    return false;
  }
})();

let scratch: OffscreenCanvas | null = null;
function getScratch(w: number, h: number): [OffscreenCanvas, OffscreenCanvasRenderingContext2D] {
  if (!scratch) scratch = new OffscreenCanvas(w, h);
  if (scratch.width !== w) scratch.width = w;
  if (scratch.height !== h) scratch.height = h;
  return [scratch, scratch.getContext("2d")!];
}

let heartPath: Path2D | null = null;
function getHeartPath(): Path2D {
  if (!heartPath)
    heartPath = new Path2D(
      "M 0 -0.25 C 0.22 -0.55 0.68 -0.38 0.52 0.02 C 0.42 0.28 0.16 0.42 0 0.62 C -0.16 0.42 -0.42 0.28 -0.52 0.02 C -0.68 -0.38 -0.22 -0.55 0 -0.25 Z"
    );
  return heartPath;
}

/** 黑底 + contain 铺满画布 */
function blitFrame(ctx: Ctx2D, src: TransitionSource, w: number, h: number): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  drawFitted(ctx, src.image, src.width, src.height, w, h, "contain");
}

interface Xform {
  dx?: number;
  dy?: number;
  scale?: number;
  rotate?: number;
}

/** 以画布中心为锚点做平移/缩放/旋转后绘制(不带黑底) */
function drawTransformed(ctx: Ctx2D, src: TransitionSource, w: number, h: number, t: Xform): void {
  ctx.save();
  ctx.translate(w / 2 + (t.dx ?? 0), h / 2 + (t.dy ?? 0));
  if (t.rotate) ctx.rotate(t.rotate);
  const s = t.scale ?? 1;
  ctx.scale(s, s);
  ctx.translate(-w / 2, -h / 2);
  drawFitted(ctx, src.image, src.width, src.height, w, h, "contain");
  ctx.restore();
}

function crossfade(
  ctx: Ctx2D,
  prev: TransitionSource,
  next: TransitionSource,
  w: number,
  h: number,
  p: number
): void {
  blitFrame(ctx, prev, w, h);
  ctx.globalAlpha = smooth(p);
  blitFrame(ctx, next, w, h);
  ctx.globalAlpha = 1;
}

/**
 * 绘制转场中的一帧,完整覆盖画布。progress ∈ [0,1] 横跨片段边界
 * (0.5 为边界时刻)。prev/next 可传静帧或实时画面,预览与导出共用。
 */
export function drawTransitionFrame(
  ctx: Ctx2D,
  type: string,
  progress: number,
  prev: TransitionSource,
  next: TransitionSource,
  w: number,
  h: number
): void {
  const p = Math.min(1, Math.max(0, progress));
  const e = smooth(p);
  const a = peak(p);
  /** 边界前后正在播放的一侧 */
  const front = p < 0.5 ? prev : next;

  switch (type) {
    case "fade":
      crossfade(ctx, prev, next, w, h, p);
      break;

    case "black":
    case "white":
      blitFrame(ctx, front, w, h);
      ctx.globalAlpha = a;
      ctx.fillStyle = type === "black" ? "#000" : "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      break;

    case "wipe-l":
    case "wipe-r":
    case "wipe-u": {
      blitFrame(ctx, prev, w, h);
      ctx.save();
      ctx.beginPath();
      if (type === "wipe-l") ctx.rect(0, 0, w * e, h);
      else if (type === "wipe-r") ctx.rect(w * (1 - e), 0, w * e, h);
      else ctx.rect(0, 0, w, h * e);
      ctx.clip();
      blitFrame(ctx, next, w, h);
      ctx.restore();
      break;
    }

    // —— 慢节奏(F-64:小红书审美,柔和不抢戏)——

    case "soft-fade": {
      // 柔和叠化:双重平滑让切换更"慢",边界处罩一层极淡暖白柔化对比
      blitFrame(ctx, prev, w, h);
      ctx.globalAlpha = smooth(e);
      blitFrame(ctx, next, w, h);
      ctx.globalAlpha = 0.12 * a;
      ctx.fillStyle = "#fff8ef";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      break;
    }

    case "mist": {
      // 雾化过渡:画面渐糊、奶白雾气自四周合拢,在雾里完成切换
      if (FILTER_SUPPORTED) ctx.filter = `blur(${(a * w * 0.015).toFixed(1)}px)`;
      blitFrame(ctx, prev, w, h);
      ctx.globalAlpha = e;
      blitFrame(ctx, next, w, h);
      ctx.globalAlpha = 1;
      if (FILTER_SUPPORTED) ctx.filter = "none";
      const fog = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.1,
        w / 2, h / 2, Math.max(w, h) * 0.8
      );
      fog.addColorStop(0, `rgba(248,244,236,${0.5 * a})`);
      fog.addColorStop(1, `rgba(248,244,236,${0.85 * a})`);
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case "breath": {
      // 呼吸感缩放:旧画面轻轻"吸气"放大淡出,新画面从微放大缓缓"呼气"落回原位
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      drawTransformed(ctx, prev, w, h, { scale: 1 + 0.08 * e });
      ctx.globalAlpha = smooth(e);
      drawTransformed(ctx, next, w, h, { scale: 1.08 - 0.08 * e });
      ctx.globalAlpha = 1;
      break;
    }

    case "blank-fade": {
      // 留白渐隐:画面先隐入米白留白,在留白处停一拍,新画面再缓缓浮现
      blitFrame(ctx, front, w, h);
      ctx.globalAlpha = smooth(Math.min(1, a * 1.5));
      ctx.fillStyle = "#f7f3ea";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      break;
    }

    case "push-l":
    case "push-r": {
      const dir = type === "push-l" ? -1 : 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      drawTransformed(ctx, prev, w, h, { dx: dir * w * e });
      drawTransformed(ctx, next, w, h, { dx: -dir * w * (1 - e) });
      break;
    }

    case "zoom-in":
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      drawTransformed(ctx, prev, w, h, { scale: 1 + 1.4 * e });
      ctx.globalAlpha = e;
      ctx.fillRect(0, 0, w, h);
      drawTransformed(ctx, next, w, h, { scale: 2.4 - 1.4 * e });
      ctx.globalAlpha = 1;
      break;

    case "zoom-out":
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      drawTransformed(ctx, next, w, h, { scale: 0.4 + 0.6 * e });
      ctx.globalAlpha = 1 - e;
      drawTransformed(ctx, prev, w, h, { scale: 1 - 0.6 * e });
      ctx.globalAlpha = 1;
      break;

    case "spin": {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      const angle = p < 0.5 ? e * 0.9 : -(1 - e) * 0.9;
      drawTransformed(ctx, front, w, h, { rotate: angle, scale: 1 + 0.5 * a });
      break;
    }

    case "shake": {
      const step = Math.floor(p * 24);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      drawTransformed(ctx, front, w, h, {
        // 轻微放大避免抖动露出画布边缘
        scale: 1.08,
        dx: (rand(step) * 2 - 1) * a * w * 0.04,
        dy: (rand(step + 100) * 2 - 1) * a * h * 0.03,
      });
      break;
    }

    case "blur":
      if (!FILTER_SUPPORTED) {
        crossfade(ctx, prev, next, w, h, p);
        break;
      }
      ctx.filter = `blur(${(a * w * 0.02).toFixed(1)}px)`;
      blitFrame(ctx, prev, w, h);
      ctx.globalAlpha = e;
      blitFrame(ctx, next, w, h);
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      break;

    case "motion-blur": {
      blitFrame(ctx, front, w, h);
      const dir = p < 0.5 ? -1 : 1;
      for (let k = 1; k <= 4; k++) {
        ctx.globalAlpha = 0.16 * a;
        drawTransformed(ctx, front, w, h, { dx: dir * k * a * w * 0.035, scale: 1.02 });
      }
      ctx.globalAlpha = 1;
      break;
    }

    case "radial-blur": {
      blitFrame(ctx, front, w, h);
      for (let k = 1; k <= 4; k++) {
        ctx.globalAlpha = 0.15 * a;
        drawTransformed(ctx, front, w, h, { scale: 1 + k * 0.05 * a });
      }
      ctx.globalAlpha = 1;
      break;
    }

    case "flash":
      crossfade(ctx, prev, next, w, h, p);
      ctx.globalAlpha = Math.pow(a, 0.6);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      break;

    case "leak": {
      crossfade(ctx, prev, next, w, h, p);
      // 暖色光带自左向右扫过
      const cx = (e * 1.6 - 0.3) * w;
      const glowA = Math.sin(p * Math.PI);
      const grad = ctx.createLinearGradient(cx - w * 0.45, 0, cx + w * 0.45, 0);
      grad.addColorStop(0, "rgba(255,96,32,0)");
      grad.addColorStop(0.5, `rgba(255,140,50,${0.85 * glowA})`);
      grad.addColorStop(0.75, `rgba(255,220,130,${0.7 * glowA})`);
      grad.addColorStop(1, "rgba(255,96,32,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      break;
    }

    case "glow": {
      crossfade(ctx, prev, next, w, h, p);
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      grad.addColorStop(0, `rgba(255,245,220,${0.9 * a})`);
      grad.addColorStop(1, "rgba(255,245,220,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      break;
    }

    case "glitch": {
      const [sc, sctx] = getScratch(w, h);
      blitFrame(sctx, front, w, h);
      ctx.drawImage(sc, 0, 0);
      // 色散重影
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.25 * a;
      ctx.drawImage(sc, a * w * 0.012, 0);
      ctx.drawImage(sc, -a * w * 0.012, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
      // 横向错位切片(按进度量化步进,同一帧序抖动一致)
      const step = Math.floor(p * 20);
      const slices = 12;
      for (let i = 0; i < slices; i++) {
        if (rand(i * 7.3 + step * 13.7) < 0.5) continue;
        const sy = Math.floor((i / slices) * h);
        const sh = Math.ceil(h / slices);
        const dx = (rand(i * 3.1 + step * 17.9) * 2 - 1) * a * w * 0.12;
        ctx.drawImage(sc, 0, sy, w, sh, dx, sy, w, sh);
      }
      break;
    }

    case "mosaic": {
      // 像素化:先缩小再关闭平滑放大,格子尺寸随包络增大
      const cell = 1 + a * 40;
      const sw = Math.max(2, Math.round(w / cell));
      const sh = Math.max(2, Math.round(h / cell));
      const [sc, sctx] = getScratch(sw, sh);
      blitFrame(sctx, front, sw, sh);
      const smoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sc, 0, 0, sw, sh, 0, 0, w, h);
      ctx.imageSmoothingEnabled = smoothing;
      break;
    }

    case "heart": {
      blitFrame(ctx, prev, w, h);
      // 心形从中心放大揭示下一片段(路径为单位坐标,放大到盖满对角线)
      const s = Math.max(e * Math.hypot(w, h) * 1.2, 0.001);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(s, s);
      ctx.clip(getHeartPath());
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      blitFrame(ctx, next, w, h);
      ctx.restore();
      break;
    }

    case "page": {
      blitFrame(ctx, next, w, h);
      // 旧画面向左折叠压缩,折叠面随进度变暗,折缘留一道高光
      ctx.save();
      ctx.scale(1 - e, 1);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      drawFitted(ctx, prev.image, prev.width, prev.height, w, h, "contain");
      ctx.restore();
      ctx.fillStyle = `rgba(0,0,0,${0.6 * e})`;
      ctx.fillRect(0, 0, w * (1 - e), h);
      ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`;
      ctx.fillRect(Math.max(0, w * (1 - e) - 2), 0, 3, h);
      break;
    }

    default:
      crossfade(ctx, prev, next, w, h, p);
  }
}
