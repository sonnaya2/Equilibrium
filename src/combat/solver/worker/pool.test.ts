import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeProgress, solverPoolSize } from "./pool";
import type { SolverProgress } from "./protocol";

afterEach(() => {
  vi.unstubAllGlobals();
});

function progress(partial: Partial<SolverProgress> & Pick<SolverProgress, "bestScore">): SolverProgress {
  return {
    evaluations: 10,
    uniqueCandidates: 5,
    windowDpms: 0,
    phase: "explore",
    noImprovementCount: 0,
    topBarPreview: ["a"],
    ...partial,
  };
}

describe("mergeProgress dual scores", () => {
  it("takes max exploratory and max full across agents; sums dual evals", () => {
    const merged = mergeProgress(
      [
        progress({
          bestScore: 100,
          bestExploratoryScore: 100,
          bestFullScore: 40,
          searchEvaluations: 8,
          fullEvaluations: 2,
          evaluations: 10,
        }),
        progress({
          bestScore: 80,
          bestExploratoryScore: 80,
          bestFullScore: 55,
          searchEvaluations: 12,
          fullEvaluations: 3,
          evaluations: 15,
          phase: "finalize",
          evaluationMode: "finalize",
        }),
      ],
      2,
      100,
    );
    expect(merged.bestScore).toBe(100);
    expect(merged.bestExploratoryScore).toBe(100);
    expect(merged.bestFullScore).toBe(55);
    expect(merged.searchEvaluations).toBe(20);
    expect(merged.fullEvaluations).toBe(5);
    expect(merged.evaluations).toBe(25);
    expect(merged.phase).toBe("finalize");
    // bestScore stays exploratory — never the full robust max.
    expect(merged.bestScore).not.toBe(merged.bestFullScore);
  });

  it("keeps bestScore exploratory when only bestScore is present", () => {
    const merged = mergeProgress(
      [progress({ bestScore: 12 }), progress({ bestScore: 9 })],
      2,
      50,
    );
    expect(merged.bestScore).toBe(12);
    expect(merged.bestExploratoryScore).toBe(12);
    expect(merged.bestFullScore).toBeUndefined();
  });
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

  it("uses hardwareConcurrency - 1 within 1..8", () => {
    for (const [hc, want] of [
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 4],
      [9, 8],
    ] as const) {
      vi.stubGlobal("navigator", { hardwareConcurrency: hc });
      expect(solverPoolSize(), `hc=${hc}`).toBe(want);
    }
  });

  it("caps at 8 on high core counts (unhinged pool size)", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 16 });
    expect(solverPoolSize()).toBe(8);
    vi.stubGlobal("navigator", { hardwareConcurrency: 64 });
    expect(solverPoolSize()).toBe(8);
  });

  it("floors at 1 for non-positive concurrency", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 0 });
    expect(solverPoolSize()).toBe(1);
    vi.stubGlobal("navigator", { hardwareConcurrency: -2 });
    expect(solverPoolSize()).toBe(1);
  });

  it("always returns an integer in [1, 8] for common core counts", () => {
    for (const hc of [1, 2, 4, 6, 8, 12, 16, 32]) {
      vi.stubGlobal("navigator", { hardwareConcurrency: hc });
      const n = solverPoolSize();
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(8);
    }
  });
});
