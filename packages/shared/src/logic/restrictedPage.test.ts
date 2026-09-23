import { describe, expect, it } from "vitest";
import { isNeverRecordablePage } from "./restrictedPage.js";

describe("isNeverRecordablePage", () => {
  it("flags Chrome/Edge internal pages", () => {
    expect(isNeverRecordablePage("chrome://extensions/")).toBe(true);
    expect(isNeverRecordablePage("chrome-extension://abcdef/options.html")).toBe(true);
    expect(isNeverRecordablePage("edge://settings")).toBe(true);
    expect(isNeverRecordablePage("about:blank")).toBe(true);
    expect(isNeverRecordablePage("view-source:https://example.com")).toBe(true);
  });

  it("flags the Chrome Web Store (both hosts)", () => {
    expect(isNeverRecordablePage("https://chrome.google.com/webstore/detail/x")).toBe(true);
    expect(isNeverRecordablePage("https://chromewebstore.google.com/detail/x")).toBe(true);
  });

  it("flags the built-in PDF viewer by extension, case-insensitively", () => {
    expect(isNeverRecordablePage("https://example.com/report.pdf")).toBe(true);
    expect(isNeverRecordablePage("https://example.com/report.PDF?x=1")).toBe(true);
  });

  it("flags local files unless file access was granted", () => {
    expect(isNeverRecordablePage("file:///Users/x/notes.txt")).toBe(true);
    expect(isNeverRecordablePage("file:///Users/x/notes.txt", { fileAccessAllowed: true })).toBe(
      false,
    );
  });

  it("treats missing or unparseable URLs as never-recordable", () => {
    expect(isNeverRecordablePage(undefined)).toBe(true);
    expect(isNeverRecordablePage(null)).toBe(true);
    expect(isNeverRecordablePage("")).toBe(true);
    expect(isNeverRecordablePage("not a url")).toBe(true);
  });

  it("allows ordinary web pages", () => {
    expect(isNeverRecordablePage("https://example.com/page")).toBe(false);
    expect(isNeverRecordablePage("http://localhost:3000/")).toBe(false);
    expect(isNeverRecordablePage("https://example.com/report.pdf.html")).toBe(false);
  });
});
