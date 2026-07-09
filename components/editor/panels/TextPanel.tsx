"use client";

import { useEffect, useState } from "react";
import { getFont } from "@/lib/data/fonts";
import { TEXT_TEMPLATES, TEXT_TEMPLATE_CATEGORIES } from "@/lib/data/text-templates";
import { TEXT_GROUP_TEMPLATES } from "@/lib/data/text-group-templates";
import {
  textStyleService,
  type TextStyleSnapshot,
  type UserAsset,
} from "@/lib/services/user-templates";
import type { TextOverlay } from "@/lib/types";
import { CategoryTabs } from "./FilterPanel";
import type { EditorState } from "./../useEditorState";

/** T1 「我的」分类:属性面板沉淀的个人文字样式 */
const MY_CATEGORY = "我的";

/** F-15 文字添加 + F-16 文字模板库(F-64「小红书风」/ T1「我的」分类) */
export default function TextPanel({ editor }: { editor: EditorState }) {
  const { draft, apply, setSelection, playhead, totalDuration, addTextGroup } = editor;
  const [category, setCategory] = useState<string>(TEXT_TEMPLATE_CATEGORIES[0]);
  const [myStyles, setMyStyles] = useState<UserAsset<TextStyleSnapshot>[]>(() =>
    textStyleService.list()
  );

  // 属性面板「存为我的样式」后同步刷新
  useEffect(
    () => textStyleService.subscribe(() => setMyStyles(textStyleService.list())),
    []
  );

  if (!draft) return null;

  function addText(partial?: Partial<TextOverlay>) {
    if (!draft) return;
    // 从播放头处出现,默认 3s;贴近片尾时向前让出最小显示时长
    const start =
      totalDuration > 0 ? Math.min(playhead, Math.max(totalDuration - 0.5, 0)) : 0;
    const end = totalDuration > 0 ? Math.min(start + 3, totalDuration) : start + 3;
    const overlay: TextOverlay = {
      id: crypto.randomUUID(),
      content: "点击输入文字",
      start,
      end,
      x: 50,
      y: 50,
      fontSize: 28,
      color: "#ffffff",
      fontWeight: "normal",
      ...partial,
    };
    apply({ texts: [...draft.texts, overlay] });
    setSelection({ type: "text", id: overlay.id });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="p-3">
        <button
          type="button"
          onClick={() => addText()}
          className="w-full rounded-lg bg-[#ff2442] py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          + 添加文字
        </button>
        <p className="mt-2 text-[11px] text-zinc-600">
          添加后在预览区拖动调整位置,在右侧属性面板编辑样式,在时间轴文字轨调整出现时间
        </p>
      </div>

      {/* T2 文字组合模板:一键投放一组预排版图层(广告/种草/教程),各层可再微调 */}
      <div className="border-t border-zinc-800 px-3 pt-2 text-xs font-medium text-zinc-400">
        文字组合(广告 / 种草)
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-2">
        {TEXT_GROUP_TEMPLATES.map((g) => (
          <button
            key={g.id}
            type="button"
            title={g.hint}
            onClick={() => addTextGroup(g.layers)}
            className="flex flex-col items-start gap-0.5 rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-left hover:border-zinc-600"
          >
            <span className="text-xs font-medium text-zinc-200">{g.name}</span>
            <span className="truncate text-[10px] text-zinc-500">{g.hint}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-zinc-800 px-3 pt-2 text-xs font-medium text-zinc-400">
        单条文字模板
      </div>
      <CategoryTabs
        categories={[...TEXT_TEMPLATE_CATEGORIES, MY_CATEGORY]}
        active={category}
        onChange={setCategory}
      />
      {category === MY_CATEGORY ? (
        <div className="flex-1 overflow-y-auto p-3">
          {myStyles.length === 0 && (
            <p className="rounded-lg bg-zinc-800/60 px-3 py-2 text-xs leading-5 text-zinc-500">
              还没有个人样式。选中画面上的文字,在右侧属性面板调好样式后点「存为我的样式」,
              即可跨草稿复用。
            </p>
          )}
          {myStyles.map((s) => (
            <div
              key={s.id}
              className="mb-2 flex items-center gap-2 rounded-lg border border-zinc-800 p-2"
            >
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-xs leading-4"
                style={{
                  color: s.data.color,
                  background: s.data.background || undefined,
                  border: s.data.borderColor ? `1px solid ${s.data.borderColor}` : undefined,
                  fontWeight: s.data.fontWeight,
                  fontFamily: getFont(s.data.fontFamily).css,
                }}
              >
                Aa
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-300" title={s.name}>
                {s.name}
              </span>
              <button
                type="button"
                title="按此样式添加文字"
                onClick={() => addText({ ...s.data })}
                className="rounded bg-[#ff2442] px-2 py-1 text-xs text-white hover:opacity-90"
              >
                添加
              </button>
              <button
                type="button"
                title="删除此样式"
                onClick={() => textStyleService.remove(s.id)}
                className="text-xs text-zinc-600 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3">
        {TEXT_TEMPLATES.filter(
          (t) => t.scene === "画面" && (t.category ?? TEXT_TEMPLATE_CATEGORIES[0]) === category
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              addText({
                content: t.sample,
                color: t.style.color,
                background: t.style.background,
                borderColor: t.style.borderColor,
                fontWeight: t.style.fontWeight,
                fontSize: t.style.fontSize,
                fontFamily: t.style.fontFamily,
                stroke: t.style.stroke,
                shadow: t.style.shadow,
                letterSpacing: t.style.letterSpacing,
                opacity: t.style.opacity,
                templateId: t.id,
              })
            }
            className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 p-2 hover:border-zinc-600"
          >
            <span
              className="flex h-12 w-full items-center justify-center overflow-hidden rounded bg-zinc-800 px-1 text-center"
              style={{
                color: t.style.color,
                fontWeight: t.style.fontWeight,
                fontFamily: getFont(t.style.fontFamily).css,
              }}
            >
              <span
                className="rounded px-1.5 py-0.5 text-xs"
                style={{
                  background: t.style.background,
                  border: t.style.borderColor ? `1px solid ${t.style.borderColor}` : undefined,
                }}
              >
                {t.sample}
              </span>
            </span>
            <span className="text-[11px] text-zinc-500">{t.name}</span>
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
