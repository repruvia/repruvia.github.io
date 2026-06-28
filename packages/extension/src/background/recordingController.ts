import {
  SESSION_QUERY_PARAM,
  type CaptureMessage,
  type RecordingStatePayload,
} from "@repruvia/shared";
import type { SessionRepository } from "../storage/types.js";
import { captureEnvironment } from "./recording/environment.js";
import { ChromeScreenshotCapturer } from "./recording/screenshotCapturer.js";
import { SessionRecorder } from "./recording/sessionRecorder.js";
import { openWebApp } from "./webAppUrl.js";

/**
 * Owns the recording lifecycle and is the single module that touches Chrome's
 * `action`, `tabs`, and tab messaging — everything else depends on abstractions.
 */
export class RecordingController {
  private recorder: SessionRecorder | null = null;
  private tabId: number | null = null;
  private readonly screenshots = new ChromeScreenshotCapturer();

  constructor(private readonly sessions: SessionRepository) {}

  get isRecording(): boolean {
    return this.recorder !== null;
  }

  getState(): RecordingStatePayload {
    return {
      state: this.recorder ? "recording" : "idle",
      sessionId: this.recorder?.id ?? null,
      stepCount: this.recorder?.stepCount ?? 0,
    };
  }

  async start(tab: chrome.tabs.Tab): Promise<RecordingStatePayload> {
    if (this.recorder || tab.id === undefined || tab.windowId === undefined) {
      return this.getState();
    }
    const tabId = tab.id;
    const url = tab.url ?? "";
    const environment = await captureEnvironment(tabId, url);

    this.recorder = new SessionRecorder(this.sessions, this.screenshots, {
      tabId,
      windowId: tab.windowId,
      tabUrl: url,
      environment,
    });
    this.tabId = tabId;

    await this.toggleCapture(tabId, true);
    await this.setRecordingBadge(tabId);
    this.broadcastState();
    return this.getState();
  }

  async stop(): Promise<RecordingStatePayload> {
    const recorder = this.recorder;
    const tabId = this.tabId;
    if (!recorder) return this.getState();

    // Stop capturing first so no further steps slip in, then finalize.
    if (tabId !== null) await this.toggleCapture(tabId, false);
    const session = await recorder.finish();

    if (tabId !== null) await this.clearRecordingBadge(tabId);

    this.recorder = null;
    this.tabId = null;
    this.broadcastState();

    await this.openReportBuilder(session.id);
    return this.getState();
  }

  /** Route a capture message from a content script to the active session. */
  handleCapture(message: CaptureMessage): void {
    const recorder = this.recorder;
    if (!recorder) return;
    switch (message.type) {
      case "CAPTURE_EVENT":
        void recorder.addEvent(message.event).then(() => this.broadcastState());
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

  private async toggleCapture(tabId: number, active: boolean): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "TOGGLE_CAPTURE", active });
    } catch {
      // No content script in this tab: either a restricted page (chrome://,
      // Web Store) or — most commonly — a tab that was already open before the
      // extension was loaded/reloaded. Reloading the page injects the script.
      if (active) {
        console.warn(
          "[Repruvia] Could not reach the capture content script in this tab. " +
            "Reload the page you want to record, then start recording again.",
        );
      }
    }
  }

  private async setRecordingBadge(tabId: number): Promise<void> {
    await chrome.action.setBadgeText({ tabId, text: "REC" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#dc2626" });
  }

  private async clearRecordingBadge(tabId: number): Promise<void> {
    await chrome.action.setBadgeText({ tabId, text: "" });
  }

  private broadcastState(): void {
    chrome.runtime.sendMessage({ type: "STATE_CHANGED", payload: this.getState() }).catch(() => {});
  }

  private async openReportBuilder(sessionId: string): Promise<void> {
    await openWebApp(`${SESSION_QUERY_PARAM}=${encodeURIComponent(sessionId)}`);
  }
}
