import { useCallback, useEffect, useState } from "react";
import { toFriendlyMessage } from "@repruvia/shared";
import { listCloudTickets, type CloudTicket } from "@/lib/cloud/ticketSync";

export type TicketHistoryStatus = "idle" | "loading" | "ready" | "error";

const HISTORY_UNAVAILABLE = "Ticket history isn't available right now.";

/** The signed-in user's ticket history from their account (newest first). */
export function useTicketHistory(uid: string | null) {
  const [tickets, setTickets] = useState<CloudTicket[]>([]);
  const [status, setStatus] = useState<TicketHistoryStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) return;
    setStatus("loading");
    try {
      setTickets(await listCloudTickets());
      setStatus("ready");
      setError(null);
    } catch (err) {
      console.error("[repruvia] Couldn't load ticket history:", err);
      setStatus("error");
      setError(toFriendlyMessage(err, HISTORY_UNAVAILABLE));
    }
  }, [uid]);

  useEffect(() => {
    setTickets([]);
    setStatus("idle");
    void refresh();
  }, [refresh]);

  return { tickets, status, error, refresh };
}
