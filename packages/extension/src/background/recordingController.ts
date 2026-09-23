import {
  SESSION_QUERY_PARAM,
  withTimeout,
  type CaptureMessage,
  type DomEvent,
  type RecordingStatePayload,
  type TabCommand,
  type TabCommandAck,
} from "@repruvia/shared";
import type { SessionRepository } from "../storage/types.js";
import { captureEnvironment } from "./recording/environment.js";
import { ChromeScreenshotCapturer } from "./recording/screenshotCapturer.js";
import { SessionRecorder } from "./recording/sessionRecorder.js";
import { openWebApp } from "./webAppUrl.js";

/**
 * Which tab/session is recording, mirrored into `chrome.storage.session` so a
 * recording survives MV3 suspending the idle service worker (which wipes all
 * in-memory state). Cleared when the recording stops.
 */
const ACTIVE_RECORDING_KEY = "repruvia.activeRecording";

interface ActiveRecording {
  sessionId: string;
  tabId: number;
  windowId: number;
}

/**
 * How long to wait for the interrupted-recording restore before giving up on
 * it. Every message handler awaits `ready`, so a storage read that never
 * settles would otherwise leave the popup stuck with no controls and no error.
 */
const RESTORE_TIMEOUT_MS = 5000;

const UNREACHABLE_TAB_ERROR =
  "Can't record this page. Reload it (or open a normal web page) and start recording again.";

/**
 * Owns the recording lifecycle and is the single module that touches Chrome's
 * `action`, `tabs`, and tab messaging — everything else depends on abstractions.
 */
export class RecordingController {
  private recorder: SessionRecorder | null = null;
  private tabId: number | null = null;
  /** Guard the async gaps in `start`/`stop` so a double-click (or popup + tab close) can't race. */
  private starting = false;
  private stopping = false;
  private readonly screenshots = new ChromeScreenshotCapturer();
  /** Resolves once any recording interrupted by a worker restart is restored. */
  private readonly ready: Promise<void>;

  constructor(private readonly sessions: SessionRepository) {
    // Never let a stuck restore wedge the controller: on timeout we carry on
    // without the interrupted recording (it stays saved and can still be opened).
    this.ready = withTimeout(this.restore(), RESTORE_TIMEOUT_MS, "Restore timed out").catch(
      (error: unknown) => {
        console.warn("[Repruvia] Couldn't restore the active recording in time:", error);
      },
    );
  }

  /** Wait until state restored after a worker restart is in place. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  getState(): RecordingStatePayload {
    return {
      state: this.recorder ? "recording" : "idle",
      sessionId: this.recorder?.id ?? null,
      stepCount: this.recorder?.stepCount ?? 0,
    };
  }

  /** Whether `tabId` is the tab being recorded (content scripts ask on load). */
  isRecordingTab(tabId: number | undefined): boolean {
    return this.recorder !== null && tabId !== undefined && tabId === this.tabId;
  }

  async start(tab: chrome.tabs.Tab): Promise<RecordingStatePayload> {
    await this.ready;
    if (this.recorder || this.starting || this.stopping) return this.getState();
    if (tab.id === undefined || tab.windowId === undefined) {
      return { ...this.getState(), error: "No active tab to record." };
    }
    this.starting = true;
    try {
      const tabId = tab.id;
      const url = tab.url ?? "";
      const environment = await captureEnvironment(tabId, url);

      this.recorder = SessionRecorder.create(this.sessions, this.screenshots, {
        tabId,
        windowId: tab.windowId,
        tabUrl: url,
        environment,
      });
      this.tabId = tabId;

      // No content script (restricted page, or a tab opened before the extension
      // loaded) means nothing would be captured — refuse rather than record an
      // empty session behind a "REC" badge.
      if (!(await this.sendTabCommand(tabId, { type: "TOGGLE_CAPTURE", active: true }))) {
        this.recorder = null;
        this.tabId = null;
        return { ...this.getState(), error: UNREACHABLE_TAB_ERROR };
      }

      await this.recorder.flush();
      await this.saveActive({ sessionId: this.recorder.id, tabId, windowId: tab.windowId });
      await this.setRecordingBadge(tabId);
      this.broadcastState();
      return this.getState();
    } catch (error) {
      console.warn("[Repruvia] Couldn't start recording:", error);
      if (this.tabId !== null) {
        await this.sendTabCommand(this.tabId, { type: "TOGGLE_CAPTURE", active: false });
      }
      this.recorder = null;
      this.tabId = null;
      await this.clearActive();
      return { ...this.getState(), error: "Couldn't start recording. Please try again." };
    } finally {
      this.starting = false;
    }
  }

  async stop(): Promise<RecordingStatePayload> {
    await this.ready;
    const recorder = this.recorder;
    const tabId = this.tabId;
    if (!recorder || this.stopping) return this.getState();
    this.stopping = true;

    let savedId: string | null = null;
    try {
      // Stop capturing first so no further steps slip in. The ack carries the
      // tab's still-debounced typing step, recorded here before finalizing.
      const ack =
        tabId !== null
          ? await this.sendTabCommand(tabId, { type: "TOGGLE_CAPTURE", active: false })
          : null;
      const pending: DomEvent | undefined = ack?.pendingEvent;
      if (pending) void recorder.addEvent(pending);

      // Detach so late captures are ignored, then finalize (awaits in-flight screenshots).
      this.recorder = null;
      this.tabId = null;
      savedId = (await recorder.finish()).id;
    } catch (cause) {
      console.warn("[Repruvia] Couldn't save the recording:", cause);
    } finally {
      this.recorder = null;
      this.tabId = null;
      this.stopping = false;
    }
    if (tabId !== null) await this.clearRecordingBadge(tabId);
    await this.clearActive();
    this.broadcastState();

    if (!savedId) {
      return {
        ...this.getState(),
        error: "Couldn't save the recording — the browser may be out of storage space.",
      };
    }
    await this.openReportBuilder(savedId).catch((cause: unknown) => {
      console.warn("[Repruvia] Couldn't open the report builder:", cause);
    });
    return this.getState();
  }

  /** Route a capture message to the active session — only from the recorded tab. */
  async handleCapture(message: CaptureMessage, senderTabId: number | undefined): Promise<void> {
    await this.ready;
    const recorder = this.recorder;
    if (!recorder || senderTabId === undefined || senderTabId !== this.tabId) return;
    switch (message.type) {
      case "CAPTURE_EVENT":
        await recorder.addEvent(message.event);
        this.broadcastState();
        break;
      case "CAPTURE_CONSOLE":
        recorder.addConsole(message.entry);
        break;
      case "CAPTURE_NETWORK":
        recorder.addNetwork(message.failure);
        break;
      case "CAPTURE_REACT":
        recorder.bufferReact(message.xpath, message.info, message.timestamp);
        break;
    }
  }

  /** The recorded tab was closed: finalize so the session isn't left dangling. */
  async onTabRemoved(tabId: number): Promise<void> {
    await this.ready;
    if (tabId === this.tabId) await this.stop();
  }

  /** The recorded tab was dragged to another window: screenshot that window instead. */
  async onTabAttached(tabId: number, windowId: number): Promise<void> {
    await this.ready;
    if (tabId !== this.tabId || !this.recorder) return;
    this.recorder.setWindowId(windowId);
    await this.saveActive({ sessionId: this.recorder.id, tabId, windowId });
  }

  /** Rebuild the recorder from storage after the service worker was restarted. */
  private async restore(): Promise<void> {
    try {
      const stored = await chrome.storage.session.get(ACTIVE_RECORDING_KEY);
      const active = stored[ACTIVE_RECORDING_KEY] as ActiveRecording | undefined;
      if (!active) return;

      const session = await this.sessions.get(active.sessionId);
      if (!session || session.endedAt !== null) {
        await this.clearActive();
        return;
      }
      const tab = await chrome.tabs.get(active.tabId).catch(() => null);
      this.recorder = SessionRecorder.resume(this.sessions, this.screenshots, session, {
        tabId: active.tabId,
        windowId: tab?.windowId ?? active.windowId,
      });
      this.tabId = active.tabId;
    } catch (error) {
      console.warn("[Repruvia] Couldn't restore the active recording:", error);
    }
  }

  /** Send a command to the tab's content script; null if there's none to answer (unreachable). */
  private async sendTabCommand(tabId: number, command: TabCommand): Promise<TabCommandAck | null> {
    try {
      const ack = (await chrome.tabs.sendMessage(tabId, command)) as TabCommandAck | undefined;
      return ack ?? { ok: true };
    } catch {
      // No content script in this tab: either a restricted page (chrome://,
      // Web Store) or — most commonly — a tab that was already open before the
      // extension was loaded/reloaded. Reloading the page injects the script.
      return null;
    }
  }

  private async saveActive(active: ActiveRecording): Promise<void> {
    await chrome.storage.session.set({ [ACTIVE_RECORDING_KEY]: active });
  }

  private async clearActive(): Promise<void> {
    await chrome.storage.session.remove(ACTIVE_RECORDING_KEY).catch(() => {});
  }

  private async setRecordingBadge(tabId: number): Promise<void> {
    await chrome.action.setBadgeText({ tabId, text: "REC" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#dc2626" });
  }

  private async clearRecordingBadge(tabId: number): Promise<void> {
    // The tab may already be closed — nothing to clear then.
    await chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  }

  private broadcastState(): void {
    chrome.runtime.sendMessage({ type: "STATE_CHANGED", payload: this.getState() }).catch(() => {});
  }

  private async openReportBuilder(sessionId: string): Promise<void> {
    await openWebApp(`${SESSION_QUERY_PARAM}=${encodeURIComponent(sessionId)}`);
  }
}
