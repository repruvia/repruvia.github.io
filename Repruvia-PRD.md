# Repruvia — Product Requirements Document (PRD)

> **Version:** 1.0.0  
> **Status:** Draft  
> **License:** MIT (Open Source)  
> **Repository:** github.com/repruvia/repruvia.github.io  

---

## 1. Product Overview

**Repruvia** is an open-source Chrome Extension + companion web app that transforms how QA testers and developers report bugs. Instead of recording a screen video and manually writing reproduction steps, Repruvia automatically captures every user interaction during a recording session — paired with a screenshot at each step — and assembles it into a structured, ready-to-submit bug report that can be pushed directly to Linear, Jira, or any ticket platform.

No backend. No storage costs. No AI API fees. Everything runs in the browser.

---

## 2. Problem Statement

Today's bug reporting workflow is:

1. Tester notices a bug
2. Records their screen manually (Loom, QuickTime, etc.)
3. Watches the video back to write steps manually
4. Pastes steps into Linear/Jira with no visual context per step
5. Attaches the full video hoping the developer finds the right moment

This is **slow, inconsistent, and loses critical technical detail** — no console errors, no component info, no network failures. Developers waste time asking "can you reproduce?" because the reports lack enough context.

---

## 3. Goals

| Goal | Success Metric |
|---|---|
| Reduce time to file a bug report by 80% | Tester files a report in < 2 mins vs 10+ mins today |
| Every report has step-by-step screenshot evidence | 100% of submitted reports include screenshots per step |
| Zero infrastructure required to self-host | Runs fully in-browser, no server needed |
| Integrates with Linear and Jira out of the box | Issues created directly from the app |
| Open source adoption | 500+ GitHub stars in first 3 months |

---

## 4. Non-Goals

- **Not a full observability or APM tool** — Repruvia is for QA tester-facing bug reporting, not production monitoring
- **Not a session replay tool** — No FullStory/LogRocket-style passive recording; Repruvia is triggered intentionally
- **Not a mobile recording tool** — Chrome desktop only in v1
- **No AI-powered description generation in v1** — Pure rule-based step generation; AI layer is a future optional plugin
- **No team workspace / SaaS model** — Self-hosted, open source only; no accounts, no cloud sync

---

## 5. Target Users

### Primary — QA Tester
- Files 5–20 bug reports per sprint
- Comfortable with Chrome extensions
- Currently uses Loom + Linear or Jira
- Pain: manually writing steps is tedious and inconsistent

### Secondary — Frontend Developer
- Receives bug reports and acts on them
- Wants console errors + component context without asking for it
- Wants reproducible, precise steps instead of vague descriptions

### Tertiary — Engineering Manager / Tech Lead
- Wants consistent, high-quality bug reports across the team
- Wants an open source tool they can self-host and customise
- Would contribute to or fork the project

---

## 6. User Stories

### Core Recording
- As a tester, I want to click a button to start recording my session so I don't have to use a separate screen recorder
- As a tester, I want each action I take (click, input, navigate) to be captured automatically so I don't have to manually log steps
- As a tester, I want a screenshot automatically taken at each step so the report has visual evidence without extra effort
- As a tester, I want to stop recording and immediately see a structured report preview

### Report Review
- As a tester, I want to see a step-by-step report with thumbnails before submitting so I can verify it's correct
- As a tester, I want to edit or delete any auto-generated step before submitting
- As a tester, I want to add a title and short summary to the report
- As a tester, I want to see any console errors and failed network requests automatically included

### Technical Context (Dev Mode)
- As a developer, I want to know which React component the tester was interacting with at each step
- As a developer, I want the component's props at the time of the interaction included in the report
- As a developer, I want the full console error log attached to the report

### Ticket Creation
- As a tester, I want to submit the report directly to Linear without leaving the web app
- As a tester, I want to submit the report to Jira as an alternative
- As a tester, I want to export the report as a Markdown file for other platforms
- As a tester, I want the video recording to be attached to the ticket alongside the step screenshots

---

## 7. Features — MVP (v1.0)

### 7.1 Chrome Extension

| Feature | Description |
|---|---|
| **Start / Stop recording** | Toolbar button toggles a recording session. Tab is highlighted in red while recording. |
| **Interaction capture** | Captures `click`, `input`, `change`, `navigation` events with full element metadata (tag, id, class, aria-label, placeholder, text content) |
| **Screenshot per step** | Canvas API snapshot of the current viewport taken within 200ms of each interaction |
| **Console error capture** | Injects a content script that intercepts `console.error` and `console.warn` calls with timestamps |
| **Network failure capture** | Listens for 4xx/5xx responses via `chrome.devtools.network` and records URL, status, method |
| **Video recording** | `MediaRecorder` + `getDisplayMedia` captures the full tab as a WebM blob |
| **React component detection** | Reads `__REACT_DEVTOOLS_GLOBAL_HOOK__` (if present) to resolve component name + key props at time of interaction |
| **Local storage** | All captured data stored in extension `IndexedDB` with `unlimitedStorage` permission |
| **Open in Repruvia** | After stopping, opens the companion web app in a new tab and passes the session payload |

### 7.2 Web App — Report Builder

| Feature | Description |
|---|---|
| **Session import** | Receives session data from extension via `chrome.runtime.sendMessage` |
| **Step-by-step report view** | Renders each step with: thumbnail, auto-generated text, console errors and network failures at that timestamp |
| **Editable step descriptions** | Tester can edit any auto-generated description inline |
| **Step reordering / deletion** | Drag to reorder, click to delete any step |
| **Report header** | Editable title, description, severity (Low/Medium/High/Critical), environment (URL, browser, OS, viewport) |
| **Video playback** | Embedded video player showing the full recording |
| **Markdown export** | One-click export of the full report as `.md` file with base64-embedded screenshots |

### 7.3 Ticket Integrations

| Integration | Method |
|---|---|
| **Linear** | GraphQL API — OAuth login, create issue with description + file attachments |
| **Jira** | REST API v3 — OAuth or API token login, create issue with rich text + attachments |
| **Markdown export** | Fallback for any other platform |

---

## 8. Features — Future Releases

| Feature | Version | Notes |
|---|---|---|
| AI-enhanced step descriptions | v1.5 | Optional Claude/GPT-4o call to narrate steps as prose — user opts in, brings their own API key |
| Firefox extension | v1.5 | WebExtensions API is largely compatible |
| GitHub Issues integration | v1.5 | REST API, straightforward |
| Notion integration | v1.5 | Notion API, create a page in a Bug DB |
| Slack report sharing | v2.0 | Post report summary to a channel with screenshots |
| Annotation layer | v2.0 | Draw arrows/circles on step screenshots before submitting |
| Video trimming | v2.0 | Trim the recorded video to the relevant window before attaching |
| Keyboard shortcut recording | v2.0 | Capture keyboard shortcuts as steps, not just clicks |
| Mobile browser support | v3.0 | Android Chrome — limited capabilities |
| CLI tool for CI/CD pipelines | v3.0 | Headless Playwright-based variant for automated test failure reporting |

---

## 9. User Flow (MVP)

```
1. Tester installs Repruvia Chrome Extension from Chrome Web Store (or unpacked)

2. Tester opens the app under test in a Chrome tab

3. Tester clicks the Repruvia toolbar icon → clicks "Start Recording"
   - Extension shows a red recording badge on the tab
   - MediaRecorder begins capturing the tab

4. Tester reproduces the bug naturally — clicks, fills inputs, navigates

5. Tester clicks "Stop Recording"
   - Extension finalises the video blob
   - Bundles all captured events, screenshots, console errors, network failures

6. Repruvia web app opens in a new tab, session data loaded

7. Tester sees the auto-generated report:
   - Report header (editable title + description)
   - Step 1 → Step N (each with thumbnail + auto text)
   - Console errors section
   - Network failures section
   - Environment info (URL, browser, viewport)
   - Video player

8. Tester edits any steps if needed, sets severity

9. Tester clicks "Submit to Linear" (or Jira)
   - OAuth prompt if first time
   - Selects team/project
   - Issue created with full description + screenshots + video

10. Done. Linear issue URL shown with one-click copy.
```

---

## 10. Environment Auto-Capture

The following is captured automatically at session start — no tester input needed:

- Page URL
- Browser name + version
- OS platform
- Viewport size (width × height)
- Device pixel ratio
- User agent string
- Timestamp of recording start/end

---

## 11. Auto-Generated Step Text Format

Each step is rendered from DOM event metadata. No AI required.

**Click event:**
```
Clicked "Place Order" button  [#btn-place-order]  on /checkout
```

**Input event:**
```
Entered text in "Email Address" field  [input[name=email]]  on /checkout
```

**Navigation:**
```
Navigated to /dashboard/orders
```

**Console error (pinned to nearest step):**
```
⚠ Console Error: TypeError: Cannot read properties of undefined (reading 'total')
   at OrderSummary.jsx:42
```

**Network failure:**
```
🔴 Network: POST /api/orders → 500 Internal Server Error
```

**React component (if detected):**
```
⚛ Component: <CheckoutButton>  props: { disabled: false, loading: true }
```

---

## 12. Open Source Strategy

### License
MIT License — permissive, commercial use allowed, attribution required.

### Repository Structure
```
repruvia/
├── extension/        # Chrome Extension (MV3)
├── web-app/          # React companion app
├── docs/             # Documentation site (Docusaurus or plain MD)
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── CONTRIBUTING.md
├── LICENSE
└── README.md
```

### Contribution Guidelines
- Issues tagged `good first issue` for new contributors
- Clear setup docs: `pnpm install && pnpm dev` to run both packages
- Extension loaded unpacked in Chrome for local dev
- Conventional commits enforced via Commitlint

### Distribution
- Chrome Web Store listing (free)
- GitHub Releases with pre-built `.zip` for unpacked install
- Docs site with integration guides for Linear and Jira

---

## 13. Success Metrics (Post-Launch)

| Metric | Target (30 days) | Target (90 days) |
|---|---|---|
| GitHub Stars | 200 | 500+ |
| Chrome Web Store Installs | 100 | 500+ |
| Issues / PRs from community | 10 | 40+ |
| Report-to-ticket success rate | > 90% | > 95% |

---

## 14. Out of Scope (Explicit)

- No user accounts or authentication on Repruvia's side
- No Repruvia cloud — all data stays in the user's browser
- No analytics or telemetry on Repruvia's part
- No monetisation in v1 — 100% free and open source
