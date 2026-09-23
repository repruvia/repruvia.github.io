import type * as FirestoreSdk from "firebase/firestore";
import type { CollectionReference, DocumentReference, Firestore } from "firebase/firestore";
import { firebaseApp, useFirebaseEmulators } from "@/lib/firebase/app";
import { currentUser } from "@/lib/firebase/auth";

/** The modular Firestore SDK, loaded on demand (see `cloudClient`). */
export type FirestoreApi = typeof FirestoreSdk;

/** Firestore plus the uid every document path is scoped to. */
export interface CloudClient {
  db: Firestore;
  fs: FirestoreApi;
  uid: string;
}

/** Shown when a sync is attempted while signed out; safe to surface as-is. */
export const SIGNED_OUT_MESSAGE = "Sign in to sync with your account.";

/** Top-level collection: one document of non-secret preferences per user. */
const USERS = "users";
/** Per-user subcollection: one document per ticket, keyed by its source id. */
const TICKETS = "tickets";

let connection: Promise<{ db: Firestore; fs: FirestoreApi }> | null = null;

/**
 * The Firestore SDK, imported on first use so it stays out of the initial
 * bundle — only signed-in users ever need it.
 */
function connect(): Promise<{ db: Firestore; fs: FirestoreApi }> {
  connection ??= import("firebase/firestore").then((fs) => {
    const db = fs.getFirestore(firebaseApp);
    if (useFirebaseEmulators) fs.connectFirestoreEmulator(db, "localhost", 8080);
    return { db, fs };
  });
  connection.catch(() => {
    connection = null; // e.g. the chunk failed to load offline — retry next time
  });
  return connection;
}

/**
 * Firestore scoped to the signed-in user. Rejects while signed out: every
 * document lives under the caller's uid, which the security rules enforce.
 */
export async function cloudClient(): Promise<CloudClient> {
  const user = currentUser();
  if (!user) throw new Error(SIGNED_OUT_MESSAGE);
  const { db, fs } = await connect();
  return { db, fs, uid: user.uid };
}

/** `users/{uid}` — the user's synced settings. */
export function settingsDoc({ db, fs, uid }: CloudClient): DocumentReference {
  return fs.doc(db, USERS, uid);
}

/** `users/{uid}/tickets` — every ticket the user has raised. */
export function ticketsCollection({ db, fs, uid }: CloudClient): CollectionReference {
  return fs.collection(db, USERS, uid, TICKETS);
}

/** `users/{uid}/tickets/{sourceId}` — the ticket raised from one recording or snip. */
export function ticketDoc({ db, fs, uid }: CloudClient, sourceId: string): DocumentReference {
  return fs.doc(db, USERS, uid, TICKETS, sourceId);
}
