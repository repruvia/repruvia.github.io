import type { DomEvent } from "@repruvia/shared";
import { buildDomEvent } from "./elementMetadata.js";

export type DomEventSink = (event: DomEvent) => void;

/** Quiet period before a run of keystrokes in one field is committed as a step. */
const INPUT_COALESCE_MS = 700;

/**
 * Observes user interactions at the document level via event delegation and
 * emits normalized `DomEvent`s. Single responsibility: turn raw browser events
 * into domain events.
 *
 * Consecutive `input` events on the same field are coalesced into a single step
 * (the last value), so typing produces "Entered text in X" once — not one step
 * (and one screenshot) per keystroke. Any other interaction flushes the pending
 * input first so ordering is preserved.
 */
export class DomEventObserver {
  private readonly sink: DomEventSink;
  private lastNavigation = location.pathname + location.search + location.hash;
  private active = false;

  private pendingInput: DomEvent | null = null;
  private pendingInputXPath: string | null = null;
  private inputTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(sink: DomEventSink) {
    this.sink = sink;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("input", this.onInput, true);
    document.addEventListener("change", this.onChange, true);
    window.addEventListener("popstate", this.onNavigate);
    window.addEventListener("hashchange", this.onNavigate);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.flushInput();
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("input", this.onInput, true);
    document.removeEventListener("change", this.onChange, true);
    window.removeEventListener("popstate", this.onNavigate);
    window.removeEventListener("hashchange", this.onNavigate);
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
    const next = location.pathname + location.search + location.hash;
    if (next === this.lastNavigation) return;
    this.lastNavigation = next;
    this.flushInput();
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
  };

  /** Emit the buffered input step, if any. */
  private flushInput(): void {
    if (this.inputTimer) {
      clearTimeout(this.inputTimer);
      this.inputTimer = null;
    }
    const event = this.pendingInput;
    this.pendingInput = null;
    this.pendingInputXPath = null;
    if (event) this.sink(event);
  }
}
