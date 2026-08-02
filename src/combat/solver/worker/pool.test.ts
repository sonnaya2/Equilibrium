import { afterEach, describe, expect, it, vi } from "vitest";
import { solverPoolSize } from "./pool";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("solverPoolSize", () => {
  it("returns 1 when navigator is undefined", () => {
    vi.stubGlobal("navigator", undefined);
    expect(solverPoolSize()).toBe(1);
  });

  it("returns 1 when hardwareConcurrency is missing", () => {
    vi.stubGlobal("navigator", {});
    expect(solverPoolSize()).toBe(1);
  });

  it("uses hardwareConcurrency - 1 within 1..4", () => {
    for (const [hc, want] of [
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 4],
    ] as const) {
      vi.stubGlobal("navigator", { hardwareConcurrency: hc });
      expect(solverPoolSize(), `hc=${hc}`).toBe(want);
    }
  });

  it("caps at 4 on high core counts", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 16 });
    expect(solverPoolSize()).toBe(4);
    vi.stubGlobal("navigator", { hardwareConcurrency: 64 });
    expect(solverPoolSize()).toBe(4);
  });

  it("floors at 1 for non-positive concurrency", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 0 });
    expect(solverPoolSize()).toBe(1);
    vi.stubGlobal("navigator", { hardwareConcurrency: -2 });
    expect(solverPoolSize()).toBe(1);
  });

  it("always returns an integer in [1, 4] for common core counts", () => {
    for (const hc of [1, 2, 4, 6, 8, 12, 16, 32]) {
      vi.stubGlobal("navigator", { hardwareConcurrency: hc });
      const n = solverPoolSize();
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
    }
  });
});
