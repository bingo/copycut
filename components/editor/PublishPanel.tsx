"use client";

import { useState } from "react";
import { getTextTemplate } from "@/lib/data/text-templates";
import type { PublishInfo } from "@/lib/types";
import PublishPrecheck from "./PublishPrecheck";
import type { EditorState } from "./useEditorState";

const TITLE_LIMIT = 20;
const BODY_LIMIT = 1000;

/**
 * F-22 发布准备面板:标题/正文/话题草稿 + 封面安全区示意 +
 * 版权/水印风险提示。F-63 发布预检(违禁词/格式校验/发布时间建议)
 * 见 PublishPrecheck。小红书账号授权与一键发布在后续版本接入。
 */
export default function PublishPanel({
  editor,
  onClose,
}: {
  editor: EditorState;
  onClose: () => void;
}) {
  const { draft, apply } = editor;
  const [info, setInfo] = useState<PublishInfo>(
    draft?.publish ?? { title: "", body: "", topics: [] }
  );
  const [topicInput, setTopicInput] = useState("");

  if (!draft) return null;

  const coverTemplate = getTextTemplate(draft.cover?.templateId);

  function addTopic() {
    const topic = topicInput.trim().replace(/^#/, "");
    if (!topic || info.topics.includes(topic)) return;
    setInfo({ ...info, topics: [...info.topics, topic] });
    setTopicInput("");
  }

  function save() {
    apply({ publish: info }, { undoable: false });
    onClose();
  }

  const warnings = [
    draft.music && "使用的曲库音乐为 CC0 公有领域授权,可免版权商用",
    "如素材来自其他平台,注意画面水印可能触发小红书限流",
    "发布为草稿整理流程,小红书账号授权与一键发布在后续版本接入",
  ].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h2 className="text-base font-semibold text-zinc-100">发布准备</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          {/* 封面 + 安全区示意 */}
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-400">封面(含安全区示意)</p>
            <div className="relative mx-auto aspect-[3/4] w-40 overflow-hidden rounded-lg bg-black">
              {draft.cover?.frameThumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.cover.frameThumbnail}
                  alt="封面"
                  className="h-full w-full object-cover"
                />
              ) : (
                <p className="flex h-full items-center justify-center px-3 text-center text-[11px] text-zinc-600">
                  尚未制作封面
                </p>
              )}
              {draft.cover?.text && (
                <span
                  className="absolute left-1/2 top-1/2 max-w-[90%] -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap rounded px-1.5 py-0.5 text-center text-xs leading-snug"
                  style={{
                    color: coverTemplate?.style.color ?? "#fff",
                    background: coverTemplate?.style.background,
                    fontWeight: coverTemplate?.style.fontWeight ?? "bold",
                  }}
                >
                  {draft.cover.text}
                </span>
              )}
              {/* 安全区:信息流双列卡片裁切区示意 */}
              <div className="pointer-events-none absolute inset-x-[8%] inset-y-[12%] rounded border border-dashed border-emerald-400/70" />
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/70 px-1 text-[9px] text-emerald-400">
                安全区内避免关键信息被裁切
              </span>
            </div>
          </div>

          {/* 标题 */}
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-zinc-400">标题</span>
              <span className={info.title.length > TITLE_LIMIT ? "text-red-400" : "text-zinc-600"}>
                {info.title.length}/{TITLE_LIMIT}
              </span>
            </div>
            <input
              value={info.title}
              onChange={(e) => setInfo({ ...info, title: e.target.value })}
              placeholder="填写吸引人的标题"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#ff2442]"
            />
          </div>

          {/* 正文 */}
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-zinc-400">正文</span>
              <span className={info.body.length > BODY_LIMIT ? "text-red-400" : "text-zinc-600"}>
                {info.body.length}/{BODY_LIMIT}
              </span>
            </div>
            <textarea
              value={info.body}
              onChange={(e) => setInfo({ ...info, body: e.target.value })}
              placeholder="分享你的创作心得…"
              rows={5}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#ff2442]"
            />
          </div>

          {/* 话题 */}
          <div>
            <p className="mb-1 text-xs font-medium text-zinc-400">话题</p>
            <div className="flex gap-2">
              <input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTopic()}
                placeholder="输入话题后回车"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#ff2442]"
              />
              <button
                type="button"
                onClick={addTopic}
                className="rounded-lg border border-zinc-700 px-3 text-sm text-zinc-400 hover:border-zinc-500"
              >
                添加
              </button>
            </div>
            {info.topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {info.topics.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 rounded-full bg-[#ff2442]/10 px-2.5 py-1 text-xs text-[#ff2442]"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() =>
                        setInfo({ ...info, topics: info.topics.filter((x) => x !== t) })
                      }
                      className="hover:opacity-70"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* F-63 发布预检:违禁词 + 格式校验 + 发布时间建议 */}
          <PublishPrecheck info={info} />

          {/* 风险提示 */}
          <div className="flex flex-col gap-2">
            {warnings.map((w) => (
              <p
                key={w}
                className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-4 text-amber-500"
              >
                ⚠ {w}
              </p>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-800 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800">
            取消
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-[#ff2442] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            保存发布草稿
          </button>
        </div>
      </div>
    </div>
  );
}
