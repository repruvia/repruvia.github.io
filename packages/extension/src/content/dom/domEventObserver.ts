import type { DomEvent } from "@repruvia/shared";
import { buildDomEvent } from "./elementMetadata.js";

export type DomEventSink = (event: DomEvent) => void;

/** Quiet period before a run of keystrokes in one field is committed as a step. */
const INPUT_COALESCE_MS = 700;

/**
 * Observes document-level interactions (event delegation) and emits normalized
 * `DomEvent`s. Consecutive `input`s on one field coalesce into a single step so
 * typing makes one step/screenshot, not one per keystroke; any other
 * interaction flushes the pending input first to preserve ordering.
 */
export class DomEventObserver {
  private readonly sink: DomEventSink;
  private lastNavigation = currentLocation();
  private active = false;

  private pendingInput: DomEvent | null = null;
  private pendingInputXPath: string | null = null;
  private inputTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(sink: DomEventSink) {
    this.sink = sink;
  }

  get isActive(): boolean {
    return this.active;
  }

  /**
   * Begin capturing. `announcePage` records the current page as a navigation
   * step — used when capture resumes on a freshly loaded document mid-recording.
   */
  start(options: { announcePage?: boolean } = {}): void {
    if (this.active) return;
    this.active = true;
    this.lastNavigation = currentLocation();
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("input", this.onInput, true);
    document.addEventListener("change", this.onChange, true);
    window.addEventListener("popstate", this.onNavigate);
    window.addEventListener("hashchange", this.onNavigate);
    // SPA routers navigate with history.pushState, which fires neither event
    // above; the Navigation API reports every same-document entry change.
    pageNavigation()?.addEventListener("currententrychange", this.onNavigate);
    if (options.announcePage) this.emitNavigation();
  }

  /**
   * Stop capturing. Returns the pending (debounced) input step instead of
   * emitting it, so the caller can hand it over synchronously with the stop ack.
   */
  stop(): DomEvent | null {
    if (!this.active) return null;
    const pending = this.takePendingInput();
    this.active = false;
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("input", this.onInput, true);
    document.removeEventListener("change", this.onChange, true);
    window.removeEventListener("popstate", this.onNavigate);
    window.removeEventListener("hashchange", this.onNavigate);
    pageNavigation()?.removeEventListener("currententrychange", this.onNavigate);
    return pending;
  }

  private readonly onClick = (e: Event): void => {
    this.flushInput();
    const el = e.target;
    if (el instanceof Element) this.sink(buildDomEvent("click", el));
  };

  private readonly onInput = (e: Event): void => {
    const el = e.target;
    if (!(el instanceof Element)) return;
    const event = buildDomEvent("input", el);

    // Switching to a different field commits the previous field's input first.
    if (this.pendingInputXPath && this.pendingInputXPath !== event.xpath) this.flushInput();

    this.pendingInput = event;
    this.pendingInputXPath = event.xpath;
    if (this.inputTimer) clearTimeout(this.inputTimer);
    this.inputTimer = setTimeout(() => this.flushInput(), INPUT_COALESCE_MS);
  };

  private readonly onChange = (e: Event): void => {
    this.flushInput();
    const el = e.target;
    if (el instanceof Element) this.sink(buildDomEvent("change", el));
  };

  private readonly onNavigate = (): void => {
    const next = currentLocation();
    if (next === this.lastNavigation) return;
    this.lastNavigation = next;
    this.flushInput();
    this.emitNavigation();
  };

  private emitNavigation(): void {
    this.sink({
      type: "navigate",
      tagName: "DOCUMENT",
      id: null,
      className: null,
      textContent: null,
      ariaLabel: null,
      placeholder: null,
      fieldLabel: null,
      href: null,
      inputType: null,
      xpath: "/",
      pathname: location.pathname,
    });
  }

  /** Emit the buffered input step, if any. */
  private flushInput(): void {
    const event = this.takePendingInput();
    if (event) this.sink(event);
  }

  /** Remove and return the buffered input step, cancelling its timer. */
  private takePendingInput(): DomEvent | null {
    if (this.inputTimer) {
      clearTimeout(this.inputTimer);
      this.inputTimer = null;
    }
    const event = this.pendingInput;
    this.pendingInput = null;
    this.pendingInputXPath = null;
    return event;
  }
}

function currentLocation(): string {
  return location.pathname + location.search + location.hash;
}

/** The Navigation API (Chrome 102+); not yet in TypeScript's DOM lib. */
interface PageNavigation {
  addEventListener(type: "currententrychange", listener: () => void): void;
  removeEventListener(type: "currententrychange", listener: () => void): void;
}

function pageNavigation(): PageNavigation | undefined {
  return (window as { navigation?: PageNavigation }).navigation;
}
