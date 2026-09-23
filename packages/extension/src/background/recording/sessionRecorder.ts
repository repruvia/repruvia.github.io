import {
  generateDescription,
  isDuplicateNetworkFailure,
  LIMITS,
  truncateText,
  uuid,
  type RepruviaSession,
  type ConsoleEntry,
  type DomEvent,
  type Environment,
  type NetworkFailure,
  type CaptureTarget,
  type ReactInfo,
  type Step,
} from "@repruvia/shared";
import type { SessionRepository } from "../../storage/types.js";
import type { ScreenshotCapturer } from "./screenshotCapturer.js";

/** Window within which a React-info message is matched to a step by xpath. */
const REACT_MATCH_WINDOW_MS = 500;

/**
 * Mid-recording saves are throttled to one per interval. Every save
 * re-serializes the whole session (all base64 screenshots), so a page spamming
 * console errors must not trigger one write per error.
 */
const PERSIST_INTERVAL_MS = 1000;

interface BufferedReact {
  xpath: string;
  info: ReactInfo;
  timestamp: number;
}

/**
 * Owns the in-progress session and assembles capture inputs into persisted
 * steps. Depends on `SessionRepository`/`ScreenshotCapturer`, not Chrome APIs.
 */
export class SessionRecorder {
  private readonly session: RepruviaSession;
  /**
   * The tab being recorded and the window it currently sits in. Mutable and
   * read at capture time (not when a capture is queued), so a tab dragged to
   * another window retargets screenshots already in the queue.
   */
  private readonly target: CaptureTarget;
  private readonly reactBuffer: BufferedReact[] = [];
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** Captures still resolving; awaited on finish so none are lost. */
  private readonly inFlight = new Set<Promise<void>>();

  private constructor(
    private readonly repository: SessionRepository,
    private readonly screenshots: ScreenshotCapturer,
    session: RepruviaSession,
    target: CaptureTarget,
  ) {
    this.session = session;
    this.target = { ...target };
  }

  /** Begin a brand-new session. */
  static create(
    repository: SessionRepository,
    screenshots: ScreenshotCapturer,
    init: { tabId: number; windowId: number; tabUrl: string; environment: Environment },
  ): SessionRecorder {
    const session: RepruviaSession = {
      id: uuid(),
      startedAt: Date.now(),
      endedAt: null,
      tabUrl: init.tabUrl,
      environment: init.environment,
      steps: [],
      consoleErrors: [],
      networkFailures: [],
    };
    return new SessionRecorder(repository, screenshots, session, {
      tabId: init.tabId,
      windowId: init.windowId,
    });
  }

  /**
   * Continue a session that was being recorded when the service worker was
   * suspended (MV3 kills idle workers). The last persisted state is the
   * starting point; anything captured after the last save is gone.
   */
  static resume(
    repository: SessionRepository,
    screenshots: ScreenshotCapturer,
    session: RepruviaSession,
    target: CaptureTarget,
  ): SessionRecorder {
    return new SessionRecorder(repository, screenshots, session, target);
  }

  get id(): string {
    return this.session.id;
  }

  get stepCount(): number {
    return this.session.steps.length;
  }

  /**
   * The recorded tab moved to another window; capture that window from now on.
   * Captures already queued pick this up too — they resolve the target when
   * they run, not when they were queued.
   */
  setWindowId(windowId: number): void {
    this.target.windowId = windowId;
  }

  addEvent(event: DomEvent): Promise<void> {
    // Stamp event time and React match now, but the screenshot resolves later
    // (captures are throttled). Track the work so `finish` can await it.
    const timestamp = Date.now();
    const reactComponent = this.matchReact(event.xpath);
    const task = this.screenshots.capture(() => this.target).then((screenshot) => {
      const step: Step = {
        id: uuid(),
        index: this.session.steps.length + 1,
        timestamp,
        event,
        screenshot,
        reactComponent,
        autoDescription: generateDescription(event),
        editedDescription: null,
      };
      this.session.steps.push(step);
      this.schedulePersist();
    });
    this.inFlight.add(task);
    void task.finally(() => this.inFlight.delete(task));
    return task;
  }

  addConsole(entry: Omit<ConsoleEntry, "id" | "nearestStepId">): void {
    if (this.session.consoleErrors.length >= LIMITS.CONSOLE_ENTRIES_MAX) return;
    this.session.consoleErrors.push({
      id: uuid(),
      nearestStepId: null,
      ...entry,
      message: truncateText(entry.message, LIMITS.CONSOLE_MESSAGE_MAX),
    });
    this.schedulePersist();
  }

  addNetwork(failure: Omit<NetworkFailure, "id" | "nearestStepId">): void {
    const recorded = this.session.networkFailures;
    if (recorded.length >= LIMITS.NETWORK_ENTRIES_MAX) return;
    // DevTools + the in-page patch usually both report the same failure.
    if (isDuplicateNetworkFailure(recorded, failure)) return;
    recorded.push({ id: uuid(), nearestStepId: null, ...failure });
    this.schedulePersist();
  }

  bufferReact(xpath: string, info: ReactInfo, timestamp: number): void {
    this.reactBuffer.push({ xpath, info, timestamp });
    // Keep the buffer small; drop entries older than the match window.
    const cutoff = Date.now() - REACT_MATCH_WINDOW_MS * 2;
    while (this.reactBuffer.length && this.reactBuffer[0]!.timestamp < cutoff) {
      this.reactBuffer.shift();
    }
  }

  /** Save the current state now (e.g. right after start, so a worker restart can resume it). */
  async flush(): Promise<void> {
    this.cancelPersist();
    await this.repository.save(this.session);
  }

  /** Finalize and persist the session; returns the completed snapshot. */
  async finish(): Promise<RepruviaSession> {
    // Wait for any queued screenshots so trailing steps aren't lost.
    await Promise.allSettled([...this.inFlight]);
    this.cancelPersist();
    this.session.endedAt = Date.now();
    await this.repository.save(this.session);
    return this.session;
  }

  private matchReact(xpath: string): ReactInfo | null {
    const now = Date.now();
    for (let i = this.reactBuffer.length - 1; i >= 0; i -= 1) {
      const entry = this.reactBuffer[i]!;
      if (entry.xpath === xpath && now - entry.timestamp <= REACT_MATCH_WINDOW_MS) {
        return entry.info;
      }
    }
    return null;
  }

  /**
   * Coalesce changes into at most one IndexedDB put per interval. A fixed delay
   * (not a sliding debounce) so a steady stream of errors can't postpone saving forever.
   */
  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.repository.save(this.session).catch((error: unknown) => {
        console.warn("[Repruvia] Couldn't save the in-progress recording:", error);
      });
    }, PERSIST_INTERVAL_MS);
  }

  private cancelPersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
  }
}
