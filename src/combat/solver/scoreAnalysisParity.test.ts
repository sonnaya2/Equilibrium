import { describe, expect, it } from "vitest";
import type { RevolutionBarEvaluation } from "./contracts";
import {
  SCORE_ANALYSIS_PARITY_TOLERANCE,
  compareScoreAnalysisParity,
  parityFailureMessage,
  snapshotFromEvaluation,
  type ScoreAnalysisParitySnapshot,
} from "./scoreAnalysisParity";

function baseEval(
  overrides: Partial<RevolutionBarEvaluation> & {
    summary?: RevolutionBarEvaluation["summary"];
  } = {},
): RevolutionBarEvaluation {
  return {
    ok: true,
    mode: "full",
    exploratory: false,
    validForFinalRanking: true,
    horizonTicks: 500,
    objectiveType: "balanced",
    score: 12_000,
    reasons: [],
    bar: ["sever", "assault"],
    profileId: "balanced",
    summary: {
      ok: true,
      totalExpected: 50_000,
      damageByTick: { 0: 100 },
      rng: { residualWeight: 0, exactness: "exact" },
    },
    metrics: {
      dpm: 10_000,
      totalExpected: 50_000,
      openingDpm: 11_000,
      developedDpm: 12_000,
      steadyDpm: 13_000,
    },
    objective: {
      ok: true,
      minDpm: 11_000,
      weightedMean: 12_000,
      robustScore: 12_000,
      openingDpm: 11_000,
      developedDpm: 12_000,
      steadyDpm: 13_000,
      profileId: "balanced",
      weights: {
        opening: 1,
        developed: 1,
        steady: 1,
        robustMean: 0.7,
        robustMin: 0.3,
      },
    },
    ...overrides,
  };
}

describe("scoreAnalysisParity", () => {
  it("snapshots ranking surface from evaluation", () => {
    const snap = snapshotFromEvaluation(baseEval());
    expect(snap).not.toBeNull();
    expect(snap!.ok).toBe(true);
    expect(snap!.validForFinalRanking).toBe(true);
    expect(snap!.score).toBe(12_000);
    expect(snap!.totalExpected).toBe(50_000);
    expect(snap!.openingDpm).toBe(11_000);
    expect(snap!.residualWeight).toBe(0);
    expect(snap!.concreteMass).toBe(0);
    expect(snap!.damageByTick[0]).toBe(100);
    expect(snap!.exactness).toBe("exact");
  });

  it("fails when damageByTick drifts past tol", () => {
    const scoreOnly = snapshotFromEvaluation(baseEval())!;
    const full = snapshotFromEvaluation(
      baseEval({
        summary: {
          ok: true,
          totalExpected: 50_000,
          damageByTick: { 0: 100.5 },
          rng: { residualWeight: 0, exactness: "exact" },
        },
      }),
    )!;
    const cmp = compareScoreAnalysisParity(scoreOnly, full);
    expect(cmp.pass).toBe(false);
    expect(cmp.mismatches.some((m) => m.field.startsWith("damageByTick"))).toBe(true);
  });

  it("fails when concreteMass drifts past tol", () => {
    const scoreOnly = snapshotFromEvaluation(
      baseEval({
        summary: {
          ok: true,
          totalExpected: 50_000,
          damageByTick: { 0: 100 },
          rng: { residualWeight: 0, concreteMass: 1, exactness: "exact" },
        },
      }),
    )!;
    const full = snapshotFromEvaluation(
      baseEval({
        summary: {
          ok: true,
          totalExpected: 50_000,
          damageByTick: { 0: 100 },
          rng: { residualWeight: 0, concreteMass: 0.9, exactness: "exact" },
        },
      }),
    )!;
    const cmp = compareScoreAnalysisParity(scoreOnly, full);
    expect(cmp.pass).toBe(false);
    expect(cmp.mismatches.some((m) => m.field === "concreteMass")).toBe(true);
  });

  it("passes when score-only and full-analysis match within tol", () => {
    const a = snapshotFromEvaluation(baseEval())!;
    const b = snapshotFromEvaluation(baseEval({ score: 12_000 + SCORE_ANALYSIS_PARITY_TOLERANCE / 2 }))!;
    const cmp = compareScoreAnalysisParity(a, b);
    expect(cmp.pass).toBe(true);
    expect(cmp.mismatches).toHaveLength(0);
  });

  it("fails when robust score drifts past tol", () => {
    const scoreOnly = snapshotFromEvaluation(baseEval({ score: 100 }))!;
    const full = snapshotFromEvaluation(baseEval({ score: 100.5 }))!;
    const cmp = compareScoreAnalysisParity(scoreOnly, full);
    expect(cmp.pass).toBe(false);
    expect(cmp.mismatches.some((m) => m.field === "score")).toBe(true);
    expect(parityFailureMessage(cmp.mismatches)).toMatch(/score-analysis parity failed/);
    expect(parityFailureMessage(cmp.mismatches)).toMatch(/score/);
  });

  it("fails on exactness mismatch", () => {
    const scoreOnly: ScoreAnalysisParitySnapshot = {
      ...snapshotFromEvaluation(baseEval())!,
      exactness: "exact",
    };
    const full: ScoreAnalysisParitySnapshot = {
      ...scoreOnly,
      exactness: "approximated",
    };
    const cmp = compareScoreAnalysisParity(scoreOnly, full);
    expect(cmp.pass).toBe(false);
    expect(cmp.mismatches.some((m) => m.field === "exactness")).toBe(true);
  });

  it("fails when either snapshot is null", () => {
    const a = snapshotFromEvaluation(baseEval());
    const cmp = compareScoreAnalysisParity(a, null);
    expect(cmp.pass).toBe(false);
    expect(cmp.mismatches.some((m) => m.field === "snapshot")).toBe(true);
  });
});
