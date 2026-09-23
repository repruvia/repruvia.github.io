import { idbGet, idbPut, STORES } from "./db";

/**
 * App settings, persisted in IndexedDB (`settings` store). An in-memory cache
 * keeps `loadSettings()` synchronous for the many call sites that read during
 * render; `hydrateSettings()` must run once at startup (see `main.tsx`) to fill
 * the cache from IndexedDB before the first read.
 */

const SETTINGS_KEY = "app";
/** Legacy localStorage key — migrated into IndexedDB on first hydrate. */
const LEGACY_LS_KEY = "repruvia.settings";

export type AiProviderId = "openai" | "anthropic" | "gemini" | "grok" | "groq";

/** Providers that work without the user supplying an API key. Currently none — every
 * supported provider needs the user's own API key, so AI defaults to off until they add one. */
export const KEYLESS_AI_PROVIDERS: readonly AiProviderId[] = [];

/** Selectable models per provider — only vision-capable ones (custom ids still allowed in UI). */
export const AI_PROVIDER_MODELS: Record<AiProviderId, { id: string; label: string }[]> = {
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini — fast, reads images" },
    { id: "gpt-4o", label: "GPT-4o — reads images" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini — fast, reads images" },
    { id: "gpt-4.1", label: "GPT-4.1 — reads images" },
  ],
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fast, reads images" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — reads images" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8 — best, reads images" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash — fast, reads images" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro — reads images" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash — reads images" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash — reads images" },
  ],
  grok: [{ id: "grok-2-vision-1212", label: "Grok 2 Vision" }],
  groq: [
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout — reads images" },
    { id: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick — reads images" },
  ],
};

/** Every provider id the app knows about — used to drop ids from older/newer builds. */
export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDER_MODELS) as AiProviderId[];

export interface AiProviderConfig {
  apiKey?: string;
  model: string;
}

export interface AiSettings {
  /** null = AI off. */
  activeProvider: AiProviderId | null;
  providers: Record<AiProviderId, AiProviderConfig>;
}

const AI_DEFAULTS: AiSettings = {
  // AI is off by default — every supported provider needs the user's own API
  // key, so there's nothing to turn on until they add one in Settings.
  activeProvider: null,
  providers: {
    openai: { apiKey: "", model: "gpt-4o-mini" },
    anthropic: { apiKey: "", model: "claude-haiku-4-5-20251001" },
    gemini: { apiKey: "", model: "gemini-2.0-flash" },
    grok: { apiKey: "", model: "grok-2-vision-1212" },
    groq: { apiKey: "", model: "meta-llama/llama-4-scout-17b-16e-instruct" },
  },
};

export interface AppSettings {
  reporterName: string;
  reporterEmail: string;
  linearToken: string;
  jiraToken: string;
  jiraEmail: string;
  jiraSite: string;
  ai: AiSettings;
}

const DEFAULTS: AppSettings = {
  reporterName: "",
  reporterEmail: "",
  linearToken: "",
  jiraToken: "",
  jiraEmail: "",
  jiraSite: "",
  ai: AI_DEFAULTS,
};

/** AI is usable iff a provider is selected and (unless keyless) has an API key. */
export function isAiConfigured(settings: AppSettings): boolean {
  const id = settings.ai.activeProvider;
  if (!id) return false;
  if (KEYLESS_AI_PROVIDERS.includes(id)) return Boolean(settings.ai.providers[id]?.model?.trim());
  return Boolean(settings.ai.providers[id]?.apiKey?.trim());
}

let cache: AppSettings = { ...DEFAULTS };

export function loadSettings(): AppSettings {
  return cache;
}

type SettingsListener = (settings: AppSettings, origin: SettingsOrigin) => void;
/** "local" = the user saved in this tab; "cloud" = applied from their synced account. */
export type SettingsOrigin = "local" | "cloud";
const listeners = new Set<SettingsListener>();

/** Observe saves (cloud sync pushes local ones; an open settings form refreshes on cloud ones). */
export function subscribeSettings(listener: SettingsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Update the cache and persist to IndexedDB (fire-and-forget). */
export function saveSettings(settings: AppSettings, origin: SettingsOrigin = "local"): void {
  cache = { ...settings };
  for (const listener of listeners) listener(cache, origin);
  idbPut(STORES.SETTINGS, cache, SETTINGS_KEY).catch((error: unknown) => {
    // The in-memory cache still applies for this tab; it just won't survive a reload.
    console.warn("[repruvia] Couldn't persist settings:", error);
  });
}

/**
 * Load settings from IndexedDB into the cache. Migrates a legacy localStorage
 * value on first run. Call once before rendering.
 */
export async function hydrateSettings(): Promise<void> {
  try {
    const stored = await idbGet<Partial<AppSettings>>(STORES.SETTINGS, SETTINGS_KEY);
    if (stored) {
      cache = { ...DEFAULTS, ...stored, ai: migrateAi(stored) };
      return;
    }
    const legacy = readLegacy();
    if (legacy) {
      cache = { ...DEFAULTS, ...legacy, ai: migrateAi(legacy) };
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

/** Normalize a stored AI block; drops any provider id that no longer exists (e.g. a
 * previously removed provider such as the keyless Firebase/Gemini one). */
function migrateAi(raw: Partial<AppSettings>): AiSettings {
  const storedProviders = raw.ai?.providers as
    | Partial<Record<AiProviderId, AiProviderConfig>>
    | undefined;
  const providers = Object.fromEntries(
    AI_PROVIDER_IDS.map((id) => [id, { ...AI_DEFAULTS.providers[id], ...storedProviders?.[id] }]),
  ) as Record<AiProviderId, AiProviderConfig>;

  // A removed provider (e.g. old settings with `activeProvider: "firebase"`) falls
  // back to "off" rather than an invalid id. A stored `null` is the user's choice
  // (AI off) and is kept; only a missing AI block (older settings) picks up the
  // current default.
  const stored = raw.ai?.activeProvider;
  const activeProvider =
    raw.ai === undefined
      ? AI_DEFAULTS.activeProvider
      : stored && AI_PROVIDER_IDS.includes(stored)
        ? stored
        : null;

  return { activeProvider, providers };
}

function readLegacy(): Partial<AppSettings> | null {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    return raw ? (JSON.parse(raw) as Partial<AppSettings>) : null;
  } catch {
    return null;
  }
}
