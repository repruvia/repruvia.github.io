<div align="center">

# 🐛 Repruvia

**Record a bug or snip a screenshot, mark it up, and turn it into a clear, ready-to-submit bug report for Linear or Jira — all in your browser.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/repruvia/repruvia.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/repruvia/repruvia.github.io/actions/workflows/ci.yml)

</div>

---

Repruvia is an open-source **Chrome extension + web app** that helps you file better bug reports in two ways:

- **Record a session** — click _Start Recording_, reproduce the bug, and Repruvia captures every click, input, and navigation as a numbered step with a screenshot, plus any console errors and network failures.
- **Snip & annotate** — grab any region of the screen, then draw arrows, boxes, and text on it to point out exactly what's wrong.

Either way, you add a title and description (or let AI draft them from the image), then send the result straight to **Linear** or **Jira**, or export it as Markdown.

Everything runs in your browser. No server, no storage costs, no telemetry — your data only leaves the browser when you submit a ticket. AI drafting is optional and uses your own provider API key.

## Why Repruvia?

| Today | With Repruvia |
| --- | --- |
| Record screen, re-watch, hand-write steps | Steps captured automatically |
| Vague "it broke on checkout" | Screenshot + selector + console error per step |
| Developer asks "can you repro?" | Reproduction steps + environment baked in |
| 10+ minutes per report | < 2 minutes |

## Monorepo Layout

```
repruvia/
├── packages/
│   ├── shared/      # Framework-agnostic types + pure logic (used by both)
│   ├── extension/   # Chrome MV3 capture + snip engine (CRXJS + Vite + TS)
│   └── web-app/     # React 19 report builder + screenshot annotator (Vite + Tailwind v4 + shadcn/ui)
├── docs/            # Integration & getting-started guides
└── .github/         # CI, release, issue templates
```

## Quick Start

```bash
pnpm install
pnpm build:shared          # build the shared package first

pnpm dev:web               # web app at http://localhost:3000
pnpm dev:extension         # extension build watcher → packages/extension/dist/
```

Load the extension: `chrome://extensions` → **Developer Mode** → **Load unpacked** → `packages/extension/dist/`.

## Architecture Highlights

- **SOLID & DRY** — capture modules implement a shared `CaptureModule` interface; ticket integrations implement a `TicketProvider` interface; pure domain logic lives in `@repruvia/shared` and is reused by both artifacts.
- **UI / logic separation** — every web-app component is presentational; all behaviour lives in hooks (`useSession`, `useReportEditor`, `useTicketSubmission`, …).
- **Atomic design** — `components/ui` (shadcn primitives) → `atoms` → `molecules` → `organisms` → `pages`.
- **Robust MV3 capture** — DOM events are captured by content scripts in two execution worlds; screenshots are serialized and throttled to respect Chrome's `captureVisibleTab` rate limit so no step loses its image. The snip tool captures a drag-selected region and crops it via `OffscreenCanvas` in the service worker.
- **Screenshot annotator** — the snip editor (Konva) supports pen, arrow, box, and text, each selectable, movable, resizable, and rotatable, with undo/redo and auto-save; the flattened image can be copied, downloaded, or attached to a ticket.
- **Bring-your-own-key AI (optional)** — draft a title, description, and per-step text, or generate a title + description from an annotated screenshot, using a vision model from your chosen provider (OpenAI, Anthropic, Gemini, xAI Grok, or Groq). Requests run through the extension's allowlisted proxy (CORS-free); your API key is stored locally and nothing is sent until you click. Behind an `LlmEngine` interface, lazy-loaded so it costs nothing until used.

## Tech Stack

React 19 · Vite 6 · Tailwind CSS v4 · shadcn/ui · Zustand · React Router v7 · Konva (canvas annotation) · TipTap (Markdown editor) · CRXJS · TypeScript · pnpm workspaces.

## Privacy

Input **values are never captured** — only field labels/placeholders. Recordings and snapshots live in your browser's IndexedDB and are sent nowhere until you explicitly submit a ticket. If you enable AI, the relevant text/image is sent to your chosen provider only when you click an AI action (using your own API key). See [`packages/extension`](./packages/extension) and the [TRD](./Repruvia-TRD.md) §12.

📄 **[Privacy Policy](https://ash-larch-a05.notion.site/Repruvia-Privacy-Policy-381a0161464a80168f99c885addf346e)**

## License

[MIT](./LICENSE) © Repruvia Contributors
