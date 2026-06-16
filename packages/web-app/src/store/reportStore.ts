import { create } from "zustand";
import {
  assembleSession,
  reindexSteps,
  type RepruviaSession,
  type ReportMeta,
  type Severity,
  type Step,
} from "@repruvia/shared";
import {
  applyPersistedReport,
  savePersistedReport,
  type PersistedReport,
} from "@/lib/reportPersistence";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

interface ReportState {
  status: LoadStatus;
  error: string | null;
  session: RepruviaSession | null;
  meta: ReportMeta;

  // lifecycle
  beginLoad: () => void;
  setSession: (session: RepruviaSession, persisted?: PersistedReport | null) => void;
  setError: (message: string) => void;
  reset: () => void;

  // meta edits
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setSeverity: (severity: Severity) => void;

  // step edits
  editStep: (stepId: string, description: string) => void;
  deleteStep: (stepId: string) => void;
  moveStep: (stepId: string, direction: "up" | "down") => void;
}

const DEFAULT_META: ReportMeta = { title: "", description: "", severity: "medium" };

function deriveTitle(session: RepruviaSession): string {
  // Sensible default: first navigation/click path keeps the tester oriented.
  const firstPath = session.steps[0]?.event.pathname ?? new URL(session.tabUrl).pathname;
  return `Bug on ${firstPath}`;
}

function withSession(
  state: ReportState,
  update: (session: RepruviaSession) => RepruviaSession,
): Partial<ReportState> {
  if (!state.session) return {};
  return { session: assembleSession(update(state.session)) };
}

export const useReportStore = create<ReportState>((set) => ({
  status: "idle",
  error: null,
  session: null,
  meta: DEFAULT_META,

  beginLoad: () => set({ status: "loading", error: null }),
  setSession: (session, persisted) => {
    if (persisted) {
      // Restore the tester's saved edits (incl. AI refinements) over the
      // freshly-captured session.
      const { steps, meta } = applyPersistedReport(session, persisted);
      set({
        status: "ready",
        session: assembleSession({ ...session, steps }),
        meta: { ...DEFAULT_META, ...meta },
      });
    } else {
      set({
        status: "ready",
        session: assembleSession(session),
        meta: { ...DEFAULT_META, title: deriveTitle(session) },
      });
    }
  },
  setError: (message) => set({ status: "error", error: message }),
  reset: () => set({ status: "idle", error: null, session: null, meta: DEFAULT_META }),

  setTitle: (title) => set((s) => ({ meta: { ...s.meta, title } })),
  setDescription: (description) => set((s) => ({ meta: { ...s.meta, description } })),
  setSeverity: (severity) => set((s) => ({ meta: { ...s.meta, severity } })),

  editStep: (stepId, description) =>
    set((s) =>
      withSession(s, (session) => ({
        ...session,
        steps: session.steps.map((step) =>
          step.id === stepId
            ? { ...step, editedDescription: description.trim() ? description : null }
            : step,
        ),
      })),
    ),

  deleteStep: (stepId) =>
    set((s) =>
      withSession(s, (session) => ({
        ...session,
        steps: reindexSteps(session.steps.filter((step) => step.id !== stepId)),
      })),
    ),

  moveStep: (stepId, direction) =>
    set((s) =>
      withSession(s, (session) => {
        const steps: Step[] = [...session.steps];
        const i = steps.findIndex((step) => step.id === stepId);
        const j = direction === "up" ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= steps.length) return session;
        [steps[i], steps[j]] = [steps[j]!, steps[i]!];
        return { ...session, steps: reindexSteps(steps) };
      }),
    ),
}));

// Persist the editable report layer to IndexedDB whenever it changes (debounced
// so rapid typing / an AI refine that touches many fields writes once).
let saveTimer: ReturnType<typeof setTimeout> | null = null;
useReportStore.subscribe((state, prev) => {
  if (!state.session) return;
  if (state.session === prev.session && state.meta === prev.meta) return;
  const { id } = state.session;
  const { meta } = state;
  const { steps } = state.session;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void savePersistedReport(id, meta, steps);
  }, 400);
});
