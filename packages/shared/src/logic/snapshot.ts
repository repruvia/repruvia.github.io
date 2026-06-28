import type { CaptureRect } from "../types/messaging.js";
import type { Snapshot, SnapshotSummary } from "../types/domain.js";

/** A rectangle in device pixels, ready to pass to a canvas `drawImage`. */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Convert a CSS-pixel selection from the snip overlay into a device-pixel crop
 * rectangle against a captured viewport image, clamped so it never reads outside
 * the image bounds. `captureVisibleTab` returns the viewport at the device pixel
 * ratio, so the selection (in CSS px) is scaled by `devicePixelRatio`.
 */
export function deviceCropRect(
  rect: CaptureRect,
  devicePixelRatio: number,
  imageWidth: number,
  imageHeight: number,
): PixelRect {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const x = clamp(Math.round(rect.x * dpr), 0, Math.max(0, imageWidth - 1));
  const y = clamp(Math.round(rect.y * dpr), 0, Math.max(0, imageHeight - 1));
  const width = clamp(Math.round(rect.width * dpr), 1, imageWidth - x);
  const height = clamp(Math.round(rect.height * dpr), 1, imageHeight - y);
  return { x, y, width, height };
}

/** Project a full snapshot to its lightweight list-view summary. */
export function toSnapshotSummary(snapshot: Snapshot): SnapshotSummary {
  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    tabUrl: snapshot.tabUrl,
    width: snapshot.width,
    height: snapshot.height,
  };
}
