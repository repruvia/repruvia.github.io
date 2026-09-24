import {
  isCaptureTargetVisible,
  SCREENSHOT_DEBOUNCE_MS,
  type CaptureTarget,
} from "@repruvia/shared";

/**
 * Resolves which tab (and the window it now lives in) a capture should show.
 * It is a function, not a fixed value, because captures are queued: by the time
 * one runs, the recorded tab may have been dragged to another window, and a
 * stale window id would photograph the wrong screen.
 */
export type CaptureTargetResolver = () => CaptureTarget | null;

/** Abstraction for capturing a viewport screenshot (Dependency Inversion). */
export interface ScreenshotCapturer {
  /** Resolves to a base64 PNG data URL, or `null` if nothing safe could be captured. */
  capture(target: CaptureTargetResolver): Promise<string | null>;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `chrome.tabs.captureVisibleTab` is hard-limited by Chrome to roughly two calls
 * per second (`MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND`); exceeding it throws a
 * quota error and the screenshot is lost. Because the recorder fires captures
 * concurrently per interaction, this capturer **serializes** all captures and
 * enforces a minimum gap between them, with retries — so every step reliably
 * gets a screenshot instead of some silently dropping.
 *
 * `captureVisibleTab` photographs whatever tab is active in a window, so every
 * attempt first confirms the recorded tab is still the one on screen. If it
 * isn't — a `target="_blank"` link took focus, or the user switched tabs while
 * captures were queued — the capture is skipped and the step simply has no
 * screenshot, rather than storing a picture of an unrelated page.
 */
export class ChromeScreenshotCapturer implements ScreenshotCapturer {
  /** Stay just under the ~2/sec quota. */
  private static readonly MIN_GAP_MS = 550;
  private static readonly MAX_ATTEMPTS = 3;

  private chain: Promise<unknown> = Promise.resolve();
  private lastCaptureAt = 0;

  capture(target: CaptureTargetResolver): Promise<string | null> {
    const result = this.chain.then(() => this.run(target));
    // Keep the queue alive even if one capture rejects.
    this.chain = result.catch(() => null);
    return result;
  }

  private async run(resolveTarget: CaptureTargetResolver): Promise<string | null> {
    const sinceLast = Date.now() - this.lastCaptureAt;
    if (sinceLast < ChromeScreenshotCapturer.MIN_GAP_MS) {
      await delay(ChromeScreenshotCapturer.MIN_GAP_MS - sinceLast);
    }
    // Let reactive UI paint before the snapshot (TRD §3.2).
    await delay(SCREENSHOT_DEBOUNCE_MS);

    for (let attempt = 0; attempt < ChromeScreenshotCapturer.MAX_ATTEMPTS; attempt += 1) {
      // Re-read the target on every attempt: it can move between windows, and
      // each retry waits out another rate-limit window.
      const target = resolveTarget();
      if (!target || !(await this.isOnScreen(target))) return null;
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(target.windowId, { format: "png" });
        this.lastCaptureAt = Date.now();
        if (dataUrl) return dataUrl;
      } catch {
        // Quota or transient failure — wait out the rate-limit window and retry.
        await delay(ChromeScreenshotCapturer.MIN_GAP_MS);
      }
    }
    this.lastCaptureAt = Date.now();
    return null;
  }

  /** Whether the recorded tab is still the visible one in the window we'd capture. */
  private async isOnScreen(target: CaptureTarget): Promise<boolean> {
    const tab = await chrome.tabs.get(target.tabId).catch(() => null);
    return isCaptureTargetVisible(target, tab);
  }
}
