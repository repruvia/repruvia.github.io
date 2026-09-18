/**
 * True when keystrokes are going into a text field — an input, textarea, or a
 * contenteditable (the TipTap description editor) — so page-level shortcuts
 * (undo, delete, tool keys) must leave them alone.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}
