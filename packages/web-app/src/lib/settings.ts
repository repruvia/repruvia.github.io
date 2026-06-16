import { idbGet, idbPut, STORES } from "./db";

/**
 * App settings, persisted in the web app's IndexedDB (`settings` store). An
 * in-memory cache keeps `loadSettings()` synchronous for the many call sites
 * that read it during render/inference; `hydrateSettings()` must run once at
 * startup (see `main.tsx`) to fill the cache from IndexedDB before first read.
 */

const SETTINGS_KEY = "app";
/** Legacy localStorage key — migrated into IndexedDB on first hydrate. */
const LEGACY_LS_KEY = "repruvia.settings";

/** Available on-device AI models (WebLLM). */
export const AI_MODELS = [
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B — fast (~0.9 GB)" },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "Llama 3.2 3B — better (~2.3 GB)" },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 1.5B — balanced (~1.1 GB)" },
] as const;

export interface AppSettings {
  // Profile
  reporterName: string;
  reporterEmail: string;
  // Integrations
  linearToken: string;
  jiraToken: string;
  jiraEmail: string;
  jiraSite: string;
  // AI
  aiEnabled: boolean;
  aiModel: string;
}

const DEFAULTS: AppSettings = {
  reporterName: "",
  reporterEmail: "",
  linearToken: "",
  jiraToken: "",
  jiraEmail: "",
  jiraSite: "",
  aiEnabled: true,
  aiModel: AI_MODELS[0].id,
};

let cache: AppSettings = { ...DEFAULTS };

/** Synchronous read of the cached settings. */
export function loadSettings(): AppSettings {
  return cache;
}

/** Update the cache and persist to IndexedDB (fire-and-forget). */
export function saveSettings(settings: AppSettings): void {
  cache = { ...settings };
  void idbPut(STORES.SETTINGS, cache, SETTINGS_KEY);
}

/**
 * Load settings from IndexedDB into the cache. Migrates a legacy localStorage
 * value on first run. Call once before rendering.
 */
export async function hydrateSettings(): Promise<void> {
  try {
    const stored = await idbGet<Partial<AppSettings>>(STORES.SETTINGS, SETTINGS_KEY);
    if (stored) {
      cache = { ...DEFAULTS, ...stored };
      return;
    }
    const legacy = readLegacy();
    if (legacy) {
      cache = { ...DEFAULTS, ...legacy };
      await idbPut(STORES.SETTINGS, cache, SETTINGS_KEY);
      try {
        localStorage.removeItem(LEGACY_LS_KEY);
      } catch {
        // ignore
      }
    }
  } catch {
    // IndexedDB unavailable — keep defaults; saves will retry.
  }
}

function readLegacy(): Partial<AppSettings> | null {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    return raw ? (JSON.parse(raw) as Partial<AppSettings>) : null;
  } catch {
    return null;
  }
}
