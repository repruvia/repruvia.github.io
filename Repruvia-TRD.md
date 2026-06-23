# Repruvia — Technical Requirements Document (TRD)

> **Version:** 1.0.0  
> **Status:** Draft  
> **License:** MIT (Open Source)  
> **Repository:** github.com/repruvia/repruvia.github.io  

---

## 1. System Architecture Overview

Repruvia is a **fully client-side system** composed of two tightly coupled browser artifacts:

1. **Chrome Extension (MV3)** — the capture engine
2. **React Web App** — the report builder and ticket submission UI

There is no backend, no cloud storage, and no external API dependency beyond the ticket platform APIs (Linear, Jira). All data lives in the browser until the moment a ticket is submitted.

```
┌────────────────────────────────────────────────────────────┐
│                     User's Browser                         │
│                                                            │
│  ┌─────────────────────┐       ┌────────────────────────┐  │
│  │  Chrome Extension   │       │   Repruvia Web App      │  │
│  │  (Capture Engine)   │──────▶│   (Report Builder)     │  │
│  │                     │  IDB  │                        │  │
│  │  · MediaRecorder    │  msg  │  · Step viewer         │  │
│  │  · DOM event hooks  │       │  · Inline editor       │  │
│  │  · Canvas snapshots │       │  · Video playback      │  │
│  │  · Console capture  │       │  · Ticket submission   │  │
│  │  · Network monitor  │       │                        │  │
│  │  · React detection  │       │                        │  │
│  └─────────────────────┘       └──────────┬─────────────┘  │
│          │                                │                │
│          └──── IndexedDB ─────────────────┘                │
│                                           │                │
└───────────────────────────────────────────┼────────────────┘
                                            │
                          ┌─────────────────▼──────────────┐
                          │     External Ticket APIs        │
                          │  · Linear GraphQL API           │
                          │  · Jira REST API v3             │
                          │  · Markdown file export         │
                          └────────────────────────────────┘
```

---

## 2. Chrome Extension Architecture

### 2.1 Manifest V3 Overview

```json
{
  "manifest_version": 3,
  "name": "Repruvia",
  "version": "1.0.0",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "unlimitedStorage",
    "tabs",
    "webRequest"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "devtools_page": "devtools.html"
}
```

### 2.2 Extension Components

```
extension/
├── manifest.json
├── background/
│   └── background.js          # Service worker — session coordinator
├── content/
│   ├── content.js             # DOM event listener + console interceptor
│   └── react-bridge.js        # React DevTools hook reader
├── devtools/
│   ├── devtools.html          # DevTools panel entry
│   └── devtools.js            # Network request monitor
├── popup/
│   ├── popup.html             # Toolbar popup UI
│   └── popup.js               # Start/stop controls
└── shared/
    ├── storage.js             # IndexedDB abstraction layer
    └── constants.js           # Event types, message names
```

### 2.3 Data Flow Within Extension

```
User Action (click/input/navigate)
        │
        ▼
content.js — fires RepruviaEvent { type, target, timestamp, metadata }
        │
        ▼
background.js — receives via chrome.runtime.onMessage
        │
        ├── 1. Requests screenshot via chrome.tabs.captureVisibleTab()
        │
        ├── 2. Queries react-bridge.js for component info at target element
        │
        ├── 3. Appends to active session's step array in IndexedDB
        │
        └── 4. Emits session:updated to popup for live step counter
```

---

## 3. Capture Modules

### 3.1 DOM Event Capture (`content.js`)

Listens at the `document` level using event delegation. Captures:

| Event | Trigger | Metadata Captured |
|---|---|---|
| `click` | Any user click | `tagName`, `id`, `className`, `textContent`, `ariaLabel`, `href` (if anchor), `type` (if button/input), XPath selector |
| `input` | Text field change | `name`, `placeholder`, `type`, field label (from `<label for>` or `aria-labelledby`) — **never the value itself** |
| `change` | Select / checkbox / radio | `name`, selected option text (not value) |
| `popstate` | SPA route change | new `location.pathname` + `location.search` |
| `hashchange` | Hash-based routing | new `location.hash` |

**Privacy note:** Input values are never captured. Only field labels and placeholders.

**Console intercept (same content script):**
```js
const originalError = console.error;
console.error = (...args) => {
  window.postMessage({
    type: 'REPRUVIA_CONSOLE',
    level: 'error',
    message: args.map(String).join(' '),
    timestamp: Date.now()
  }, '*');
  originalError.apply(console, args);
};
```

### 3.2 Screenshot Capture (`background.js`)

On each captured event, the background service worker calls:
```js
const screenshot = await chrome.tabs.captureVisibleTab(tabId, {
  format: 'png',
  quality: 80
});
// Returns a data URL: "data:image/png;base64,..."
```

**Timing:** Screenshot is taken with a 150ms debounce after the event fires — enough time for any reactive UI update to render.

**Storage:** Stored as base64 strings in IndexedDB alongside the step object.

### 3.3 Video Recording (`background.js` + `popup.js`)

Recording is initiated from the popup:
```js
// popup.js
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { mediaSource: 'tab' },
  audio: false
});

const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'video/webm; codecs=vp9'
});

const chunks = [];
mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
mediaRecorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'video/webm' });
  // Store to IndexedDB
  storage.saveVideoBlob(sessionId, blob);
};
```

**Format:** WebM/VP9 — native browser support, no re-encoding needed.
**Storage:** Binary blob stored directly in IndexedDB as `ArrayBuffer`.

### 3.4 Network Monitor (`devtools.js`)

Requires the extension's DevTools panel to be open. Listens via:
```js
chrome.devtools.network.onRequestFinished.addListener((request) => {
  const { status } = request.response;
  if (status >= 400) {
    chrome.runtime.sendMessage({
      type: 'REPRUVIA_NETWORK_FAILURE',
      url: request.request.url,
      method: request.request.method,
      status,
      timestamp: Date.now()
    });
  }
});
```

**Fallback:** If DevTools panel isn't open, network failures are captured via `window.fetch` and `XMLHttpRequest` monkey-patching in `content.js`:
```js
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (!response.ok) {
    window.postMessage({ type: 'REPRUVIA_NETWORK', url: args[0], status: response.status }, '*');
  }
  return response;
};
```

### 3.5 React Component Detection (`react-bridge.js`)

Injected as a content script. Reads the React DevTools global hook to resolve component info at a given DOM node:
```js
function getReactComponent(element) {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) return null;

  let fiber = element._reactFiber || element[
    Object.keys(element).find(k => k.startsWith('__reactFiber'))
  ];

  if (!fiber) return null;

  // Walk up fiber tree to find named function component
  while (fiber) {
    const name = fiber.type?.displayName || fiber.type?.name;
    if (name && name !== 'div' && name !== 'span') {
      return {
        name,
        props: sanitizeProps(fiber.memoizedProps)
      };
    }
    fiber = fiber.return;
  }
  return null;
}

// Strip functions and circular refs from props
function sanitizeProps(props) {
  return Object.fromEntries(
    Object.entries(props || {})
      .filter(([, v]) => typeof v !== 'function' && typeof v !== 'object')
      .slice(0, 10) // max 10 props
  );
}
```

**Availability:** Only works on React apps in development mode (with source maps). Silently skipped if React DevTools hook not found.

---

## 4. Data Models

### 4.1 Session
```typescript
interface RepruviaSession {
  id: string;                    // uuid v4
  startedAt: number;             // Unix ms
  endedAt: number | null;
  tabUrl: string;
  environment: Environment;
  steps: Step[];
  consoleErrors: ConsoleEntry[];
  networkFailures: NetworkFailure[];
  videoBlob: ArrayBuffer | null;
}
```

### 4.2 Environment
```typescript
interface Environment {
  url: string;
  browserName: string;           // "Chrome"
  browserVersion: string;        // "124.0.6367.60"
  os: string;                    // "MacIntel" | "Win32" | "Linux x86_64"
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  userAgent: string;
  recordingStartTime: string;    // ISO 8601
}
```

### 4.3 Step
```typescript
interface Step {
  id: string;                    // uuid v4
  index: number;                 // 1-based position
  timestamp: number;             // Unix ms
  event: DOMEvent;
  screenshot: string;            // base64 PNG data URL
  reactComponent: ReactInfo | null;
  autoDescription: string;       // generated from event metadata
  editedDescription: string | null; // tester override
}
```

### 4.4 DOMEvent
```typescript
interface DOMEvent {
  type: 'click' | 'input' | 'change' | 'navigate';
  tagName: string;
  id: string | null;
  className: string | null;
  textContent: string | null;    // trimmed, max 80 chars
  ariaLabel: string | null;
  placeholder: string | null;
  fieldLabel: string | null;     // from <label> association
  href: string | null;           // for anchors
  inputType: string | null;      // for inputs
  xpath: string;
  pathname: string;              // current URL path at time of event
}
```

### 4.5 ConsoleEntry
```typescript
interface ConsoleEntry {
  level: 'error' | 'warn';
  message: string;
  timestamp: number;
  nearestStepId: string | null;  // assigned during report assembly
}
```

### 4.6 NetworkFailure
```typescript
interface NetworkFailure {
  url: string;
  method: string;
  status: number;
  timestamp: number;
  nearestStepId: string | null;
}
```

### 4.7 ReactInfo
```typescript
interface ReactInfo {
  name: string;                  // Component display name
  props: Record<string, string | number | boolean>;
}
```

---

## 5. Storage Layer (IndexedDB)

All session data is stored in the extension's IndexedDB under the database name `repruvia_db`.

### Object Stores

| Store | Key | Value |
|---|---|---|
| `sessions` | `session.id` | Full `RepruviaSession` minus videoBlob |
| `videos` | `session.id` | `ArrayBuffer` (raw video blob) |

### Abstraction (`shared/storage.js`)
```js
const DB_NAME = 'repruvia_db';
const DB_VERSION = 1;

export async function openDB() { /* ... */ }
export async function saveSession(session) { /* ... */ }
export async function saveVideoBlob(sessionId, blob) { /* ... */ }
export async function getSession(sessionId) { /* ... */ }
export async function getVideoBlob(sessionId) { /* ... */ }
export async function listSessions() { /* ... */ }
export async function deleteSession(sessionId) { /* ... */ }
```

**Size management:** Sessions older than 7 days are automatically pruned on extension startup.

---

## 6. Extension ↔ Web App Communication

The extension opens the web app in a new tab, passing the session ID as a URL param:
```
https://repruvia.app/?session=<sessionId>
```

The web app then requests the full session payload from the extension via `chrome.runtime.sendMessage`:
```js
// web-app side
const session = await chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'GET_SESSION',
  sessionId
});
```

For the video blob (binary, can be 50–200MB):
```js
// background.js (extension)
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_VIDEO') {
    storage.getVideoBlob(msg.sessionId).then(buffer => {
      sendResponse({ buffer });
    });
    return true; // async response
  }
});
```

**Security:** The extension only responds to messages from the known Repruvia web app origin (`https://repruvia.app` or `http://localhost:3000` in dev).

---

## 7. Web App Architecture

### 7.1 Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 | Animesh's existing stack, component model fits step-by-step UI |
| Build tool | Vite | Fast, simple config, good MV3 extension bundling story too |
| Styling | Tailwind CSS | Utility-first, consistent with Expo/RN patterns |
| State | Zustand | Lightweight global state for session data |
| Routing | React Router v6 | Simple — 3 routes max |
| Video | Native `<video>` | WebM plays natively, no lib needed |
| Package manager | pnpm | Workspace support for monorepo |

### 7.2 App Routes

| Route | Component | Description |
|---|---|---|
| `/` | `Home` | Landing page, extension install prompt |
| `/?session=<id>` | `ReportBuilder` | Main report review + edit screen |
| `/settings` | `Settings` | OAuth tokens for Linear / Jira |

### 7.3 Component Tree

```
App
├── Home (no session)
│   └── InstallBanner
│
└── ReportBuilder (session loaded)
    ├── ReportHeader
    │   ├── TitleInput
    │   ├── DescriptionTextarea
    │   ├── SeveritySelector
    │   └── EnvironmentBadges
    │
    ├── StepList
    │   └── StepCard (× N)
    │       ├── StepScreenshot
    │       ├── StepDescription (editable)
    │       ├── ReactComponentBadge (if present)
    │       └── StepErrors (console + network)
    │
    ├── VideoSection
    │   └── VideoPlayer
    │
    ├── ConsoleSummary
    ├── NetworkSummary
    │
    └── SubmitBar
        ├── LinearSubmitButton
        ├── JiraSubmitButton
        └── ExportMarkdownButton
```

---

## 8. Step Description Auto-Generation

Step descriptions are generated deterministically in the web app from the `DOMEvent` object. No AI needed.

```typescript
function generateDescription(event: DOMEvent, index: number): string {
  const location = event.pathname ? ` on ${event.pathname}` : '';

  switch (event.type) {
    case 'click': {
      const label =
        event.ariaLabel ||
        event.textContent ||
        event.fieldLabel ||
        event.placeholder ||
        event.id ||
        event.tagName;
      return `Clicked "${label}" [${event.tagName.toLowerCase()}]${location}`;
    }

    case 'input': {
      const fieldName =
        event.fieldLabel ||
        event.ariaLabel ||
        event.placeholder ||
        event.id ||
        'a text field';
      return `Entered text in "${fieldName}" [input]${location}`;
    }

    case 'change': {
      const fieldName =
        event.fieldLabel ||
        event.ariaLabel ||
        event.id ||
        'a field';
      return `Changed "${fieldName}" [${event.tagName.toLowerCase()}]${location}`;
    }

    case 'navigate': {
      return `Navigated to ${event.pathname}`;
    }

    default:
      return `Interacted with page${location}`;
  }
}
```

---

## 9. Report Markdown Export Format

```markdown
# Bug Report: [Title]

**Severity:** High  
**Reported by:** [tester]  
**Date:** 2025-06-15T10:32:00Z  

## Environment
- **URL:** https://app.example.com/checkout
- **Browser:** Chrome 124.0.6367.60
- **OS:** MacIntel
- **Viewport:** 1440 × 900

## Description
[Tester-written summary]

## Steps to Reproduce

### Step 1 — Navigated to /checkout
![Step 1](data:image/png;base64,...)

### Step 2 — Clicked "Place Order" button [button] on /checkout
![Step 2](data:image/png;base64,...)
⚛ Component: `<CheckoutButton>`  props: `{ disabled: false, loading: true }`

### Step 3 — Entered text in "Email Address" [input] on /checkout
![Step 3](data:image/png;base64,...)

## Console Errors
| Time | Level | Message |
|---|---|---|
| +4.2s | ERROR | TypeError: Cannot read properties of undefined (reading 'total') at OrderSummary.jsx:42 |

## Network Failures
| Time | Method | URL | Status |
|---|---|---|---|
| +6.1s | POST | /api/orders | 500 |

## Recording
[Attached: repruvia-session-2025-06-15.webm]
```

---

## 10. Linear Integration

**API:** Linear GraphQL API  
**Auth:** OAuth 2.0 (`linear.app/oauth/authorize`)

### Creating an Issue

```js
const CREATE_ISSUE = `
  mutation CreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { id url identifier }
    }
  }
`;

const response = await fetch('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    query: CREATE_ISSUE,
    variables: {
      input: {
        teamId,
        title: report.title,
        description: report.markdownBody,
        priority: severityToPriority(report.severity),
        labelIds: []
      }
    }
  })
});
```

### Attaching Screenshots + Video

Linear supports file uploads via their S3-backed `fileUpload` mutation. Each screenshot and the video file are uploaded, then attached to the issue via `attachmentCreate`.

---

## 11. Jira Integration

**API:** Jira REST API v3  
**Auth:** OAuth 2.0 (`auth.atlassian.com/authorize`) or personal API token

### Creating an Issue

```js
const response = await fetch(
  `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary: report.title,
        description: {
          type: 'doc',
          version: 1,
          content: markdownToAtlassianDoc(report.markdownBody)
        },
        issuetype: { name: 'Bug' },
        priority: { name: report.severity }
      }
    })
  }
);
```

Attachments (screenshots + video) are uploaded to `/rest/api/3/issue/{issueId}/attachments` as `multipart/form-data`.

---

## 12. Privacy & Security

| Concern | Mitigation |
|---|---|
| Input values (passwords, PII) | Input event capture **never records values** — only labels, placeholders, field names |
| OAuth tokens | Stored in `chrome.storage.local` (encrypted by Chrome, user-scoped, never leaves device) |
| Session data | Lives only in browser `IndexedDB`. Never sent anywhere except to the ticket platform when the user explicitly submits |
| Video recording | `getDisplayMedia` shows native Chrome permission dialog — user must explicitly approve |
| XSS in report UI | Step descriptions and DOM metadata are rendered as text, never as innerHTML |
| External message security | Extension only responds to `chrome.runtime.onMessageExternal` from a hardcoded allowed origin list |

---

## 13. Repository & Monorepo Structure

```
repruvia/
├── packages/
│   ├── extension/              # Chrome Extension (MV3)
│   │   ├── manifest.json
│   │   ├── background/
│   │   ├── content/
│   │   ├── devtools/
│   │   ├── popup/
│   │   └── shared/
│   │
│   └── web-app/                # React report builder
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── store/          # Zustand
│       │   ├── lib/
│       │   │   ├── descriptionGenerator.ts
│       │   │   ├── markdownExporter.ts
│       │   │   ├── linearClient.ts
│       │   │   └── jiraClient.ts
│       │   └── pages/
│       ├── public/
│       └── vite.config.ts
│
├── docs/                       # Docusaurus docs site
│   ├── getting-started.md
│   ├── linear-integration.md
│   └── jira-integration.md
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # Lint + type-check on PR
│   │   └── release.yml         # Build + publish extension zip
│   └── ISSUE_TEMPLATE/
│
├── pnpm-workspace.yaml
├── package.json                # Root workspace config
├── README.md
└── LICENSE                     # MIT
```

---

## 14. Development Setup

### Prerequisites
- Node.js 20+
- pnpm 9+
- Chrome 120+ (for MV3 + `captureVisibleTab`)

### Local Dev
```bash
git clone https://github.com/repruvia/repruvia.github.io
cd repruvia
pnpm install

# Start the web app
pnpm --filter web-app dev       # http://localhost:3000

# Build the extension
pnpm --filter extension build   # outputs to packages/extension/dist/

# Load extension in Chrome
# Chrome → chrome://extensions → Load unpacked → packages/extension/dist/
```

### Environment Variables (web-app only)
```bash
# .env.local
VITE_EXTENSION_ID=<your-extension-id-from-chrome>
VITE_LINEAR_CLIENT_ID=<your-linear-oauth-app-id>
VITE_JIRA_CLIENT_ID=<your-jira-oauth-app-id>
```

---

## 15. Build & Release

### Extension Build
```bash
pnpm --filter extension build
# Produces: packages/extension/dist/ (zip for Chrome Web Store)
```

Extension is bundled with Vite in library mode — no React in the extension itself, pure vanilla JS.

### Web App Build
```bash
pnpm --filter web-app build
# Produces: packages/web-app/dist/ (static site, deployable to GitHub Pages or Vercel)
```

### CI Pipeline (GitHub Actions)
- On every PR: ESLint + TypeScript type-check across all packages
- On merge to `main`: build artifacts uploaded as GitHub Actions artifacts
- On version tag `v*.*.*`: Chrome Web Store submission via `chrome-webstore-upload` action + GitHub Release with `.zip` attached

---

## 16. Performance Considerations

| Concern | Approach |
|---|---|
| Screenshot size | PNG quality 80, capped at viewport size, stored as base64 — ~100–300KB per step |
| Video size | WebM VP9, typically 5–20MB for a 1–2 min session — acceptable for IndexedDB |
| Step capture rate | Debounced at 150ms — prevents burst captures on rapid interactions |
| IndexedDB writes | Batched — steps written in groups of 5 to avoid excessive I/O |
| Web app load | Session data passed as reference (sessionId), large blobs fetched on demand not on page load |
| Memory | Video `ArrayBuffer` transferred (not copied) between extension and web app via `postMessage` with `transferable` flag |

---

## 17. Development Milestones

### Phase 1 — Core Capture (Weeks 1–3)
- Extension skeleton (MV3, popup, background, content script)
- DOM event capture + console intercept
- Screenshot per step via `captureVisibleTab`
- IndexedDB storage layer
- Session start/stop UI in popup

### Phase 2 — Web App Report Builder (Weeks 4–6)
- Session data transfer extension → web app
- Step list UI with screenshots
- Editable step descriptions
- Video playback
- Environment info panel
- Console + network errors display

### Phase 3 — Ticket Integrations (Weeks 7–9)
- Markdown export
- Linear OAuth + issue creation + file attachments
- Jira OAuth + issue creation + file attachments
- Settings page for token management

### Phase 4 — Polish + Open Source Launch (Weeks 10–12)
- React component detection (react-bridge.js)
- Network failure capture (devtools panel + fetch monkey-patch)
- Error handling + edge cases
- Docs site
- README with GIF demo
- Chrome Web Store submission
- Product Hunt + GitHub launch

---

## 18. Future Technical Considerations

| Feature | Technical Approach |
|---|---|
| AI step enhancement (opt-in) | POST screenshots + step text to Claude API (user-supplied key); stream enhanced descriptions back |
| Firefox support | WebExtensions API polyfill; `browser` namespace instead of `chrome` |
| Annotation layer | Fabric.js canvas overlay on screenshot `<img>` tags |
| Video trimming | `ffmpeg.wasm` — runs entirely in-browser, no server |
| CLI / Playwright integration | `playwright-repruvia` npm package; `page.on('console')` + screenshots at each test step |
