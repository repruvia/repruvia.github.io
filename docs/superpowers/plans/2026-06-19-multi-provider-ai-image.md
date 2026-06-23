# Multi-provider AI with image support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user choose among several image-capable AI providers (on-device WebLLM, OpenAI, Anthropic, Google Gemini, xAI Grok) for the inline report-refine icons, configured in the AI settings tab, with one globally-active provider that is disabled by default until configured.

**Architecture:** A provider registry mirrors the existing `TicketProvider` pattern: each provider is an `LlmEngine` implementation; `aiProviderRegistry.buildActiveEngine(settings)` returns the active one (or `null`). Cloud calls go through the extension's existing `PROXY_FETCH` channel (CORS-free, non-streamed JSON). The inline `AiRefineButton`s talk only to the engine interface via `AiRefineProvider`. Step refine attaches the step's screenshot as an image content part.

**Tech Stack:** React 19, TypeScript, Vite, `@mlc-ai/web-llm` (on-device), the extension MV3 service worker (proxy), IndexedDB settings. Spec: `docs/superpowers/specs/2026-06-19-multi-provider-ai-image-design.md`.

## Global Constraints

- **No `any` in new code.** Message channels use the discriminated unions in `shared/src/types/messaging.ts`.
- **SOLID / provider abstraction:** UI must not branch on provider type — depend only on `LlmEngine` + the registry. New provider = new file implementing `LlmEngine`, registered once.
- **Definition of done per task:** `pnpm typecheck && pnpm lint && pnpm build` all pass. Pure logic added to `shared` gets a vitest test (`pnpm --filter @repruvia/shared test`). The web-app has **no unit-test runner** — verify web-app tasks with typecheck/lint/build and the manual smoke steps given.
- **Always `pnpm build:shared` before building the apps** when shared types change.
- **Privacy copy is required** in the AI section: on-device = local; a cloud provider sends report text and (on step refine) the step screenshot to that API. Off by default.
- **Provider host suffixes** added to the proxy allowlist: `openai.com`, `anthropic.com`, `googleapis.com`, `x.ai`.
- Model ids are starting defaults with a custom-model override; verify current ids at build time (they move). Anthropic ids used here: `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`.

---

### Task 1: Extend the proxy host allowlist (shared)

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Test: `packages/shared/src/constants.test.ts` (create)

**Interfaces:**
- Consumes: existing `isProxyFetchAllowed(url)` + `PROXY_FETCH_ALLOWED_HOST_SUFFIXES`.
- Produces: the allowlist now also permits `api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `api.x.ai`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/src/constants.test.ts
import { describe, expect, it } from "vitest";
import { isProxyFetchAllowed } from "./constants.js";

describe("isProxyFetchAllowed", () => {
  it("allows ticket + AI provider hosts over https", () => {
    for (const url of [
      "https://uploads.linear.app/x",
      "https://acme.atlassian.net/rest",
      "https://api.openai.com/v1/chat/completions",
      "https://api.anthropic.com/v1/messages",
      "https://generativelanguage.googleapis.com/v1beta/models/x:generateContent",
      "https://api.x.ai/v1/chat/completions",
    ]) {
      expect(isProxyFetchAllowed(url)).toBe(true);
    }
  });
  it("rejects other hosts and non-https", () => {
    expect(isProxyFetchAllowed("https://evil.example.com")).toBe(false);
    expect(isProxyFetchAllowed("http://api.openai.com")).toBe(false);
    expect(isProxyFetchAllowed("not a url")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repruvia/shared test`
Expected: FAIL — `api.openai.com` etc. not yet allowed.

- [ ] **Step 3: Add the host suffixes**

In `packages/shared/src/constants.ts`, change `PROXY_FETCH_ALLOWED_HOST_SUFFIXES`:

```ts
export const PROXY_FETCH_ALLOWED_HOST_SUFFIXES = [
  "linear.app", // api.linear.app, uploads.linear.app
  "atlassian.net", // <site>.atlassian.net (Jira)
  "openai.com", // OpenAI API
  "anthropic.com", // Anthropic API
  "googleapis.com", // Google Gemini (generativelanguage.googleapis.com)
  "x.ai", // xAI Grok (api.x.ai)
] as const;
```

- [ ] **Step 4: Run tests + build shared**

Run: `pnpm --filter @repruvia/shared test && pnpm build:shared`
Expected: PASS; shared builds.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/constants.test.ts
git commit -m "feat(shared): allow AI provider hosts through the proxy"
```

---

### Task 2: AI content-part types (web-app)

**Files:**
- Modify: `packages/web-app/src/lib/ai/types.ts`

**Interfaces:**
- Produces:
  - `type ContentPart = { type: "text"; text: string } | { type: "image"; dataUrl: string }`
  - `ChatMessage.content: string | ContentPart[]`
  - helpers `textOf(content): string`, `partsOf(content): ContentPart[]`, `dataUrlToBase64(dataUrl): { mediaType: string; base64: string }`.

- [ ] **Step 1: Widen the message type and add helpers**

Replace the `ChatMessage` interface in `packages/web-app/src/lib/ai/types.ts` and append helpers:

```ts
/** A part of a multimodal message. */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; dataUrl: string };

/** Minimal chat message shape (OpenAI-compatible). Content may be multimodal. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

/** Flatten a message's content to plain text (drops images). */
export function textOf(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

/** Normalize content to an array of parts. */
export function partsOf(content: string | ContentPart[]): ContentPart[] {
  return typeof content === "string" ? [{ type: "text", text: content }] : content;
}

/** Split a data URL into its media type and raw base64 payload. */
export function dataUrlToBase64(dataUrl: string): { mediaType: string; base64: string } {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
  return { mediaType: match?.[1] || "image/png", base64: match?.[2] ?? "" };
}
```

Leave `LlmProgress`, `GenerateOptions`, and `LlmEngine` unchanged.

- [ ] **Step 2: Verify**

Run: `pnpm --filter @repruvia/web-app typecheck`
Expected: PASS (existing string-content callers still valid). The WebLLM engine `generate` will be updated in Task 6; if typecheck flags `content` usage there, that's expected and fixed in Task 6 — proceed.

- [ ] **Step 3: Commit**

```bash
git add packages/web-app/src/lib/ai/types.ts
git commit -m "feat(web): multimodal ChatMessage content parts"
```

---

### Task 3: AI provider settings shape + migration (web-app)

**Files:**
- Modify: `packages/web-app/src/lib/settings.ts`

**Interfaces:**
- Produces:
  - `type AiProviderId = "webllm" | "openai" | "anthropic" | "gemini" | "grok"`
  - `AppSettings.ai: AiSettings` where `AiSettings = { activeProvider: AiProviderId | null; providers: Record<AiProviderId, { apiKey?: string; model: string }> }`
  - `AI_PROVIDER_MODELS: Record<AiProviderId, { id: string; label: string }[]>`
  - `isAiConfigured(settings): boolean` (active provider set + configured)
  - keeps existing `AI_MODELS` (now = the WebLLM catalog) for backward references.

- [ ] **Step 1: Add provider catalogs and the AiSettings shape**

In `packages/web-app/src/lib/settings.ts`, after `AI_MODELS`, add:

```ts
export type AiProviderId = "webllm" | "openai" | "anthropic" | "gemini" | "grok";

/** Selectable models per provider (starting defaults; custom ids allowed in UI). */
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
    openai: { apiKey: "", model: AI_PROVIDER_MODELS.openai[0].id },
    anthropic: { apiKey: "", model: AI_PROVIDER_MODELS.anthropic[0].id },
    gemini: { apiKey: "", model: AI_PROVIDER_MODELS.gemini[0].id },
    grok: { apiKey: "", model: AI_PROVIDER_MODELS.grok[0].id },
  },
};

/** AI is usable iff an active provider is selected and configured. */
export function isAiConfigured(settings: AppSettings): boolean {
  const id = settings.ai.activeProvider;
  if (!id) return false;
  if (id === "webllm") return Boolean(settings.ai.providers.webllm.model);
  return Boolean(settings.ai.providers[id].apiKey?.trim());
}
```

- [ ] **Step 2: Replace the AI fields in `AppSettings` + `DEFAULTS`**

Change the `AppSettings` interface: remove `aiEnabled: boolean;` and `aiModel: string;`, add `ai: AiSettings;`. In `DEFAULTS`, remove `aiEnabled`/`aiModel`, add `ai: AI_DEFAULTS`.

- [ ] **Step 3: Migrate legacy AI settings in `hydrateSettings`**

In `hydrateSettings`, after computing `cache` from `stored`/`legacy`, normalize the AI block (handles users on the old `aiEnabled`/`aiModel` shape). Add a helper and call it in both the `stored` and `legacy` branches:

```ts
function migrateAi(raw: Partial<AppSettings> & { aiEnabled?: boolean; aiModel?: string }): AiSettings {
  if (raw.ai) {
    // Deep-fill missing providers/keys against defaults.
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
  // Legacy: fold aiModel into webllm; stay OFF (user re-opts-in).
  return {
    ...AI_DEFAULTS,
    providers: {
      ...AI_DEFAULTS.providers,
      webllm: { model: raw.aiModel || AI_MODELS[0].id },
    },
  };
}
```

Then where `cache` is assigned from `stored`/`legacy`, set `cache = { ...DEFAULTS, ...stored, ai: migrateAi(stored as never) }` (and the analogous line for `legacy`). Keep the existing spread of other fields.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @repruvia/web-app typecheck`
Expected: FAILS only where old `aiEnabled`/`aiModel` are still read (`SettingsSections.tsx`, `aiRefine.tsx`, `AiRefineButton` indirectly). Those are fixed in Tasks 8–9 — proceed; do NOT add back the old fields.

- [ ] **Step 5: Commit**

```bash
git add packages/web-app/src/lib/settings.ts
git commit -m "feat(web): multi-provider AI settings shape + migration"
```

---

### Task 4: Field-refine prompt gains an optional screenshot (web-app)

**Files:**
- Modify: `packages/web-app/src/lib/ai/reportPrompt.ts`

**Interfaces:**
- Consumes: `ContentPart` from `./types`.
- Produces: `buildFieldRefineMessages(field, current, report, screenshot?: string | null): ChatMessage[]` — when `field === "step"` and `screenshot` is a data URL, the user message content is `ContentPart[]` with a trailing image part.

- [ ] **Step 1: Update the builder**

In `reportPrompt.ts`, add the import and replace `buildFieldRefineMessages`:

```ts
import type { ChatMessage, ContentPart } from "./types";
```

```ts
export function buildFieldRefineMessages(
  field: RefineField,
  current: string,
  report: Report,
  screenshot?: string | null,
): ChatMessage[] {
  const userText =
    field === "step"
      ? `Rewrite this step line${screenshot ? " (a screenshot of the step is attached)" : ""}:\n${current || "(empty)"}`
      : [
          `Current ${field}:`,
          current || "(empty)",
          "",
          "Session context for grounding:",
          sessionContext(report),
        ].join("\n");

  const userContent: string | ContentPart[] =
    field === "step" && screenshot
      ? [
          { type: "text", text: userText },
          { type: "image", dataUrl: screenshot },
        ]
      : userText;

  return [
    { role: "system", content: REFINE_SYSTEM[field] },
    { role: "user", content: userContent },
  ];
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @repruvia/web-app typecheck`
Expected: PASS for this file (callers updated in Task 8).

- [ ] **Step 3: Commit**

```bash
git add packages/web-app/src/lib/ai/reportPrompt.ts
git commit -m "feat(web): attach step screenshot to refine prompt"
```

---

### Task 5: Cloud provider engines (OpenAI, Grok, Anthropic, Gemini)

**Files:**
- Create: `packages/web-app/src/lib/ai/providers/proxyJson.ts`
- Create: `packages/web-app/src/lib/ai/providers/openaiProvider.ts`
- Create: `packages/web-app/src/lib/ai/providers/anthropicProvider.ts`
- Create: `packages/web-app/src/lib/ai/providers/geminiProvider.ts`

**Interfaces:**
- Consumes: `extensionBridge.proxyFetch` (`{ url, method, headers, body?: Blob }` → `{ status, statusText, bodyText }`), `ChatMessage`/`ContentPart`/`partsOf`/`textOf`/`dataUrlToBase64`, `LlmEngine`.
- Produces:
  - `proxyJson(url, headers, payload): Promise<unknown>` — POST JSON via the proxy, parse the response, throw on non-2xx.
  - `class OpenAiCompatibleEngine implements LlmEngine` (used by OpenAI **and** Grok — constructor takes `{ baseUrl, apiKey, model }`).
  - `class AnthropicEngine implements LlmEngine`.
  - `class GeminiEngine implements LlmEngine`.

- [ ] **Step 1: Shared proxy-JSON helper**

```ts
// packages/web-app/src/lib/ai/providers/proxyJson.ts
import { extensionBridge } from "@/lib/extensionBridge";

/** POST a JSON payload through the extension proxy and return the parsed body. */
export async function proxyJson(
  url: string,
  headers: Record<string, string>,
  payload: unknown,
): Promise<unknown> {
  const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const res = await extensionBridge.proxyFetch({
    url,
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`AI request failed (${res.status}). ${res.bodyText.slice(0, 300)}`);
  }
  try {
    return JSON.parse(res.bodyText);
  } catch {
    throw new Error("AI request returned a non-JSON response.");
  }
}
```

- [ ] **Step 2: OpenAI-compatible engine (OpenAI + Grok)**

```ts
// packages/web-app/src/lib/ai/providers/openaiProvider.ts
import type { ChatMessage, GenerateOptions, LlmEngine } from "../types";
import { partsOf } from "../types";
import { proxyJson } from "./proxyJson";

interface OpenAiConfig {
  baseUrl: string; // e.g. https://api.openai.com/v1 or https://api.x.ai/v1
  apiKey: string;
  model: string;
}

function toOpenAiContent(content: ChatMessage["content"]) {
  if (typeof content === "string") return content;
  return partsOf(content).map((p) =>
    p.type === "text"
      ? { type: "text", text: p.text }
      : { type: "image_url", image_url: { url: p.dataUrl } },
  );
}

/** OpenAI Chat Completions API; also serves xAI Grok (same wire format). */
export class OpenAiCompatibleEngine implements LlmEngine {
  constructor(private config: OpenAiConfig) {}

  isSupported(): Promise<boolean> {
    return Promise.resolve(true);
  }
  init(): Promise<void> {
    return Promise.resolve();
  }

  async generate(messages: ChatMessage[], _options: GenerateOptions = {}): Promise<string> {
    const body = {
      model: this.config.model,
      temperature: 0.4,
      max_tokens: 1024,
      messages: messages.map((m) => ({ role: m.role, content: toOpenAiContent(m.content) })),
    };
    const data = (await proxyJson(`${this.config.baseUrl}/chat/completions`, {
      authorization: `Bearer ${this.config.apiKey}`,
    }, body)) as { choices?: { message?: { content?: string } }[] };
    return (data.choices?.[0]?.message?.content ?? "").trim();
  }
}
```

- [ ] **Step 3: Anthropic engine**

```ts
// packages/web-app/src/lib/ai/providers/anthropicProvider.ts
import type { ChatMessage, GenerateOptions, LlmEngine } from "../types";
import { dataUrlToBase64, partsOf, textOf } from "../types";
import { proxyJson } from "./proxyJson";

function toAnthropicContent(content: ChatMessage["content"]) {
  return partsOf(content).map((p) =>
    p.type === "text"
      ? { type: "text", text: p.text }
      : {
          type: "image",
          source: (() => {
            const { mediaType, base64 } = dataUrlToBase64(p.dataUrl);
            return { type: "base64", media_type: mediaType, data: base64 };
          })(),
        },
  );
}

export class AnthropicEngine implements LlmEngine {
  constructor(private config: { apiKey: string; model: string }) {}

  isSupported(): Promise<boolean> {
    return Promise.resolve(true);
  }
  init(): Promise<void> {
    return Promise.resolve();
  }

  async generate(messages: ChatMessage[], _options: GenerateOptions = {}): Promise<string> {
    // Anthropic takes `system` at the top level, not as a message.
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => textOf(m.content))
      .join("\n");
    const turns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: toAnthropicContent(m.content) }));

    const data = (await proxyJson(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      { model: this.config.model, max_tokens: 1024, system, messages: turns },
    )) as { content?: { type: string; text?: string }[] };
    return (data.content?.find((c) => c.type === "text")?.text ?? "").trim();
  }
}
```

- [ ] **Step 4: Gemini engine**

```ts
// packages/web-app/src/lib/ai/providers/geminiProvider.ts
import type { ChatMessage, GenerateOptions, LlmEngine } from "../types";
import { dataUrlToBase64, partsOf, textOf } from "../types";
import { proxyJson } from "./proxyJson";

function toGeminiParts(content: ChatMessage["content"]) {
  return partsOf(content).map((p) => {
    if (p.type === "text") return { text: p.text };
    const { mediaType, base64 } = dataUrlToBase64(p.dataUrl);
    return { inlineData: { mimeType: mediaType, data: base64 } };
  });
}

export class GeminiEngine implements LlmEngine {
  constructor(private config: { apiKey: string; model: string }) {}

  isSupported(): Promise<boolean> {
    return Promise.resolve(true);
  }
  init(): Promise<void> {
    return Promise.resolve();
  }

  async generate(messages: ChatMessage[], _options: GenerateOptions = {}): Promise<string> {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => textOf(m.content))
      .join("\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: toGeminiParts(m.content) }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
    const data = (await proxyJson(url, {}, {
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
    })) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return (data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "").trim();
  }
}
```

- [ ] **Step 5: Verify**

Run: `pnpm --filter @repruvia/web-app typecheck && pnpm --filter @repruvia/web-app lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web-app/src/lib/ai/providers/
git commit -m "feat(web): OpenAI/Grok, Anthropic, Gemini AI engines via proxy"
```

---

### Task 6: WebLLM engine adapted to content parts (web-app)

**Files:**
- Modify: `packages/web-app/src/lib/ai/webLlmEngine.ts`

**Interfaces:**
- Consumes: `ChatMessage` (now `string | ContentPart[]`), `partsOf`, `textOf`.
- Produces: `webLlmEngine.generate` accepts multimodal messages — converts image parts to OpenAI-style `image_url` (the underlying WebLLM API is OpenAI-shaped); for non-VLM models it drops image parts to text so text models still work.

- [ ] **Step 1: Convert content before sending to WebLLM**

In `webLlmEngine.ts`, import helpers and map message content. Add near the top:

```ts
import { partsOf, textOf, type ChatMessage } from "./types";

/** WebLLM mirrors OpenAI content; VLMs accept image_url, text models need strings. */
function toWebLlmMessages(messages: ChatMessage[], allowImages: boolean) {
  return messages.map((m) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    if (!allowImages) return { role: m.role, content: textOf(m.content) };
    return {
      role: m.role,
      content: partsOf(m.content).map((p) =>
        p.type === "text"
          ? { type: "text", text: p.text }
          : { type: "image_url", image_url: { url: p.dataUrl } },
      ),
    };
  });
}

function isVisionModel(model: string): boolean {
  return /vision/i.test(model);
}
```

In both `engine.chat.completions.create({ messages, ... })` calls inside `generate`, replace `messages` with `toWebLlmMessages(messages, isVisionModel(primaryModel()))`. (Import `primaryModel` is local; it already exists in this file.)

Update the `generate` signature's existing `messages: ChatMessage[]` import to the local `ChatMessage` (now multimodal) — the type import already comes from `./types`, so no signature change is needed.

- [ ] **Step 2: Verify**

Run: `pnpm --filter @repruvia/web-app typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/web-app/src/lib/ai/webLlmEngine.ts
git commit -m "feat(web): WebLLM engine accepts multimodal content"
```

---

### Task 7: AI provider registry (web-app)

**Files:**
- Create: `packages/web-app/src/lib/ai/aiProviderRegistry.ts`

**Interfaces:**
- Consumes: `AppSettings`/`AiProviderId`/`isAiConfigured`, the engines from Tasks 5–6, `webLlmEngine`.
- Produces: `buildActiveEngine(settings: AppSettings): LlmEngine | null` and `isVisionProvider(settings): boolean`.

- [ ] **Step 1: Implement the registry**

```ts
// packages/web-app/src/lib/ai/aiProviderRegistry.ts
import { isAiConfigured, type AppSettings } from "@/lib/settings";
import type { LlmEngine } from "./types";
import { webLlmEngine } from "./webLlmEngine";
import { OpenAiCompatibleEngine } from "./providers/openaiProvider";
import { AnthropicEngine } from "./providers/anthropicProvider";
import { GeminiEngine } from "./providers/geminiProvider";

/** The active AI engine for the user's settings, or null when AI is off/unconfigured. */
export function buildActiveEngine(settings: AppSettings): LlmEngine | null {
  if (!isAiConfigured(settings)) return null;
  const { activeProvider, providers } = settings.ai;
  switch (activeProvider) {
    case "webllm":
      return webLlmEngine; // model read from settings inside the engine
    case "openai":
      return new OpenAiCompatibleEngine({
        baseUrl: "https://api.openai.com/v1",
        apiKey: providers.openai.apiKey ?? "",
        model: providers.openai.model,
      });
    case "grok":
      return new OpenAiCompatibleEngine({
        baseUrl: "https://api.x.ai/v1",
        apiKey: providers.grok.apiKey ?? "",
        model: providers.grok.model,
      });
    case "anthropic":
      return new AnthropicEngine({ apiKey: providers.anthropic.apiKey ?? "", model: providers.anthropic.model });
    case "gemini":
      return new GeminiEngine({ apiKey: providers.gemini.apiKey ?? "", model: providers.gemini.model });
    default:
      return null;
  }
}

/** Whether the active provider can accept images (gates sending screenshots). */
export function isVisionProvider(settings: AppSettings): boolean {
  const id = settings.ai.activeProvider;
  if (!id) return false;
  if (id === "webllm") return /vision/i.test(settings.ai.providers.webllm.model);
  return true; // the cloud defaults are all vision-capable
}
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @repruvia/web-app typecheck && pnpm --filter @repruvia/web-app lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/web-app/src/lib/ai/aiProviderRegistry.ts
git commit -m "feat(web): active AI engine registry"
```

---

### Task 8: Route refine through the active engine + pass screenshots (web-app)

**Files:**
- Modify: `packages/web-app/src/hooks/aiRefine.tsx`
- Modify: `packages/web-app/src/components/molecules/AiRefineButton.tsx`
- Modify: `packages/web-app/src/components/organisms/StepCard.tsx`

**Interfaces:**
- Consumes: `buildActiveEngine`, `isVisionProvider`, `loadSettings`, `isAiConfigured`, `buildFieldRefineMessages(field, current, report, screenshot?)`.
- Produces: `useAiRefine()` returns `{ available, refine }` where `refine(field, current, screenshot?)`. `AiRefineButton` gains an optional `screenshot?: string | null` prop forwarded to `refine`.

- [ ] **Step 1: Rebuild `aiRefine.tsx` around the registry**

Replace the body of `AiRefineProvider` and the `refine` callback:

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Report } from "@repruvia/shared";
import { buildActiveEngine, isVisionProvider } from "@/lib/ai/aiProviderRegistry";
import { buildFieldRefineMessages, formatStepMarkdown, type RefineField } from "@/lib/ai/reportPrompt";
import { isAiConfigured, loadSettings } from "@/lib/settings";

interface AiRefineContextValue {
  available: boolean;
  refine: (field: RefineField, current: string, screenshot?: string | null) => Promise<string>;
}

const AiRefineContext = createContext<AiRefineContextValue | null>(null);
const MODEL_TOAST_ID = "ai-refine-model";

export function AiRefineProvider({ report, children }: { report: Report | null; children: ReactNode }) {
  const [available, setAvailable] = useState(false);

  // Availability = a configured active provider. WebLLM additionally needs WebGPU.
  useEffect(() => {
    let active = true;
    const settings = loadSettings();
    if (!isAiConfigured(settings)) {
      setAvailable(false);
      return;
    }
    if (settings.ai.activeProvider === "webllm") {
      void import("@/lib/ai/webLlmEngine").then(({ webLlmEngine }) =>
        webLlmEngine.isSupported().then((s) => active && setAvailable(s)),
      );
    } else {
      setAvailable(true);
    }
    return () => {
      active = false;
    };
  }, []);

  const refine = useCallback(
    async (field: RefineField, current: string, screenshot?: string | null): Promise<string> => {
      if (!report) throw new Error("No report loaded.");
      const settings = loadSettings();
      const engine = buildActiveEngine(settings);
      if (!engine) throw new Error("No AI provider is configured.");

      let showedProgress = false;
      await engine.init((p) => {
        showedProgress = true;
        toast.loading(`Loading AI model… ${Math.round(p.progress * 100)}%`, { id: MODEL_TOAST_ID });
      });
      if (showedProgress) toast.dismiss(MODEL_TOAST_ID);

      const shot = field === "step" && isVisionProvider(settings) ? screenshot : null;
      const out = (await engine.generate(buildFieldRefineMessages(field, current, report, shot))).trim();
      if (!out) throw new Error("The model returned nothing. Try again.");
      return field === "step" ? formatStepMarkdown(out) : out;
    },
    [report],
  );

  return <AiRefineContext.Provider value={{ available, refine }}>{children}</AiRefineContext.Provider>;
}

export function useAiRefine(): AiRefineContextValue {
  return (
    useContext(AiRefineContext) ?? {
      available: false,
      refine: async () => {
        throw new Error("AiRefineProvider is missing.");
      },
    }
  );
}
```

- [ ] **Step 2: Add the `screenshot` prop to `AiRefineButton`**

In `AiRefineButton.tsx`, add `screenshot?: string | null` to `AiRefineButtonProps`, accept it, and pass it: change the click handler call to `onResult(await refine(field, text, screenshot))`.

- [ ] **Step 3: Pass the step screenshot in `StepCard`**

In `StepCard.tsx`, update the step refine button to include the screenshot:

```tsx
<AiRefineButton
  field="step"
  text={resolveStepText(step)}
  screenshot={step.screenshot}
  onResult={onEdit}
  label={`Refine step ${step.index} with AI`}
  className="size-9"
/>
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @repruvia/web-app typecheck && pnpm --filter @repruvia/web-app lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web-app/src/hooks/aiRefine.tsx packages/web-app/src/components/molecules/AiRefineButton.tsx packages/web-app/src/components/organisms/StepCard.tsx
git commit -m "feat(web): refine via active provider, send step screenshot"
```

---

### Task 9: AI settings UI — provider picker, per-provider config, privacy notice (web-app)

**Files:**
- Modify: `packages/web-app/src/components/organisms/SettingsSections.tsx`

**Interfaces:**
- Consumes: `AppSettings`, `AiProviderId`, `AI_PROVIDER_MODELS`, the `update` helper already in this file (writes a settings key).
- Produces: the AI section renders a provider `<Select>` (incl. an "Off" option), and for the chosen provider an API-key input (cloud) + a model `<Select>` with an optional custom-model input, plus the privacy notice. No other section changes.

- [ ] **Step 1: Replace the AI section markup**

Remove the old `aiEnabled` Switch + single `aiModel` Select. Add imports `AI_PROVIDER_MODELS`, `type AiProviderId` from `@/lib/settings`. Render:

```tsx
{/* AI section */}
<div className="flex flex-col gap-4">
  <div className="flex flex-col gap-1.5">
    <Label>AI provider</Label>
    <Select
      value={settings.ai.activeProvider ?? "off"}
      onValueChange={(v) =>
        update("ai", {
          ...settings.ai,
          activeProvider: v === "off" ? null : (v as AiProviderId),
        })
      }
    >
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="off">Off</SelectItem>
        <SelectItem value="webllm">On-device (private, no key)</SelectItem>
        <SelectItem value="openai">OpenAI</SelectItem>
        <SelectItem value="anthropic">Anthropic</SelectItem>
        <SelectItem value="gemini">Google Gemini</SelectItem>
        <SelectItem value="grok">xAI Grok</SelectItem>
      </SelectContent>
    </Select>
  </div>

  {settings.ai.activeProvider && (
    <ProviderConfig
      provider={settings.ai.activeProvider}
      config={settings.ai.providers[settings.ai.activeProvider]}
      onChange={(next) =>
        update("ai", {
          ...settings.ai,
          providers: { ...settings.ai.providers, [settings.ai.activeProvider!]: next },
        })
      }
    />
  )}

  <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
    On-device keeps everything local. Choosing a cloud provider sends report text — and, when
    refining a step, that step&apos;s screenshot — to that provider&apos;s API. API keys are stored
    locally in your browser. AI is off until you pick and configure a provider.
  </p>
</div>
```

- [ ] **Step 2: Add the `ProviderConfig` subcomponent (same file, bottom)**

```tsx
import type { AiProviderConfig } from "@/lib/settings";

function ProviderConfig({
  provider,
  config,
  onChange,
}: {
  provider: AiProviderId;
  config: AiProviderConfig;
  onChange: (next: AiProviderConfig) => void;
}) {
  const models = AI_PROVIDER_MODELS[provider];
  const isCustom = !models.some((m) => m.id === config.model);
  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      {provider !== "webllm" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-key">API key</Label>
          <Input
            id="ai-key"
            type="password"
            value={config.apiKey ?? ""}
            placeholder="Paste your API key"
            onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label>Model</Label>
        <Select
          value={isCustom ? "custom" : config.model}
          onValueChange={(v) => onChange({ ...config, model: v === "custom" ? "" : v })}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
            ))}
            <SelectItem value="custom">Custom…</SelectItem>
          </SelectContent>
        </Select>
        {isCustom && (
          <Input
            value={config.model}
            placeholder="Custom model id"
            onChange={(e) => onChange({ ...config, model: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Full build + lint**

Run: `pnpm build:shared && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS (no remaining references to `aiEnabled`/`aiModel`). If any remain, grep `rg "aiEnabled|aiModel" packages/web-app/src` and fix.

- [ ] **Step 4: Manual smoke**

1. `pnpm dev:web`; reload the local extension (`pnpm build:extension` is prod-mode — use `pnpm dev:extension`).
2. Settings → AI: provider defaults to **Off**; refine icons are hidden on a report.
3. Pick **OpenAI**, paste a key, choose a model. Open a report → Sparkles icons appear on title, description, each step.
4. Click a step's icon → step text is rewritten; the network request goes through the extension SW (no page CORS error). Title/description icons rewrite text-only.
5. Switch provider to **On-device** → still works (Phi-3.5 Vision sends the screenshot; text models don't).

- [ ] **Step 5: Commit**

```bash
git add packages/web-app/src/components/organisms/SettingsSections.tsx
git commit -m "feat(web): AI settings — provider picker, per-provider config, privacy notice"
```

---

## Self-Review

**Spec coverage:**
- Provider registry / one active provider → Tasks 5–7, 9. ✓
- Providers set (WebLLM, OpenAI, Anthropic, Gemini, Grok) → Tasks 5, 6, 7. ✓
- Image support per provider (step screenshot only) → Tasks 4, 6 (WebLLM), 5 (cloud), 8 (wiring + `isVisionProvider` gate). ✓
- Transport via PROXY_FETCH + allowlist → Tasks 1, 5. ✓
- Settings shape, migration, off-by-default → Task 3 (`isAiConfigured`, `activeProvider: null`). ✓
- AI settings UI + privacy notice → Task 9. ✓
- Per-field refine unchanged otherwise (title/description text-only) → Task 4, 8. ✓

**Placeholder scan:** No TBD/TODO; every code step has real code. ✓

**Type consistency:** `AiProviderId`, `AiSettings`, `AiProviderConfig`, `isAiConfigured` (Task 3) are used consistently in Tasks 7–9. `buildActiveEngine`/`isVisionProvider` (Task 7) used in Task 8. `ContentPart`/`partsOf`/`textOf`/`dataUrlToBase64` (Task 2) used in Tasks 5, 6. `buildFieldRefineMessages(field, current, report, screenshot?)` (Task 4) called in Task 8. `proxyFetch` shape matches `extensionBridge.proxyFetch`. ✓

**Note:** No new web-app test runner is introduced (the repo has none); web-app tasks gate on typecheck/lint/build + the Task 9 manual smoke. The one new automated test is the shared allowlist test (Task 1).
```
