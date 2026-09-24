# CLAUDE.md

Guidance for working in the Repruvia repo. Read this before making changes.

## What this is

Repruvia is an **open-source Chrome MV3 extension + React web app** that turns a recording session into a structured bug report submittable to Linear/Jira. **Client-first, no telemetry**: capture, recordings, screenshots, and API keys never leave the browser/extension. An **optional Firebase backend** (signed-in users only, free Spark plan: Auth + Cloud Firestore + Hosting) adds account sync of non-secret preferences and ticket history — see "Firebase" below. No Analytics, by explicit decision. Product spec is `Repruvia-PRD.md`; technical spec is `Repruvia-TRD.md`. Read the relevant section of those before building a feature.

## Monorepo layout

pnpm workspaces. One dependency direction: **both apps depend on `shared`; `shared` depends on nothing.** There is no server-side code: the optional backend is Firebase Auth + Cloud Firestore + Hosting, all on the free **Spark** plan (no Cloud Functions, no Cloud SQL).

```
packages/
├── shared/       # @repruvia/shared — domain types + pure logic (no DOM, no chrome.*, no React)
├── extension/    # @repruvia/extension — MV3 capture engine (CRXJS + Vite + TS, no UI framework)
└── web-app/      # @repruvia/web-app — React 19 report builder (Vite + Tailwind v4 + shadcn/ui)
firestore.rules   # Cloud Firestore security rules (the whole backend config; deployed with hosting)
```

## Non-negotiable rules

1. **SOLID.** New capture concerns implement an interface and are injected, not hard-wired. New ticket integrations implement the shared `TicketProvider` interface — never branch on provider type in the UI. Keep `RecordingController` the only extension module that touches `chrome.action`/`chrome.tabs`.
2. **UI / logic separation (web app).** Components are presentational: they take data + callbacks and render. **All** behaviour — async, effects, derivations, persistence — lives in `hooks/`, `store/`, or `lib/`. If a component has a `useEffect` doing real work, it belongs in a hook.
3. **Atomic structure (web app).** `components/ui` (shadcn) → `atoms` → `molecules` → `organisms` → `pages`. A component only imports from its own layer or below.
4. **Use shadcn/ui — don't hand-roll base components.** Add primitives with `pnpm dlx shadcn@latest add <name>` (run inside `packages/web-app`). `components/ui/**` is generated and ESLint-ignored; don't hand-edit it. Build features by composing primitives.
   - **Theming** — light/dark/system via `ThemeProvider` + `useTheme` (`lib/theme.tsx`); toggles `.dark` on `<html>`, persists to `localStorage("repruvia.theme")`. An inline script in `index.html` sets the class pre-paint (no flash). `ThemeToggle` (header) switches Light/Dark/System; both token sets already exist in `index.css` (`:root` light, `.dark`). Sonner toaster follows `resolvedTheme`.
   - **Design system** (committed "technical terminal" aesthetic — keep it cohesive, avoid generic "AI slop"): deep slate background (never pure black), a single **lime-green** brand accent (`--primary`; do NOT introduce AI-purple/indigo or gradient text), distinctive type — **Space Grotesk** (`font-display`, auto-applied to h1–h4) / **Plus Jakarta Sans** (`font-sans`) / **JetBrains Mono** (`font-mono`, for code/selectors/errors). Atmosphere = faint dotted grid + soft top glow on `body::before` (subtle, not neon). Prefer left-aligned/asymmetric layouts (bento) over centered heroes and 3-equal-card rows. All color comes from theme tokens in `src/index.css`, so restyling = editing tokens, not components.
5. **Verify with fresh data.** Before adopting a library/API pattern, check current docs (versions and APIs move). Several TRD patterns were intentionally modernized — see "Decisions" below.
6. **Privacy.** Never capture input *values* — only labels/placeholders/field names. Never render DOM metadata as HTML. Session data leaves the browser only on an explicit ticket submission (or an explicit AI refine). **Never sync credentials, recordings, or screenshots to Firebase** — only the non-secret fields in `lib/cloud/settingsSync.ts` and ticket links. Every Firestore document must live under `users/{uid}` so `firestore.rules` can scope it to its owner; never add a collection a signed-in user could read across uids.
7. **Keep it typed.** No `any` in new code. Message channels use the discriminated unions in `shared/src/types/messaging.ts` — extend those, don't invent ad-hoc shapes.

## Commands

```bash
pnpm install
pnpm build:shared          # ALWAYS build shared first; the apps import its dist/
pnpm dev:web               # web app → http://localhost:3000
pnpm dev:extension         # extension watch build → packages/extension/dist/
pnpm typecheck             # tsc across all packages
pnpm lint                  # eslint across all packages (root flat config)
pnpm build                 # production build of everything (what CI runs)
pnpm --filter @repruvia/shared test   # vitest for pure logic
pnpm -r test                          # every package's tests
pnpm emulators             # local Auth (9099) / Firestore (8080) / Hosting (set VITE_FIREBASE_EMULATORS=true)
pnpm deploy                # build everything + firebase deploy (hosting + firestore rules)
pnpm firebase <cmd>        # pinned Firebase CLI via npx (e.g. `pnpm firebase login`)
```

Load the extension: `chrome://extensions` → Developer Mode → **Load unpacked** → `packages/extension/dist/`. Copy the extension ID into `packages/web-app/.env.local` as `VITE_EXTENSION_ID`.

**Definition of done for any change:** `pnpm typecheck && pnpm lint && pnpm build` all pass, and pure logic added to `shared` has a vitest test.

## How to extend (playbooks)

**Add a ticket provider (e.g. GitHub Issues):**
1. Create `packages/web-app/src/lib/integrations/githubProvider.ts` implementing `TicketProvider` from `@repruvia/shared`.
2. Register it in `lib/integrations/providerRegistry.ts` and add its `ProviderId`.
3. Add a button in `organisms/SubmitBar.tsx`. The dialog (`SubmitDialog.tsx`) and `useTicketSubmission` need no changes.

**Inline screenshots in tickets.** Both providers embed screenshots *inline in the issue body*, not just as attachment cards. The hook passes `markdownBody` (rendered `screenshots: "omit"`) + `reportedBy` + the `attachments`; each provider uploads the images, then re-renders the body with `exportReportToMarkdown(report, { screenshots: "link", screenshotPath })` mapping each step to its uploaded URL/id (filename via the shared `screenshotAttachmentName(index)`). **Linear:** `fileUpload` → embed the returned `assetUrl` as `![](assetUrl)` (no `attachmentCreate`). **Jira:** create issue → upload attachments (capture each attachment id) → PUT the description as ADF with `media` nodes (`markdownToAdf`'s `resolveMedia` maps an image path → `{ id }`). All best-effort: a failed upload drops just that image (the exporter skips empty `link` paths), never the issue. Browser→Jira CORS can still block these calls.

**Settings** is a two-pane page (`SettingsPage` + `SettingsSections` organisms): left nav (Profile / Integrations / AI) → right panel renders the active section. Persisted as `AppSettings` in the web app's IndexedDB (`repruvia_web` → `settings` store, via shared `lib/db.ts`). `loadSettings()` stays **synchronous** by reading an in-memory cache; `hydrateSettings()` fills it from IndexedDB once at startup in `main.tsx` (before first render) and migrates the legacy localStorage value. `saveSettings()` updates the cache + writes through to IndexedDB. AI section drives `aiEnabled` (hides the Refine card) and `aiModel` (read by `webLlmEngine`; applies on next reload). `AI_MODELS` lists selectable WebLLM models.

**Edits persist locally.** The extension's captured session is immutable; the tester's edit layer (title, severity, description, per-step edits, reorder/delete — including AI refinements) is saved to the **web app's own IndexedDB** (`repruvia_web` DB, `reports` store, keyed by session id) via `reportPersistence.ts`. The store restores it on load (`setSession(session, persisted)` — both fetched in parallel in `useSessionLoader`) and a debounced store subscription writes on every change. Deleting a recording also deletes its persisted edits. Screenshots are never stored here (re-fetched from the extension).

**Markdown export = single self-contained `.md`.** "Export Markdown" downloads one `.md` (`useMarkdownExport` → `downloadTextFile`) with screenshots inlined as base64 data URLs (`exportReportToMarkdown(report, { screenshots: "embed" })`). `exportReportToMarkdown` still supports `screenshots: "embed" | "link" | "omit"` (+ `screenshotPath` for `"link"`): clipboard copy (`reportText.ts`) and ticket submission use `"omit"` (images upload as real attachments), `"link"` remains available for a ZIP-style export. (Previously the export produced a fflate ZIP with linked images; that was replaced by inline-embed at the user's request.)

**Rich text editor.** The report **description** uses a Slack-style WYSIWYG editor (`RichTextEditor`, TipTap v3 + `@tiptap/markdown` + Link + Placeholder) whose source of truth is **Markdown** (`editor.getMarkdown()` / `setContent(md, { contentType: "markdown" })`), so it stays compatible with the exporter and Linear/Jira. External value changes (e.g. AI fills the description) re-sync via a `lastMarkdown` ref guard so typing doesn't loop/jump. `ReportBuilderPage` is **lazy-loaded** (`React.lazy`) so TipTap stays out of the initial bundle (Home entry ~317 KB; editor loads only when a recording opens).

**Step data & Markdown.** `DomEvent` carries rich, privacy-safe context per step — `role`, `name`, `title`, `alt`, `testId` (data-testid/test/cy/qa), a readable `selector`, `checked` — captured in `content/dom/elementMetadata.ts` and fed to the AI prompt for better descriptions. `generateDescription` emits **Markdown** (paths/tags wrapped in `` `code` ``); step descriptions render via the `MarkdownText` atom (react-markdown, inline, code-highlighted) and the inline editor edits raw Markdown. Never capture input *values* — only labels/attributes.

**Add a capture signal in the extension:**
1. Add a variant to the relevant union in `shared/src/types/messaging.ts`.
2. Emit it from the right world — page globals → MAIN-world `content/inpage/*`; DOM → ISOLATED `content/`; network-from-devtools → `devtools/`.
3. Handle it in `SessionRecorder` (assembly) and route it in `background/recordingController.ts` + `background/index.ts`.

**Add domain logic:** put pure functions in `packages/shared/src/logic/`, export from `index.ts`, add a `*.test.ts`. Never put `chrome.*`/DOM/React in `shared`.

## Decisions that deviate from the TRD (and why)

- **No video recording.** The TRD specs a tab-capture/offscreen video recording feature; it was **removed** (unreliable across Chrome builds, and the core value — steps + screenshots + console/network — doesn't need it). Don't re-add it without an explicit ask. The `tabCapture`/`offscreen` permissions, offscreen document, video IndexedDB store, and `GET_VIDEO` channel are all gone.
- **Recordings library.** Sessions are persisted in the extension's IndexedDB (pruned after 7 days). The web app's Home page lists them via `LIST_SESSIONS`, which returns lightweight `SessionSummary` objects (no steps/screenshots — the full session loads on open via `GET_SESSION`). `useRecordings` doubles as the extension-availability probe: a successful list ⇒ installed (Home shows the library), an `ExtensionUnavailableError` ⇒ not installed (Home shows the install prompt). Don't go back to listing full sessions — it transfers megabytes of base64 over the message channel.
- **Firebase (optional backend, project `repruvia`, free Spark plan).** Everything used here is Spark-tier: **Auth**, **Cloud Firestore**, **Hosting**. Cloud Functions and SQL Connect (Data Connect / Cloud SQL) were **removed** — they require Blaze. Don't reintroduce a Function or a SQL Connect operation; put the logic in the client against Firestore instead. `lib/firebase/app.ts` initializes the app (config is public; `VITE_FIREBASE_*` overrides). **Auth**: Google sign-in via `AuthProvider`/`useAuth` (`hooks/auth.tsx`), header `AccountMenu`, Settings → Account (ticket history). The `firebase/auth` SDK is **dynamically imported** (`lib/firebase/auth.ts`) for the same reason Firestore is — signed-out visitors never pay for it; keep it that way. `onUserChanged` stays synchronous (listeners registered before the chunk resolves are buffered), but there is no synchronous `currentUser()` — use `await signedInUser()`. **Firestore** (`lib/cloud/firestore.ts` — SDK dynamically imported so it stays out of the initial bundle; `connectFirestoreEmulator` on localhost:8080 when `VITE_FIREBASE_EMULATORS=true`): the data model is `users/{uid}` (synced settings: reporterName, reporterEmail, jiraSite, jiraEmail, aiProvider, `aiModels` map, updatedAt) + `users/{uid}/tickets/{sourceId}` (sourceKind, provider, identifier, url, title, createdAt). Rules live in `firestore.rules`; a subcollection under the uid keeps every rule owner-scoped and `orderBy(createdAt desc)` inside one user's tickets needs no composite index. Settings: on sign-in the account's copy wins (or local settings seed a new account), later local saves push (`subscribeSettings` in `lib/settings.ts`, origin `"local" | "cloud"`) — see `lib/cloud/settingsSync.ts`. Tickets: IndexedDB first, mirrored to the account when signed in (`lib/ticketPersistence.ts` → `lib/cloud/ticketSync.ts`). Documents are read back through the shared coercion helpers (`toText`/`toOptionalString`/`toStringRecord`/`toIsoTimestamp` in `shared/src/logic/cloudDoc.ts`) — never trust a stored field's type. **Tickets route**: providers take an `HttpTransport` (`lib/integrations/transport.ts`); `ticketTransport(fallback)` sends through the **extension service worker**, which is CORS-free via `host_permissions` (so Jira Cloud works without any server), and falls back to a direct browser fetch only when the extension itself is unreachable — never after a call that may have reached the provider. **AI** is entirely client-side (BYO API key per provider, `lib/ai/`); there is no Firebase AI / Gemini-via-Firebase path — don't add one, it needs Blaze. **App Check**: opt-in via `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`. **Hosting**: `firebase.json` serves `packages/web-app/dist` (SPA rewrite); the extension's production web-app URL is `https://repruvia.web.app`.
- **Firebase MCP** is configured in `.mcp.json` (`firebase-tools mcp`); it needs `pnpm firebase login` once.
- **shadcn registry gotcha:** `shadcn add avatar` (latest and 2.5) currently emits `import { cn } from "cn"` + the `radix-ui` umbrella package — broken for this repo. Check generated imports/deps after any `shadcn add`.
- **In-browser AI (WebLLM).** The "AI-enhanced" PRD feature is an opt-in, on-device LLM (WebGPU via `@mlc-ai/web-llm`) — no backend, no API key. **Per-field inline refine**: a Sparkles `AiRefineButton` sits on the report title, the description, and every step row; clicking it rewrites just that field with the model and applies it through the existing store setters. Availability + lazy model load (progress shown as a toast, ~0.9 GB cached after first use) are shared via `AiRefineProvider` (`hooks/aiRefine.tsx`); buttons render nothing when AI is off in Settings or WebGPU is unsupported. Plain-text generation per field via `buildFieldRefineMessages(field, current, report)` in `reportPrompt.ts` (`field`: `title | description | step`). Engine lives in `web-app/src/lib/ai/` behind an `LlmEngine` interface (`webLlmEngine.ts`), runs in a Web Worker (`webllm.worker.ts`), **dynamically imported** so the lib/model stay out of the initial bundle. Add new AI backends by implementing `LlmEngine`. (The earlier single global "Analyze with AI" card + `useAiAnalysis` one-shot JSON pass was replaced by this per-field UX at the user's request; `reportPrompt.ts` still has the `ANALYSIS_SCHEMA`/`buildAnalysisMessages`/`parseAnalysis` JSON-mode helpers if a batch pass is wanted again.)
- **Two content-script worlds** — MAIN for `console`/`fetch` overrides and React fiber reads (page realm required), ISOLATED for DOM capture + `chrome.runtime` messaging.
- **Tailwind v4** (`@theme inline`, `@tailwindcss/vite`) + **shadcn new-york** + **React 19** + **CRXJS 2.6.1** (stable, Vite 6).
- **Jira uses Basic auth (email + API token)** — fine for self-host/local, but Jira Cloud restricts browser CORS; production should front it with OAuth 2.0 (3LO). The interface makes that swap UI-invisible.

## Gotchas

- esbuild's build script is allowlisted in `pnpm-workspace.yaml` (`onlyBuiltDependencies`) — pnpm 10 blocks it otherwise and Vite breaks.
- **Capture content scripts only attach to pages loaded AFTER the extension was installed/reloaded.** If steps come back empty, reload the page being recorded. (CRXJS hashes content-script filenames, so programmatic `scripting.executeScript` injection isn't a clean fallback.) `RecordingController.toggleCapture` logs a warning to the SW console when the script is unreachable. Recording works on any site — localhost only matters for the web app ↔ extension link.
- `addEvent` (and thus `ScreenshotCapturer.capture`) runs **concurrently per interaction** — the capturer serializes + throttles calls (`captureVisibleTab` is hard-limited to ~2/sec) and retries transient failures, so steps don't silently lose screenshots.
- **A screenshot is skipped when the recorded tab isn't the one on screen.** `captureVisibleTab` photographs whatever tab is *active* in the given window, and captures are deliberately delayed, so a `target="_blank"` click or a tab switch would otherwise store another tab's content (a privacy leak, since it ships to Linear/Jira on submit). `ScreenshotCapturer.capture` takes a **resolver** (`() => CaptureTarget`), re-reads it on every attempt, and verifies the tab is still active in the target window (`isCaptureTargetVisible` in `shared`) right before capturing — returning `null` otherwise. The resolver is also what makes a queued capture follow a tab dragged to another window. The step keeps its data and simply has no image; nothing tells the user why.
- **Coalesce `input` events** — capturing per keystroke creates one step + one screenshot per character and blows the captureVisibleTab quota. `DomEventObserver` debounces input per field (700ms) into a single step; flushed on any other interaction or stop.
- `SessionRecorder.finish()` awaits in-flight (throttled) captures so trailing steps aren't dropped when recording stops.
- **Recording survives MV3 worker suspension.** The active `{sessionId, tabId, windowId}` lives in `chrome.storage.session`; `RecordingController` restores it on wake (`whenReady()` — every handler awaits it) and resumes from the last IndexedDB save. Mid-recording saves are throttled to 1/sec (each save re-serializes all screenshots). Closing the recorded tab stops + opens the report; dragging it to another window retargets screenshots.
- **Only the recorded tab is captured.** Capture messages are filtered by `sender.tab.id` (the DevTools page has no tab, so `CAPTURE_NETWORK` carries `tabId`), and content scripts in other tabs get `idle` from `GET_RECORDING_STATE` and don't relay console/network at all.
- **Content scripts must ack every `TabCommand`** (`TabCommandAck`). The SW treats a rejected `tabs.sendMessage` as "no content script" (start refuses with an error). Stopping returns the still-debounced typing step in the ack (`pendingEvent`) so it's recorded before finalize — don't go back to emitting it as a separate message.
- Network failures with no response (network/CORS/DNS) are recorded as **status 0**; DevTools + in-page duplicates are dropped via `isDuplicateNetworkFailure` (URLs are made absolute in-page so they match).
- IndexedDB writes (both apps) resolve on transaction `complete` and reject on `abort` — a quota-exceeded write aborts without a request error, so awaiting the request alone hangs.
- Web-app keyboard shortcuts must skip typing targets via `isTypingTarget` (`lib/keyboard.ts`), which includes contenteditable — otherwise ⌘Z/Backspace/"q" hijack the TipTap editor.
- **WebLLM JSON mode needs a STRINGIFIED schema.** `response_format: { type: "json_object" }` with no schema passes `undefined` into the native `CompileJSONSchema` (wants a `std::string`) → `BindingError` thrown *in the worker*, the `create()` promise never resolves, UI hangs. Always pass `{ type: "json_object", schema: JSON.stringify(schema) }` (see `webLlmEngine.generate` + `ANALYSIS_SCHEMA`). The analysis call is also wrapped in a `withTimeout` so a stalled worker surfaces as an error, never an infinite spinner.
- **Routing reads must be reactive.** Home (`/`) and the report builder (`/?session=`) share the same `/` route — they differ only by query string, and React Router matches on pathname only. Read route/search state via router hooks (`useSearchParams`/`useLocation`), never `window.location` directly, or client-side navigation changes the URL without re-rendering the page (works on reload, not on click). `useSessionId` uses `useSearchParams`.
- If `shared` types change, rebuild it (`pnpm build:shared`) before the apps will see them.
- **Brand icons** are generated from `brand/logo.png` (the master) via `pnpm assets:icons` (`scripts/generate-icons.mjs`, uses sharp → square, transparent, aspect-preserved). It writes the extension's `icon-16/48/128` and the web app's `favicon-16/32`, `apple-touch-icon`, `icon-192/512`. To swap the logo: replace `brand/logo.png` (or pass a path) and re-run. Header/hero use `/icon-192|512.png`; `index.html` links the favicons + `site.webmanifest`; the extension manifest sets both `icons` and `action.default_icon`.
- The web app **auto-discovers the extension ID** via the `content/webappBridge.ts` content script (announces `chrome.runtime.id` to the page); `VITE_EXTENSION_ID` is only an optional override. A new web-app origin must be added in THREE places: `externally_connectable` and the `webappBridge` content-script `matches` (both in `manifest.config.ts`) and `ALLOWED_WEB_APP_ORIGINS` (`shared/src/constants.ts`). "Extension not reachable" usually means the extension wasn't reloaded after a build, or the web app is on an unlisted origin/port.

## Memory

A persistent memory note (`repruvia-architecture`) records the stack and key decisions. **When you make a decision that future sessions need** — a new architectural pattern, a non-obvious constraint, a deviation from the specs, a "we tried X and it didn't work" — update that note (or add a new one) so it isn't lost. Don't record things already captured by the code, git history, or this file.
