import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  exportReportToMarkdown,
  toFriendlyMessage,
  type ProviderContainer,
  type Report,
  type SubmissionResult,
} from "@repruvia/shared";
import { buildProviders, type ProviderId } from "@/lib/integrations/providerRegistry";
import { buildAttachments } from "@/lib/reportAttachments";
import { loadSettings, subscribeSettings, type AppSettings } from "@/lib/settings";

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

/** Only the fields `buildProviders` reads: any other save leaves the instances alone. */
function sameCredentials(a: AppSettings, b: AppSettings): boolean {
  return (
    a.linearToken === b.linearToken &&
    a.jiraSite === b.jiraSite &&
    a.jiraEmail === b.jiraEmail &&
    a.jiraToken === b.jiraToken
  );
}

/**
 * Orchestrates submitting a report to a ticket provider. Depends only on the
 * `TicketProvider` abstraction, so the UI is identical across providers.
 */
export function useTicketSubmission(report: Report | null) {
  const [state, setState] = useState<SubmissionState>(INITIAL);

  // Credentials can change under an open dialog — a sign-in pulls the Jira site
  // from the account — so the providers are rebuilt when they do, and only then.
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  useEffect(
    () => subscribeSettings((next) => setSettings((prev) => (sameCredentials(prev, next) ? prev : next))),
    [],
  );
  const providers = useMemo(() => buildProviders(settings), [settings]);

  // Connecting and submitting both run long enough for the user to cancel and
  // start another one: only the newest request may write state, or a stale
  // reply lands under a different provider.
  const latestRequest = useRef(0);

  const reset = useCallback(() => {
    latestRequest.current++;
    setState(INITIAL);
  }, []);

  /** Authenticate and fetch the selectable containers (teams/projects). */
  const connect = useCallback(
    async (providerId: ProviderId) => {
      const requestId = ++latestRequest.current;
      const isStale = () => requestId !== latestRequest.current;
      const provider = providers[providerId];
      setState({ ...INITIAL, phase: "connecting" });
      try {
        await provider.authenticate();
        const containers = await provider.listContainers();
        if (isStale()) return;
        setState({ ...INITIAL, phase: "ready", containers });
      } catch (error) {
        if (isStale()) return;
        console.error("[repruvia] Couldn't connect to the ticket provider:", error);
        setState({
          ...INITIAL,
          phase: "error",
          error: toFriendlyMessage(error, "Couldn't connect. Check your API key and try again."),
        });
      }
    },
    [providers],
  );

  const submit = useCallback(
    async (providerId: ProviderId, containerId: string, includeImages = true) => {
      if (!report) return;
      const requestId = ++latestRequest.current;
      const isStale = () => requestId !== latestRequest.current;
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
          onProgress: (progress) => {
            if (isStale()) return;
            setState((s) => ({ ...s, progress }));
          },
        });
        if (isStale()) return;
        setState((s) => ({ ...s, phase: "done", result }));
      } catch (error) {
        if (isStale()) return;
        console.error("[repruvia] Couldn't submit the ticket:", error);
        setState((s) => ({
          ...s,
          phase: "error",
          error: toFriendlyMessage(error, "Couldn't submit this ticket. Try again."),
        }));
      }
    },
    [providers, report],
  );

  return { state, providers, connect, submit, reset };
}
