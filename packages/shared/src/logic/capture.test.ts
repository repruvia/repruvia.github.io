import { describe, expect, it } from "vitest";
import { isDuplicateNetworkFailure, truncateText } from "./capture.js";

const failure = (url: string, timestamp: number, status = 500, method = "GET") => ({
  url,
  method,
  status,
  timestamp,
});

describe("isDuplicateNetworkFailure", () => {
  it("flags the same request seen twice within the window", () => {
    const recorded = [failure("https://a.test/api", 1000)];
    expect(isDuplicateNetworkFailure(recorded, failure("https://a.test/api", 1400, 500, "get"))).toBe(true);
  });

  it("keeps a repeat outside the window, or with a different status/method/url", () => {
    const recorded = [failure("https://a.test/api", 1000)];
    expect(isDuplicateNetworkFailure(recorded, failure("https://a.test/api", 5000))).toBe(false);
    expect(isDuplicateNetworkFailure(recorded, failure("https://a.test/api", 1100, 404))).toBe(false);
    expect(isDuplicateNetworkFailure(recorded, failure("https://a.test/api", 1100, 500, "POST"))).toBe(false);
    expect(isDuplicateNetworkFailure(recorded, failure("https://a.test/other", 1100))).toBe(false);
  });

  it("handles an empty history", () => {
    expect(isDuplicateNetworkFailure([], failure("https://a.test/api", 0))).toBe(false);
  });
});

describe("truncateText", () => {
  it("leaves short text alone and caps long text with an ellipsis", () => {
    expect(truncateText("abc", 5)).toBe("abc");
    expect(truncateText("abcdefgh", 5)).toBe("abcde…");
  });
});
