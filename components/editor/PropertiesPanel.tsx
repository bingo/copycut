"use client";

import { useState } from "react";
import { getTransition } from "@/lib/data/transitions";
import { textStyleService } from "@/lib/services/user-templates";
import type { TextOverlay } from "@/lib/types";
import { Field, FontSelect, OptionalColorField } from "./fields";
import type { EditorState } from "./useEditorState";

/** 右侧属性面板:按选中对象(片段/文字)展示可编辑属性 */
export default function PropertiesPanel({ editor }: { editor: EditorState }) {
  const {
    draft,
    clips,
    selection,
    apply,
    deleteClip,
    setSelection,
    totalDuration,
    alignSelectedText,
    reorderSelectedText,
  } = editor;
  /** T1 存为我的样式:内联命名输入 */
  const [namingStyle, setNamingStyle] = useState(false);
  const [styleName, setStyleName] = useState("");
  const [styleSaved, setStyleSaved] = useState(false);
  if (!draft) return null;

  const selectedClip =
    selection?.type === "clip" ? clips.find((c) => c.id === selection.id) : undefined;
  const selectedText =
    selection?.type === "text" ? draft.texts.find((t) => t.id === selection.id) : undefined;

  function updateText(patch: Partial<TextOverlay>) {
    if (!draft || !selectedText) return;
    apply({
      texts: draft.texts.map((t) => (t.id === selectedText.id ? { ...t, ...patch } : t)),
    });
  }

  /** T1 把当前文字的样式(不含内容/位置/时间)存入个人样式库 */
  function saveTextStyle() {
    const name = styleName.trim();
    if (!name || !selectedText) return;
    textStyleService.save(name, {
      fontSize: selectedText.fontSize,
      color: selectedText.color,
      fontWeight: selectedText.fontWeight,
      fontFamily: selectedText.fontFamily,
      background: selectedText.background,
      borderColor: selectedText.borderColor,
    });
    setNamingStyle(false);
    setStyleName("");
    setStyleSaved(true);
    setTimeout(() => setStyleSaved(false), 2000);
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-zinc-800">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-medium">属性</div>

      {selectedClip && (
        <div className="flex flex-col gap-3 overflow-y-auto p-4 text-sm">
          <Field label="片段">
            <p className="truncate text-zinc-200">{selectedClip.name}</p>
          </Field>
          <Field label="类型">
            <p className="text-zinc-400">{selectedClip.assetType === "video" ? "视频" : "图片"}</p>
          </Field>
          <Field label="时长">
            <p className="text-zinc-400">
              {(selectedClip.end - selectedClip.start).toFixed(1)}s(入点 {selectedClip.start.toFixed(1)}s /
              出点 {selectedClip.end.toFixed(1)}s)
            </p>
          </Field>
          <Field label="转场">
            <p className="text-zinc-400">
              {getTransition(selectedClip.transitionAfter)?.name ?? "无(在转场面板添加)"}
            </p>
          </Field>
          <button
            type="button"
            onClick={() => deleteClip(selectedClip.id)}
            className="mt-2 rounded-lg border border-red-900 py-1.5 text-xs text-red-400 hover:bg-red-950/40"
          >
            删除片段
          </button>
        </div>
      )}

      {selectedText && (
        <div className="flex flex-col gap-3 overflow-y-auto p-4 text-sm">
          <Field label="时间">
            <p className="text-zinc-400">
              {(selectedText.start ?? 0).toFixed(1)}s ~{" "}
              {(selectedText.end ?? totalDuration).toFixed(1)}s(在时间轴文字轨拖动调整)
            </p>
          </Field>

          {/* T3 对齐:一键对齐到画布参考位置(方向键可微调,拖拽时自动吸附) */}
          <Field label="对齐画布">
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1">
                {(
                  [
                    ["左", "x", 10],
                    ["水平居中", "x", 50],
                    ["右", "x", 90],
                  ] as const
                ).map(([label, axis, value]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => alignSelectedText(axis, value)}
                    className="flex-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-zinc-500"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(
                  [
                    ["上", "y", 10],
                    ["垂直居中", "y", 50],
                    ["下", "y", 90],
                  ] as const
                ).map(([label, axis, value]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => alignSelectedText(axis, value)}
                    className="flex-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-zinc-500"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          {/* T3 图层顺序:texts 数组末尾为顶层,渲染顺序即叠放顺序 */}
          <Field label="图层顺序">
            <div className="flex gap-1">
              {(
                [
                  ["置顶", "front"],
                  ["上移", "forward"],
                  ["下移", "backward"],
                  ["置底", "back"],
                ] as const
              ).map(([label, dir]) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => reorderSelectedText(dir)}
                  className="flex-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-zinc-500"
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="内容">
            <textarea
              value={selectedText.content}
              onChange={(e) =>
                apply({
                  texts: draft.texts.map((t) =>
                    t.id === selectedText.id ? { ...t, content: e.target.value } : t
                  ),
                })
              }
              rows={2}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm outline-none focus:border-[#ff2442]"
            />
          </Field>
          <Field label="字体">
            <FontSelect
              value={selectedText.fontFamily}
              onChange={(id) => updateText({ fontFamily: id })}
            />
          </Field>
          <Field label={`字号 ${selectedText.fontSize}`}>
            <input
              type="range"
              min={12}
              max={72}
              value={selectedText.fontSize}
              onChange={(e) =>
                apply(
                  {
                    texts: draft.texts.map((t) =>
                      t.id === selectedText.id ? { ...t, fontSize: Number(e.target.value) } : t
                    ),
                  },
                  { undoable: false }
                )
              }
              className="w-full accent-[#ff2442]"
            />
          </Field>
          <div className="flex items-center gap-4">
            <Field label="文字色">
              <input
                type="color"
                value={selectedText.color}
                onChange={(e) => updateText({ color: e.target.value })}
                className="h-8 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent"
              />
            </Field>
            <label className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={selectedText.fontWeight === "bold"}
                onChange={(e) => updateText({ fontWeight: e.target.checked ? "bold" : "normal" })}
                className="accent-[#ff2442]"
              />
              加粗
            </label>
          </div>
          <div className="flex items-center gap-4">
            <OptionalColorField
              label="背景色"
              value={selectedText.background}
              fallback="#111111"
              onChange={(v) => updateText({ background: v })}
            />
            <OptionalColorField
              label="边框色"
              value={selectedText.borderColor}
              fallback="#ffffff"
              onChange={(v) => updateText({ borderColor: v })}
            />
          </div>
          {/* T1 样式沉淀:存入个人样式库,文字面板「我的」分类里跨草稿复用 */}
          {namingStyle ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTextStyle();
                  if (e.key === "Escape") setNamingStyle(false);
                }}
                placeholder="给这套样式起个名字"
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-[#ff2442]"
              />
              <button
                type="button"
                onClick={saveTextStyle}
                disabled={!styleName.trim()}
                className="rounded bg-[#ff2442] px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
              >
                保存
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNamingStyle(true);
                setStyleName("");
              }}
              className="mt-2 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
            >
              {styleSaved ? "✓ 已存入「我的」样式" : "存为我的样式"}
            </button>
          )}
          <button
            type="button"
            onClick={() => editor.duplicateSelected()}
            className="rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
            title="⌘/Ctrl+D"
          >
            复制一份
          </button>
          <button
            type="button"
            onClick={() => {
              apply({ texts: draft.texts.filter((t) => t.id !== selectedText.id) });
              setSelection(null);
            }}
            className="rounded-lg border border-red-900 py-1.5 text-xs text-red-400 hover:bg-red-950/40"
          >
            删除文字
          </button>
        </div>
      )}

      {!selectedClip && !selectedText && (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-sm text-zinc-600">
            选中时间轴片段或预览区文字
            <br />
            在此调整属性
          </p>
        </div>
      )}
    </aside>
  );
}
