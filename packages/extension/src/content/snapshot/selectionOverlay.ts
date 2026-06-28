import type { CaptureRect, SnapshotMessage } from "@repruvia/shared";

/**
 * The drag-to-select snip overlay. Injected on demand by the ISOLATED content
 * script when the service worker sends `BEGIN_SNAPSHOT`. The user drags a
 * rectangle; on release we hide the overlay (so it is NOT in the captured frame)
 * and hand the region — in CSS px within the viewport, plus the device pixel
 * ratio — to the service worker, which performs the actual capture + crop.
 */

const Z_INDEX = "2147483647";
/** Selections smaller than this (px) are treated as an accidental click → cancel. */
const MIN_SELECTION = 8;

let active = false;

function send(message: SnapshotMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {});
}

export function beginSnapshotSelection(): void {
  if (active) return;
  active = true;

  const root = document.createElement("div");
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    zIndex: Z_INDEX,
    cursor: "crosshair",
    background: "transparent",
  } satisfies Partial<CSSStyleDeclaration>);

  const hint = document.createElement("div");
  hint.textContent = "Drag to capture  ·  Esc to cancel";
  Object.assign(hint.style, {
    position: "fixed",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "8px 14px",
    borderRadius: "8px",
    background: "rgba(20,24,31,0.92)",
    color: "#e6edf3",
    font: "13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif",
    boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);

  const box = document.createElement("div");
  Object.assign(box.style, {
    position: "fixed",
    border: "2px solid #84cc16",
    // A massive spread shadow dims everything OUTSIDE the selection.
    boxShadow: "0 0 0 100000px rgba(0,0,0,0.4)",
    pointerEvents: "none",
    display: "none",
  } satisfies Partial<CSSStyleDeclaration>);

  root.append(hint, box);
  document.documentElement.appendChild(root);

  let startX = 0;
  let startY = 0;
  let dragging = false;

  const rectFrom = (x: number, y: number): CaptureRect => ({
    x: Math.min(startX, x),
    y: Math.min(startY, y),
    width: Math.abs(x - startX),
    height: Math.abs(y - startY),
  });

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    hint.style.display = "none";
    box.style.display = "block";
    drawBox(box, { x: startX, y: startY, width: 0, height: 0 });
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    drawBox(box, rectFrom(e.clientX, e.clientY));
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const rect = rectFrom(e.clientX, e.clientY);
    if (rect.width < MIN_SELECTION || rect.height < MIN_SELECTION) {
      cleanup();
      send({ type: "CANCEL_SNAPSHOT" });
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    // Remove the overlay BEFORE the capture so its dimming/border isn't in frame.
    cleanup();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => send({ type: "CAPTURE_REGION", rect, devicePixelRatio: dpr })),
    );
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      cleanup();
      send({ type: "CANCEL_SNAPSHOT" });
    }
  };

  function cleanup(): void {
    active = false;
    root.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("keydown", onKeyDown, true);
    root.remove();
  }

  root.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown, true);
}

function drawBox(box: HTMLDivElement, rect: CaptureRect): void {
  box.style.left = `${rect.x}px`;
  box.style.top = `${rect.y}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}
