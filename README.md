<div align="center">

# 🐛 Repruvia

**Turn a recording session into a structured, ready-to-submit bug report — no backend, no AI fees, all in the browser.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/leoAnimesh/repruvia/actions/workflows/ci.yml/badge.svg)](https://github.com/leoAnimesh/repruvia/actions/workflows/ci.yml)

</div>

---

Repruvia is an open-source **Chrome Extension (MV3) + React web app**. A QA tester clicks _Start Recording_, reproduces a bug, and Repruvia automatically captures every interaction — click, input, navigation — with a screenshot per step, console errors, network failures, and React component context. It then assembles a structured report you can push straight to **Linear**, **Jira**, or export as Markdown.

Everything runs client-side. No server. No storage costs. No telemetry.

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
│   ├── extension/   # Chrome MV3 capture engine (CRXJS + Vite + TS)
│   └── web-app/     # React 19 report builder (Vite + Tailwind v4 + shadcn/ui)
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
- **Robust MV3 capture** — DOM events are captured by content scripts in two execution worlds; screenshots are serialized and throttled to respect Chrome's `captureVisibleTab` rate limit so no step loses its image.
- **Optional in-browser AI** — draft a report description from the captured steps/errors with a small LLM running entirely on-device via WebGPU ([WebLLM](https://github.com/mlc-ai/web-llm)). No server, no API key, nothing leaves the browser. Behind the `LlmEngine` interface, lazy-loaded so it costs nothing until used.

## Tech Stack

React 19 · Vite 6 · Tailwind CSS v4 · shadcn/ui · Zustand · React Router v7 · CRXJS · TypeScript · pnpm workspaces.

## Privacy

Input **values are never captured** — only field labels/placeholders. Session data lives in your browser's IndexedDB and is sent nowhere until you explicitly submit a ticket. See [`packages/extension`](./packages/extension) and the [TRD](./Repruvia-TRD.md) §12.

📄 **[Privacy Policy](https://ash-larch-a05.notion.site/Repruvia-Privacy-Policy-381a0161464a80168f99c885addf346e)**

## License

[MIT](./LICENSE) © Repruvia Contributors
