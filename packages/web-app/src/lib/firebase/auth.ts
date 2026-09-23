import type * as AuthSdk from "firebase/auth";
import type { Auth, User } from "firebase/auth";
import { firebaseApp, useFirebaseEmulators } from "./app";

export type { User };

/** The modular Auth SDK, loaded on demand (see `load`). */
type AuthApi = typeof AuthSdk;

type Listener = (user: User | null) => void;

/** Subscribers, fanned out to from the single internal Firebase subscription. */
const listeners = new Set<Listener>();
/** The user Firebase last reported; null while signed out or before auth restores. */
let latest: User | null = null;
/** True once Firebase has reported the restored session, signed in or out. */
let restored = false;

let markRestored: () => void = () => {};
const restoredOnce = new Promise<void>((resolve) => {
  markRestored = resolve;
});

let sdk: Promise<{ auth: Auth; api: AuthApi }> | null = null;

function report(user: User | null): void {
  latest = user;
  restored = true;
  markRestored();
  // Copied: a listener may unsubscribe from inside its own callback.
  for (const listener of [...listeners]) listener(user);
}

/**
 * The Auth SDK, imported on first use so it stays out of the initial bundle —
 * only signed-in users ever need it. One internal subscription feeds every
 * caller of `onUserChanged`, including those that subscribed before this
 * resolved.
 */
function load(): Promise<{ auth: Auth; api: AuthApi }> {
  const pending = (sdk ??= import("firebase/auth").then((api) => {
    const auth = api.getAuth(firebaseApp);
    if (useFirebaseEmulators) {
      api.connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    }
    api.onAuthStateChanged(auth, report);
    return { auth, api };
  }));
  pending.catch(() => {
    if (sdk === pending) sdk = null; // e.g. the chunk failed offline — retry next time
  });
  return pending;
}

/**
 * The signed-in user once the session has been restored, or null. Async because
 * the SDK loads on demand; callers that need a uid must await it.
 */
export async function signedInUser(): Promise<User | null> {
  if (restored) return latest;
  await load();
  await restoredOnce;
  return latest;
}

export function onUserChanged(listener: Listener): () => void {
  listeners.add(listener);
  // A subscriber joining after the session is known still gets told about it,
  // the way Firebase's own `onAuthStateChanged` would.
  if (restored) {
    queueMicrotask(() => {
      if (listeners.has(listener)) listener(latest);
    });
  }
  void load().catch((error: unknown) => {
    // Nothing to sync without the SDK: settle as signed out so the UI isn't
    // stuck waiting. Signing in retries the import and surfaces the real error.
    console.warn("[repruvia] Couldn't load sign-in:", error);
    if (!restored) report(null);
  });
  return () => {
    listeners.delete(listener);
  };
}

/** Google sign-in; falls back to a full-page redirect where pop-ups are blocked. */
export async function signInWithGoogle(): Promise<void> {
  const { auth, api } = await load();
  const provider = new api.GoogleAuthProvider();
  try {
    await api.signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await api.signInWithRedirect(auth, provider);
      return;
    }
    // The user closing the pop-up isn't an error worth reporting.
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const { auth, api } = await load();
  await api.signOut(auth);
}
