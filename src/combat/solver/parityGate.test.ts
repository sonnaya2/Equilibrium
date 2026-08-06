import { describe, expect, it } from "vitest";
import type { ScoredBar, SolveResult } from "./contracts";
import { collectParityGateBars, selectAfterParity, type ParityGateCandidate } from "./parityGate";
import type { WinnerPresentation } from "./evaluate";

function fullBar(bar: readonly string[], score: number): ScoredBar {
  return {
    bar: [...bar],
    fingerprint: bar.join("\0"),
    robustScore: score,
    profileId: "balanced",
    mode: "full",
    objectiveType: "balanced",
    horizonTicks: 500,
    exploratory: false,
    validForFinalRanking: true,
    minDpm: score,
    weightedMean: score,
    openingDpm: score,
    developedDpm: score,
    steadyDpm: score,
  };
}

function presentation(score: number): WinnerPresentation {
  return {
    recheckScore: score,
    summary: { totalExpected: score, dps: 1, ticks: 500, ok: true },
  };
}

function validated(bar: readonly string[], score: number): ParityGateCandidate {
  return {
    bar,
    fingerprint: bar.join("\0"),
    rankingScore: score,
    openingDpm: score,
    developedDpm: score,
    steadyDpm: score,
    presentation: presentation(score),
  };
}

function priorResult(partial: Partial<SolveResult> = {}): SolveResult {
  const best = fullBar(["a", "b"], 1000);
  return {
    status: "ok",
    best,
    top: [best],
    proof: "heuristic-best-found",
    searchEvaluations: 5,
    fullEvaluations: 2,
    totalEvaluations: 7,
    searchBudget: 20,
    evaluationsUsed: 7,
    evaluationBudget: 20,
    exhaustiveCompleted: false,
    tier: "thorough",
    seedBestScore: 1,
    bestExploratoryScore: 2,
    bestFullScore: 1000,
    validFullCandidateCount: 1,
    incumbentBar: null,
    incumbentScore: Number.NEGATIVE_INFINITY,
    isUpgrade: true,
    scoreImprovement: 0,
    percentImprovement: null,
    validForApply: true,
    stats: {
      evaluations: 7,
      searchEvaluations: 5,
      fullEvaluations: 2,
      cacheHits: 0,
      cacheMisses: 7,
      searchCacheHits: 0,
      fullCacheHits: 0,
      uniqueBars: 2,
      elapsedMs: 1,
    },
    ...partial,
  };
}

describe("parityGate selection", () => {
  it("collects top rankable and includes incumbent when absent from top", () => {
    const topA = fullBar(["x", "y"], 2000);
    const result = priorResult({
      best: topA,
      top: [topA],
      incumbentBar: ["i", "n"],
      incumbentScore: 1500,
    });
    const bars = collectParityGateBars(result);
    expect(bars.map((b) => b.bar.join("|"))).toEqual(["x|y", "i|n"]);
  });

  it("selects upgrade when proposed beats validated incumbent", () => {
    const out = selectAfterParity({
      validated: [validated(["u", "p"], 2000), validated(["i", "n"], 1000)],
      incumbentBar: ["i", "n"],
      prior: priorResult({ incumbentBar: ["i", "n"], incumbentScore: 1000 }),
    });
    expect(out.status).toBe("ok");
    expect(out.isUpgrade).toBe(true);
    expect(out.validForApply).toBe(true);
    expect(out.best?.bar).toEqual(["u", "p"]);
    expect(out.best?.robustScore).toBe(2000);
    expect(out.scoreImprovement).toBe(1000);
  });

  it("keeps incumbent when no validated upgrade beats it", () => {
    const out = selectAfterParity({
      validated: [validated(["i", "n"], 2000), validated(["weak"], 1500)],
      incumbentBar: ["i", "n"],
      prior: priorResult({ incumbentBar: ["i", "n"] }),
    });
    expect(out.status).toBe("ok");
    expect(out.isUpgrade).toBe(false);
    expect(out.validForApply).toBe(false);
    expect(out.best?.bar).toEqual(["i", "n"]);
    expect(out.scoreImprovement).toBe(0);
  });

  it("upgrades when only proposed is validated (no incumbent)", () => {
    const out = selectAfterParity({
      validated: [validated(["a", "b"], 900)],
      incumbentBar: null,
      prior: priorResult(),
    });
    expect(out.status).toBe("ok");
    expect(out.isUpgrade).toBe(true);
    expect(out.validForApply).toBe(true);
    expect(out.best?.bar).toEqual(["a", "b"]);
  });

  it("fails when no validated candidates remain", () => {
    const out = selectAfterParity({
      validated: [],
      incumbentBar: ["i"],
      prior: priorResult({ incumbentBar: ["i"] }),
    });
    expect(out.status).toBe("failed");
    expect(out.best).toBeNull();
    expect(out.validFullCandidateCount).toBe(0);
    expect(out.proof).toBe("failed");
  });

  it("parity mismatch outcome: rejected challenger cannot displace incumbent", () => {
    // Simulates runScoreAnalysisParityGate after challenger failed compareScoreAnalysisParity:
    // only incumbent remains in validated[]; prior thought challenger won search.
    const out = selectAfterParity({
      validated: [validated(["i"], 1000)],
      incumbentBar: ["i"],
      prior: priorResult({
        best: fullBar(["challenger"], 9000),
        top: [fullBar(["challenger"], 9000), fullBar(["i"], 1000)],
        incumbentBar: ["i"],
        incumbentScore: 1000,
        isUpgrade: true,
        validForApply: true,
      }),
    });
    expect(out.best?.bar).toEqual(["i"]);
    expect(out.isUpgrade).toBe(false);
    expect(out.validForApply).toBe(false);
    expect(out.top.every((t) => t.bar.join("|") !== "challenger")).toBe(true);
  });

  it("does not keep a stale high prior when only lower parity-pass remains", () => {
    // Prior search thought stale was best; gate only validated weak + incumbent.
    const out = selectAfterParity({
      validated: [validated(["weak"], 800), validated(["i"], 1000)],
      incumbentBar: ["i"],
      prior: priorResult({
        best: fullBar(["stale"], 5000),
        incumbentBar: ["i"],
        incumbentScore: 1000,
      }),
    });
    expect(out.best?.bar).toEqual(["i"]);
    expect(out.isUpgrade).toBe(false);
    expect(out.top.every((t) => t.bar.join("|") !== "stale")).toBe(true);
  });
});
