import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot } from "firebase/firestore";
import { toIsoTimestamp, toOptionalString, toText } from "@repruvia/shared";
import type { ProviderId } from "@/lib/integrations/providerRegistry";
import { cloudClient, ticketDoc, ticketsCollection } from "./firestore";

export type TicketSourceKind = "session" | "snapshot";

/** A ticket as stored in the user's account (`users/{uid}/tickets/{sourceId}`). */
export interface CloudTicket {
  sourceId: string;
  sourceKind: TicketSourceKind;
  provider: ProviderId;
  identifier: string;
  url: string;
  title: string | null;
  /** ISO timestamp; approximated to "now" while the server value is still pending. */
  createdAt: string;
}

/**
 * Record the ticket under the signed-in user. Keyed by source id, so
 * re-submitting the same recording replaces the previous entry rather than
 * adding a duplicate, and `createdAt` tracks the latest submission.
 */
export async function upsertCloudTicket(ticket: Omit<CloudTicket, "createdAt">): Promise<void> {
  const client = await cloudClient();
  const { sourceId, ...fields } = ticket;
  await client.fs.setDoc(ticketDoc(client, sourceId), {
    ...fields,
    createdAt: client.fs.serverTimestamp(),
  });
}

export async function getCloudTicket(sourceId: string): Promise<CloudTicket | null> {
  const client = await cloudClient();
  const snapshot = await client.fs.getDoc(ticketDoc(client, sourceId));
  return snapshot.exists() ? toCloudTicket(snapshot) : null;
}

export async function deleteCloudTicket(sourceId: string): Promise<void> {
  const client = await cloudClient();
  await client.fs.deleteDoc(ticketDoc(client, sourceId));
}

/** The user's tickets, newest first (a single-field index — no composite one needed). */
export async function listCloudTickets(max = 50): Promise<CloudTicket[]> {
  const client = await cloudClient();
  const { query, orderBy, limit, getDocs } = client.fs;
  const snapshot = await getDocs(
    query(ticketsCollection(client), orderBy("createdAt", "desc"), limit(max)),
  );
  return snapshot.docs.map(toCloudTicket);
}

/** Re-used so both the collection listing and a single read narrow identically. */
function toCloudTicket(
  snapshot: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
): CloudTicket {
  const data = (snapshot.data() ?? {}) as Record<string, unknown>;
  return {
    sourceId: snapshot.id,
    sourceKind: data.sourceKind === "snapshot" ? "snapshot" : "session",
    provider: data.provider === "jira" ? "jira" : "linear",
    identifier: toText(data.identifier),
    url: toText(data.url),
    title: toOptionalString(data.title),
    // A write that hasn't reached the server yet reads back with a null
    // timestamp; showing "just now" beats showing an invalid date.
    createdAt: toIsoTimestamp(data.createdAt) ?? new Date().toISOString(),
  };
}
