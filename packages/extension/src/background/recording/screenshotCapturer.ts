import { SCREENSHOT_DEBOUNCE_MS } from "@repruvia/shared";

/** Abstraction for capturing a viewport screenshot (Dependency Inversion). */
export interface ScreenshotCapturer {
  /** Resolves to a base64 PNG data URL, or `null` if capture failed. */
  capture(windowId: number): Promise<string | null>;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `chrome.tabs.captureVisibleTab` is hard-limited by Chrome to roughly two calls
 * per second (`MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND`); exceeding it throws a
 * quota error and the screenshot is lost. Because the recorder fires captures
 * concurrently per interaction, this capturer **serializes** all captures and
 * enforces a minimum gap between them, with retries — so every step reliably
 * gets a screenshot instead of some silently dropping.
 */
export class ChromeScreenshotCapturer implements ScreenshotCapturer {
  /** Stay just under the ~2/sec quota. */
  private static readonly MIN_GAP_MS = 550;
  private static readonly MAX_ATTEMPTS = 3;

  private chain: Promise<unknown> = Promise.resolve();
  private lastCaptureAt = 0;

  capture(windowId: number): Promise<string | null> {
    const result = this.chain.then(() => this.run(windowId));
    // Keep the queue alive even if one capture rejects.
    this.chain = result.catch(() => null);
    return result;
  }

  private async run(windowId: number): Promise<string | null> {
    const sinceLast = Date.now() - this.lastCaptureAt;
    if (sinceLast < ChromeScreenshotCapturer.MIN_GAP_MS) {
      await delay(ChromeScreenshotCapturer.MIN_GAP_MS - sinceLast);
    }
    // Let reactive UI paint before the snapshot (TRD §3.2).
    await delay(SCREENSHOT_DEBOUNCE_MS);

    for (let attempt = 0; attempt < ChromeScreenshotCapturer.MAX_ATTEMPTS; attempt += 1) {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
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
}
