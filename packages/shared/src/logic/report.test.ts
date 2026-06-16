import { describe, expect, it } from "vitest";
import { assignNearestSteps, reindexSteps, resolveStepText } from "./report.js";
import type { ConsoleEntry, Step } from "../types/domain.js";

function step(id: string, index: number, timestamp: number): Step {
  return {
    id,
    index,
    timestamp,
    event: {
      type: "click",
      tagName: "BUTTON",
      id: null,
      className: null,
      textContent: "x",
      ariaLabel: null,
      placeholder: null,
      fieldLabel: null,
      href: null,
      inputType: null,
      xpath: "/",
      pathname: "/",
    },
    screenshot: null,
    reactComponent: null,
    autoDescription: `auto-${id}`,
    editedDescription: null,
  };
}

describe("resolveStepText", () => {
  it("uses the edited description when present", () => {
    expect(resolveStepText({ ...step("a", 1, 0), editedDescription: "edited" })).toBe("edited");
  });
  it("falls back to auto when edit is blank", () => {
    expect(resolveStepText({ ...step("a", 1, 0), editedDescription: "  " })).toBe("auto-a");
  });
});

describe("reindexSteps", () => {
  it("renumbers steps 1..n", () => {
    const reindexed = reindexSteps([step("a", 5, 0), step("b", 9, 1)]);
    expect(reindexed.map((s) => s.index)).toEqual([1, 2]);
  });
});

describe("assignNearestSteps", () => {
  it("attaches each entry to the latest step at or before it", () => {
    const steps = [step("a", 1, 1000), step("b", 2, 2000)];
    const entries: ConsoleEntry[] = [
      { id: "e1", level: "error", message: "boom", timestamp: 2500, nearestStepId: null },
    ];
    expect(assignNearestSteps(entries, steps)[0]!.nearestStepId).toBe("b");
  });
});
