import { useCallback, useState } from "react";
import { loadSettings, saveSettings, type AppSettings } from "@/lib/settings";

/** Owns the settings form state and persistence. */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const persist = useCallback(() => {
    saveSettings(settings);
    setSavedAt(Date.now());
  }, [settings]);

  return { settings, update, persist, savedAt };
}
