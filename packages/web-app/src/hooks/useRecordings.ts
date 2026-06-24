import { useCallback, useEffect, useState } from "react";
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

  const refresh = useCallback(async () => {
    try {
      const [summaries, metaById] = await Promise.all([
        extensionBridge.listSessions(),
        loadAllPersistedMeta(),
      ]);
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

  // Re-probe when the tab regains focus/visibility so a user who installs the
  // extension in another tab and comes back sees the library without a manual
  // refresh.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "visible") void refresh();
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
      } finally {
        void refresh();
      }
    },
    [refresh],
  );

  return { ...state, refresh, remove };
}
