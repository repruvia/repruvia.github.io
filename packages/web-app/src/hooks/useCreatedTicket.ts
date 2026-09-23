import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/auth";
import {
  loadCreatedTicket,
  saveCreatedTicket,
  type CreatedTicket,
  type TicketSourceKind,
} from "@/lib/ticketPersistence";

/**
 * Tracks the ticket (if any) created from the current report. Loaded from
 * IndexedDB on mount so a created issue survives reloads (UI offers "View
 * issue" instead of "Raise an issue").
 */
export function useCreatedTicket(sessionId: string | null, sourceKind: TicketSourceKind) {
  const [ticket, setTicketState] = useState<CreatedTicket | null>(null);
  // Re-check once sign-in restores: a ticket raised on another device lives in the account.
  const uid = useAuth().user?.uid ?? null;

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
  }, [sessionId, uid]);

  const setTicket = useCallback(
    (next: CreatedTicket) => {
      setTicketState(next);
      if (sessionId) void saveCreatedTicket(sessionId, next, sourceKind);
    },
    [sessionId, sourceKind],
  );

  return { ticket, setTicket };
}
