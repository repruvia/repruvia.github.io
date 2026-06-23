# Multi-provider AI with image support — Design

**Date:** 2026-06-19
**Status:** Approved (pending spec review)

## Summary

Replace the single on-device-only AI backend with a **provider registry** of selectable AI
providers, several of them **image-capable**. The user configures providers in the **AI settings
tab**, picks **one globally-active provider**, and AI stays **disabled by default until a provider is
configured**. The inline per-field refine icons (title, description, each step) keep working — they
talk only to the active provider through the existing `LlmEngine` interface.

This is a deliberate change to the app's privacy posture: cloud providers send report text and (on
step refine) a step screenshot to a third-party API. On-device WebLLM keeps everything local. The AI
section discloses this; nothing is sent until the user explicitly selects and keys a cloud provider.

## Providers

| Provider | Key | Image support | Notes |
|---|---|---|---|
| **On-device (WebLLM)** | none | only with `Phi-3.5-vision-instruct` (~3.8 GB) | Keep small text-only models (Llama 3.2 1B, Qwen2.5 1.5B) for text refine. WebLLM 0.2.84 ships exactly one VLM. |
| **OpenAI** | API key | GPT-4o / 4o-mini | `chat/completions`, `image_url` parts |
| **Anthropic** | API key | Claude (vision) | `/v1/messages`, base64 `image` blocks, `anthropic-version` header |
| **Google Gemini** | API key | 1.5/2.0 Flash | `generateContent`, `inlineData` parts |
| **xAI Grok** | API key | grok vision | OpenAI-compatible at `api.x.ai/v1` (reuse the OpenAI request shape) |

## Architecture

Mirrors the existing `TicketProvider` registry pattern (Open/Closed, Dependency Inversion). The UI
never branches on provider type — it depends only on the engine interface.

```
packages/web-app/src/lib/ai/
  types.ts                 # widen ChatMessage.content: string | ContentPart[]  (text | image)
  providers/
    webllmProvider.ts      # wraps the existing WebLlmEngine; image only if model is a VLM
    openaiProvider.ts      # chat/completions
    anthropicProvider.ts   # /v1/messages
    geminiProvider.ts      # :generateContent
    grokProvider.ts        # OpenAI-compatible, base URL api.x.ai/v1
  aiProviderRegistry.ts    # buildActiveEngine(settings) -> LlmEngine | null
  reportPrompt.ts          # buildFieldRefineMessages(field, current, report, screenshot?)
```

`LlmEngine` interface stays the contract (`isSupported`, `init`, `generate`). Cloud engines:
`isSupported()` = true (a key check happens at config/registry level), `init()` = no-op,
`generate(messages, opts)` = one non-streamed request.

### Message/content shape

`ChatMessage.content` widens from `string` to `string | ContentPart[]` where
`ContentPart = { type: "text"; text: string } | { type: "image"; dataUrl: string }`. Each provider
serializes image parts to its own wire format (OpenAI/Grok `image_url`, Anthropic `image`/base64,
Gemini `inlineData`, WebLLM `image_url`). Existing string content stays valid.

## Transport

Cloud requests are **routed through the extension service worker** via the existing `PROXY_FETCH`
channel (CORS-free, uniform across providers; non-streamed). Changes:

- Extend `PROXY_FETCH_ALLOWED_HOST_SUFFIXES` (shared/constants) with `openai.com`,
  `anthropic.com`, `googleapis.com`, `x.ai`.
- `extensionBridge.proxyFetch` already returns `{status, statusText, bodyText}`; cloud engines send a
  JSON `Blob` body and parse `bodyText`. No proxy API change beyond the allowlist.

On-device WebLLM runs locally (unchanged). Because AI refine only runs in the report builder — which
always has the extension present (the session was loaded from it) — depending on the proxy for cloud
calls is acceptable.

## Settings

`AppSettings.ai`:

```ts
interface AiSettings {
  activeProvider: AiProviderId | null;       // null = OFF (default)
  providers: {
    webllm:    { model: string };            // migrated from legacy aiModel
    openai:    { apiKey: string; model: string };
    anthropic: { apiKey: string; model: string };
    gemini:    { apiKey: string; model: string };
    grok:      { apiKey: string; model: string };
  };
}
type AiProviderId = "webllm" | "openai" | "anthropic" | "gemini" | "grok";
```

**Availability rule:** AI is available iff `activeProvider != null` AND that provider is configured —
cloud: non-empty `apiKey`; webllm: always (model has a default). The on-device option is additionally
gated by WebGPU support; cloud options are not.

**Migration:** legacy `aiEnabled` + `aiModel` fold in — `providers.webllm.model = aiModel`,
`activeProvider = null` (honoring "disabled until configured"; the user re-opts-in). Migration runs in
`hydrateSettings()` alongside the existing localStorage migration.

### AI settings UI (SettingsSections → AI)

- A **provider picker** (the active provider, includes an "Off" choice).
- A **config card per provider**: API key input (cloud) + a **curated model dropdown** with an
  optional **custom model id** field. WebLLM card shows its model list (incl. the VLM) and a WebGPU
  note.
- A **privacy notice**: on-device = fully local; a cloud provider sends report text and step
  screenshots to that API. Keys are stored locally in IndexedDB (same as Linear/Jira creds).

## Images & data flow

- **Step refine**: message includes the step's `screenshot` (data URL) as an image part.
- **Title / description refine**: text-only (full session text context as today).
- `buildFieldRefineMessages` gains an optional `screenshot` arg used only for `field === "step"`.
- `AiRefineProvider.refine` resolves the active engine from the registry, builds the messages
  (passing the step screenshot when applicable), calls `engine.generate`, applies `formatStepMarkdown`
  for steps.
- `AiRefineButton` for steps passes `step.screenshot`; it already passes the step text.

## Error handling

- Per-field failure → toast (already wired in `AiRefineButton`).
- Each engine maps non-2xx / proxy errors and empty output to a clear message.
- No streaming over the proxy — the refine resolves on the full response. Acceptable for short
  single-field refines.
- On-device model-load progress still surfaces via a toast on first use.

## Out of scope / YAGNI

- Per-feature provider selection (one global active provider only).
- Streaming for cloud providers.
- Bringing back the global one-shot "Analyze with AI" batch pass (the JSON-mode helpers remain in
  `reportPrompt.ts` if ever wanted).
- New on-device VLMs beyond what WebLLM ships.

## Testing

- Pure logic in `shared` (allowlist `isProxyFetchAllowed` already tested; add cases for the new
  hosts).
- Provider request-shape builders (message → provider payload) are pure and unit-testable per
  provider; add focused tests where logic is non-trivial (content-part serialization).
- `pnpm typecheck && pnpm lint && pnpm build` green.
