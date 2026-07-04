"use client";

import { getTransition } from "@/lib/data/transitions";
import type { EditorState } from "./useEditorState";

/** 右侧属性面板:按选中对象(片段/文字)展示可编辑属性 */
export default function PropertiesPanel({ editor }: { editor: EditorState }) {
  const { draft, clips, selection, apply, deleteClip, setSelection, totalDuration } = editor;
  if (!draft) return null;

  const selectedClip =
    selection?.type === "clip" ? clips.find((c) => c.id === selection.id) : undefined;
  const selectedText =
    selection?.type === "text" ? draft.texts.find((t) => t.id === selection.id) : undefined;

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
            <Field label="颜色">
              <input
                type="color"
                value={selectedText.color}
                onChange={(e) =>
                  apply({
                    texts: draft.texts.map((t) =>
                      t.id === selectedText.id ? { ...t, color: e.target.value } : t
                    ),
                  })
                }
                className="h-8 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent"
              />
            </Field>
            <label className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={selectedText.fontWeight === "bold"}
                onChange={(e) =>
                  apply({
                    texts: draft.texts.map((t) =>
                      t.id === selectedText.id
                        ? { ...t, fontWeight: e.target.checked ? "bold" : "normal" }
                        : t
                    ),
                  })
                }
                className="accent-[#ff2442]"
              />
              加粗
            </label>
          </div>
          <button
            type="button"
            onClick={() => {
              apply({ texts: draft.texts.filter((t) => t.id !== selectedText.id) });
              setSelection(null);
            }}
            className="mt-2 rounded-lg border border-red-900 py-1.5 text-xs text-red-400 hover:bg-red-950/40"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      {children}
    </div>
  );
}
