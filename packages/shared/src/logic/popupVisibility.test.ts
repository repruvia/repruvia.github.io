import { describe, expect, it } from "vitest";
import { resolvePopupView, type PopupAvailability } from "./popupVisibility.js";

const AVAILABILITIES: PopupAvailability[] = [
  { kind: "checking" },
  { kind: "ready" },
  { kind: "reload" },
  { kind: "restricted" },
];

describe("resolvePopupView", () => {
  it("never shows the notice without a message (structural: notice visibility is derived from text)", () => {
    for (const recording of [true, false]) {
      for (const availability of AVAILABILITIES) {
        const view = resolvePopupView(recording, availability);
        if (view.noticeText === null) {
          expect(view.noticeReloadVisible).toBe(false);
        }
      }
    }
  });

  it("never leaves the popup with neither a status message nor a notice message", () => {
    for (const recording of [true, false]) {
      for (const availability of AVAILABILITIES) {
        const view = resolvePopupView(recording, availability);
        expect(view.statusText !== null || view.noticeText !== null).toBe(true);
      }
    }
  });

  it("an error is never invisible: every view puts it on the status line", () => {
    const message = "Couldn't save the recording.";
    for (const recording of [true, false]) {
      for (const availability of AVAILABILITIES) {
        const view = resolvePopupView(recording, availability, message);
        expect(view.statusText).toBe(message);
        expect(view.statusState).toBe("recording");
      }
    }
  });

  it("keeps the page notice alongside an error, and drops the error once it clears", () => {
    const message = "Couldn't save the recording.";
    const failed = resolvePopupView(false, { kind: "restricted" }, message);
    expect(failed.statusText).toBe(message);
    expect(failed.noticeText).toBe(resolvePopupView(false, { kind: "restricted" }).noticeText);
    expect(resolvePopupView(false, { kind: "restricted" }, null)).toEqual(
      resolvePopupView(false, { kind: "restricted" }),
    );
  });

  it("never shows actions without a control that can actually work", () => {
    for (const recording of [true, false]) {
      for (const availability of AVAILABILITIES) {
        const view = resolvePopupView(recording, availability);
        if (!view.actionsVisible) {
          expect(view.snipVisible).toBe(false);
        }
      }
    }
  });

  it("a recording in progress always keeps a working action row (Stop), regardless of availability", () => {
    for (const availability of AVAILABILITIES) {
      const view = resolvePopupView(true, availability);
      expect(view.actionsVisible).toBe(true);
      expect(view.snipVisible).toBe(false); // snip never shows mid-recording
      expect(view.noticeText).toBeNull();
      expect(view.statusText).toBe("Recording…");
      expect(view.statusState).toBe("recording");
    }
  });

  it("not recording + ready: shows Start and Snip, no notice", () => {
    const view = resolvePopupView(false, { kind: "ready" });
    expect(view).toEqual({
      statusText: "Ready to record",
      statusState: "idle",
      noticeText: null,
      noticeReloadVisible: false,
      actionsVisible: true,
      snipVisible: true,
    });
  });

  it("not recording + checking: only the status line, no actions, no notice", () => {
    const view = resolvePopupView(false, { kind: "checking" });
    expect(view).toEqual({
      statusText: "Checking this page…",
      statusState: "idle",
      noticeText: null,
      noticeReloadVisible: false,
      actionsVisible: false,
      snipVisible: false,
    });
  });

  it("not recording + reload: notice with a reload button, no status, no actions", () => {
    const view = resolvePopupView(false, { kind: "reload" });
    expect(view).toEqual({
      statusText: null,
      statusState: "idle",
      noticeText: "Reload this page to record it.",
      noticeReloadVisible: true,
      actionsVisible: false,
      snipVisible: false,
    });
  });

  it("not recording + restricted: notice without a reload button, no status, no actions", () => {
    const view = resolvePopupView(false, { kind: "restricted" });
    expect(view).toEqual({
      statusText: null,
      statusState: "idle",
      noticeText: "Repruvia can't record this page. Open a normal page and try again.",
      noticeReloadVisible: false,
      actionsVisible: false,
      snipVisible: false,
    });
  });
});
