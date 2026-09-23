import { describe, expect, it } from "vitest";
import { mapWithConcurrency, withTimeout } from "./async.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe("mapWithConcurrency", () => {
  it("preserves order and never exceeds the limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30]);
    expect(peak).toBe(2);
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 3, async (n: number) => n)).toEqual([]);
  });

  it("rejects when a call rejects", async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
  });
});

describe("withTimeout", () => {
  it("passes through a value that arrives in time", async () => {
    await expect(withTimeout(Promise.resolve("done"), 50)).resolves.toBe("done");
  });

  it("passes through the original rejection", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 50)).rejects.toThrow("boom");
  });

  it("rejects once the wait runs out", async () => {
    const stuck = new Promise<never>(() => {});
    await expect(withTimeout(stuck, 5, "took too long")).rejects.toThrow("took too long");
  });

  it("still settles from the wrapped promise after a slow start", async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve("late"), 5));
    await expect(withTimeout(slow, 200)).resolves.toBe("late");
  });
});
