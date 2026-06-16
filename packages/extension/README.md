# @repruvia/extension

The Repruvia **MV3 capture engine**. Plain TypeScript (no UI framework), built with Vite + CRXJS.

## Architecture

```
src/
├── background/                 # Service worker (coordinator)
│   ├── index.ts                # Message routing for every channel
│   ├── recordingController.ts  # Lifecycle orchestration + Chrome action/tabs
│   └── recording/
│       ├── sessionRecorder.ts  # Builds steps from capture events
│       ├── screenshotCapturer.ts # interface + Chrome impl (serialized + throttled)
│       └── environment.ts        # Env capture via scripting.executeScript
├── content/
│   ├── index.ts                # ISOLATED world: DOM capture + relay
│   ├── inpage.ts               # MAIN world entry
│   ├── dom/                    # Event observer + privacy-safe metadata
│   └── inpage/                 # console / network interceptors + React bridge
├── devtools/                   # Network failure monitor
├── popup/                      # Start/stop UI (vanilla)
└── storage/                    # IndexedDB repository (behind an interface)
```

## Design notes

- **SOLID** — capture concerns are isolated single-responsibility units behind
  interfaces (`SessionRepository`, `ScreenshotCapturer`). The
  `RecordingController` is the only module that touches `chrome.action`/`tabs`.
- **Two-world content scripts** — `console`/`fetch` overrides and React fiber
  reads require the page's own JS realm (MAIN world); DOM capture and
  `chrome.runtime` messaging run sandboxed in the ISOLATED world.
- **Throttled screenshots** — `captureVisibleTab` is rate-limited (~2/sec), so
  captures are serialized with a minimum gap and retried; input events are
  coalesced per field so typing yields one step, not one per keystroke.
- **Privacy** — input *values* are never read; only labels/placeholders.

## Develop

```bash
pnpm --filter @repruvia/extension dev   # watch build → dist/
```

Load `dist/` as an unpacked extension at `chrome://extensions`.
