import { useCallback, useEffect, useState } from "react";
import {
  loadCreatedTicket,
  saveCreatedTicket,
  type CreatedTicket,
} from "@/lib/ticketPersistence";

/**
 * Tracks the ticket (if any) created from the current report. Loaded from
 * IndexedDB on mount so a created issue survives reloads (UI offers "View
 * issue" instead of "Raise an issue").
 */
export function useCreatedTicket(sessionId: string | null) {
  const [ticket, setTicketState] = useState<CreatedTicket | null>(null);

  useEffect(() => {
    let active = true;
    setTicketState(null);
    if (!sessionId) return;
    void loadCreatedTicket(sessionId).then((t) => {
      if (active) setTicketState(t);
    });
    return () => {
      active = false;
    };
  }, [sessionId]);

  const setTicket = useCallback(
    (next: CreatedTicket) => {
      setTicketState(next);
      if (sessionId) void saveCreatedTicket(sessionId, next);
    },
    [sessionId],
  );

  return { ticket, setTicket };
}
