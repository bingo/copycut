"use client";

import { isMacPlatform } from "./useEditorShortcuts";

/** F-65 快捷键速查面板:按 ? 或点击顶栏 ⌨ 入口打开 */
export default function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const mod = isMacPlatform() ? "⌘" : "Ctrl";

  const groups: { title: string; items: [string[], string][] }[] = [
    {
      title: "播放",
      items: [
        [["Space"], "播放 / 暂停"],
        [["←", "→"], "播放头微移(约一帧)"],
        [["Shift", "←/→"], "播放头快移(1 秒)"],
      ],
    },
    {
      title: "文字排版",
      items: [
        [["←↑→↓"], "微调选中文字位置"],
        [["Shift", "方向键"], "大步移动文字"],
        [["拖拽"], "自动吸附中心 / 三分线(按住 Alt 关闭)"],
      ],
    },
    {
      title: "剪辑",
      items: [
        [["S"], "在播放头处分割片段"],
        [["Delete"], "删除选中片段 / 文字"],
        [[mod, "C"], "复制选中片段 / 文字"],
        [[mod, "V"], "粘贴片段 / 文字"],
        [[mod, "D"], "原位复制选中对象"],
      ],
    },
    {
      title: "通用",
      items: [
        [[mod, "Z"], "撤销"],
        [[mod, "⇧", "Z"], "重做"],
        [["?"], "打开 / 关闭本面板"],
        [["Esc"], "关闭本面板"],
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">键盘快捷键</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {groups.map((group) => (
          <section key={group.title} className="mt-4">
            <h3 className="mb-2 text-xs text-zinc-500">{group.title}</h3>
            <ul className="space-y-1.5">
              {group.items.map(([keys, label]) => (
                <li key={label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{label}</span>
                  <span className="flex items-center gap-1">
                    {keys.map((k) => (
                      <kbd
                        key={k}
                        className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-4 text-xs text-zinc-600">
          焦点在输入框内时快捷键不生效;图文轮播模式仅撤销 / 重做可用。
        </p>
      </div>
    </div>
  );
}
