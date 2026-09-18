import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { SessionSummary } from "@repruvia/shared";
import { ExtensionUnavailableError, extensionBridge } from "@/lib/extensionBridge";
import { deletePersistedReport, loadAllPersistedMeta } from "@/lib/reportPersistence";
import { deleteCreatedTicket } from "@/lib/ticketPersistence";

export type RecordingsStatus = "checking" | "unavailable" | "ready" | "error";

/** A recording summary enriched with the tester's saved title/description. */
export interface RecordingItem extends SessionSummary {
  title?: string;
  description?: string;
}

interface RecordingsState {
  status: RecordingsStatus;
  recordings: RecordingItem[];
  error: string | null;
}

/**
 * Loads the saved recordings from the extension. Doubles as the extension
 * availability probe: a successful list means the extension is installed and
 * reachable; an `ExtensionUnavailableError` means it isn't.
 */
export function useRecordings() {
  const [state, setState] = useState<RecordingsState>({
    status: "checking",
    recordings: [],
    error: null,
  });

  // Focus + visibilitychange usually fire together, and replies can land out of
  // order: only the newest request may write state.
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    const isStale = () => requestId !== latestRequest.current;
    try {
      const [summaries, metaById] = await Promise.all([
        extensionBridge.listSessions(),
        loadAllPersistedMeta(),
      ]);
      if (isStale()) return;
      const recordings: RecordingItem[] = summaries
        .map((s) => {
          const meta = metaById.get(s.id);
          return {
            ...s,
            title: meta?.title?.trim() || undefined,
            description: meta?.description?.trim() || undefined,
          };
        })
        .sort((a, b) => b.startedAt - a.startedAt);
      setState({ status: "ready", recordings, error: null });
    } catch (error) {
      if (isStale()) return;
      if (error instanceof ExtensionUnavailableError) {
        setState({ status: "unavailable", recordings: [], error: null });
      } else {
        setState({ status: "error", recordings: [], error: (error as Error).message });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-probe on focus/visibility so installing the extension in another tab is
  // picked up without a manual refresh.
  useEffect(() => {
    let lastCheck = 0;
    const recheck = () => {
      // Returning to the tab fires both events; one probe is enough.
      if (document.visibilityState !== "visible" || Date.now() - lastCheck < 1000) return;
      lastCheck = Date.now();
      void refresh();
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [refresh]);

  const remove = useCallback(
    async (sessionId: string) => {
      // Optimistic removal, then reconcile with the extension.
      setState((s) => ({ ...s, recordings: s.recordings.filter((r) => r.id !== sessionId) }));
      try {
        await extensionBridge.deleteSession(sessionId);
        await deletePersistedReport(sessionId);
        await deleteCreatedTicket(sessionId);
      } catch (error) {
        toast.error(`Couldn't delete the recording: ${(error as Error).message}`);
      } finally {
        void refresh();
      }
    },
    [refresh],
  );

  return { ...state, refresh, remove };
}
