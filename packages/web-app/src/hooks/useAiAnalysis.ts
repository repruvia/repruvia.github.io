import { useCallback, useEffect, useState } from "react";
import type { Report } from "@repruvia/shared";
import { useReportStore } from "@/store/reportStore";
import { webLlmEngine } from "@/lib/ai/webLlmEngine";
import {
  ANALYSIS_SCHEMA,
  buildAnalysisMessages,
  formatStepMarkdown,
  parseAnalysis,
} from "@/lib/ai/reportPrompt";

/** Cap generation so a stalled worker surfaces as an error instead of hanging. */
const GENERATE_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("AI analysis timed out. Please try again.")), ms),
    ),
  ]);
}

export type AiStatus =
  | "checking"
  | "unsupported"
  | "idle"
  | "loading" // downloading / compiling the model
  | "analyzing" // running inference
  | "done"
  | "error";

/** What the last run applied, for a friendly confirmation message. */
export interface AppliedSummary {
  title: boolean;
  severity: boolean;
  description: boolean;
  steps: number;
}

interface AnalysisState {
  status: AiStatus;
  progress: number;
  progressText: string;
  applied: AppliedSummary | null;
  error: string | null;
}

const INITIAL: AnalysisState = {
  status: "checking",
  progress: 0,
  progressText: "",
  applied: null,
  error: null,
};

/**
 * One-shot AI analysis of the current report. On `analyze()` it loads the model
 * (once), asks for a structured JSON result, and applies the title, severity,
 * description, and per-step rewrites to the store. WebGPU detection, progress,
 * and persistence concerns all live here; the card is purely presentational.
 */
export function useAiAnalysis(report: Report | null) {
  const [state, setState] = useState<AnalysisState>(INITIAL);

  const setTitle = useReportStore((s) => s.setTitle);
  const setSeverity = useReportStore((s) => s.setSeverity);
  const setDescription = useReportStore((s) => s.setDescription);
  const editStep = useReportStore((s) => s.editStep);

  useEffect(() => {
    let cancelled = false;
    webLlmEngine.isSupported().then((supported) => {
      if (!cancelled) setState((s) => ({ ...s, status: supported ? "idle" : "unsupported" }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const analyze = useCallback(async () => {
    if (!report) return;
    // Capture step ids in order up front; the report prop changes as we apply edits.
    const stepIds = report.session.steps.map((step) => step.id);

    setState((s) => ({ ...s, status: "loading", error: null, applied: null, progress: 0 }));
    try {
      await webLlmEngine.init((p) =>
        setState((s) => ({ ...s, progress: p.progress, progressText: p.text })),
      );

      setState((s) => ({ ...s, status: "analyzing" }));
      const raw = await withTimeout(
        webLlmEngine.generate(buildAnalysisMessages(report), {
          json: true,
          schema: ANALYSIS_SCHEMA,
        }),
        GENERATE_TIMEOUT_MS,
      );
      const result = parseAnalysis(raw);

      const applied: AppliedSummary = { title: false, severity: false, description: false, steps: 0 };
      if (result.title) {
        setTitle(result.title);
        applied.title = true;
      }
      if (result.severity) {
        setSeverity(result.severity);
        applied.severity = true;
      }
      if (result.description) {
        setDescription(result.description);
        applied.description = true;
      }
      // Steps come back in order, one per input step — map positionally.
      (result.steps ?? []).forEach((title, i) => {
        const id = stepIds[i];
        if (id && title) {
          editStep(id, formatStepMarkdown(title));
          applied.steps += 1;
        }
      });

      const producedAnything =
        applied.title || applied.severity || applied.description || applied.steps > 0;
      if (!producedAnything) {
        setState((s) => ({ ...s, status: "error", error: "The model returned no usable result. Try again." }));
        return;
      }
      setState((s) => ({ ...s, status: "done", applied }));
    } catch (error) {
      setState((s) => ({ ...s, status: "error", error: (error as Error).message }));
    }
  }, [report, setTitle, setSeverity, setDescription, editStep]);

  return { ...state, analyze };
}
