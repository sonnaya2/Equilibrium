import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeProgress, SolverAgentPool, solverPoolSize } from "./pool";
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
    // One agent still exploring — do not promote merged phase to finalize.
    expect(merged.phase).toBe("explore");
    // bestScore stays exploratory — never the full robust max.
    expect(merged.bestScore).not.toBe(merged.bestFullScore);
  });

  it("promotes finalize only after every live agent leaves search", () => {
    const merged = mergeProgress(
      [
        progress({
          bestScore: 90,
          phase: "finalize",
          finalizeStep: 2,
          finalizeTotal: 4,
          scoringLabel: "Full-horizon score 2/4",
          scoringBarPreview: ["x"],
          progressRatio: 0.9,
        }),
        progress({
          bestScore: 70,
          phase: "finalize",
          finalizeStep: 1,
          finalizeTotal: 4,
          progressRatio: 0.85,
        }),
      ],
      2,
      100,
    );
    expect(merged.phase).toBe("finalize");
    // Furthest shortlist step wins, not exploratory-score leader.
    expect(merged.finalizeStep).toBe(2);
    expect(merged.finalizeTotal).toBe(4);
    expect(merged.scoringLabel).toBe("Full-horizon score 2/4");
    expect(merged.scoringBarPreview).toEqual(["x"]);
  });

  it("keeps search phase while a peer is still exploring", () => {
    const merged = mergeProgress(
      [
        progress({
          bestScore: 50,
          phase: "finalize",
          finalizeStep: 3,
          finalizeTotal: 4,
          scoringLabel: "should not surface yet",
          progressRatio: 0.95,
        }),
        progress({
          bestScore: 120,
          phase: "explore",
          progressRatio: 0.4,
        }),
      ],
      2,
      100,
    );
    expect(merged.phase).toBe("explore");
    expect(merged.finalizeStep).toBeUndefined();
    expect(merged.scoringLabel).toBeUndefined();
    expect(merged.progressRatio).toBeLessThanOrEqual(0.82);
  });

  it("surfaces the busiest unfinished agent’s active bar for the cycling strip", () => {
    const merged = mergeProgress(
      [
        progress({
          bestScore: 100,
          topBarPreview: ["best-a", "best-b"],
          activeBarPreview: ["old-try"],
          evaluations: 10,
          progressRatio: 0.3,
        }),
        progress({
          bestScore: 40,
          topBarPreview: ["other"],
          activeBarPreview: ["live-1", "live-2"],
          evaluations: 40,
          progressRatio: 0.5,
        }),
      ],
      2,
      100,
    );
    // Best strip stays with the score leader; active follows the busier agent.
    expect(merged.topBarPreview).toEqual(["best-a", "best-b"]);
    expect(merged.activeBarPreview).toEqual(["live-1", "live-2"]);
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

  it("emits one agent snapshot per slot, including empty warmers", () => {
    const merged = mergeProgress(
      [
        progress({
          bestScore: 20,
          bestExploratoryScore: 20,
          evaluations: 5,
          phase: "explore",
          progressRatio: 0.4,
        }),
        undefined,
        progress({
          bestScore: 15,
          evaluations: 3,
          phase: "finalize",
          progressRatio: 1,
        }),
      ],
      3,
      100,
    );
    expect(merged.agents).toHaveLength(3);
    expect(merged.agents?.[0]).toMatchObject({
      index: 0,
      phase: "explore",
      evaluations: 5,
      bestScore: 20,
      finished: false,
    });
    expect(merged.agents?.[1]).toMatchObject({
      index: 1,
      phase: "seed",
      evaluations: 0,
      finished: false,
    });
    expect(merged.agents?.[2]).toMatchObject({
      index: 2,
      phase: "idle",
      finished: true,
    });
  });
});

describe("solverPoolSize", () => {
  it("returns full pool capacity (18) for unhinged 3×6 pack", () => {
    expect(solverPoolSize()).toBe(18);
    vi.stubGlobal("navigator", { hardwareConcurrency: 4 });
    expect(solverPoolSize()).toBe(18);
    vi.stubGlobal("navigator", undefined);
    expect(solverPoolSize()).toBe(18);
  });
});

describe("SolverAgentPool.ensure shrinks", () => {
  it("drops extra workers when a later run asks for fewer agents", () => {
    const terminated: number[] = [];
    const fakeWorker = (): Worker =>
      ({
        terminate: () => {
          terminated.push(1);
        },
        postMessage: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as Worker;

    const pool = new SolverAgentPool();
    const internal = pool as unknown as {
      slots: { worker: Worker; requestId: number }[];
    };
    // Simulate a prior Extreme run that left 12 workers warm.
    for (let i = 0; i < 12; i++) {
      internal.slots.push({ worker: fakeWorker(), requestId: 0 });
    }
    expect(pool.size()).toBe(12);
    // Thorough only wants 6 — must shrink or second runs stay slow.
    expect(pool.ensure(6)).toBe(6);
    expect(pool.size()).toBe(6);
    expect(terminated.length).toBe(6);
    pool.dispose();
  });
});
