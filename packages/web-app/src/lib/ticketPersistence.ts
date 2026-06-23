import { idbDelete, idbGet, idbPut, STORES } from "./db";
import type { ProviderId } from "./integrations/providerRegistry";

/** A ticket created from a report, remembered so the UI can offer "View issue". */
export interface CreatedTicket {
  provider: ProviderId;
  /** Provider-native id, e.g. "ENG-123". */
  identifier: string;
  url: string;
}

interface StoredTicket extends CreatedTicket {
  sessionId: string;
}

export async function loadCreatedTicket(sessionId: string): Promise<CreatedTicket | null> {
  try {
    const record = await idbGet<StoredTicket>(STORES.TICKETS, sessionId);
    return record ? { provider: record.provider, identifier: record.identifier, url: record.url } : null;
  } catch {
    return null;
  }
}

export async function saveCreatedTicket(sessionId: string, ticket: CreatedTicket): Promise<void> {
  try {
    await idbPut(STORES.TICKETS, { sessionId, ...ticket } satisfies StoredTicket);
  } catch {
    // non-fatal
  }
}

export async function deleteCreatedTicket(sessionId: string): Promise<void> {
  try {
    await idbDelete(STORES.TICKETS, sessionId);
  } catch {
    // non-fatal
  }
}
