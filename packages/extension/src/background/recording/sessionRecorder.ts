import {
  generateDescription,
  uuid,
  type RepruviaSession,
  type ConsoleEntry,
  type DomEvent,
  type Environment,
  type NetworkFailure,
  type ReactInfo,
  type Step,
} from "@repruvia/shared";
import type { SessionRepository } from "../../storage/types.js";
import type { ScreenshotCapturer } from "./screenshotCapturer.js";

/** Window within which a React-info message is matched to a step by xpath. */
const REACT_MATCH_WINDOW_MS = 500;

interface BufferedReact {
  xpath: string;
  info: ReactInfo;
  timestamp: number;
}

/**
 * Owns the in-progress session and converts capture inputs into persisted
 * steps. Single responsibility: session assembly. It depends on abstractions
 * (`SessionRepository`, `ScreenshotCapturer`) rather than Chrome APIs directly,
 * which keeps it unit-testable and swappable.
 */
export class SessionRecorder {
  private session: RepruviaSession;
  private readonly windowId: number;
  private readonly reactBuffer: BufferedReact[] = [];
  private persistScheduled = false;
  /** Captures still resolving; awaited on finish so none are lost. */
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly repository: SessionRepository,
    private readonly screenshots: ScreenshotCapturer,
    init: { tabId: number; windowId: number; tabUrl: string; environment: Environment },
  ) {
    this.windowId = init.windowId;
    this.session = {
      id: uuid(),
      startedAt: Date.now(),
      endedAt: null,
      tabUrl: init.tabUrl,
      environment: init.environment,
      steps: [],
      consoleErrors: [],
      networkFailures: [],
    };
  }

  get id(): string {
    return this.session.id;
  }

  get stepCount(): number {
    return this.session.steps.length;
  }

  addEvent(event: DomEvent): Promise<void> {
    // Stamp event time and React match now, but the screenshot resolves later
    // (captures are throttled). Track the work so `finish` can await it.
    const timestamp = Date.now();
    const reactComponent = this.matchReact(event.xpath);
    const task = this.screenshots.capture(this.windowId).then((screenshot) => {
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
    const record: ConsoleEntry = { id: uuid(), nearestStepId: null, ...entry };
    this.session.consoleErrors.push(record);
    this.schedulePersist();
  }

  addNetwork(failure: Omit<NetworkFailure, "id" | "nearestStepId">): void {
    const record: NetworkFailure = { id: uuid(), nearestStepId: null, ...failure };
    this.session.networkFailures.push(record);
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

  /** Finalize and persist the session; returns the completed snapshot. */
  async finish(): Promise<RepruviaSession> {
    // Wait for any queued screenshots so trailing steps aren't lost.
    await Promise.allSettled([...this.inFlight]);
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

  /** Coalesce rapid writes into a single IndexedDB put on the next microtask. */
  private schedulePersist(): void {
    if (this.persistScheduled) return;
    this.persistScheduled = true;
    queueMicrotask(() => {
      this.persistScheduled = false;
      void this.repository.save(this.session);
    });
  }
}
