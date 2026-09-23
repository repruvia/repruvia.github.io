import { idbDelete, idbGet, idbPut, STORES } from "./db";
import { deleteCloudTicket, getCloudTicket, upsertCloudTicket, type TicketSourceKind } from "./cloud/ticketSync";
import { signedInUser } from "./firebase/auth";
import type { ProviderId } from "./integrations/providerRegistry";

export type { TicketSourceKind };

/** A ticket created from a report, remembered so the UI can offer "View issue". */
export interface CreatedTicket {
  provider: ProviderId;
  /** Provider-native id, e.g. "ENG-123". */
  identifier: string;
  url: string;
  /** Report title at submission time (shown in ticket history). */
  title?: string;
}

interface StoredTicket extends CreatedTicket {
  sessionId: string;
}

/**
 * Local IndexedDB is the source of truth for the UI; when signed in, tickets are
 * mirrored to the user's account (Cloud Firestore) so history follows them
 * across devices. Cloud failures are logged and never block the local path.
 */
export async function loadCreatedTicket(sessionId: string): Promise<CreatedTicket | null> {
  try {
    const record = await idbGet<StoredTicket>(STORES.TICKETS, sessionId);
    if (record) {
      return { provider: record.provider, identifier: record.identifier, url: record.url, title: record.title };
    }
  } catch {
    // fall through to the account copy
  }
  try {
    if (!(await signedInUser())) return null;
    const cloud = await getCloudTicket(sessionId);
    if (!cloud) return null;
    const ticket: CreatedTicket = {
      provider: cloud.provider,
      identifier: cloud.identifier,
      url: cloud.url,
      title: cloud.title ?? undefined,
    };
    await idbPut(STORES.TICKETS, { sessionId, ...ticket } satisfies StoredTicket).catch(() => {});
    return ticket;
  } catch (error) {
    console.warn("[repruvia] Couldn't load ticket from your account:", error);
    return null;
  }
}

export async function saveCreatedTicket(
  sessionId: string,
  ticket: CreatedTicket,
  sourceKind: TicketSourceKind,
): Promise<void> {
  try {
    await idbPut(STORES.TICKETS, { sessionId, ...ticket } satisfies StoredTicket);
  } catch {
    // non-fatal
  }
  try {
    if (!(await signedInUser())) return;
    await upsertCloudTicket({
      sourceId: sessionId,
      sourceKind,
      provider: ticket.provider,
      identifier: ticket.identifier,
      url: ticket.url,
      title: ticket.title ?? null,
    });
  } catch (error) {
    console.warn("[repruvia] Couldn't save ticket to your account:", error);
  }
}

export async function deleteCreatedTicket(sessionId: string): Promise<void> {
  try {
    await idbDelete(STORES.TICKETS, sessionId);
  } catch {
    // non-fatal
  }
  try {
    if (!(await signedInUser())) return;
    await deleteCloudTicket(sessionId);
  } catch (error) {
    console.warn("[repruvia] Couldn't remove ticket from your account:", error);
  }
}
