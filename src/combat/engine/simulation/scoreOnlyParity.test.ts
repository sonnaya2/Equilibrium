/**
 * Score-only vs full-analysis ranking parity.
 * Ranking metrics must match bit-for-bit (or exact float equality) so search
 * can drop presentation bookkeeping without changing objective outcomes.
 */
import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../../styles/necromancy/abilities";
import { buildCandidatePool } from "../../solver/candidatePool";
import { evaluateRevolutionBar } from "../../solver/evaluate";
import { scoreSummary } from "../../solver/objective";
import { simulateRevolution, type RevolutionInput } from "./revolution";
import { simulate } from "./simulate";
import { rotationOf } from "./contracts";
import { necroInput } from "../../test/fixtures/inputs";

function rankingSlice(summary: {
  ok: boolean;
  error?: string;
  horizonTicks?: number;
  totalExpected: number;
  damageByTick: Record<number, number>;
  rng?: {
    failedWeight?: number;
    residualWeight?: number;
    exactness?: string;
    concreteMass?: number;
    probabilityMass?: number;
  };
}) {
  const tickKeys = Object.keys(summary.damageByTick)
    .map(Number)
    .sort((a, b) => a - b);
  return {
    ok: summary.ok,
    error: summary.error,
    horizonTicks: summary.horizonTicks,
    totalExpected: summary.totalExpected,
    damageByTick: Object.fromEntries(tickKeys.map((t) => [t, summary.damageByTick[t]])),
    rng: summary.rng
      ? {
          failedWeight: summary.rng.failedWeight ?? 0,
          residualWeight: summary.rng.residualWeight ?? 0,
          exactness: summary.rng.exactness,
          concreteMass: summary.rng.concreteMass ?? summary.rng.probabilityMass,
        }
      : undefined,
  };
}

function expectRankingParity(
  full: ReturnType<typeof simulateRevolution>,
  scoreOnly: ReturnType<typeof simulateRevolution>,
) {
  expect(rankingSlice(scoreOnly)).toEqual(rankingSlice(full));

  // Objective gates + robust score identity when horizon is rankable.
  if (full.horizonTicks != null && full.horizonTicks >= 50) {
    const a = scoreSummary(full, "balanced");
    const b = scoreSummary(scoreOnly, "balanced");
    expect(b).toEqual(a);
  }
}

const meleeBase = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
} as const;

function meleeBar(ids: readonly string[], durationTicks: number): RevolutionInput {
  const bar = ids.map((id) => {
    const a = MELEE_ABILITIES.find((x) => x.id === id);
    if (!a) throw new Error(`missing melee ability ${id}`);
    return a;
  });
  return {
    ...meleeBase,
    bar,
    style: "melee",
    durationTicks,
  };
}

describe("score-only / full-analysis ranking parity", () => {
  it("deterministic revolution bar matches ranking metrics", () => {
    const input = meleeBar(["fury", "dismember", "assault"], 50);
    const full = simulateRevolution(input, { detailLevel: "full-analysis" });
    const scoreOnly = simulateRevolution(input, { detailLevel: "score-only" });
    expect(full.ok).toBe(true);
    expect(scoreOnly.ok).toBe(true);
    expectRankingParity(full, scoreOnly);
    // Score-only strips presentation surfaces.
    expect(scoreOnly.events).toEqual([]);
    expect(scoreOnly.casts).toEqual([]);
    expect(scoreOnly.analysis.byEffect).toEqual([]);
    expect(full.events.length).toBeGreaterThan(0);
  });

  it("sampled Impatient revolution matches ranking metrics", () => {
    const input: RevolutionInput = {
      ...meleeBar(["fury", "dismember", "assault", "punish"], 60),
      adrenaline: { impatientRank: 4 },
    };
    const full = simulateRevolution(input, { detailLevel: "full-analysis" });
    const scoreOnly = simulateRevolution(input, { detailLevel: "score-only" });
    expect(full.ok).toBe(true);
    expect(scoreOnly.ok).toBe(true);
    // Both detail levels use the same stochastic lanes.
    expectRankingParity(full, scoreOnly);
    if (full.rng) {
      expect(scoreOnly.rng?.exactness).toBe(full.rng.exactness);
      expect(scoreOnly.rng?.residualWeight).toBe(full.rng.residualWeight);
    }
  });

  it("Impatient and Relentless sampling matches ranking metrics", () => {
    const input: RevolutionInput = {
      ...meleeBar(["fury", "dismember", "assault"], 50),
      adrenaline: { impatientRank: 4, relentlessRank: 5 },
    };
    const full = simulateRevolution(input, { detailLevel: "full-analysis" });
    const scoreOnly = simulateRevolution(input, { detailLevel: "score-only" });
    expectRankingParity(full, scoreOnly);
  });

  it("manual stochastic simulation matches ranking totals", () => {
    const input = {
      ...meleeBase,
      rotation: rotationOf("fury", "dismember", "assault"),
      adrenaline: { impatientRank: 4 },
    };
    const full = simulate(input, { detailLevel: "full-analysis" });
    const scoreOnly = simulate(input, { detailLevel: "score-only" });
    expect(scoreOnly.totalExpected).toBe(full.totalExpected);
    expect(rankingSlice(scoreOnly)).toEqual(rankingSlice(full));
  });

  it("manual Ghost damage and healing stay identical in score-only mode", () => {
    const input = {
      ...necroInput,
      rotation: rotationOf(
        "conjure_vengeful_ghost",
        "command_vengeful_ghost",
        ...Array(18).fill("necromancy_basic"),
      ),
    };
    const full = simulate(input, { detailLevel: "full-analysis", stochasticLanes: 1 });
    const scoreOnly = simulate(input, { detailLevel: "score-only", stochasticLanes: 1 });
    expect(scoreOnly.totalExpected).toBe(full.totalExpected);
    expect(scoreOnly.totalHealed).toBe(full.totalHealed);
    expect(rankingSlice(scoreOnly)).toEqual(rankingSlice(full));
  });

  it("magic revo bar parity", () => {
    const pick = (...ids: string[]): AbilitySpec[] =>
      ids.map((id) => {
        const a = MAGIC_ABILITIES.find((x) => x.id === id);
        if (!a) throw new Error(id);
        return a;
      });
    const input: RevolutionInput = {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: MAGIC_ABILITIES,
      bar: pick("sonic_wave", "dragon_breath", "concentrated_blast"),
      style: "magic",
      durationTicks: 50,
    };
    const full = simulateRevolution(input, { detailLevel: "full-analysis" });
    const scoreOnly = simulateRevolution(input, { detailLevel: "score-only" });
    expectRankingParity(full, scoreOnly);
  });

  it("necromancy revo bar parity", () => {
    const abilities = [...NECROMANCY_ABILITIES, volleyOfSouls(3)];
    const pick = (...ids: string[]): AbilitySpec[] =>
      ids.map((id) => {
        const a = abilities.find((x) => x.id === id);
        if (!a) throw new Error(id);
        return a;
      });
    const input: RevolutionInput = {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities,
      bar: pick("touch_of_death", "soul_sap", "finger_of_death"),
      style: "necromancy",
      durationTicks: 50,
    };
    const full = simulateRevolution(input, { detailLevel: "full-analysis" });
    const scoreOnly = simulateRevolution(input, { detailLevel: "score-only" });
    expectRankingParity(full, scoreOnly);
  });

  it("necromancy bloat derived tails match ranking metrics", () => {
    const abilities = NECROMANCY_ABILITIES;
    const pick = (...ids: string[]): AbilitySpec[] =>
      ids.map((id) => {
        const a = abilities.find((x) => x.id === id);
        if (!a) throw new Error(id);
        return a;
      });
    const input: RevolutionInput = {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0.1 },
      abilities,
      bar: pick("bloat", "touch_of_death", "soul_sap"),
      style: "necromancy",
      durationTicks: 60,
      startingAdrenaline: 100,
    };
    const full = simulateRevolution(input, { detailLevel: "full-analysis" });
    const scoreOnly = simulateRevolution(input, { detailLevel: "score-only" });
    expect(full.ok).toBe(true);
    expect(scoreOnly.ok).toBe(true);
    expectRankingParity(full, scoreOnly);
  });

  it("evaluateRevolutionBar score-only matches full-analysis objective", () => {
    const auto: AbilitySpec = {
      id: "attack",
      name: "Attack",
      style: "melee",
      category: "basic",
      basicAttack: true,
      hits: [{ band: { minPct: 110, maxPct: 130 } }],
      adrenaline: { gain: 9 },
    };
    const alpha: AbilitySpec = {
      id: "alpha",
      name: "Alpha",
      style: "melee",
      category: "basic",
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { gain: 9 },
      cooldownSeconds: 5.4,
    };
    const beta: AbilitySpec = {
      id: "beta",
      name: "Beta",
      style: "melee",
      category: "basic",
      hits: [{ band: { minPct: 150, maxPct: 150 } }],
      adrenaline: { gain: 9 },
      cooldownSeconds: 5.4,
    };
    const catalogue = [auto, alpha, beta];
    const pool = buildCandidatePool(catalogue, "melee");
    const sim = {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: catalogue,
    };
    const full = evaluateRevolutionBar({
      bar: ["alpha", "beta"],
      style: "melee",
      durationTicks: 50,
      pool,
      sim,
      profileId: "balanced",
      detailLevel: "full-analysis",
    });
    const scoreOnly = evaluateRevolutionBar({
      bar: ["alpha", "beta"],
      style: "melee",
      durationTicks: 50,
      pool,
      sim,
      profileId: "balanced",
      detailLevel: "score-only",
    });
    expect(full.ok).toBe(true);
    expect(scoreOnly.ok).toBe(true);
    expect(scoreOnly.score).toBe(full.score);
    expect(scoreOnly.validForFinalRanking).toBe(full.validForFinalRanking);
    expect(scoreOnly.exploratory).toBe(full.exploratory);
    expect(scoreOnly.objective).toEqual(full.objective);
    expect(scoreOnly.metrics).toEqual(full.metrics);
    expect(scoreOnly.summary?.totalExpected).toBe(full.summary?.totalExpected);
    expect(scoreOnly.summary?.damageByTick).toEqual(full.summary?.damageByTick);
  });

  it("default detail level remains full-analysis (presentation intact)", () => {
    const input = meleeBar(["fury"], 20);
    const def = simulateRevolution(input);
    expect(def.events.length).toBeGreaterThan(0);
    expect(def.casts.length).toBeGreaterThan(0);
  });
});
