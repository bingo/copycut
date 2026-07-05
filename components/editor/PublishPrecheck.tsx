"use client";

import { useMemo, type ReactNode } from "react";
import { BANNED_WORD_GROUPS, detectBannedWords } from "@/lib/data/banned-words";
import type { PublishInfo } from "@/lib/types";

const TITLE_LIMIT = 20;
const TITLE_NEAR_LIMIT = 18;
const BODY_LIMIT = 1000;
const BODY_NEAR_LIMIT = 900;
const TOPIC_MIN = 3;
const TOPIC_MAX = 8;

type CheckLevel = "pass" | "warn" | "risk";

interface CheckItem {
  id: string;
  label: string;
  level: CheckLevel;
  detail: string;
}

const LEVEL_META: Record<CheckLevel, { icon: string; text: string; className: string }> = {
  pass: { icon: "✓", text: "通过", className: "text-emerald-400" },
  warn: { icon: "⚠", text: "警告", className: "text-amber-500" },
  risk: { icon: "✕", text: "风险", className: "text-red-400" },
};

const OVERALL_META: Record<CheckLevel, { text: string; className: string }> = {
  pass: { text: "预检通过", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" },
  warn: { text: "建议调整后发布", className: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  risk: { text: "存在发布风险", className: "border-red-500/40 bg-red-500/10 text-red-400" },
};

/** 通用高流量时段(社区经验值,非官方数据) */
const PUBLISH_TIME_TIPS = [
  { label: "工作日午休", time: "12:00–14:00", desc: "午休刷手机高峰,适合轻内容" },
  { label: "工作日晚间", time: "18:00–22:00", desc: "下班后活跃度最高,互动量大" },
  { label: "周末上午", time: "09:00–12:00", desc: "周末起床后浏览,适合攻略/长内容" },
  { label: "周日晚间", time: "20:00–23:00", desc: "周一综合症前夜,收藏行为集中" },
];

function worstLevel(items: CheckItem[]): CheckLevel {
  if (items.some((i) => i.level === "risk")) return "risk";
  if (items.some((i) => i.level === "warn")) return "warn";
  return "pass";
}

/** 把文本里命中的风险词用高亮标出 */
function highlightHits(text: string, words: string[]): ReactNode {
  if (!text || words.length === 0) return text;
  // 长词优先,避免「全网最低价」只高亮出其中的「最低价」
  const pattern = [...words]
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "g"));
  return parts.map((part, i) =>
    words.includes(part) ? (
      <mark key={i} className="rounded-sm bg-red-500/30 px-0.5 text-red-300">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * F-63 发布预检工作台:违禁词预检(命中高亮 + 分类风险说明)、
 * 标题/正文/话题格式校验、发布时间建议,汇总为通过/警告/风险三级结果。
 * 全部本地词典检测,不调用外部 API,结果供人工复核。
 */
export default function PublishPrecheck({ info }: { info: PublishInfo }) {
  const hits = useMemo(
    () => detectBannedWords(`${info.title}\n${info.body}`),
    [info.title, info.body]
  );

  const checks = useMemo<CheckItem[]>(() => {
    const items: CheckItem[] = [];

    // 违禁词
    items.push(
      hits.length > 0
        ? {
            id: "banned",
            label: "违禁词预检",
            level: "risk",
            detail: `命中 ${hits.length} 个风险词,详见下方说明`,
          }
        : { id: "banned", label: "违禁词预检", level: "pass", detail: "未命中本地风险词词典" }
    );

    // 标题字数
    const titleLen = info.title.length;
    if (titleLen === 0) {
      items.push({ id: "title", label: "标题字数", level: "warn", detail: "尚未填写标题" });
    } else if (titleLen > TITLE_LIMIT) {
      items.push({
        id: "title",
        label: "标题字数",
        level: "risk",
        detail: `${titleLen} 字,超出上限 ${TITLE_LIMIT} 字,发布时会被截断`,
      });
    } else if (titleLen >= TITLE_NEAR_LIMIT) {
      items.push({
        id: "title",
        label: "标题字数",
        level: "warn",
        detail: `${titleLen} 字,接近 ${TITLE_LIMIT} 字上限`,
      });
    } else {
      items.push({ id: "title", label: "标题字数", level: "pass", detail: `${titleLen}/${TITLE_LIMIT} 字` });
    }

    // 正文字数
    const bodyLen = info.body.length;
    if (bodyLen === 0) {
      items.push({ id: "body", label: "正文字数", level: "warn", detail: "正文为空,建议补充内容提升搜索收录" });
    } else if (bodyLen > BODY_LIMIT) {
      items.push({
        id: "body",
        label: "正文字数",
        level: "risk",
        detail: `${bodyLen} 字,超出上限 ${BODY_LIMIT} 字,无法发布`,
      });
    } else if (bodyLen >= BODY_NEAR_LIMIT) {
      items.push({
        id: "body",
        label: "正文字数",
        level: "warn",
        detail: `${bodyLen} 字,接近 ${BODY_LIMIT} 字上限`,
      });
    } else {
      items.push({ id: "body", label: "正文字数", level: "pass", detail: `${bodyLen}/${BODY_LIMIT} 字` });
    }

    // 话题数量与格式
    const badTopics = info.topics.filter((t) => /[#＃\s@]/.test(t));
    if (badTopics.length > 0) {
      items.push({
        id: "topics",
        label: "话题格式",
        level: "warn",
        detail: `话题「${badTopics.join("、")}」含 #/空格/@ 等符号,可能无法识别为话题`,
      });
    } else if (info.topics.length === 0) {
      items.push({
        id: "topics",
        label: "话题数量",
        level: "warn",
        detail: `尚未添加话题,建议 ${TOPIC_MIN}–${TOPIC_MAX} 个提升分发`,
      });
    } else if (info.topics.length < TOPIC_MIN) {
      items.push({
        id: "topics",
        label: "话题数量",
        level: "warn",
        detail: `当前 ${info.topics.length} 个,建议 ${TOPIC_MIN}–${TOPIC_MAX} 个提升分发`,
      });
    } else if (info.topics.length > TOPIC_MAX) {
      items.push({
        id: "topics",
        label: "话题数量",
        level: "warn",
        detail: `当前 ${info.topics.length} 个,超过 ${TOPIC_MAX} 个易被判定话题堆砌`,
      });
    } else {
      items.push({
        id: "topics",
        label: "话题",
        level: "pass",
        detail: `${info.topics.length} 个,数量与格式合适`,
      });
    }

    return items;
  }, [hits, info.title, info.body, info.topics]);

  const overall = worstLevel(checks);
  const hitWords = hits.map((h) => h.word);
  const hitGroups = BANNED_WORD_GROUPS.filter((g) => hits.some((h) => h.category === g.id));

  return (
    <div className="flex flex-col gap-3">
      {/* 汇总状态 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-400">发布预检</p>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${OVERALL_META[overall].className}`}
          >
            {OVERALL_META[overall].text}
          </span>
        </div>
        <div className="flex flex-col divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-950">
          {checks.map((item) => (
            <div key={item.id} className="flex items-start gap-2 px-3 py-2">
              <span className={`w-4 text-center text-xs ${LEVEL_META[item.level].className}`}>
                {LEVEL_META[item.level].icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-300">{item.label}</span>
                  <span className={`text-[10px] ${LEVEL_META[item.level].className}`}>
                    {LEVEL_META[item.level].text}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 违禁词命中详情 */}
      {hits.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-xs font-medium text-red-400">风险词命中详情</p>
          {hitGroups.map((group) => {
            const groupHits = hits.filter((h) => h.category === group.id);
            return (
              <div key={group.id}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-zinc-400">{group.name}:</span>
                  {groupHits.map((h) => (
                    <span
                      key={h.word}
                      className="rounded bg-red-500/20 px-1.5 py-0.5 text-[11px] text-red-300"
                    >
                      {h.word}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] leading-4 text-zinc-500">{group.risk}</p>
                <p className="text-[11px] leading-4 text-emerald-500/80">改写方向:{group.suggestion}</p>
              </div>
            );
          })}
          {/* 命中位置高亮预览 */}
          <div className="rounded bg-zinc-950 px-2.5 py-2">
            <p className="mb-1 text-[10px] text-zinc-600">命中位置预览</p>
            {info.title && (
              <p className="whitespace-pre-wrap break-all text-[11px] leading-4 text-zinc-400">
                {highlightHits(info.title, hitWords)}
              </p>
            )}
            {info.body && (
              <p className="mt-1 whitespace-pre-wrap break-all text-[11px] leading-4 text-zinc-500">
                {highlightHits(info.body, hitWords)}
              </p>
            )}
          </div>
          <p className="text-[10px] leading-4 text-zinc-600">
            词典基于广告法与平台社区规范常识本地整理,结果供参考,请结合语境人工复核。
          </p>
        </div>
      )}

      {/* 发布时间建议 */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
        <p className="mb-2 text-xs font-medium text-zinc-400">发布时间建议</p>
        <div className="flex flex-col gap-1.5">
          {PUBLISH_TIME_TIPS.map((tip) => (
            <div key={tip.label} className="flex items-baseline gap-2">
              <span className="w-16 shrink-0 text-[11px] text-zinc-300">{tip.label}</span>
              <span className="shrink-0 rounded bg-[#ff2442]/10 px-1.5 py-0.5 text-[11px] text-[#ff2442]">
                {tip.time}
              </span>
              <span className="text-[11px] leading-4 text-zinc-500">{tip.desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          以上为社区通用经验值,非官方数据,请结合自己账号的粉丝活跃时段调整。
        </p>
      </div>
    </div>
  );
}
