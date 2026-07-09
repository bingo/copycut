"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorState } from "./useEditorState";

/** 方向键单步步长(约一帧,秒) */
const FRAME_STEP = 1 / 30;
/** Shift + 方向键大步步长(秒) */
const LARGE_STEP = 1;

/** 是否 Mac 平台,决定快捷键提示显示 ⌘ 还是 Ctrl */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
}

/** 焦点在输入类元素(input/textarea/contenteditable)时不响应快捷键 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("input, textarea, select") !== null;
}

/**
 * F-65 编辑器全局快捷键(策略 S6「PC Web 一等公民」):
 * 空格播放/暂停、方向键微移播放头(Shift 大步)、S 分割、Delete 删除、
 * ⌘/Ctrl+C/V 复制粘贴片段、⌘/Ctrl+Z/⇧Z 撤销重做(原 F-09,自 useEditorState 移入)、
 * ? 打开快捷键速查面板。
 *
 * 输入保护:焦点在输入类元素、输入法合成中或有弹窗打开(modalOpen)时全部不触发;
 * 图文轮播模式没有时间轴,仅保留撤销/重做与帮助面板。
 */
export function useEditorShortcuts(editor: EditorState, options: { modalOpen: boolean }) {
  const { modalOpen } = options;
  const [helpOpen, setHelpOpen] = useState(false);

  // editor 每次渲染都是新对象,经 ref 转手,避免播放时逐帧重绑事件
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.isComposing) return;
      if (isEditableTarget(e.target)) return;
      const ed = editorRef.current;
      const meta = e.metaKey || e.ctrlKey;

      // ? 随时可开关帮助面板(其余弹窗打开时除外)
      if (!meta && e.key === "?" && !modalOpen) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (helpOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setHelpOpen(false);
        }
        return;
      }
      if (modalOpen) return;

      // F-09 撤销/重做
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) ed.redo();
        else ed.undo();
        return;
      }

      // 以下为时间轴剪辑快捷键,图文轮播模式不适用
      if (ed.draft?.mode === "gallery") return;

      if (meta && e.key.toLowerCase() === "c") {
        // 页面上有选中文本时保留浏览器原生复制
        if (window.getSelection()?.toString()) return;
        if (!ed.selection) return;
        e.preventDefault();
        ed.copySelected();
        return;
      }
      if (meta && e.key.toLowerCase() === "v") {
        e.preventDefault();
        ed.paste();
        return;
      }
      // T1 ⌘/Ctrl+D 原位复制选中片段/文字
      if (meta && e.key.toLowerCase() === "d") {
        if (!ed.selection) return;
        e.preventDefault();
        ed.duplicateSelected();
        return;
      }
      if (meta) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          ed.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          ed.seekBy(e.shiftKey ? -LARGE_STEP : -FRAME_STEP);
          break;
        case "ArrowRight":
          e.preventDefault();
          ed.seekBy(e.shiftKey ? LARGE_STEP : FRAME_STEP);
          break;
        case "s":
        case "S":
          e.preventDefault();
          ed.splitAtPlayhead();
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          ed.deleteSelected();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, helpOpen]);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  return { helpOpen, openHelp, closeHelp };
}
