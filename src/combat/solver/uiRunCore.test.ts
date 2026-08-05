import { describe, expect, it } from "vitest";
import {
  pickBestUiRunProbe,
  preferredUiRunWorkerCount,
  type UiRunProbeResult,
} from "./uiRunCore";
import { RESIDUAL_FREE_TOLERANCE } from "./branchFidelity";

describe("uiRunCore", () => {
  it("pickBest prefers residual-free over lower residual non-free", () => {
    const probes: UiRunProbeResult[] = [
      { maxLiveBranches: 256, residualWeight: 0.4, ok: true, totalExpected: 1 },
      { maxLiveBranches: 128, residualWeight: 0, ok: true, totalExpected: 1 },
      { maxLiveBranches: 512, residualWeight: 0.1, ok: true, totalExpected: 1 },
    ];
    const best = pickBestUiRunProbe(probes)!;
    expect(best.maxLiveBranches).toBe(128);
    expect(best.residualWeight).toBe(0);
  });

  it("pickBest among residual picks lowest residual then higher live", () => {
    const probes: UiRunProbeResult[] = [
      { maxLiveBranches: 256, residualWeight: 0.3, ok: true, totalExpected: 1 },
      { maxLiveBranches: 1024, residualWeight: 0.2, ok: true, totalExpected: 1 },
      { maxLiveBranches: 512, residualWeight: 0.2 + RESIDUAL_FREE_TOLERANCE / 2, ok: true, totalExpected: 1 },
    ];
    const best = pickBestUiRunProbe(probes)!;
    expect(best.residualWeight).toBeCloseTo(0.2, 9);
    expect(best.maxLiveBranches).toBe(1024);
  });

  it("preferredUiRunWorkerCount is 2-4", () => {
    expect(preferredUiRunWorkerCount(2)).toBe(2);
    expect(preferredUiRunWorkerCount(4)).toBe(3);
    expect(preferredUiRunWorkerCount(8)).toBe(4);
    expect(preferredUiRunWorkerCount(16)).toBe(4);
  });
});
