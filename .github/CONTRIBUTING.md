# Contributing to Repruvia

Thanks for your interest in contributing! Repruvia is MIT-licensed and community-driven.

## Development Setup

```bash
git clone https://github.com/[org]/repruvia
cd repruvia
pnpm install

# Build the shared package first (extension + web app depend on it)
pnpm build:shared

# Run the web app
pnpm dev:web        # http://localhost:3000

# Run the extension in watch mode
pnpm dev:extension  # outputs to packages/extension/dist/
```

Load the extension unpacked: `chrome://extensions` → enable Developer Mode → **Load unpacked** → select `packages/extension/dist/`.

## Architecture

This is a pnpm monorepo with three packages:

- **`packages/shared`** — Framework-agnostic domain types and pure business logic (step description generation, markdown export, severity mapping). No DOM or `chrome.*` dependencies, so both the extension and the web app reuse it.
- **`packages/extension`** — The MV3 capture engine. Plain TypeScript, organized into single-responsibility capture modules behind interfaces.
- **`packages/web-app`** — The React report builder. UI is split from logic: components are presentational (atomic design), all behaviour lives in hooks.

## Conventions

- **Conventional Commits** — `feat:`, `fix:`, `docs:`, `chore:`, etc.
- **SOLID** — capture modules implement a common `CaptureModule` interface; integration clients implement `TicketProvider`.
- **UI** — use shadcn/ui primitives; do not hand-roll base components.
- **Type-check + lint must pass** — `pnpm typecheck && pnpm lint`.

## Good First Issues

Look for issues tagged [`good first issue`](https://github.com/[org]/repruvia/labels/good%20first%20issue).
