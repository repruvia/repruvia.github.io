import { toStringRecord, toText } from "@repruvia/shared";
import { AI_PROVIDER_IDS, type AiProviderId, type AppSettings } from "@/lib/settings";
import { cloudClient, settingsDoc } from "./firestore";

/**
 * The slice of settings synced to the user's account. Deliberately excludes
 * every credential (Linear/Jira tokens, AI API keys) — those never leave this browser.
 */
export interface SyncedSettings {
  reporterName: string;
  reporterEmail: string;
  jiraSite: string;
  jiraEmail: string;
  aiProvider: AiProviderId | null;
  aiModels: Partial<Record<AiProviderId, string>>;
}

function toSynced(settings: AppSettings): SyncedSettings {
  return {
    reporterName: settings.reporterName,
    reporterEmail: settings.reporterEmail,
    jiraSite: settings.jiraSite,
    jiraEmail: settings.jiraEmail,
    aiProvider: settings.ai.activeProvider,
    aiModels: Object.fromEntries(
      Object.entries(settings.ai.providers).map(([id, config]) => [id, config.model]),
    ),
  };
}

/** Overlay synced values onto local settings, keeping local-only credentials. */
export function applySyncedSettings(local: AppSettings, synced: SyncedSettings): AppSettings {
  const providers = { ...local.ai.providers };
  for (const [id, model] of Object.entries(synced.aiModels) as [AiProviderId, string][]) {
    if (providers[id] && model) providers[id] = { ...providers[id], model };
  }
  const aiProvider =
    synced.aiProvider === null || synced.aiProvider in providers ? synced.aiProvider : local.ai.activeProvider;
  return {
    ...local,
    reporterName: synced.reporterName,
    reporterEmail: synced.reporterEmail,
    jiraSite: synced.jiraSite,
    jiraEmail: synced.jiraEmail,
    ai: { activeProvider: aiProvider, providers },
  };
}

/**
 * A signed-in user reports as their account: its name and email replace the
 * hand-entered reporter fields (kept as-is when the account lacks one).
 */
export function withAccountIdentity(
  settings: AppSettings,
  name: string | null,
  email: string | null,
): AppSettings {
  return {
    ...settings,
    reporterName: name?.trim() || settings.reporterName,
    reporterEmail: email?.trim() || settings.reporterEmail,
  };
}

/** Keep only model choices for providers this build still supports. */
function toAiModels(value: unknown): SyncedSettings["aiModels"] {
  const stored = toStringRecord(value);
  const known = AI_PROVIDER_IDS.filter((id) => stored[id]).map((id) => [id, stored[id]] as const);
  return Object.fromEntries(known) as SyncedSettings["aiModels"];
}

function toAiProvider(value: unknown): AiProviderId | null {
  return AI_PROVIDER_IDS.find((id) => id === value) ?? null;
}

/** The signed-in user's synced settings, or null if they've never saved any. */
export async function pullSettings(): Promise<SyncedSettings | null> {
  const client = await cloudClient();
  const snapshot = await client.fs.getDoc(settingsDoc(client));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, unknown>;
  return {
    reporterName: toText(data.reporterName),
    reporterEmail: toText(data.reporterEmail),
    jiraSite: toText(data.jiraSite),
    jiraEmail: toText(data.jiraEmail),
    aiProvider: toAiProvider(data.aiProvider),
    aiModels: toAiModels(data.aiModels),
  };
}

/**
 * Write the synced slice to the user's account. Merged, so a field this build
 * doesn't know about (written by a newer one) survives the round trip.
 */
export async function pushSettings(settings: AppSettings): Promise<void> {
  const synced = toSynced(settings);
  const client = await cloudClient();
  await client.fs.setDoc(
    settingsDoc(client),
    { ...synced, updatedAt: client.fs.serverTimestamp() },
    { merge: true },
  );
}
