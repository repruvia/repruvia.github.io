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

  it("attributes entries before the first step to the first step", () => {
    const steps = [step("a", 1, 1000), step("b", 2, 2000)];
    const entries: ConsoleEntry[] = [
      { id: "e1", level: "error", message: "early", timestamp: 10, nearestStepId: null },
    ];
    expect(assignNearestSteps(entries, steps)[0]!.nearestStepId).toBe("a");
  });

  it("uses timestamp order even when steps were reordered", () => {
    const steps = [step("c", 1, 3000), step("a", 2, 1000), step("b", 3, 2000)];
    const entries: ConsoleEntry[] = [
      { id: "e1", level: "error", message: "x", timestamp: 2000, nearestStepId: null },
      { id: "e2", level: "warn", message: "y", timestamp: 9999, nearestStepId: null },
    ];
    expect(assignNearestSteps(entries, steps).map((e) => e.nearestStepId)).toEqual(["b", "c"]);
  });

  it("assigns null when there are no steps", () => {
    const entries: ConsoleEntry[] = [
      { id: "e1", level: "error", message: "x", timestamp: 1, nearestStepId: "stale" },
    ];
    expect(assignNearestSteps(entries, [])[0]!.nearestStepId).toBeNull();
  });
});
