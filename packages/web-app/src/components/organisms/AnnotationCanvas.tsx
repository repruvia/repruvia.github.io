import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type Konva from "konva";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Line,
  Arrow,
  Rect,
  Text,
  Transformer,
} from "react-konva";
import { uuid } from "@repruvia/shared";
import type { AnnotationShape, AnnotationTool } from "@/lib/annotations/types";

/** Imperative handle so the page can flatten the canvas to a PNG for export/AI. */
export interface AnnotationCanvasHandle {
  /** Flattened screenshot + annotations as a full-resolution PNG data URL. */
  toDataURL: () => string;
}

interface AnnotationCanvasProps {
  image: string;
  imageWidth: number;
  imageHeight: number;
  shapes: AnnotationShape[];
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  fontSize: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onShapeCommitted: (id: string) => void;
  onAddShape: (shape: AnnotationShape) => void;
  onUpdateShape: (id: string, patch: Partial<AnnotationShape>) => void;
  onRemoveShape: (id: string) => void;
}

/** Minimum box size / text width so a shape can't be collapsed to nothing. */
const MIN_SIZE = 6;
const MIN_TEXT_WIDTH = 24;
/** Match the Konva Text font to the editing <textarea> so wrapping stays identical. */
const TEXT_FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
const TEXT_LINE_HEIGHT = 1.2;

const ALL_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

/** Load a data-URL image into an HTMLImageElement for Konva. */
function useHtmlImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.src = src;
    const onLoad = () => setImage(img);
    img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [src]);
  return image;
}

export const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, AnnotationCanvasProps>(
  function AnnotationCanvas(
    {
      image,
      imageWidth,
      imageHeight,
      shapes,
      tool,
      color,
      strokeWidth,
      fontSize,
      selectedId,
      onSelect,
      onShapeCommitted,
      onAddShape,
      onUpdateShape,
      onRemoveShape,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const trRef = useRef<Konva.Transformer>(null);
    const htmlImage = useHtmlImage(image);

    // Scale the stage to fit container width + viewport height (never upscale past 1:1):
    // the capture is in device pixels (often 2×), so it'd otherwise overflow. Measure before paint, then track resizes.
    const [containerWidth, setContainerWidth] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(() =>
      typeof window === "undefined" ? 0 : window.innerHeight,
    );
    useLayoutEffect(() => {
      const el = containerRef.current;
      if (el) setContainerWidth(el.clientWidth);
    }, []);
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const observer = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width;
        if (w) setContainerWidth(w);
      });
      observer.observe(el);
      const onResize = () => setViewportHeight(window.innerHeight);
      window.addEventListener("resize", onResize);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", onResize);
      };
    }, []);

    // Leave headroom for the toolbar + page chrome so the canvas fits the fold.
    const maxHeight = Math.max(320, viewportHeight - 200);
    const widthScale = containerWidth > 0 ? containerWidth / imageWidth : 1;
    const scale = Math.min(widthScale, maxHeight / imageHeight, 1);

    // Editing state for the inline text input overlay.
    const [editingId, setEditingId] = useState<string | null>(null);
    const drawingId = useRef<string | null>(null);
    const startPoint = useRef<{ x: number; y: number } | null>(null);

    // Attach the selection outline (Transformer) to the selected node and pick
    // the right anchors for its type (text = width-only; others = all corners).
    useEffect(() => {
      const tr = trRef.current;
      const stage = stageRef.current;
      if (!tr || !stage) return;
      const shape =
        selectedId && tool === "select" ? shapes.find((s) => s.id === selectedId) : undefined;
      const node = shape ? stage.findOne(`#${selectedId}`) : undefined;
      if (node && shape && shape.id !== editingId) {
        tr.enabledAnchors(shape.type === "text" ? ["middle-left", "middle-right"] : ALL_ANCHORS);
        tr.keepRatio(false);
        tr.nodes([node]);
      } else {
        tr.nodes([]);
      }
      tr.getLayer()?.batchDraw();
    }, [selectedId, tool, shapes, scale, editingId]);

    // Delete / Backspace removes the selected shape (unless typing in a field).
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (!selectedId || editingId) return;
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          onRemoveShape(selectedId);
          onSelect(null);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [selectedId, editingId, onRemoveShape, onSelect]);

    useImperativeHandle(ref, () => ({
      toDataURL: () => {
        const stage = stageRef.current;
        if (!stage) return image;
        const tr = trRef.current;
        // Detach the selection outline so it isn't baked in, then force a SYNCHRONOUS
        // redraw so just-drawn shapes are rasterized before we read pixels (batchDraw would be a frame late).
        tr?.nodes([]);
        const layer = tr?.getLayer() ?? stage.getLayers()[0];
        layer?.draw();
        const url = stage.toDataURL({ pixelRatio: scale > 0 ? 1 / scale : 1 });
        const node = selectedId ? stage.findOne(`#${selectedId}`) : undefined;
        if (tr && node) {
          tr.nodes([node]);
          layer?.draw();
        }
        return url;
      },
    }));

    const pointer = (): { x: number; y: number } | null => {
      const pos = stageRef.current?.getRelativePointerPosition();
      return pos ? { x: pos.x, y: pos.y } : null;
    };

    const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      // A text editor is open: this click only commits it (via textarea blur) —
      // don't also start a new shape in the same gesture (race left stray empty text).
      if (editingId) return;
      const target = e.target;
      const targetId = target.id();
      if (tool === "select") {
        // Click on empty canvas / background image clears selection; shape + anchor clicks handled elsewhere.
        if (target === stageRef.current || target.name() === "bg-image") onSelect(null);
        return;
      }
      const pos = pointer();
      if (!pos) return;
      // Clicking existing text with the text tool edits it (no stacked duplicate).
      if (tool === "text" && targetId) {
        const existing = shapes.find((s) => s.id === targetId && s.type === "text");
        if (existing) {
          setEditingId(existing.id);
          return;
        }
      }
      e.evt.preventDefault();
      const id = uuid();

      if (tool === "pen") {
        onAddShape({ id, type: "pen", points: [pos.x, pos.y], color, strokeWidth });
        drawingId.current = id;
      } else if (tool === "arrow") {
        onAddShape({ id, type: "arrow", points: [pos.x, pos.y, pos.x, pos.y], color, strokeWidth });
        drawingId.current = id;
        startPoint.current = pos;
      } else if (tool === "rect") {
        onAddShape({ id, type: "rect", x: pos.x, y: pos.y, width: 0, height: 0, color, strokeWidth });
        drawingId.current = id;
        startPoint.current = pos;
      } else if (tool === "text") {
        // Start as a wrapping box (resizable via the width anchors).
        const width = Math.round(Math.min(imageWidth * 0.4, Math.max(160, imageWidth * 0.2)));
        onAddShape({ id, type: "text", x: pos.x, y: pos.y, text: "", color, fontSize, width });
        setEditingId(id);
      }
    };

    const onPointerMove = () => {
      const id = drawingId.current;
      if (!id) return;
      const pos = pointer();
      if (!pos) return;
      const shape = shapes.find((s) => s.id === id);
      if (!shape) return;

      if (shape.type === "pen") {
        onUpdateShape(id, { points: [...shape.points, pos.x, pos.y] });
      } else if (shape.type === "arrow" && startPoint.current) {
        const { x, y } = startPoint.current;
        onUpdateShape(id, { points: [x, y, pos.x, pos.y] });
      } else if (shape.type === "rect" && startPoint.current) {
        const { x, y } = startPoint.current;
        onUpdateShape(id, {
          x: Math.min(x, pos.x),
          y: Math.min(y, pos.y),
          width: Math.abs(pos.x - x),
          height: Math.abs(pos.y - y),
        });
      }
    };

    const onPointerUp = () => {
      const id = drawingId.current;
      drawingId.current = null;
      startPoint.current = null;
      if (!id) return;
      const shape = shapes.find((s) => s.id === id);
      if (!shape) return;
      // Drop a degenerate (click-with-no-drag) shape; otherwise it's committed.
      let degenerate = false;
      if (shape.type === "rect") degenerate = shape.width < 2 && shape.height < 2;
      else if (shape.type === "arrow")
        degenerate =
          Math.hypot(shape.points[2]! - shape.points[0]!, shape.points[3]! - shape.points[1]!) < 2;
      else if (shape.type === "pen") degenerate = shape.points.length < 4;

      if (degenerate) onRemoveShape(id);
      else onShapeCommitted(id);
    };

    /** Select a shape on click/tap while in select mode. */
    const selectOnClick =
      (id: string) => (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (tool !== "select") return;
        e.cancelBubble = true;
        onSelect(id);
      };

    /** Persist a shape's new position after a drag (bake offsets into points). */
    const handleDragEnd =
      (shape: AnnotationShape) => (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target;
        if (shape.type === "pen" || shape.type === "arrow") {
          const dx = node.x();
          const dy = node.y();
          const points = shape.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy));
          node.position({ x: 0, y: 0 });
          onUpdateShape(shape.id, { points });
        } else {
          onUpdateShape(shape.id, { x: node.x(), y: node.y() });
        }
      };

    /** Live width re-wrap for text: convert scaleX into width (keeps font size). */
    const onTextTransform = (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const width = Math.max(MIN_TEXT_WIDTH, node.width() * node.scaleX());
      node.setAttrs({ width, scaleX: 1, scaleY: 1 });
    };

    /** Bake the Transformer's scale/rotation into the shape's own geometry. */
    const handleTransformEnd =
      (shape: AnnotationShape) => (e: Konva.KonvaEventObject<Event>) => {
        const node = e.target;
        if (shape.type === "text") {
          const width = Math.max(MIN_TEXT_WIDTH, node.width() * node.scaleX());
          node.setAttrs({ width, scaleX: 1, scaleY: 1 });
          onUpdateShape(shape.id, {
            x: node.x(),
            y: node.y(),
            width,
            rotation: node.rotation(),
          });
          return;
        }
        if (shape.type === "rect") {
          const sx = node.scaleX();
          const sy = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onUpdateShape(shape.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(MIN_SIZE, node.width() * sx),
            height: Math.max(MIN_SIZE, node.height() * sy),
            rotation: node.rotation(),
          });
          return;
        }
        // pen / arrow — bake scale/rotation/position into the points, then reset the node to identity.
        const transform = node.getTransform().copy();
        const baked: number[] = [];
        for (let i = 0; i < shape.points.length; i += 2) {
          const p = transform.point({ x: shape.points[i]!, y: shape.points[i + 1]! });
          baked.push(p.x, p.y);
        }
        node.setAttrs({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
        onUpdateShape(shape.id, { points: baked });
      };

    const draggable = tool === "select";
    const commonShapeProps = (shape: AnnotationShape) => ({
      id: shape.id,
      draggable,
      onClick: selectOnClick(shape.id),
      onTap: selectOnClick(shape.id),
      onDragStart: () => onSelect(shape.id),
      onDragEnd: handleDragEnd(shape),
      onTransformEnd: handleTransformEnd(shape),
      strokeScaleEnabled: false,
    });

    const editingShape = shapes.find((s) => s.id === editingId && s.type === "text");

    return (
      <div ref={containerRef} className="relative w-full">
        <Stage
          ref={stageRef}
          width={imageWidth * scale}
          height={imageHeight * scale}
          scaleX={scale}
          scaleY={scale}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            cursor: tool === "select" ? "default" : "crosshair",
            borderRadius: 8,
            touchAction: "none",
          }}
        >
          <Layer>
            {htmlImage && (
              <KonvaImage
                name="bg-image"
                image={htmlImage}
                width={imageWidth}
                height={imageHeight}
                listening={tool === "select"}
              />
            )}
            {shapes.map((shape) => {
              if (shape.type === "pen") {
                return (
                  <Line
                    key={shape.id}
                    {...commonShapeProps(shape)}
                    points={shape.points}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                    lineCap="round"
                    lineJoin="round"
                    tension={0.3}
                    hitStrokeWidth={Math.max(12, shape.strokeWidth)}
                  />
                );
              }
              if (shape.type === "arrow") {
                return (
                  <Arrow
                    key={shape.id}
                    {...commonShapeProps(shape)}
                    points={shape.points}
                    stroke={shape.color}
                    fill={shape.color}
                    strokeWidth={shape.strokeWidth}
                    pointerLength={Math.max(8, shape.strokeWidth * 3)}
                    pointerWidth={Math.max(8, shape.strokeWidth * 3)}
                    hitStrokeWidth={Math.max(12, shape.strokeWidth)}
                  />
                );
              }
              if (shape.type === "rect") {
                return (
                  <Rect
                    key={shape.id}
                    {...commonShapeProps(shape)}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    rotation={shape.rotation ?? 0}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                  />
                );
              }
              return (
                <Text
                  key={shape.id}
                  {...commonShapeProps(shape)}
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  rotation={shape.rotation ?? 0}
                  text={shape.text || " "}
                  fontSize={shape.fontSize}
                  fontFamily={TEXT_FONT}
                  fontStyle="bold"
                  lineHeight={TEXT_LINE_HEIGHT}
                  wrap="word"
                  fill={shape.color}
                  visible={shape.id !== editingId}
                  onTransform={onTextTransform}
                  onDblClick={() => setEditingId(shape.id)}
                  onDblTap={() => setEditingId(shape.id)}
                />
              );
            })}
            <Transformer
              ref={trRef}
              flipEnabled={false}
              rotateEnabled
              // Hide the default rotate connector line and tuck the handle near the top edge.
              rotateLineVisible={false}
              rotateAnchorOffset={20}
              ignoreStroke
              anchorSize={9}
              anchorCornerRadius={4}
              anchorStroke="#84cc16"
              anchorFill="#0f172a"
              rotateAnchorCursor="grab"
              borderStroke="#84cc16"
              borderStrokeWidth={1.5}
              borderDash={[4, 4]}
              boundBoxFunc={(oldBox, newBox) =>
                Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE
                  ? oldBox
                  : newBox
              }
            />
          </Layer>
        </Stage>

        {editingShape && editingShape.type === "text" && (
          <textarea
            autoFocus
            defaultValue={editingShape.text}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value) {
                onUpdateShape(editingShape.id, { text: value });
                onShapeCommitted(editingShape.id);
              } else {
                onRemoveShape(editingShape.id);
              }
              setEditingId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
              if (e.key === "Escape") {
                if (!editingShape.text) onRemoveShape(editingShape.id);
                setEditingId(null);
              }
            }}
            className="absolute z-10 m-0 overflow-hidden whitespace-pre-wrap break-words border-none bg-transparent p-0 font-bold leading-[1.2] outline-none"
            style={{
              left: editingShape.x * scale,
              top: editingShape.y * scale,
              width: editingShape.width
                ? editingShape.width * scale
                : `${Math.max(MIN_TEXT_WIDTH, editingShape.fontSize) * scale}px`,
              fontSize: editingShape.fontSize * scale,
              fontFamily: TEXT_FONT,
              color: editingShape.color,
              transform: editingShape.rotation ? `rotate(${editingShape.rotation}deg)` : undefined,
              transformOrigin: "top left",
              resize: "none",
            }}
          />
        )}
      </div>
    );
  },
);
