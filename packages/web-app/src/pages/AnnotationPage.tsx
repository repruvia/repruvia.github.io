import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { exportReportToMarkdown, type Report } from "@repruvia/shared";
import { PageContainer } from "@/components/atoms/PageContainer";
import { StateScreen } from "@/components/molecules/StateScreen";
import { AnnotationToolbar } from "@/components/molecules/AnnotationToolbar";
import {
  AnnotationCanvas,
  type AnnotationCanvasHandle,
} from "@/components/organisms/AnnotationCanvas";
import { SnapshotActionBar } from "@/components/organisms/SnapshotActionBar";
import { SubmitDialog } from "@/components/organisms/SubmitDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/molecules/RichTextEditor";
import { useSnapshotId, useSnapshotLoader } from "@/hooks/useSnapshotLoader";
import { useSnapshotGenerate } from "@/hooks/useSnapshotGenerate";
import { useCreatedTicket } from "@/hooks/useCreatedTicket";
import { flushSnapshotSave, useSnapshotStore } from "@/store/snapshotStore";
import type { AnnotationTool } from "@/lib/annotations/types";
import type { ProviderId } from "@/lib/integrations/providerRegistry";
import { snapshotToReport } from "@/lib/snapshotReport";
import { loadSettings } from "@/lib/settings";
import { dataUrlToBlob } from "@/lib/dataUrl";
import { downloadBlob, downloadTextFile } from "@/lib/download";

/** Scale font size with the image's largest dimension (a retina capture is ~2× CSS px, so fixed px would look off). */
function fontSizeFor(width: number, height: number): number {
  return Math.max(13, Math.round(Math.max(width, height, 1) * 0.018));
}

/** Thin / Medium / Thick stroke presets (in image px). */
function strokeSteps(width: number, height: number): number[] {
  const m = Math.max(width, height, 1);
  return [
    Math.max(1, Math.round(m * 0.0012)),
    Math.max(2, Math.round(m * 0.0022)),
    Math.max(3, Math.round(m * 0.004)),
  ];
}

/** Build a filesystem-safe file stem from the title (fallback: "snapshot"). */
function fileStem(title: string): string {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "snapshot";
}

export function AnnotationPage() {
  const snapshotId = useSnapshotId();
  useSnapshotLoader(snapshotId);

  const status = useSnapshotStore((s) => s.status);
  const error = useSnapshotStore((s) => s.error);
  const snapshot = useSnapshotStore((s) => s.snapshot);
  const title = useSnapshotStore((s) => s.title);
  const description = useSnapshotStore((s) => s.description);
  const shapes = useSnapshotStore((s) => s.shapes);
  const saveState = useSnapshotStore((s) => s.saveState);
  const setTitle = useSnapshotStore((s) => s.setTitle);
  const setDescription = useSnapshotStore((s) => s.setDescription);
  const addShape = useSnapshotStore((s) => s.addShape);
  const updateShape = useSnapshotStore((s) => s.updateShape);
  const removeShape = useSnapshotStore((s) => s.removeShape);
  const undo = useSnapshotStore((s) => s.undo);
  const redo = useSnapshotStore((s) => s.redo);
  const clearShapes = useSnapshotStore((s) => s.clearShapes);
  const canUndo = useSnapshotStore((s) => s.past.length > 0);
  const canRedo = useSnapshotStore((s) => s.future.length > 0);

  const [tool, setToolState] = useState<AnnotationTool>("pen");
  const [color, setColorState] = useState<string>("#84cc16");
  const [strokeIndex, setStrokeIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // When locked, the active tool stays selected after each draw (Excalidraw "Q"); else reverts to select.
  const [locked, setLocked] = useState(false);
  const canvasRef = useRef<AnnotationCanvasHandle>(null);

  // Report built lazily on submit so it carries the flattened annotated image captured at click time.
  const [submitting, setSubmitting] = useState<ProviderId | null>(null);
  const [submitReport, setSubmitReport] = useState<Report | null>(null);
  const { ticket, setTicket } = useCreatedTicket(snapshotId);

  // Switching to a drawing tool clears the current selection.
  const setTool = (next: AnnotationTool) => {
    setToolState(next);
    if (next !== "select") setSelectedId(null);
  };

  // Color/stroke changes also recolor/re-stroke the selected shape, and become the default for new ones.
  const setColor = (next: string) => {
    setColorState(next);
    if (selectedId) updateShape(selectedId, { color: next });
  };

  const setStroke = (index: number, width: number) => {
    setStrokeIndex(index);
    if (selectedId) updateShape(selectedId, { strokeWidth: width });
  };

  // After a shape is finished, select it so it's immediately movable/resizable — unless the tool is locked.
  const onShapeCommitted = (id: string) => {
    if (locked) {
      setSelectedId(null);
      return;
    }
    setToolState("select");
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    removeShape(selectedId);
    setSelectedId(null);
  };

  // "Q" toggles the keep-tool-active lock (Excalidraw convention), ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "q" || e.key === "Q") setLocked((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Undo / redo keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") {
        // Ctrl+Y is the Windows redo convention.
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
          const el = document.activeElement;
          if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
          e.preventDefault();
          redo();
        }
        return;
      }
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Flush a pending save before the tab is hidden/closed or the editor unmounts, so last-debounce edits aren't lost.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushSnapshotSave();
    };
    window.addEventListener("pagehide", flushSnapshotSave);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushSnapshotSave);
      document.removeEventListener("visibilitychange", onHide);
      flushSnapshotSave();
    };
  }, []);

  const { available: aiAvailable, generating, generate } = useSnapshotGenerate();

  if (status === "loading" || status === "idle") {
    return (
      <PageContainer className="py-12">
        <StateScreen title="Loading snapshot…" />
      </PageContainer>
    );
  }

  if (status === "error" || !snapshot) {
    return (
      <PageContainer className="py-12">
        <StateScreen
          title="Couldn't open this snapshot"
          description={error ?? "It may have expired or been deleted."}
          action={
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="size-4" /> Back home
              </Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const steps = strokeSteps(snapshot.width, snapshot.height);
  const strokeWidth = steps[strokeIndex] ?? steps[1]!;
  const fontSize = fontSizeFor(snapshot.width, snapshot.height);

  const flatten = (): string | null => canvasRef.current?.toDataURL() ?? null;

  const onGenerate = async () => {
    const image = flatten();
    if (!image) return;
    try {
      const draft = await generate(image, { title, description });
      setTitle(draft.title);
      setDescription(draft.description);
      toast.success("Draft generated from the image");
    } catch (e) {
      console.error("Snapshot AI generation failed:", e);
      const message =
        e instanceof Error && e.message
          ? e.message
          : "AI generation failed. Check your provider/API key in Settings and try again.";
      toast.error(message);
    }
  };

  /** Build a report from the snapshot + current annotations (flattened image). */
  const buildReport = (): Report | null => {
    const image = flatten();
    return image ? snapshotToReport(snapshot, title, description, image) : null;
  };

  const onDownloadPng = () => {
    const image = flatten();
    if (!image) return;
    downloadBlob(`${fileStem(title)}.png`, dataUrlToBlob(image));
    toast.success("Image downloaded");
  };

  const onDownloadMarkdown = () => {
    const report = buildReport();
    if (!report) return;
    const reportedBy = loadSettings().reporterName || undefined;
    const md = exportReportToMarkdown(report, { screenshots: "embed", reportedBy });
    downloadTextFile(`${fileStem(title)}.md`, md);
    toast.success("Markdown downloaded");
  };

  const onCopyImage = async () => {
    const image = flatten();
    if (!image) return;
    try {
      const blob = dataUrlToBlob(image);
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast.success("Image copied to clipboard");
    } catch {
      toast.error("Couldn't copy the image — your browser may not allow it. Try Download instead.");
    }
  };

  const onCopyMarkdown = async () => {
    const report = buildReport();
    if (!report) return;
    const reportedBy = loadSettings().reporterName || undefined;
    const md = exportReportToMarkdown(report, { screenshots: "omit", reportedBy });
    try {
      await navigator.clipboard.writeText(md);
      toast.success("Markdown copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  };

  const onSubmit = (providerId: ProviderId) => {
    const report = buildReport();
    if (!report) return;
    setSubmitReport(report);
    setSubmitting(providerId);
  };

  return (
    <PageContainer className="flex flex-col gap-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="size-4" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            {saveState === "saving" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Saving…
              </>
            ) : saveState === "saved" ? (
              <>
                <Check className="size-3.5 text-primary" /> Saved
              </>
            ) : null}
          </span>
          <SnapshotActionBar
            onCopyImage={onCopyImage}
            onCopyMarkdown={onCopyMarkdown}
            onDownloadPng={onDownloadPng}
            onDownloadMarkdown={onDownloadMarkdown}
            onSubmit={onSubmit}
            createdTicket={ticket}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <AnnotationToolbar
          tool={tool}
          onToolChange={setTool}
          color={color}
          onColorChange={setColor}
          strokeIndex={strokeIndex}
          onStrokeChange={(i) => setStroke(i, steps[i]!)}
          canUndo={canUndo}
          onUndo={undo}
          canRedo={canRedo}
          onRedo={redo}
          canClear={shapes.length > 0}
          onClear={clearShapes}
          canDelete={selectedId !== null}
          onDeleteSelected={deleteSelected}
          locked={locked}
          onToggleLock={() => setLocked((v) => !v)}
        />
        <div className="min-w-0 overflow-hidden rounded-lg border bg-[repeating-conic-gradient(theme(colors.muted.DEFAULT)_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-2">
          <AnnotationCanvas
            ref={canvasRef}
            image={snapshot.image}
            imageWidth={snapshot.width}
            imageHeight={snapshot.height}
            shapes={shapes}
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            fontSize={fontSize}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onShapeCommitted={onShapeCommitted}
            onAddShape={addShape}
            onUpdateShape={updateShape}
            onRemoveShape={removeShape}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Issue details</h2>
          {aiAvailable && (
            <Button size="sm" variant="outline" onClick={onGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {generating ? "Generating…" : "Generate from image"}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="snap-title">Title</Label>
          <Input
            id="snap-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short, specific issue title"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Description</Label>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="What's wrong, what you expected…"
          />
        </div>

        {!aiAvailable && (
          <p className="text-xs text-muted-foreground">
            Configure a vision-capable AI provider in{" "}
            <Link to="/settings" className="text-primary underline-offset-2 hover:underline">
              Settings
            </Link>{" "}
            to generate a title &amp; description from the image.
          </p>
        )}
      </div>

      <SubmitDialog
        providerId={submitting}
        report={submitReport}
        onClose={() => setSubmitting(null)}
        onCreated={setTicket}
      />
    </PageContainer>
  );
}
