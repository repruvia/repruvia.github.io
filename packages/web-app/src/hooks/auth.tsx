import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { toFriendlyMessage } from "@repruvia/shared";
import { onUserChanged, signInWithGoogle, signOut as firebaseSignOut, type User } from "@/lib/firebase/auth";
import {
  applySyncedSettings,
  pullSettings,
  pushSettings,
  withAccountIdentity,
} from "@/lib/cloud/settingsSync";
import { loadSettings, saveSettings, subscribeSettings } from "@/lib/settings";

export type AuthStatus = "loading" | "signedIn" | "signedOut";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Firebase Auth state for the app, plus account sync of non-secret settings:
 * on sign-in the account's copy wins (or local settings seed a new account),
 * and every later local save is pushed. Sync failures are non-fatal — the app
 * keeps working from local storage.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(
    () =>
      onUserChanged((next) => {
        setUser(next);
        setStatus(next ? "signedIn" : "signedOut");
      }),
    [],
  );

  const uid = user?.uid ?? null;
  const accountName = user?.displayName ?? null;
  const accountEmail = user?.email ?? null;

  // Pull (or seed) the account's settings once per signed-in user; the account's
  // name and email become the reporter identity.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void (async () => {
      try {
        const synced = await pullSettings();
        if (cancelled) return;
        const base = synced ? applySyncedSettings(loadSettings(), synced) : loadSettings();
        const next = withAccountIdentity(base, accountName, accountEmail);
        saveSettings(next, "cloud");
        if (
          !synced ||
          synced.reporterName !== next.reporterName ||
          synced.reporterEmail !== next.reporterEmail
        ) {
          await pushSettings(next);
        }
      } catch (error) {
        console.warn("[repruvia] Settings sync failed:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, accountName, accountEmail]);

  // Push local saves while signed in.
  useEffect(() => {
    if (!uid) return;
    return subscribeSettings((settings, origin) => {
      if (origin !== "local") return;
      pushSettings(settings).catch((error: unknown) => {
        console.warn("[repruvia] Couldn't sync settings to your account:", error);
        toast.error("Saved on this device, but couldn't sync to your account.");
      });
    });
  }, [uid]);

  const signIn = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("[repruvia] Sign-in failed:", error);
      toast.error(toFriendlyMessage(error, "Couldn't sign you in. Try again."));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut();
      toast.success("Signed out");
    } catch (error) {
      console.error("[repruvia] Sign-out failed:", error);
      toast.error(toFriendlyMessage(error, "Couldn't sign you out. Try again."));
    }
  }, []);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
