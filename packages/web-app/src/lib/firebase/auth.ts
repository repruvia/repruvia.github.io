import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { firebaseApp, useFirebaseEmulators } from "./app";

export type { User };

export const auth = getAuth(firebaseApp);
if (useFirebaseEmulators) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
}

/** The signed-in user right now (null while signed out or before auth restores). */
export function currentUser(): User | null {
  return auth.currentUser;
}

export function onUserChanged(listener: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, listener);
}

/** Google sign-in; falls back to a full-page redirect where pop-ups are blocked. */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return;
    }
    // The user closing the pop-up isn't an error worth reporting.
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    throw error;
  }
}

export function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}
