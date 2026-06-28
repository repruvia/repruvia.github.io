import { create } from "zustand";
import type { Snapshot } from "@repruvia/shared";
import type { AnnotationShape } from "@/lib/annotations/types";
import {
  savePersistedSnapshot,
  type PersistedSnapshot,
} from "@/lib/snapshotPersistence";

export type LoadStatus = "idle" | "loading" | "ready" | "error";
export type SaveState = "idle" | "saving" | "saved";

interface SnapshotState {
  status: LoadStatus;
  error: string | null;
  snapshot: Snapshot | null;
  title: string;
  description: string;
  shapes: AnnotationShape[];
  /** Undo/redo history of settled `shapes` snapshots (most recent last/first). */
  past: AnnotationShape[][];
  future: AnnotationShape[][];
  /** Auto-save status for the annotation/edit layer. */
  saveState: SaveState;

  beginLoad: () => void;
  setSnapshot: (snapshot: Snapshot, persisted?: PersistedSnapshot | null) => void;
  setError: (message: string) => void;
  reset: () => void;

  setTitle: (title: string) => void;
  setDescription: (description: string) => void;

  addShape: (shape: AnnotationShape) => void;
  updateShape: (id: string, patch: Partial<AnnotationShape>) => void;
  removeShape: (id: string) => void;
  undo: () => void;
  redo: () => void;
  clearShapes: () => void;
}

export const useSnapshotStore = create<SnapshotState>((set) => ({
  status: "idle",
  error: null,
  snapshot: null,
  title: "",
  description: "",
  shapes: [],
  past: [],
  future: [],
  saveState: "idle",

  beginLoad: () => set({ status: "loading", error: null, saveState: "idle" }),
  setSnapshot: (snapshot, persisted) => {
    const shapes = persisted?.shapes ?? [];
    committedShapes = shapes;
    set({
      status: "ready",
      snapshot,
      title: persisted?.title ?? "",
      description: persisted?.description ?? "",
      shapes,
      past: [],
      future: [],
      saveState: "idle",
    });
  },
  setError: (message) => set({ status: "error", error: message }),
  reset: () => {
    committedShapes = [];
    set({
      status: "idle",
      error: null,
      snapshot: null,
      title: "",
      description: "",
      shapes: [],
      past: [],
      future: [],
      saveState: "idle",
    });
  },

  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),

  addShape: (shape) => set((s) => ({ shapes: [...s.shapes, shape] })),
  updateShape: (id, patch) =>
    set((s) => ({
      shapes: s.shapes.map((shape) =>
        shape.id === id ? ({ ...shape, ...patch } as AnnotationShape) : shape,
      ),
    })),
  removeShape: (id) => set((s) => ({ shapes: s.shapes.filter((shape) => shape.id !== id) })),

  undo: () => {
    // Eagerly commit any not-yet-settled change so it can be undone immediately.
    captureHistoryNow();
    set((s) => {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1]!;
      committedShapes = prev;
      return { shapes: prev, past: s.past.slice(0, -1), future: [s.shapes, ...s.future] };
    });
  },
  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0]!;
      committedShapes = next;
      return { shapes: next, future: s.future.slice(1), past: [...s.past, s.shapes] };
    }),

  clearShapes: () => set({ shapes: [] }),
}));

// Undo/redo history. `committedShapes` is the last snapshot recorded; rapid
// draw/drag frames are coalesced into one entry, captured only after edits
// settle (or eagerly, on undo). Undo/redo set `committedShapes` themselves so
// their own `shapes` change isn't re-recorded.
let committedShapes: AnnotationShape[] = [];
let historyTimer: ReturnType<typeof setTimeout> | null = null;

function captureHistoryNow(): void {
  if (historyTimer) {
    clearTimeout(historyTimer);
    historyTimer = null;
  }
  const s = useSnapshotStore.getState();
  if (s.shapes === committedShapes) return;
  useSnapshotStore.setState({ past: [...s.past, committedShapes], future: [] });
  committedShapes = s.shapes;
}

// Persist the editable layer to IndexedDB on change, debounced so rapid drawing
// or typing writes once. Tracks saveState for a "Saving… / Saved" indicator.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pending: { id: string; data: PersistedSnapshot } | null = null;

async function commitSnapshotSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!pending) return;
  const { id, data } = pending;
  pending = null;
  await savePersistedSnapshot(id, data);
  useSnapshotStore.setState({ saveState: "saved" });
}

/** Flush any pending save immediately (e.g. on tab close). */
export function flushSnapshotSave(): void {
  void commitSnapshotSave();
}

useSnapshotStore.subscribe((state, prev) => {
  if (!state.snapshot || state.status !== "ready" || prev.status !== "ready") return;
  if (
    state.title === prev.title &&
    state.description === prev.description &&
    state.shapes === prev.shapes
  ) {
    return; // a non-data change (e.g. saveState itself) — don't re-save
  }
  pending = {
    id: state.snapshot.id,
    data: { title: state.title, description: state.description, shapes: state.shapes },
  };
  if (state.saveState !== "saving") useSnapshotStore.setState({ saveState: "saving" });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void commitSnapshotSave(), 400);

  // Record an undo step once a shape edit settles. Skip undo/redo-driven changes
  // (they set committedShapes themselves, so shapes === committedShapes here).
  if (state.shapes !== prev.shapes && state.shapes !== committedShapes) {
    if (historyTimer) clearTimeout(historyTimer);
    historyTimer = setTimeout(captureHistoryNow, 350);
  }
});
