import { describe, expect, it } from "vitest";
import { toIsoTimestamp, toOptionalString, toStringRecord, toText } from "./cloudDoc.js";

describe("toOptionalString", () => {
  it("keeps a non-blank string", () => {
    expect(toOptionalString("ENG-12")).toBe("ENG-12");
  });

  it("returns null for blank, missing, or non-string values", () => {
    expect(toOptionalString("   ")).toBeNull();
    expect(toOptionalString(undefined)).toBeNull();
    expect(toOptionalString(null)).toBeNull();
    expect(toOptionalString(42)).toBeNull();
  });
});

describe("toText", () => {
  it("falls back to an empty string", () => {
    expect(toText("Ada")).toBe("Ada");
    expect(toText(undefined)).toBe("");
    expect(toText(7)).toBe("");
  });
});

describe("toStringRecord", () => {
  it("keeps string entries only", () => {
    expect(toStringRecord({ openai: "gpt-4o-mini", groq: 3, gemini: "", anthropic: null })).toEqual({
      openai: "gpt-4o-mini",
    });
  });

  it("returns an empty record for non-map values", () => {
    expect(toStringRecord(null)).toEqual({});
    expect(toStringRecord("gpt-4o-mini")).toEqual({});
    expect(toStringRecord(["gpt-4o-mini"])).toEqual({});
  });
});

describe("toIsoTimestamp", () => {
  const iso = "2026-06-16T10:32:00.000Z";
  const ms = Date.parse(iso);

  it("reads a Timestamp-like object with toDate()", () => {
    expect(toIsoTimestamp({ toDate: () => new Date(ms) })).toBe(iso);
  });

  it("reads a plain { seconds, nanoseconds } timestamp", () => {
    expect(toIsoTimestamp({ seconds: ms / 1000, nanoseconds: 0 })).toBe(iso);
  });

  it("reads a Date, epoch milliseconds, and a date string", () => {
    expect(toIsoTimestamp(new Date(ms))).toBe(iso);
    expect(toIsoTimestamp(ms)).toBe(iso);
    expect(toIsoTimestamp(iso)).toBe(iso);
  });

  it("returns null for a pending or unusable timestamp", () => {
    expect(toIsoTimestamp(null)).toBeNull();
    expect(toIsoTimestamp(undefined)).toBeNull();
    expect(toIsoTimestamp("not a date")).toBeNull();
    expect(toIsoTimestamp(Number.NaN)).toBeNull();
    expect(toIsoTimestamp(1e18)).toBeNull(); // out of the representable Date range
    expect(toIsoTimestamp({ toDate: () => "nope" })).toBeNull();
    expect(toIsoTimestamp({})).toBeNull();
  });
});
