import { describe, expect, it } from "vitest";
import {
  ABSOLUTE_MAX_BAR_SIZE,
  MIN_SOLVER_BAR_SIZE,
  agentBarLength,
  agentBarSizeBounds,
  clampSolverBarSizes,
} from "./barPolicy";

describe("barPolicy", () => {
  it("product floor is 4 and ceiling is 10", () => {
    expect(MIN_SOLVER_BAR_SIZE).toBe(4);
    expect(ABSOLUTE_MAX_BAR_SIZE).toBe(10);
  });

  it("clamps into 4..10 without expanding a narrow window", () => {
    expect(clampSolverBarSizes(4, 4)).toEqual({ minBarSize: 4, maxBarSize: 4 });
    expect(clampSolverBarSizes(4, 6)).toEqual({ minBarSize: 4, maxBarSize: 6 });
    expect(clampSolverBarSizes(6, 6)).toEqual({ minBarSize: 6, maxBarSize: 6 });
    expect(clampSolverBarSizes(5, 8)).toEqual({ minBarSize: 5, maxBarSize: 8 });
    expect(clampSolverBarSizes(8, 10)).toEqual({ minBarSize: 8, maxBarSize: 10 });
    expect(clampSolverBarSizes(3, 10)).toEqual({ minBarSize: 4, maxBarSize: 10 });
    expect(clampSolverBarSizes(5, 99)).toEqual({ minBarSize: 5, maxBarSize: 10 });
    expect(clampSolverBarSizes(8, 7)).toEqual({ minBarSize: 8, maxBarSize: 8 });
    expect(clampSolverBarSizes(undefined, undefined)).toEqual({
      minBarSize: 4,
      maxBarSize: 10,
    });
  });

  it("fixed 4..4 pins every agent at size 4", () => {
    for (let i = 0; i < 8; i++) {
      expect(agentBarSizeBounds(4, 4, i, 8)).toEqual({ minBarSize: 4, maxBarSize: 4 });
      expect(agentBarLength(i, 4, 4)).toBe(4);
    }
  });

  it("ranged bounds cycle target lengths inside the request window only", () => {
    expect(agentBarSizeBounds(4, 6, 0, 3)).toEqual({ minBarSize: 4, maxBarSize: 4 });
    expect(agentBarSizeBounds(4, 6, 1, 3)).toEqual({ minBarSize: 5, maxBarSize: 5 });
    expect(agentBarSizeBounds(4, 6, 2, 3)).toEqual({ minBarSize: 6, maxBarSize: 6 });
    expect(agentBarSizeBounds(4, 6, 3, 3)).toEqual({ minBarSize: 4, maxBarSize: 4 });

    expect(agentBarSizeBounds(5, 8, 0, 4)).toEqual({ minBarSize: 5, maxBarSize: 5 });
    expect(agentBarSizeBounds(5, 8, 3, 4)).toEqual({ minBarSize: 8, maxBarSize: 8 });

    expect(agentBarSizeBounds(8, 10, 0, 3)).toEqual({ minBarSize: 8, maxBarSize: 8 });
    expect(agentBarSizeBounds(8, 10, 1, 3)).toEqual({ minBarSize: 9, maxBarSize: 9 });
    expect(agentBarSizeBounds(8, 10, 2, 3)).toEqual({ minBarSize: 10, maxBarSize: 10 });
  });

  it("never emits sizes outside the clamped request range", () => {
    for (const [lo, hi] of [
      [4, 4],
      [4, 6],
      [5, 8],
      [8, 10],
      [6, 6],
    ] as const) {
      for (let i = 0; i < 12; i++) {
        const band = agentBarSizeBounds(lo, hi, i, 12);
        expect(band.minBarSize).toBeGreaterThanOrEqual(lo);
        expect(band.maxBarSize).toBeLessThanOrEqual(hi);
        expect(band.minBarSize).toBe(band.maxBarSize);
      }
    }
  });
});
