import { useCallback, useMemo, useState } from "react";
import {
  exportReportToMarkdown,
  type ProviderContainer,
  type Report,
  type SubmissionResult,
} from "@repruvia/shared";
import { buildProviders, type ProviderId } from "@/lib/integrations/providerRegistry";
import { buildAttachments } from "@/lib/reportAttachments";
import { loadSettings } from "@/lib/settings";

export type SubmissionPhase = "idle" | "connecting" | "ready" | "submitting" | "done" | "error";

export interface SubmissionState {
  phase: SubmissionPhase;
  containers: ProviderContainer[];
  result: SubmissionResult | null;
  error: string | null;
  progress: number;
}

const INITIAL: SubmissionState = {
  phase: "idle",
  containers: [],
  result: null,
  error: null,
  progress: 0,
};

/**
 * Orchestrates submitting a report to a ticket provider. Depends only on the
 * `TicketProvider` abstraction, so the UI is identical for Linear, Jira, or any
 * future provider. The report and video are passed in; this hook owns the flow.
 */
export function useTicketSubmission(report: Report | null) {
  const [state, setState] = useState<SubmissionState>(INITIAL);
  const providers = useMemo(() => buildProviders(loadSettings()), []);

  const reset = useCallback(() => setState(INITIAL), []);

  /** Authenticate and fetch the selectable containers (teams/projects). */
  const connect = useCallback(
    async (providerId: ProviderId) => {
      const provider = providers[providerId];
      setState({ ...INITIAL, phase: "connecting" });
      try {
        await provider.authenticate();
        const containers = await provider.listContainers();
        setState({ ...INITIAL, phase: "ready", containers });
      } catch (error) {
        setState({ ...INITIAL, phase: "error", error: (error as Error).message });
      }
    },
    [providers],
  );

  const submit = useCallback(
    async (providerId: ProviderId, containerId: string, includeImages = true) => {
      if (!report) return;
      const provider = providers[providerId];
      setState((s) => ({ ...s, phase: "submitting", progress: 0, error: null }));
      try {
        const reportedBy = loadSettings().reporterName || undefined;
        const markdownBody = exportReportToMarkdown(report, {
          screenshots: "omit", // screenshots ride along as real attachments
          reportedBy,
        });
        const result = await provider.submit({
          report,
          markdownBody,
          reportedBy,
          attachments: includeImages ? buildAttachments(report.session) : [],
          target: { containerId },
          onProgress: (progress) => setState((s) => ({ ...s, progress })),
        });
        setState((s) => ({ ...s, phase: "done", result }));
      } catch (error) {
        setState((s) => ({ ...s, phase: "error", error: (error as Error).message }));
      }
    },
    [providers, report],
  );

  return { state, providers, connect, submit, reset };
}
