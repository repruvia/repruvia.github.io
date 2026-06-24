import { describe, expect, it } from "vitest";
import { isProxyFetchAllowed } from "./constants.js";

describe("isProxyFetchAllowed", () => {
  it("allows ticket + AI provider hosts over https", () => {
    for (const url of [
      "https://uploads.linear.app/x",
      "https://acme.atlassian.net/rest",
      "https://api.openai.com/v1/chat/completions",
      "https://api.anthropic.com/v1/messages",
      "https://generativelanguage.googleapis.com/v1beta/models/x:generateContent",
      "https://api.x.ai/v1/chat/completions",
    ]) {
      expect(isProxyFetchAllowed(url)).toBe(true);
    }
  });
  it("rejects other hosts and non-https", () => {
    expect(isProxyFetchAllowed("https://evil.example.com")).toBe(false);
    expect(isProxyFetchAllowed("http://api.openai.com")).toBe(false);
    expect(isProxyFetchAllowed("not a url")).toBe(false);
  });
});
