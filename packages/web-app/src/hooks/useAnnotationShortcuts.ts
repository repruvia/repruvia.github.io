import { useEffect, useRef } from "react";
import { isTypingTarget } from "@/lib/keyboard";

interface AnnotationShortcuts {
  onUndo: () => void;
  onRedo: () => void;
  onToggleLock: () => void;
}

/**
 * Annotator keyboard shortcuts: ⌘/Ctrl+Z undo, ⌘/Ctrl+Shift+Z or Ctrl+Y redo,
 * and "Q" to toggle the keep-tool-active lock (Excalidraw convention). Ignored
 * while typing in any field so text editing keeps its own undo and letters.
 */
export function useAnnotationShortcuts(handlers: AnnotationShortcuts): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) ref.current.onRedo();
        else ref.current.onUndo();
      } else if (mod && key === "y") {
        e.preventDefault();
        ref.current.onRedo();
      } else if (!mod && !e.altKey && key === "q") {
        ref.current.onToggleLock();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
