/**
 * Adversarial honesty contract for solver branch scoring, finalization, DTO, memo.
 * Do not weaken to match broken production fallback.
 */
import { describe, expect, it } from "vitest";
import {
  enableBranchProfiling,
  getBranchProfile,
  mergeAndCapBranches,
  resetBranchProfile,
  snapshotRuntime,
  type Branch,
} from "../engine/simulation/branch";
import { combineBranchSummaries } from "../engine/simulation/summary";
import { createRuntime } from "../engine/runtime/runtime";
import { baseInput } from "../test/fixtures/inputs";
import {
  scoreSummary,
  summaryEligibleForObjectiveScore,
  summaryObjectiveIneligibilityReason,
} from "./objective";
import {
  branchFidelityLadderMemoToken,
  branchFidelityCacheToken,
  meetsBranchCompleteness,
  resolveBranchFidelityLadder,
  simulateWithAdaptiveBranchFidelity,
  DEFAULT_BRANCH_FIDELITY_LADDERS,
} from "./branchFidelity";
import { fingerprintEvaluationKey } from "./fingerprint";
import { OBJECTIVE_VERSION } from "./contracts";
import type { EvaluateFn, PoolAbility, ScoredBar, ScoreableSummary } from "./contracts";
import { configForTier, solve } from "./solve";
import { finalizeSearch } from "./search/finalize";
import { createSearchState } from "./search/types";
import { buildSolverResultDto } from "./resultBuilder";
import {
  CURRENT_BAR_REMAINS_BEST_NOTE,
  defaultSerializableRequest,
  emptyModifierSources,
} from "./worker/serializable";
import type { WinnerPresentation } from "./evaluate";
import { EQUIPMENT_SET_ACTIVATION, type ActiveEquipmentEffects } from "../shared/equipment";
import {
  mayApplySolverResultBar,
  shouldAdoptSolverResultBar,
} from "@/components/combat/revoPanelFormat";
import { isRankableSolverResult } from "./rankResults";
import { clearEvalMemo, readEvalMemo, writeEvalMemo } from "./evalMemo";
import { dtoAllowsApply } from "./solverDtoHonesty";
import {
  measureResidualStats,
  survivorBiasPrimaryFixture,
} from "./repro/survivorBiasRanking.repro";
import { simulateRevolution } from "../engine/simulation/revolution";
import { selectAfterParity, type ParityGateCandidate } from "./parityGate";
const tinyPool: PoolAbility[] = [
  { id: "a", category: "basic", averageDamage: 10, occupancyTicks: 3 },
  { id: "b", category: "enhanced", averageDamage: 30, occupancyTicks: 3 },
  { id: "c", category: "ultimate", averageDamage: 100, occupancyTicks: 3 },
];

const emptyEffects: ActiveEquipmentEffects = {
  activation: EQUIPMENT_SET_ACTIVATION,
  passiveIds: [],
  enchantments: [],
  weaponClass: null,
  defenderEquipped: false,
  passage: { active: false, agonyActive: false },
  amZiFlatDamage: 0,
  amHejDamageBonus: 0,
  vestments: {
    pieces: 0,
    heraldOfChaos: false,
    berserkExtension: false,
    increasedAdrenalineCap: false,
  },
};

function seedRt(damage: number) {
  const rt = createRuntime(baseInput);
  rt.totalExpected = damage;
  rt.totalMin = damage;
  rt.totalMax = damage;
  rt.damageByTick[0] = damage;
  rt.endTick = 10;
  rt.analysis.directDamage = damage;
  return rt;
}

function fullWinner(bar: readonly string[], score: number): ScoredBar {
  return {
    bar: [...bar],
    fingerprint: bar.join("|"),
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

function okSolve(best: ScoredBar, overrides: Partial<import("./contracts").SolveResult> = {}) {
  return {
    status: "ok" as const,
    best,
    top: [best],
    proof: "heuristic-best-found" as const,
    searchEvaluations: 10,
    fullEvaluations: 3,
    totalEvaluations: 13,
    searchBudget: 28,
    evaluationsUsed: 13,
    evaluationBudget: 28,
    exhaustiveCompleted: false,
    tier: "thorough" as const,
    seedBestScore: 1,
    bestExploratoryScore: 2,
    bestFullScore: best.robustScore,
    validFullCandidateCount: 1,
    incumbentBar: null as readonly string[] | null,
    incumbentScore: Number.NEGATIVE_INFINITY,
    isUpgrade: true,
    scoreImprovement: 0,
    percentImprovement: null as number | null,
    validForApply: true,
    stats: {
      evaluations: 13,
      searchEvaluations: 10,
      fullEvaluations: 3,
      cacheHits: 0,
      cacheMisses: 13,
      searchCacheHits: 0,
      fullCacheHits: 0,
      uniqueBars: 5,
      elapsedMs: 1,
    },
    ...overrides,
  };
}

const baseRequest = defaultSerializableRequest({
  style: "melee",
  durationTicks: 500,
  seed: 1,
  minBarSize: 1,
  maxBarSize: 11,
  loadout: {
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    equipmentEffects: emptyEffects,
    league: {
      ruleset: "base",
      blessings: [],
      blessingIds: [],
      totalArmour: 0,
      maximumLife: 10_000,
      powerburstUntilTick: 0,
      targetTiles: 1,
    },
    equipmentIds: [],
    weaponConfiguration: "dualwield",
    startingAdrenaline: 100,
    modifierSources: emptyModifierSources(),
  },
});

describe("honesty contract: branch aggregation", () => {
  it("34% concrete + 66% residual cannot produce unit-mass EV by normalization", () => {
    const rt = seedRt(1000);
    const s = combineBranchSummaries(
      [{ weight: 0.34, rt }],
      undefined,
      undefined,
      true,
      0.66,
      "bounded-approximation",
    );
    expect(s.damage.concreteMass).toBeCloseTo(0.34, 10);
    expect(s.damage.residualMass).toBeCloseTo(0.66, 10);
    expect(s.damage.conditionalConcreteMean).toBeCloseTo(1000, 10);
    expect(s.damage.knownMassExpectedDamage).toBeCloseTo(340, 10);
    expect(s.totalExpected).toBeCloseTo(340, 10);
    expect(s.damage.scope).toBe("known-mass-contribution");
    expect(s.rng?.totalsBasis).toBe("known-mass-contribution");
    expect(s.damage.eligibleForRanking).toBe(false);
    expect(summaryEligibleForObjectiveScore(s as ScoreableSummary)).toBe(false);
    expect(scoreSummary(s as ScoreableSummary, "balanced").ok).toBe(false);
  });

  it("known-mass damage equals conditional mean * concrete mass", () => {
    const rt = seedRt(2500);
    const s = combineBranchSummaries(
      [{ weight: 0.34, rt }],
      undefined,
      undefined,
      true,
      0.66,
      "bounded-approximation",
    );
    expect(s.damage.knownMassExpectedDamage).toBeCloseTo(
      s.damage.conditionalConcreteMean! * s.damage.concreteMass!,
      10,
    );
  });

  it("tick ledgers follow the same known-mass probability semantics", () => {
    const rt = seedRt(1000);
    rt.damageByTick[0] = 1000;
    const s = combineBranchSummaries(
      [{ weight: 0.34, rt }],
      undefined,
      undefined,
      true,
      0.66,
      "bounded-approximation",
    );
    expect(s.damageByTick[0]).toBeCloseTo(340, 10);
    expect(s.damageByTick[0]).not.toBeCloseTo(1000, 5);
  });

  it("residual mass is never reassigned to survivors under cap", () => {
    const base = createRuntime(baseInput);
    const branches: Branch[] = Array.from({ length: 100 }, (_, i) => {
      const rt = snapshotRuntime(base);
      rt.state = { ...rt.state, adrenaline: i };
      return { weight: 0.01, rt };
    });
    const out = mergeAndCapBranches(branches, 10);
    const kept = out.branches.reduce((s, b) => s + b.weight, 0);
    expect(out.residualWeight).toBeCloseTo(1 - kept, 10);
    expect(out.residualWeight).toBeGreaterThan(0.5);
    const maxW = Math.max(...out.branches.map((b) => b.weight));
    expect(maxW).toBeLessThanOrEqual(0.01 + 1e-12);
    expect(out.exactness).toBe("bounded-approximation");
  });

  it("exact branch expansion retains residual-free exact outputs", () => {
    const base = createRuntime(baseInput);
    const twins = [
      { weight: 0.3, rt: snapshotRuntime(base) },
      { weight: 0.7, rt: snapshotRuntime(base) },
    ];
    const out = mergeAndCapBranches(twins, 64);
    expect(out.residualWeight).toBe(0);
    expect(out.exactness).toBe("merged-exactly");
    expect(out.branches).toHaveLength(1);
    expect(out.branches[0]!.weight).toBeCloseTo(1);
  });
});

describe("honesty contract: solver search", () => {
  it("search cannot rank heavily truncated conditional score as ordinary score", () => {
    const residualSummary: ScoreableSummary = {
      ok: true,
      damageByTick: { 0: 50_000 },
      totalExpected: 50_000,
      rng: {
        residualWeight: 0.66,
        concreteMass: 0.34,
        totalsBasis: "known-mass-contribution",
        exactness: "approximated",
      },
      damage: {
        scope: "known-mass-contribution",
        knownMassExpectedDamage: 17_000,
        conditionalConcreteMean: 50_000,
      },
    };
    expect(summaryObjectiveIneligibilityReason(residualSummary)).toMatch(/residual/);
    expect(scoreSummary(residualSummary, "balanced").ok).toBe(false);

    const evaluate: EvaluateFn = ({ mode }) => {
      if (mode === "full" || mode === "finalize") {
        return { score: Number.NEGATIVE_INFINITY, finite: false, mode: "full" };
      }
      return { score: Number.NEGATIVE_INFINITY, finite: false, mode: "search" };
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      tier: "thorough",
      seed: 1,
    });
    expect(result.status).toBe("failed");
    expect(result.best).toBeNull();
    expect(result.validFullCandidateCount).toBe(0);
  });

  it("adaptive branch retries increase live budget when residual is high", () => {
    enableBranchProfiling(true);
    resetBranchProfile();
    const fixture = survivorBiasPrimaryFixture();
    // Residual-free threshold forces climb on survivor-bias residual at low live caps.
    const ladder = {
      mode: "exploratory" as const,
      liveCaps: [16, 32, 64],
      maximumResidualWeight: 1e-12,
      exactness: "any" as const,
    };
    const out = simulateWithAdaptiveBranchFidelity(
      fixture.revoInput,
      { detailLevel: "score-only" },
      ladder,
    );
    expect(out.meta.residualWeight).toBeGreaterThan(1e-12);
    expect(out.meta.attempts).toBeGreaterThanOrEqual(2);
    expect(out.meta.finalBudget.maxLiveBranches).toBeGreaterThan(16);
    const prof = getBranchProfile();
    expect(prof.fidelityRetries).toBe(out.meta.attempts);
    enableBranchProfiling(false);
    resetBranchProfile();
  });

  it("candidate remains unrankable if fidelity ladder exhausts with residual", () => {
    const incomplete = {
      ok: true,
      rng: { residualWeight: 0.2, exactness: "approximated" as const },
    };
    const fullLadder = resolveBranchFidelityLadder("full");
    expect(meetsBranchCompleteness(incomplete, fullLadder)).toBe(false);
  });

  it("approximate exploratory scores cannot enter the full leaderboard", () => {
    const evaluate: EvaluateFn = ({ mode }) => {
      if (mode === "full" || mode === "finalize") {
        return { score: Number.NEGATIVE_INFINITY, finite: false, mode: "full" };
      }
      return {
        score: 99_999,
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      tier: "thorough",
      seed: 2,
    });
    expect(result.best).toBeNull();
    expect(result.proof).toBe("failed");
    expect(result.bestExploratoryScore).toBeGreaterThan(0);
    expect(result.validFullCandidateCount).toBe(0);
  });

  it("search and full memo keys stay distinct across branch budgets and fidelity", () => {
    const bar = ["a", "b"] as const;
    const searchKey = fingerprintEvaluationKey({
      bar,
      mode: "search",
      horizonTicks: 40,
      profileId: "balanced",
      context: {
        branchFidelityMode: "exploratory",
        branchFidelityToken: branchFidelityLadderMemoToken(
          DEFAULT_BRANCH_FIDELITY_LADDERS.exploratory,
        ),
      },
      objectiveVersion: OBJECTIVE_VERSION,
    });
    const fullKey = fingerprintEvaluationKey({
      bar,
      mode: "full",
      horizonTicks: 500,
      profileId: "balanced",
      context: {
        branchFidelityMode: "full",
        branchFidelityToken: branchFidelityLadderMemoToken(DEFAULT_BRANCH_FIDELITY_LADDERS.full),
      },
      objectiveVersion: OBJECTIVE_VERSION,
    });
    expect(searchKey).not.toBe(fullKey);

    const caps64 = branchFidelityLadderMemoToken({
      mode: "full",
      liveCaps: [64],
      maximumResidualWeight: 1e-12,
      exactness: "exact-or-merged",
    });
    const caps4096 = branchFidelityLadderMemoToken({
      mode: "full",
      liveCaps: [4096],
      maximumResidualWeight: 1e-12,
      exactness: "exact-or-merged",
    });
    expect(caps64).not.toBe(caps4096);

    const key64 = fingerprintEvaluationKey({
      bar,
      mode: "full",
      context: { branchFidelityToken: caps64 },
    });
    const key4096 = fingerprintEvaluationKey({
      bar,
      mode: "full",
      context: { branchFidelityToken: caps4096 },
    });
    expect(key64).not.toBe(key4096);

    clearEvalMemo();
    writeEvalMemo(key64, {
      score: 1000,
      finite: true,
      mode: "full",
      validForFinalRanking: true,
    });
    expect(readEvalMemo(key4096)).toBeUndefined();
    expect(readEvalMemo(key64)?.score).toBe(1000);

    expect(
      branchFidelityCacheToken({
        mode: "full",
        attempts: 1,
        finalBudget: {
          maxLiveBranches: 64,
          maxIntermediateBranches: 128,
          maximumResidualWeight: 1e-12,
        },
        complete: true,
        residualWeight: 0,
      }),
    ).not.toBe(
      branchFidelityCacheToken({
        mode: "full",
        attempts: 4,
        finalBudget: {
          maxLiveBranches: 4096,
          maxIntermediateBranches: 8192,
          maximumResidualWeight: 1e-12,
        },
        complete: true,
        residualWeight: 0,
      }),
    );
  });
});

describe("honesty contract: finalization", () => {
  it("zero valid full candidates returns failed with no validated winner", () => {
    const evaluate: EvaluateFn = ({ mode }) => {
      if (mode === "full" || mode === "finalize") {
        return { score: Number.NEGATIVE_INFINITY, finite: false, mode: "full" };
      }
      return { score: 100, finite: true, mode: "search", exploratory: true };
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      tier: "thorough",
      seed: 4,
    });
    expect(result.status).toBe("failed");
    expect(result.best).toBeNull();
    expect(result.proof).toBe("failed");
    expect(() =>
      buildSolverResultDto({
        request: baseRequest,
        result,
        poolSize: 3,
        uniqueBars: 1,
        fullTicks: 500,
        evaluationBudget: 28,
        blessingIds: [],
      }),
    ).toThrow(/no validated full-horizon/);
  });

  it("exploratory fallback cannot populate best or enter DTO as solved bar", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        return { score: Number.NEGATIVE_INFINITY, finite: false, mode: "full" };
      }
      return {
        score: bar.includes("c") ? 5000 : 10,
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      tier: "thorough",
      seed: 5,
    });
    expect(result.best).toBeNull();
    expect(result.proof).not.toBe("degraded-exploratory-fallback");
    expect(result.bestExploratoryScore).toBeGreaterThan(0);
  });

  it("current user bar is always full-evaluated even when shortlist is full", () => {
    let incumbentFullCalls = 0;
    const incumbent = ["a"] as const;
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        if (bar.join("|") === "a") incumbentFullCalls += 1;
        return {
          score: bar.join("|") === "a" ? 100 : 50 + bar.length,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
        };
      }
      return {
        score: bar.includes("c") ? 9999 : 1,
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };
    const config = { ...configForTier("thorough"), fullShortlistSize: 2, topK: 2 };
    const state = createSearchState({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      config,
      seeds: [["b"], ["c"]],
      incumbentBar: incumbent,
    });
    for (const id of ["b", "c"] as const) {
      state.forceEval([id], "search", "seed");
    }
    const result = finalizeSearch(state, { tier: "thorough", topK: 2 });
    expect(incumbentFullCalls).toBeGreaterThanOrEqual(1);
    expect(result.incumbentBar).toEqual(["a"]);
    expect(result.incumbentScore).toBe(100);
  });

  it("current bar cannot be displaced by a candidate with lower full score", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        const full = bar[0] === "a" ? 1000 : 100;
        return {
          score: full,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
        };
      }
      return {
        score: bar[0] === "b" ? 9999 : 1,
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 1 },
      evaluate,
      tier: "thorough",
      seed: 6,
      incumbentBar: ["a"],
    });
    expect(result.isUpgrade).toBe(false);
    expect(result.best?.bar).toEqual(["a"]);
    expect(result.validForApply).toBe(false);
  });

  it("candidate that wins exploratory but loses full validation is rejected", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        if (bar.includes("c")) {
          return { score: Number.NEGATIVE_INFINITY, finite: false, mode: "full" };
        }
        return {
          score: 200,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
        };
      }
      return {
        score: bar.includes("c") ? 50_000 : 10,
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      tier: "thorough",
      seed: 7,
    });
    expect(result.best).not.toBeNull();
    expect(result.best!.bar.includes("c")).toBe(false);
    expect(result.best!.mode).toBe("full");
    expect(result.best!.validForFinalRanking).toBe(true);
  });

  it("candidate that beats incumbent only via conditional branch normalization is rejected", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        // Challenger: residual-shaped non-rankable; incumbent residual-free.
        if (bar[0] === "c") {
          return {
            score: Number.NEGATIVE_INFINITY,
            finite: false,
            mode: "full",
            validForFinalRanking: false,
            failureReason: "simulation residualWeight=0.66",
          };
        }
        return {
          score: bar[0] === "a" ? 500 : 100,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
        };
      }
      // Explore prefers residual challenger.
      return {
        score: bar[0] === "c" ? 50_000 : 10,
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 1 },
      evaluate,
      tier: "thorough",
      seed: 11,
      incumbentBar: ["a"],
    });
    expect(result.best?.bar).toEqual(["a"]);
    expect(result.best?.bar.includes("c")).toBe(false);
    expect(result.isUpgrade).toBe(false);
  });

  it("no-upgrade leaves incumbent in place with Apply disabled", () => {
    const winner = fullWinner(["a"], 1000);
    const result = okSolve(winner, {
      incumbentBar: ["a"],
      incumbentScore: 1000,
      isUpgrade: false,
      validForApply: false,
      scoreImprovement: 0,
    });
    const dto = buildSolverResultDto({
      request: baseRequest,
      result,
      poolSize: 3,
      uniqueBars: 1,
      fullTicks: 500,
      evaluationBudget: 28,
      blessingIds: [],
    });
    expect(dto.isUpgrade).toBe(false);
    expect(dto.validForApply).toBe(false);
    expect(dto.honesty?.beatsBar).toBe(false);
    expect(dto.honesty?.applyAllowed).toBe(false);
    expect(dto.proof?.notes?.some((n) => n.includes(CURRENT_BAR_REMAINS_BEST_NOTE))).toBe(true);
    expect(mayApplySolverResultBar(dto)).toBe(false);
    expect(shouldAdoptSolverResultBar(dto)).toBe(false);
  });
});

describe("honesty contract: parity", () => {
  function validated(bar: readonly string[], score: number): ParityGateCandidate {
    return {
      bar,
      fingerprint: bar.join("\0"),
      rankingScore: score,
      openingDpm: score,
      developedDpm: score,
      steadyDpm: score,
      presentation: {
        recheckScore: score,
        summary: { totalExpected: score, dps: 1, ticks: 500, ok: true },
      },
    };
  }

  it("if all parity checks fail, solver returns no validated winner", () => {
    const out = selectAfterParity({
      validated: [],
      incumbentBar: null,
      prior: okSolve(fullWinner(["a"], 100)),
    });
    expect(out.best).toBeNull();
    expect(out.validFullCandidateCount).toBe(0);
    expect(out.status).toBe("failed");
  });

  it("parity keeps incumbent when only lower validated candidate remains", () => {
    const out = selectAfterParity({
      validated: [validated(["weak"], 800), validated(["i"], 1000)],
      incumbentBar: ["i"],
      prior: okSolve(fullWinner(["stale"], 5000), {
        incumbentBar: ["i"],
        incumbentScore: 1000,
      }),
    });
    expect(out.best?.bar).toEqual(["i"]);
    expect(out.isUpgrade).toBe(false);
    expect(out.validForApply).toBe(false);
  });
});

describe("honesty contract: DTO + Apply", () => {
  it("DTO honesty block communicates status, validation, residual, scores, Apply", () => {
    const winner = fullWinner(["a", "b"], 2000);
    const presentation: WinnerPresentation = {
      recheckScore: 2000,
      summary: {
        totalExpected: 10_000,
        dps: 20,
        ticks: 500,
        ok: true,
        rng: { residualWeight: 0, exactness: "exact", probabilityMass: 1 },
      },
      rng: { residualWeight: 0, exactness: "exact" },
    };
    const dto = buildSolverResultDto({
      request: baseRequest,
      result: okSolve(winner, {
        incumbentBar: ["x"],
        incumbentScore: 1500,
        isUpgrade: true,
        scoreImprovement: 500,
        percentImprovement: 33.3,
        validForApply: true,
      }),
      poolSize: 3,
      uniqueBars: 2,
      fullTicks: 500,
      evaluationBudget: 28,
      blessingIds: [],
      presentation,
    });
    expect(dto.honesty).toEqual(
      expect.objectContaining({
        status: "ok",
        fullyValidated: true,
        beatsBar: true,
        residualMass: 0,
        branchExactness: "exact",
        currentBarScore: 1500,
        proposedBarScore: 2000,
        improvement: 500,
        applyAllowed: true,
      }),
    );
    expect(dto.baselineScore).toBe(1500);
    expect(dto.winnerScore).toBe(2000);
    expect(mayApplySolverResultBar(dto)).toBe(true);
    expect(dtoAllowsApply(dto)).toBe(true);
    expect(isRankableSolverResult(dto)).toBe(true);
  });

  it("residual presentation blocks Apply but keeps beatsBar score truth", () => {
    const winner = fullWinner(["a", "b"], 2000);
    const presentation: WinnerPresentation = {
      recheckScore: 2000,
      summary: {
        totalExpected: 340,
        dps: 1,
        ticks: 500,
        ok: true,
        rng: {
          residualWeight: 0.66,
          exactness: "approximated",
          probabilityMass: 0.34,
          totalsBasis: "known-mass-contribution",
        },
      },
      rng: { residualWeight: 0.66, exactness: "approximated" },
    };
    const dto = buildSolverResultDto({
      request: baseRequest,
      result: okSolve(winner, {
        incumbentBar: ["x"],
        incumbentScore: 100,
        isUpgrade: true,
        scoreImprovement: 1900,
        validForApply: true,
      }),
      poolSize: 3,
      uniqueBars: 2,
      fullTicks: 500,
      evaluationBudget: 28,
      blessingIds: [],
      presentation,
    });
    expect(dto.honesty?.residualMass).toBeCloseTo(0.66, 10);
    expect(dto.honesty?.beatsBar).toBe(true);
    expect(dto.isUpgrade).toBe(true);
    expect(dto.honesty?.fullyValidated).toBe(false);
    expect(dto.honesty?.applyAllowed).toBe(false);
    expect(dto.validForApply).toBe(false);
    expect(mayApplySolverResultBar(dto)).toBe(false);
    expect(shouldAdoptSolverResultBar(dto)).toBe(false);
    expect(isRankableSolverResult(dto)).toBe(false);
  });
});

describe("honesty contract: end-to-end residual case", () => {
  it(
    "reproduces high residual case and refuses to rank/apply residual mass",
    () => {
      enableBranchProfiling(true);
      resetBranchProfile();
      const fixture = survivorBiasPrimaryFixture();
      const stats = measureResidualStats(fixture);
      expect(stats.residualWeight).toBeGreaterThanOrEqual(0.5);
      expect(stats.concreteMass + stats.residualWeight).toBeCloseTo(1, 5);

      // Pre-fix inflated view: conditional mean >> known-mass contribution.
      expect(stats.conditionalConcreteMean).toBeGreaterThan(stats.knownMassDamage);
      expect(stats.survivorRenormFactor).toBeGreaterThan(1);

      const summary = simulateRevolution(fixture.revoInput, {
        detailLevel: "score-only",
        branchBudget: {
          maxLiveBranches: 64,
          maxIntermediateBranches: 128,
          maximumResidualWeight: 1e-12,
        },
      });
      expect(summary.rng?.residualWeight ?? 0).toBeGreaterThan(0.5);
      expect(summaryEligibleForObjectiveScore(summary as ScoreableSummary)).toBe(false);
      expect(scoreSummary(summary as ScoreableSummary, "balanced").ok).toBe(false);

      // Bounded adaptive climb (not full 4096 ladder) keeps the suite tractable.
      const adaptive = simulateWithAdaptiveBranchFidelity(
        fixture.revoInput,
        { detailLevel: "score-only" },
        {
          mode: "full",
          liveCaps: [64, 128, 256],
          maximumResidualWeight: 1e-12,
          exactness: "exact-or-merged",
        },
      );
      if (adaptive.meta.complete && adaptive.meta.residualWeight <= 1e-12) {
        expect(summaryEligibleForObjectiveScore(adaptive.summary as ScoreableSummary)).toBe(
          true,
        );
      } else {
        expect(summaryEligibleForObjectiveScore(adaptive.summary as ScoreableSummary)).toBe(
          false,
        );
      }

      const prof = getBranchProfile();
      expect(prof.fidelityRetries).toBeGreaterThanOrEqual(1);
      console.log(
        "[honesty residual branch profile]",
        JSON.stringify({
          residualWeight: stats.residualWeight,
          concreteMass: stats.concreteMass,
          knownMassDamage: stats.knownMassDamage,
          conditionalConcreteMean: stats.conditionalConcreteMean,
          survivorRenormFactor: stats.survivorRenormFactor,
          adaptiveAttempts: adaptive.meta.attempts,
          adaptiveComplete: adaptive.meta.complete,
          adaptiveResidual: adaptive.meta.residualWeight,
          adaptiveMaxLive: adaptive.meta.finalBudget.maxLiveBranches,
          profile: prof,
        }),
      );

      // Residual is what blocks Apply even when flags claim upgrade.
      const winner = fullWinner(fixture.barIds, stats.knownMassDamage + 5_000);
      const dto = buildSolverResultDto({
        request: baseRequest,
        result: okSolve(winner, {
          incumbentBar: ["slice"],
          incumbentScore: stats.knownMassDamage,
          isUpgrade: true,
          scoreImprovement: 5_000,
          validForApply: true,
        }),
        poolSize: 3,
        uniqueBars: 1,
        fullTicks: fixture.durationTicks,
        evaluationBudget: 28,
        blessingIds: [],
        presentation: {
          recheckScore: stats.knownMassDamage + 5_000,
          summary: {
            totalExpected: stats.knownMassDamage,
            dps: 1,
            ticks: fixture.durationTicks,
            ok: true,
            rng: {
              residualWeight: stats.residualWeight,
              exactness: "approximated",
              probabilityMass: stats.concreteMass,
            },
          },
          rng: { residualWeight: stats.residualWeight, exactness: "approximated" },
        },
      });
      expect(dto.honesty?.beatsBar).toBe(true);
      expect(dto.honesty?.residualMass).toBeGreaterThan(0.5);
      expect(dto.honesty?.fullyValidated).toBe(false);
      expect(dto.honesty?.applyAllowed).toBe(false);
      expect(mayApplySolverResultBar(dto)).toBe(false);

      enableBranchProfiling(false);
      resetBranchProfile();
    },
    60_000,
  );
});
