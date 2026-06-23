# Getting Started

## Install (development)

1. Clone and install:
   ```bash
   git clone https://github.com/repruvia/repruvia.github.io
   cd repruvia
   pnpm install
   pnpm build:shared
   ```
2. Build the extension: `pnpm dev:extension` (watch mode).
3. Open `chrome://extensions`, enable **Developer Mode**, click **Load unpacked**, and select `packages/extension/dist/`.
4. Start the web app: `pnpm dev:web` → http://localhost:3000.

## Recording a session

1. Open the app you want to test in a Chrome tab.
2. Click the Repruvia toolbar icon → **Start Recording**. Approve the screen-share prompt.
3. Reproduce the bug. Each click / input / navigation is captured with a screenshot.
4. Click **Stop Recording**. The Repruvia web app opens with your assembled report.
5. Review steps, set a title + severity, then **Submit to Linear / Jira** or **Export Markdown**.

## Configuration

The web app **auto-discovers the extension ID** — the extension announces itself
to the `localhost:3000` / `repruvia.app` origins, so no `VITE_EXTENSION_ID` is
needed. After (re)loading the unpacked extension, just refresh the web app tab.

> If you see "Repruvia extension not reachable", reload the extension at
> `chrome://extensions` (so the new content script is active) and refresh the
> report tab. The web app must be served from an origin the extension allows
> (`http://localhost:3000` by default — see `ALLOWED_WEB_APP_ORIGINS` and the
> manifest `externally_connectable`/content-script matches).

For ticket integrations, configure credentials in the in-app **Settings** page.
See the [Linear](./linear-integration.md) and [Jira](./jira-integration.md) guides.
