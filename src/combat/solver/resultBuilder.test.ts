import { describe, expect, it } from "vitest";
import { buildSolverResultDto } from "./resultBuilder";
import type { SolveResult, ScoredBar } from "./contracts";
import { defaultSerializableRequest, emptyModifierSources } from "./worker/serializable";
import type { WinnerPresentation } from "./evaluate";
import { EQUIPMENT_SET_ACTIVATION, type ActiveEquipmentEffects } from "../shared/equipment";

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

function okResult(best: ScoredBar, top: ScoredBar[] = [best]): SolveResult {
  return {
    status: "ok",
    best,
    top,
    proof: "heuristic-best-found",
    searchEvaluations: 10,
    fullEvaluations: 3,
    totalEvaluations: 13,
    searchBudget: 28,
    evaluationsUsed: 13,
    evaluationBudget: 28,
    exhaustiveCompleted: false,
    tier: "thorough",
    seedBestScore: 1,
    bestExploratoryScore: 2,
    bestFullScore: best.robustScore,
    validFullCandidateCount: top.length,
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
  };
}

const baseRequest = defaultSerializableRequest({
  style: "melee",
  durationTicks: 500,
  seed: 1,
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

describe("buildSolverResultDto", () => {
  it("keeps ranking score and omits summary without presentation", () => {
    const winner = fullWinner(["sever", "assault", "fury"], 12_345.5);
    const dto = buildSolverResultDto({
      request: baseRequest,
      result: okResult(winner),
      poolSize: 20,
      uniqueBars: 5,
      fullTicks: 500,
      evaluationBudget: 28,
      blessingIds: [],
    });
    expect(dto.score).toBe(12_345.5);
    expect(dto.summary).toBeUndefined();
    expect(dto.proof?.recheckScore).toBeUndefined();
    expect(dto.openingDpm).toBe(12_345.5);
  });

  it("attaches full-analysis presentation without rewriting ranking score", () => {
    const rankingScore = 99_001.25;
    const winner = fullWinner(["sever", "assault"], rankingScore);
    const presentation: WinnerPresentation = {
      recheckScore: rankingScore,
      summary: {
        totalExpected: 50_000,
        dps: 100,
        ticks: 500,
        ok: true,
        rng: {
          residualWeight: 0,
          exactness: "exact",
          failedWeight: 0,
          probabilityMass: 1,
        },
      },
      rng: { residualWeight: 0, exactness: "exact" },
    };
    const dto = buildSolverResultDto({
      request: baseRequest,
      result: okResult(winner),
      poolSize: 8,
      uniqueBars: 3,
      fullTicks: 500,
      evaluationBudget: 28,
      blessingIds: [],
      presentation,
    });
    expect(dto.score).toBe(rankingScore);
    expect(dto.summary?.ok).toBe(true);
    expect(dto.summary?.totalExpected).toBe(50_000);
    expect(dto.summary?.rng?.exactness).toBe("exact");
    expect(dto.rng?.exactness).toBe("exact");
    expect(dto.proof?.recheckScore).toBe(rankingScore);
    expect(dto.proof?.notes?.some((n) => n.includes("winner full-analysis"))).toBe(true);
  });

  it("notes recheck delta when presentation score drifts", () => {
    const winner = fullWinner(["sever"], 100);
    const presentation: WinnerPresentation = {
      recheckScore: 100.5,
      summary: { totalExpected: 1, dps: 1, ticks: 10, ok: true },
    };
    const dto = buildSolverResultDto({
      request: baseRequest,
      result: okResult(winner),
      poolSize: 1,
      uniqueBars: 1,
      fullTicks: 500,
      evaluationBudget: 10,
      blessingIds: [],
      presentation,
    });
    expect(dto.score).toBe(100);
    expect(dto.proof?.recheckScore).toBe(100.5);
    expect(dto.proof?.notes?.some((n) => n.startsWith("presentation-recheck-delta"))).toBe(true);
  });
});
