import {
  ArrowUpRight,
  Eraser,
  Lock,
  LockOpen,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ANNOTATION_COLORS, type AnnotationTool } from "@/lib/annotations/types";

const TOOLS: { id: AnnotationTool; label: string; icon: typeof Pencil }[] = [
  { id: "select", label: "Select / move", icon: MousePointer2 },
  { id: "pen", label: "Draw", icon: Pencil },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight },
  { id: "rect", label: "Box", icon: Square },
  { id: "text", label: "Text", icon: Type },
];

/** Visual preview heights (px) for the Thin / Medium / Thick presets. */
const STROKE_PREVIEW = [2, 4, 6];
const STROKE_LABELS = ["Thin", "Medium", "Thick"];

/** Human-readable names for the colors, in `ANNOTATION_COLORS` order. */
const COLOR_LABELS = ["Lime", "Red", "Amber", "Blue", "Violet", "White", "Ink"];

interface AnnotationToolbarProps {
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeIndex: number;
  onStrokeChange: (index: number) => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  canClear: boolean;
  onClear: () => void;
  canDelete: boolean;
  onDeleteSelected: () => void;
  locked: boolean;
  onToggleLock: () => void;
}

export function AnnotationToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  strokeIndex,
  onStrokeChange,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  canClear,
  onClear,
  canDelete,
  onDeleteSelected,
  locked,
  onToggleLock,
}: AnnotationToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
      <div className="flex items-center gap-1">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={tool === id}
            onClick={() => onToolChange(id)}
            className={cn(
              "flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              tool === id && "bg-primary/15 text-primary",
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
        <button
          type="button"
          title={
            locked
              ? "Tool stays active after drawing (Q)"
              : "Keep tool active after drawing (Q)"
          }
          aria-label="Keep tool active after drawing"
          aria-pressed={locked}
          onClick={onToggleLock}
          className={cn(
            "ml-0.5 flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            locked && "bg-primary/15 text-primary",
          )}
        >
          {locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
        </button>
      </div>

      <Separator orientation="vertical" className="h-7" />

      <Select value={color} onValueChange={onColorChange}>
        <SelectTrigger size="sm" className="w-32" aria-label="Color">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ANNOTATION_COLORS.map((c, i) => (
            <SelectItem key={c} value={c}>
              <span className="flex items-center gap-2">
                <span
                  className="size-4 rounded-full border border-border/60"
                  style={{ backgroundColor: c }}
                />
                {COLOR_LABELS[i]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-7" />

      <Select value={String(strokeIndex)} onValueChange={(v) => onStrokeChange(Number(v))}>
        <SelectTrigger size="sm" className="w-32" aria-label="Stroke thickness">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STROKE_LABELS.map((label, i) => (
            <SelectItem key={i} value={String(i)}>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-current" style={{ width: 18, height: STROKE_PREVIEW[i] }} />
                {label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-7" />

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl/⌘+Z)">
          <Undo2 className="size-4" /> Undo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl/⌘+Shift+Z)"
        >
          <Redo2 className="size-4" /> Redo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeleteSelected}
          disabled={!canDelete}
          className="text-destructive hover:text-destructive disabled:text-muted-foreground"
        >
          <Trash2 className="size-4" /> Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={!canClear}>
          <Eraser className="size-4" /> Clear all
        </Button>
      </div>
    </div>
  );
}
