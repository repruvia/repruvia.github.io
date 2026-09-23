import { useCallback, useEffect, useRef, useState } from "react";
import { loadSettings, saveSettings, subscribeSettings, type AppSettings } from "@/lib/settings";

/** Owns the settings form state and persistence. */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Edits the user hasn't saved yet outrank anything arriving from their
  // account: the account copy never carries the credentials typed here, so
  // applying it would wipe them. While the form is dirty the pull is dropped
  // and the user's own save wins — it's pushed straight back up, which leaves
  // the form, this device and the account agreeing again.
  const dirty = useRef(false);

  useEffect(
    () =>
      subscribeSettings((next, origin) => {
        if (origin !== "cloud" || dirty.current) return;
        setSettings(next);
      }),
    [],
  );

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    dirty.current = true;
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const persist = useCallback(() => {
    dirty.current = false;
    saveSettings(settings);
    setSavedAt(Date.now());
  }, [settings]);

  return { settings, update, persist, savedAt };
}
