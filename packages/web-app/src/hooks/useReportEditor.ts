import { useMemo } from "react";
import { groupByStep, type ConsoleEntry, type NetworkFailure } from "@repruvia/shared";
import { useReportStore } from "@/store/reportStore";

/**
 * View-model for the report builder. Bundles store state with precomputed,
 * per-step error groupings so components stay free of derivation logic.
 */
export function useReportEditor() {
  const session = useReportStore((s) => s.session);
  const meta = useReportStore((s) => s.meta);
  const status = useReportStore((s) => s.status);
  const error = useReportStore((s) => s.error);

  const setTitle = useReportStore((s) => s.setTitle);
  const setDescription = useReportStore((s) => s.setDescription);
  const setSeverity = useReportStore((s) => s.setSeverity);
  const editStep = useReportStore((s) => s.editStep);
  const deleteStep = useReportStore((s) => s.deleteStep);
  const moveStep = useReportStore((s) => s.moveStep);

  const consoleByStep = useMemo<Map<string, ConsoleEntry[]>>(
    () => (session ? groupByStep(session.consoleErrors) : new Map()),
    [session],
  );
  const networkByStep = useMemo<Map<string, NetworkFailure[]>>(
    () => (session ? groupByStep(session.networkFailures) : new Map()),
    [session],
  );

  return {
    status,
    error,
    session,
    meta,
    consoleByStep,
    networkByStep,
    actions: { setTitle, setDescription, setSeverity, editStep, deleteStep, moveStep },
  };
}

export type ReportEditor = ReturnType<typeof useReportEditor>;
