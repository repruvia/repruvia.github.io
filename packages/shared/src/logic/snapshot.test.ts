import { describe, expect, it } from "vitest";
import { deviceCropRect, toSnapshotSummary } from "./snapshot.js";
import type { Snapshot } from "../types/domain.js";

describe("deviceCropRect", () => {
  it("scales the CSS-px selection by the device pixel ratio", () => {
    const crop = deviceCropRect({ x: 10, y: 20, width: 100, height: 50 }, 2, 800, 600);
    expect(crop).toEqual({ x: 20, y: 40, width: 200, height: 100 });
  });

  it("passes a 1:1 selection through unchanged", () => {
    const crop = deviceCropRect({ x: 5, y: 5, width: 40, height: 30 }, 1, 400, 300);
    expect(crop).toEqual({ x: 5, y: 5, width: 40, height: 30 });
  });

  it("clamps a selection that runs past the image bounds", () => {
    const crop = deviceCropRect({ x: 700, y: 500, width: 400, height: 400 }, 1, 800, 600);
    expect(crop).toEqual({ x: 700, y: 500, width: 100, height: 100 });
  });

  it("guards against a zero/invalid dpr", () => {
    const crop = deviceCropRect({ x: 0, y: 0, width: 10, height: 10 }, 0, 100, 100);
    expect(crop).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it("never produces a width/height below 1", () => {
    const crop = deviceCropRect({ x: 0, y: 0, width: 0, height: 0 }, 1, 100, 100);
    expect(crop.width).toBeGreaterThanOrEqual(1);
    expect(crop.height).toBeGreaterThanOrEqual(1);
  });
});

describe("toSnapshotSummary", () => {
  it("drops the image data url and keeps metadata", () => {
    const snapshot: Snapshot = {
      id: "abc",
      createdAt: 123,
      tabUrl: "https://example.com/app",
      image: "data:image/png;base64,AAAA",
      width: 200,
      height: 100,
    };
    expect(toSnapshotSummary(snapshot)).toEqual({
      id: "abc",
      createdAt: 123,
      tabUrl: "https://example.com/app",
      width: 200,
      height: 100,
    });
  });
});
