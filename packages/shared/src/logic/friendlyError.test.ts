import { describe, expect, it } from "vitest";
import { toFriendlyMessage } from "./friendlyError.js";

describe("toFriendlyMessage", () => {
  it("passes through a clean, short, human-authored message", () => {
    expect(toFriendlyMessage(new Error("No AI provider is configured."), "fallback")).toBe(
      "No AI provider is configured.",
    );
  });

  it("replaces a raw backend JSON dump with the fallback", () => {
    const raw =
      '{"error":{"code":403,"message":"Cloud Firestore API has not been used in project repruvia before or it is disabled.","status":"PERMISSION_DENIED"}}';
    expect(toFriendlyMessage(new Error(raw), "Ticket history isn't available right now.")).toBe(
      "Ticket history isn't available right now.",
    );
  });

  it("replaces a message naming a vendor/API by name", () => {
    expect(toFriendlyMessage(new Error("Cloud Firestore is disabled."), "fallback")).toBe(
      "fallback",
    );
  });

  it("keeps a short, curated message even if it mentions a status code in passing", () => {
    // Hand-authored, actionable copy (not a raw backend dump) should still reach the user.
    expect(
      toFriendlyMessage(new Error("Jira rejected the email/API token (401). Check them in Settings."), "fallback"),
    ).toBe("Jira rejected the email/API token (401). Check them in Settings.");
  });

  it("replaces a message containing a link", () => {
    expect(
      toFriendlyMessage(new Error("Enable it at https://console.developers.google.com/apis"), "fallback"),
    ).toBe("fallback");
  });

  it("replaces an overly long message", () => {
    expect(toFriendlyMessage(new Error("x".repeat(200)), "fallback")).toBe("fallback");
  });

  it("falls back for a plain thrown string", () => {
    expect(toFriendlyMessage("boom {ugly}", "fallback")).toBe("fallback");
  });

  it("falls back for a non-Error, non-string value", () => {
    expect(toFriendlyMessage(undefined, "fallback")).toBe("fallback");
    expect(toFriendlyMessage({ code: 403 }, "fallback")).toBe("fallback");
  });
});
