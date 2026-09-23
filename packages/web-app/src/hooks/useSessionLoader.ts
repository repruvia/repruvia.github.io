import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SESSION_QUERY_PARAM, toFriendlyMessage } from "@repruvia/shared";
import { useReportStore } from "@/store/reportStore";
import { extensionBridge } from "@/lib/extensionBridge";
import { loadPersistedReport } from "@/lib/reportPersistence";

/**
 * Read the `?session=` param reactively via the router. Using `useSearchParams`
 * (not `window.location`) subscribes the caller to navigation, so the view
 * updates on client-side navigation — `?session=` is a search-only change under
 * the same `/` route, which a raw `window.location` read would miss.
 */
export function useSessionId(): string | null {
  const [params] = useSearchParams();
  return params.get(SESSION_QUERY_PARAM);
}

/** Loads the session identified by `sessionId` from the extension into the store. */
export function useSessionLoader(sessionId: string | null): void {
  const beginLoad = useReportStore((s) => s.beginLoad);
  const setSession = useReportStore((s) => s.setSession);
  const setError = useReportStore((s) => s.setError);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    beginLoad();
    // Fetch the captured session and any saved edits in parallel.
    Promise.all([extensionBridge.getSession(sessionId), loadPersistedReport(sessionId)])
      .then(([session, persisted]) => {
        if (cancelled) return;
        if (!session) setError("That recording isn't available any more. It may have expired or been deleted.");
        else setSession(session, persisted);
      })
      .catch((error: Error) => {
        console.error("[repruvia] Couldn't load the recording:", error);
        if (!cancelled) setError(toFriendlyMessage(error, "Couldn't load this recording right now."));
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, beginLoad, setSession, setError]);
}
