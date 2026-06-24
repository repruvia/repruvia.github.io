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

export type AiProviderId = "webllm" | "openai" | "anthropic" | "gemini" | "grok";

/** Selectable models per provider (starting defaults; custom ids allowed in the UI). */
export const AI_PROVIDER_MODELS: Record<AiProviderId, { id: string; label: string }[]> = {
  webllm: [
    ...AI_MODELS,
    { id: "Phi-3.5-vision-instruct-q4f16_1-MLC", label: "Phi-3.5 Vision — images (~3.8 GB)" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini — fast, vision" },
    { id: "gpt-4o", label: "GPT-4o — vision" },
  ],
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fast, vision" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — vision" },
  ],
  gemini: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash — vision" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash — vision" },
  ],
  grok: [{ id: "grok-2-vision-1212", label: "Grok 2 Vision" }],
};

export interface AiProviderConfig {
  apiKey?: string;
  model: string;
}

export interface AiSettings {
  /** null = AI off (the default until the user configures a provider). */
  activeProvider: AiProviderId | null;
  providers: Record<AiProviderId, AiProviderConfig>;
}

const AI_DEFAULTS: AiSettings = {
  activeProvider: null,
  providers: {
    webllm: { model: AI_MODELS[0].id },
    openai: { apiKey: "", model: "gpt-4o-mini" },
    anthropic: { apiKey: "", model: "claude-haiku-4-5-20251001" },
    gemini: { apiKey: "", model: "gemini-2.0-flash" },
    grok: { apiKey: "", model: "grok-2-vision-1212" },
  },
};

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

/** AI is usable iff an active provider is selected and configured. */
export function isAiConfigured(settings: AppSettings): boolean {
  const id = settings.ai.activeProvider;
  if (!id) return false;
  if (id === "webllm") return Boolean(settings.ai.providers.webllm.model);
  return Boolean(settings.ai.providers[id].apiKey?.trim());
}

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

/** Normalize a stored AI block, folding the legacy `aiEnabled`/`aiModel` shape. */
function migrateAi(raw: Partial<AppSettings> & { aiModel?: string }): AiSettings {
  if (raw.ai) {
    return {
      activeProvider: raw.ai.activeProvider ?? null,
      providers: {
        webllm: { ...AI_DEFAULTS.providers.webllm, ...raw.ai.providers?.webllm },
        openai: { ...AI_DEFAULTS.providers.openai, ...raw.ai.providers?.openai },
        anthropic: { ...AI_DEFAULTS.providers.anthropic, ...raw.ai.providers?.anthropic },
        gemini: { ...AI_DEFAULTS.providers.gemini, ...raw.ai.providers?.gemini },
        grok: { ...AI_DEFAULTS.providers.grok, ...raw.ai.providers?.grok },
      },
    };
  }
  // Legacy: fold aiModel into webllm; stay OFF (the user re-opts-in).
  return {
    ...AI_DEFAULTS,
    providers: {
      ...AI_DEFAULTS.providers,
      webllm: { model: raw.aiModel || AI_MODELS[0].id },
    },
  };
}

function readLegacy(): Partial<AppSettings> | null {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    return raw ? (JSON.parse(raw) as Partial<AppSettings>) : null;
  } catch {
    return null;
  }
}
