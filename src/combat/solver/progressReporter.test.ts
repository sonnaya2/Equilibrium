import { describe, expect, it } from "vitest";
import {
  ACTIVE_STRIP_EVAL_INTERVAL,
  PROGRESS_EVAL_INTERVAL,
  emitProgress,
  progressRatioNow,
  shouldEmitProgress,
  type ProgressState,
} from "./progressReporter";
import type { SolverProgress } from "./worker/protocol";

function wallStamp(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function baseState(over: Partial<ProgressState> = {}): ProgressState {
  return {
    currentPhase: "explore",
    evaluations: 0,
    uniqueBars: 0,
    bestExploratoryScore: Number.NEGATIVE_INFINITY,
    bestFullScore: Number.NEGATIVE_INFINITY,
    searchEvaluations: 0,
    fullEvaluations: 0,
    topPreview: [],
    activePreview: [],
    noImprovement: 0,
    evaluationBudget: 1000,
    fullMemoHits: 0,
    finalizeActive: false,
    finalizeDone: 0,
    finalizeTotal: 0,
    scoringLabel: undefined,
    scoringBarPreview: undefined,
    lastEmitEvaluations: 0,
    lastEmitMs: wallStamp(),
    lastEmittedBestExploratory: Number.NEGATIVE_INFINITY,
    lastEmittedBestFull: Number.NEGATIVE_INFINITY,
    ...over,
  };
}

describe("progressReporter throttle", () => {
  it("force always emits", () => {
    const state = baseState({ evaluations: 1, lastEmitEvaluations: 1 });
    expect(shouldEmitProgress(state, true, false)).toBe(true);
  });

  it("emits when exploratory or full best improves", () => {
    const state = baseState({
      evaluations: 3,
      lastEmitEvaluations: 2,
      bestExploratoryScore: 100,
      lastEmittedBestExploratory: 50,
    });
    expect(shouldEmitProgress(state, false, false)).toBe(true);

    const full = baseState({
      evaluations: 3,
      lastEmitEvaluations: 2,
      bestFullScore: 20,
      lastEmittedBestFull: 10,
      bestExploratoryScore: 50,
      lastEmittedBestExploratory: 50,
    });
    expect(shouldEmitProgress(full, false, false)).toBe(true);
  });

  it("suppresses flat scores until PROGRESS_EVAL_INTERVAL evals", () => {
    const state = baseState({
      evaluations: PROGRESS_EVAL_INTERVAL - 1,
      lastEmitEvaluations: 0,
      bestExploratoryScore: 10,
      lastEmittedBestExploratory: 10,
    });
    expect(shouldEmitProgress(state, false, false)).toBe(false);

    state.evaluations = PROGRESS_EVAL_INTERVAL;
    expect(shouldEmitProgress(state, false, false)).toBe(true);
  });

  it("allows active strip at ACTIVE_STRIP_EVAL_INTERVAL, not every eval", () => {
    const state = baseState({
      evaluations: ACTIVE_STRIP_EVAL_INTERVAL - 1,
      lastEmitEvaluations: 0,
      bestExploratoryScore: 10,
      lastEmittedBestExploratory: 10,
    });
    expect(shouldEmitProgress(state, false, true)).toBe(false);

    state.evaluations = ACTIVE_STRIP_EVAL_INTERVAL;
    expect(shouldEmitProgress(state, false, true)).toBe(true);
    // Without activeChanged, strip cadence does not apply below eval interval.
    expect(shouldEmitProgress(state, false, false)).toBe(false);
  });

  it("emitProgress pushes slim DTO with honest scores (no request fields)", () => {
    const seen: SolverProgress[] = [];
    const state = baseState({
      evaluations: 4,
      uniqueBars: 2,
      bestExploratoryScore: 123.5,
      bestFullScore: 40,
      searchEvaluations: 3,
      fullEvaluations: 1,
      topPreview: ["a", "b"],
      activePreview: ["x"],
      evaluationBudget: 500,
    });
    emitProgress({ onProgress: (p) => seen.push(p) }, state, true);
    expect(seen).toHaveLength(1);
    const p = seen[0]!;
    expect(p.bestScore).toBe(123.5);
    expect(p.bestExploratoryScore).toBe(123.5);
    expect(p.bestFullScore).toBe(40);
    expect(p.evaluations).toBe(4);
    expect(p.activeBarPreview).toEqual(["x"]);
    expect(p.topBarPreview).toEqual(["a", "b"]);
    // Slim DTO: no request / loadout / pool reconstruction.
    expect(p).not.toHaveProperty("request");
    expect(p).not.toHaveProperty("loadout");
    expect(p).not.toHaveProperty("pool");
    expect(Object.keys(p).sort()).toEqual(
      [
        "activeBarPreview",
        "bestExploratoryScore",
        "bestFullScore",
        "bestScore",
        "evaluationBudget",
        "evaluationMode",
        "evaluations",
        "fullEvaluations",
        "noImprovementCount",
        "phase",
        "progressRatio",
        "proof",
        "searchEvaluations",
        "topBarPreview",
        "uniqueCandidates",
        "windowDpms",
      ].sort(),
    );
  });

  it("throttles repeated emits without force or score change", () => {
    const seen: SolverProgress[] = [];
    const onProgress = (p: SolverProgress) => seen.push(p);
    const state = baseState({
      evaluations: 1,
      bestExploratoryScore: 5,
    });
    emitProgress({ onProgress }, state, true);
    expect(seen).toHaveLength(1);

    // Next few evals: same score, activeChanged, but under strip interval.
    for (let i = 2; i < ACTIVE_STRIP_EVAL_INTERVAL; i++) {
      state.evaluations = i;
      emitProgress({ onProgress }, state, false, true);
    }
    expect(seen).toHaveLength(1);

    state.evaluations = state.lastEmitEvaluations + ACTIVE_STRIP_EVAL_INTERVAL;
    emitProgress({ onProgress }, state, false, true);
    expect(seen).toHaveLength(2);
    // Honesty: still the same correct best.
    expect(seen[1]!.bestExploratoryScore).toBe(5);
  });

  it("progressRatio leaves headroom during search", () => {
    const state = baseState({ evaluations: 1000, evaluationBudget: 1000 });
    expect(progressRatioNow(state)).toBeLessThan(0.82);
  });
});
