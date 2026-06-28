/**
 * Serializable annotation model (persisted to IndexedDB, replayed onto the Konva
 * stage). Shapes use the image's own pixel coordinates, not the scaled canvas, so
 * they re-render and flatten correctly regardless of zoom.
 */

export type AnnotationTool = "select" | "pen" | "arrow" | "rect" | "text";

interface BaseShape {
  id: string;
  color: string;
  /** Rotation in degrees, baked from the Transformer (optional; default 0). */
  rotation?: number;
}

/** Free-hand stroke: a flat list of [x, y, x, y, …] points (in image coords). */
export interface PenShape extends BaseShape {
  type: "pen";
  points: number[];
  strokeWidth: number;
}

/** Straight arrow from (points[0], points[1]) to (points[2], points[3]). */
export interface ArrowShape extends BaseShape {
  type: "arrow";
  points: number[];
  strokeWidth: number;
}

/** Outlined rectangle. */
export interface RectShape extends BaseShape {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth: number;
}

/** A text label anchored at its top-left corner. A `width` makes it a wrapping box. */
export interface TextShape extends BaseShape {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  /** When set, the text wraps at this width (a resizable text box). */
  width?: number;
}

export type AnnotationShape = PenShape | ArrowShape | RectShape | TextShape;

/** Palette offered in the toolbar. The first entry is the brand lime accent. */
export const ANNOTATION_COLORS = [
  "#84cc16", // lime (brand)
  "#ef4444", // red
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#a855f7", // violet
  "#ffffff", // white
  "#0f172a", // slate-ink
] as const;
