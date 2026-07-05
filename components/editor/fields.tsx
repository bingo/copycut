"use client";

import { FONTS, getFont } from "@/lib/data/fonts";

/** 属性面板通用小组件:视频属性面板与图文轮播的文字设置共用 */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      {children}
    </div>
  );
}

/** 字体下拉:选项按各自字体渲染,值为字体预设 id */
export function FontSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={getFont(value).id}
      onChange={(e) => onChange(e.target.value)}
      className="w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm outline-none focus:border-[#ff2442]"
      style={{ fontFamily: getFont(value).css }}
    >
      {FONTS.map((f) => (
        <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>
          {f.name}
        </option>
      ))}
    </select>
  );
}

/** 可开关的颜色项:勾选启用后可调色,取消则清除该属性 */
export function OptionalColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value?: string;
  /** 首次勾选时的默认色;现值非 6 位 hex(如模板的 rgba)时也用它兜底显示 */
  fallback: string;
  onChange: (value: string | undefined) => void;
}) {
  const hex = value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked ? hex : undefined)}
          className="accent-[#ff2442]"
        />
        <input
          type="color"
          value={hex}
          disabled={!value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
    </Field>
  );
}
