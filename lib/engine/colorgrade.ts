import type { FilterPreset } from "../data/filters";
import type { ColorAdjust } from "../types";

/**
 * 导出渲染用的调色参数(滤镜 × 强度 + 基础调色合并后的等效值)。
 * 数学与 CSS filter 规范一致,保证预览(CSS)与导出(WebGL)观感一致;
 * 与 lib/color.ts 的 CSS 近似映射同源。
 */
export interface GradeParams {
  brightness: number;
  contrast: number;
  saturate: number;
  sepia: number;
  grayscale: number;
  /** 度数 */
  hueRotate: number;
}

export const IDENTITY_GRADE: GradeParams = {
  brightness: 1,
  contrast: 1,
  saturate: 1,
  sepia: 0,
  grayscale: 0,
  hueRotate: 0,
};

/** 合并滤镜(按强度插值)与基础调色为单组参数 */
export function computeGrade(
  filter: FilterPreset | undefined,
  strength: number,
  adjust: ColorAdjust
): GradeParams {
  const s = Math.max(0, Math.min(100, strength)) / 100;
  const lerp = (v: number | undefined, identity: number) =>
    v === undefined ? identity : identity + (v - identity) * s;

  const p = filter?.params ?? {};
  const grade: GradeParams = {
    brightness: lerp(p.brightness, 1),
    contrast: lerp(p.contrast, 1),
    saturate: lerp(p.saturate, 1),
    sepia: lerp(p.sepia, 0),
    grayscale: lerp(p.grayscale, 0),
    hueRotate: lerp(p.hueRotate, 0),
  };

  // 基础调色折算(与 lib/color.ts 的 CSS 映射一致;brightness/contrast 可乘法合并)
  const { brightness, contrast, saturation, temperature, tint, highlights, shadows, sharpness } =
    adjust;
  grade.brightness *= (1 + brightness / 100) * (1 + highlights / 300) * (1 + shadows / 400);
  grade.contrast *= (1 + contrast / 100) * (1 - shadows / 250);
  if (sharpness > 0) grade.contrast *= 1 + sharpness / 400;
  grade.saturate *= 1 + saturation / 100;
  if (temperature > 0) grade.sepia = Math.min(1, grade.sepia + temperature / 150);
  if (temperature < 0) grade.hueRotate += temperature * 0.4;
  grade.hueRotate += tint * 0.5;
  return grade;
}

export function isIdentityGrade(g: GradeParams): boolean {
  return (
    g.brightness === 1 &&
    g.contrast === 1 &&
    g.saturate === 1 &&
    g.sepia === 0 &&
    g.grayscale === 0 &&
    g.hueRotate === 0
  );
}

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// 各操作与 CSS Filter Effects 规范的色彩矩阵一致,顺序:
// brightness → contrast → saturate → sepia → grayscale → hue-rotate
const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturate;
uniform float u_sepia;
uniform float u_grayscale;
uniform float u_hueCos;
uniform float u_hueSin;

void main() {
  vec4 c = texture2D(u_tex, v_uv);
  vec3 rgb = c.rgb * u_brightness;
  rgb = (rgb - 0.5) * u_contrast + 0.5;

  float lum = dot(rgb, vec3(0.213, 0.715, 0.072));
  rgb = mix(vec3(lum), rgb, u_saturate);

  vec3 sep = vec3(
    dot(rgb, vec3(0.393, 0.769, 0.189)),
    dot(rgb, vec3(0.349, 0.686, 0.168)),
    dot(rgb, vec3(0.272, 0.534, 0.131))
  );
  rgb = mix(rgb, sep, u_sepia);

  float gray = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(rgb, vec3(gray), u_grayscale);

  float cs = u_hueCos;
  float sn = u_hueSin;
  mat3 hue = mat3(
    0.213 + cs * 0.787 - sn * 0.213, 0.213 - cs * 0.213 + sn * 0.143, 0.213 - cs * 0.213 - sn * 0.787,
    0.715 - cs * 0.715 - sn * 0.715, 0.715 + cs * 0.285 + sn * 0.140, 0.715 - cs * 0.715 + sn * 0.715,
    0.072 - cs * 0.072 + sn * 0.928, 0.072 - cs * 0.072 - sn * 0.283, 0.072 + cs * 0.928 + sn * 0.072
  );
  rgb = hue * rgb;

  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}`;

/**
 * WebGL 单 pass 调色器。输入任意 TexImageSource(通常是合成后的 canvas),
 * 输出到内部 OffscreenCanvas。跨浏览器一致(Safari 无 ctx.filter 的替代方案)。
 */
export class ColorGrader {
  readonly canvas: OffscreenCanvas;
  private gl: WebGLRenderingContext;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor(width: number, height: number) {
    this.canvas = new OffscreenCanvas(width, height);
    const gl = this.canvas.getContext("webgl", {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    }) as WebGLRenderingContext | null;
    if (!gl) throw new Error("WebGL 不可用,无法进行调色渲染");
    this.gl = gl;

    const program = gl.createProgram()!;
    for (const [type, src] of [
      [gl.VERTEX_SHADER, VERT],
      [gl.FRAGMENT_SHADER, FRAG],
    ] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`调色着色器编译失败: ${gl.getShaderInfoLog(shader)}`);
      }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`调色着色器链接失败: ${gl.getProgramInfoLog(program)}`);
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    for (const name of [
      "u_brightness",
      "u_contrast",
      "u_saturate",
      "u_sepia",
      "u_grayscale",
      "u_hueCos",
      "u_hueSin",
    ]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
  }

  /** 将 source 应用调色后绘制到内部 canvas 并返回 */
  apply(source: TexImageSource, grade: GradeParams): OffscreenCanvas {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1f(this.uniforms.u_brightness, grade.brightness);
    gl.uniform1f(this.uniforms.u_contrast, grade.contrast);
    gl.uniform1f(this.uniforms.u_saturate, grade.saturate);
    gl.uniform1f(this.uniforms.u_sepia, grade.sepia);
    gl.uniform1f(this.uniforms.u_grayscale, grade.grayscale);
    const rad = (grade.hueRotate * Math.PI) / 180;
    gl.uniform1f(this.uniforms.u_hueCos, Math.cos(rad));
    gl.uniform1f(this.uniforms.u_hueSin, Math.sin(rad));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }

  dispose(): void {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
