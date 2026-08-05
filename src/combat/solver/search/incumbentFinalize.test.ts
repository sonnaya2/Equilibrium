/**
 * Phase 5: first-class current-bar (incumbent) at finalize.
 * Incumbent always full-evals outside shortlist capacity; upgrade uses float tol.
 */
import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { EQUIPMENT_SET_ACTIVATION, type ActiveEquipmentEffects } from "../../shared/equipment";
import type { EvaluateFn, PoolAbility } from "../contracts";
import { INCUMBENT_SCORE_TOLERANCE } from "../contracts";
import { buildCandidatePool } from "../candidatePool";
import { barKey } from "../fingerprint";
import { fitAuthoredSeeds, fitIncumbentBar } from "../requestContext";
import { configForTier } from "../solve";
import { defaultSerializableRequest, emptyModifierSources } from "../worker/serializable";
import { createSearchState } from "./types";
import { finalizeSearch, fullCandidateList } from "./finalize";

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

const tinyPool: PoolAbility[] = [
  { id: "a", category: "basic", averageDamage: 10, occupancyTicks: 3 },
  { id: "b", category: "enhanced", averageDamage: 30, occupancyTicks: 3 },
  { id: "c", category: "ultimate", averageDamage: 100, occupancyTicks: 3 },
  { id: "d", category: "basic", averageDamage: 12, occupancyTicks: 3 },
  { id: "e", category: "basic", averageDamage: 14, occupancyTicks: 3 },
];

/** High explore score for filler bars; incumbent explore is low so shortlist excludes it. */
function exploreScore(bar: readonly string[]): number {
  // Prefer c/d/e fillers on short horizon.
  const dmg: Record<string, number> = { a: 1, b: 2, c: 200, d: 180, e: 160 };
  let score = 0;
  for (const id of bar) score += dmg[id] ?? 0;
  return score;
}

function makeState(opts: {
  evaluate: EvaluateFn;
  incumbentBar: readonly string[];
  fullShortlistSize?: number;
  seeds?: readonly (readonly string[])[];
}) {
  return createSearchState({
    pool: tinyPool,
    sizeBounds: { min: 1, max: 2 },
    evaluate: opts.evaluate,
    config: {
      ...configForTier("thorough", 1),
      evaluationBudget: 80,
      fullShortlistSize: opts.fullShortlistSize ?? 2,
      topK: 2,
      searchHorizonTicks: 40,
      fullHorizonTicks: 150,
    },
    // Seeds deliberately omit incumbent so capacity gate can exclude it.
    seeds: opts.seeds?.map((s) => [...s]) ?? [
      ["c", "d"],
      ["c", "e"],
      ["d", "e"],
    ],
    incumbentBar: opts.incumbentBar,
  });
}

/** Pre-fill explore archive with high-score bars that crowd out the incumbent. */
function seedExploreArchive(state: ReturnType<typeof createSearchState>, bars: readonly (readonly string[])[]) {
  for (const bar of bars) {
    state.tryEval(bar, "search", "explore-fill");
  }
}

describe("incumbent finalize (Phase 5)", () => {
  it("always full-evals incumbent outside shortlist capacity", () => {
    const incumbent = ["a", "b"] as const;
    const fullCalls: string[] = [];
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        fullCalls.push(bar.join("|"));
        // Incumbent is best on full; fillers are worse.
        const score = barKey(bar) === barKey(incumbent) ? 1_000 : 100;
        return {
          score,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
          fidelity: "full",
        };
      }
      return {
        score: exploreScore(bar),
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
        fidelity: "short",
      };
    };

    const state = makeState({ evaluate, incumbentBar: incumbent, fullShortlistSize: 2 });
    seedExploreArchive(state, [
      ["c", "d"],
      ["c", "e"],
      ["d", "e"],
      ["c"],
      ["d"],
      incumbent,
    ]);

    // Capacity-capped shortlist from explore should not need the low-explore incumbent.
    const { seedBestScore: _s, seedBestBar } = (() => {
      let seedBestBar: readonly string[] | null = null;
      let best = Number.NEGATIVE_INFINITY;
      for (const seed of state.seeds) {
        const sc = state.forceEval(seed, "search", "t");
        if (sc && sc.robustScore > best) {
          best = sc.robustScore;
          seedBestBar = sc.bar;
        }
      }
      return { seedBestScore: best, seedBestBar };
    })();
    void _s;
    const explorePool = state.archive.filter((a) => a.mode === "search");
    const shortlist = fullCandidateList(explorePool, state, seedBestBar);
    expect(shortlist.length).toBeLessThanOrEqual(2);
    expect(shortlist.every((s) => s.fingerprint !== barKey(incumbent))).toBe(true);

    fullCalls.length = 0;
    const fin = finalizeSearch(state, { tier: "thorough", topK: 2 });

    expect(fullCalls).toContain(incumbent.join("|"));
    expect(fin.incumbentBar).toEqual([...incumbent]);
    expect(fin.incumbentScore).toBe(1_000);
    expect(fin.status).toBe("ok");
    expect(fin.isUpgrade).toBe(false);
    expect(fin.validForApply).toBe(false);
    expect(fin.best).not.toBeNull();
    expect(fin.best!.bar).toEqual([...incumbent]);
    expect(fin.scoreImprovement).toBe(0);
    expect(fin.percentImprovement).toBeNull();
  });

  it("claims upgrade when shortlist full score beats incumbent past tolerance", () => {
    const incumbent = ["a", "b"] as const;
    const upgrade = ["c", "d"] as const;
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        const score =
          barKey(bar) === barKey(upgrade)
            ? 2_000
            : barKey(bar) === barKey(incumbent)
              ? 1_000
              : 50;
        return {
          score,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
          fidelity: "full",
        };
      }
      return {
        score: exploreScore(bar),
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };

    const state = makeState({ evaluate, incumbentBar: incumbent, fullShortlistSize: 2 });
    seedExploreArchive(state, [upgrade, ["c", "e"], ["d", "e"], incumbent]);

    const fin = finalizeSearch(state, { tier: "thorough", topK: 2 });
    expect(fin.status).toBe("ok");
    expect(fin.isUpgrade).toBe(true);
    expect(fin.validForApply).toBe(true);
    expect(fin.best!.bar).toEqual([...upgrade]);
    expect(fin.incumbentScore).toBe(1_000);
    expect(fin.scoreImprovement).toBe(1_000);
    expect(fin.percentImprovement).toBeCloseTo(100, 9);
    expect(fin.best!.robustScore).toBeGreaterThan(fin.incumbentScore + INCUMBENT_SCORE_TOLERANCE);
  });

  it("never claims upgrade when proposed full score is below incumbent", () => {
    const incumbent = ["a", "b"] as const;
    // High explore, poor full (classic short-horizon trap).
    const trap = ["c", "d"] as const;
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        const score =
          barKey(bar) === barKey(incumbent)
            ? 5_000
            : barKey(bar) === barKey(trap)
              ? 10
              : 20;
        return {
          score,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
          fidelity: "full",
        };
      }
      // Trap looks great on search horizon.
      const score = barKey(bar) === barKey(trap) ? 99_000 : exploreScore(bar);
      return {
        score,
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };

    const state = makeState({ evaluate, incumbentBar: incumbent, fullShortlistSize: 2 });
    seedExploreArchive(state, [trap, ["c", "e"], ["d", "e"], incumbent]);

    const fin = finalizeSearch(state, { tier: "thorough", topK: 2 });
    expect(fin.status).toBe("ok");
    expect(fin.isUpgrade).toBe(false);
    expect(fin.validForApply).toBe(false);
    expect(fin.best!.bar).toEqual([...incumbent]);
    expect(fin.incumbentScore).toBe(5_000);
    expect(fin.bestExploratoryScore).toBeGreaterThanOrEqual(99_000 - 1e-9);
    expect(fin.scoreImprovement).toBe(0);
  });

  it("near-tie within tolerance keeps incumbent (no upgrade)", () => {
    const incumbent = ["a", "b"] as const;
    const near = ["c", "d"] as const;
    const base = 1_000;
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        const score =
          barKey(bar) === barKey(near)
            ? base + INCUMBENT_SCORE_TOLERANCE * 0.25
            : barKey(bar) === barKey(incumbent)
              ? base
              : 1;
        return {
          score,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
          fidelity: "full",
        };
      }
      return {
        score: exploreScore(bar),
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };

    const state = makeState({ evaluate, incumbentBar: incumbent, fullShortlistSize: 2 });
    seedExploreArchive(state, [near, ["c", "e"], incumbent]);

    const fin = finalizeSearch(state, { tier: "thorough", topK: 2 });
    expect(fin.isUpgrade).toBe(false);
    expect(fin.validForApply).toBe(false);
    expect(fin.best!.bar).toEqual([...incumbent]);
  });

  it("unrankable incumbent + finite full candidate is an upgrade", () => {
    const incumbent = ["a", "b"] as const;
    const candidate = ["c", "d"] as const;
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        if (barKey(bar) === barKey(incumbent)) {
          return { score: Number.NEGATIVE_INFINITY, finite: false, mode: "full" };
        }
        return {
          score: 777,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
          fidelity: "full",
        };
      }
      return {
        score: exploreScore(bar),
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };

    const state = makeState({ evaluate, incumbentBar: incumbent, fullShortlistSize: 2 });
    seedExploreArchive(state, [candidate, ["c", "e"], incumbent]);

    const fin = finalizeSearch(state, { tier: "thorough", topK: 2 });
    expect(fin.incumbentScore).toBe(Number.NEGATIVE_INFINITY);
    expect(fin.status).toBe("ok");
    expect(fin.isUpgrade).toBe(true);
    expect(fin.validForApply).toBe(true);
    expect(fin.best!.bar).toEqual([...candidate]);
    expect(fin.scoreImprovement).toBe(777);
    expect(fin.percentImprovement).toBeNull();
  });

  it("tags forceEvalIncumbent source as incumbent-full for the current bar", () => {
    const incumbent = ["a", "b"] as const;
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        return {
          score: barKey(bar) === barKey(incumbent) ? 500 : 100,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
          fidelity: "full",
        };
      }
      return {
        score: exploreScore(bar),
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };

    const state = makeState({ evaluate, incumbentBar: incumbent, fullShortlistSize: 2 });
    seedExploreArchive(state, [["c", "d"], ["c", "e"], ["d", "e"]]);

    const origForceInc = state.forceEvalIncumbent.bind(state);
    const sources: string[] = [];
    state.forceEvalIncumbent = (bar, mode, source) => {
      if ((mode === "full" || mode === "finalize") && barKey(bar) === barKey(incumbent)) {
        sources.push(source ?? "");
      }
      return origForceInc(bar, mode, source);
    };

    finalizeSearch(state, { tier: "thorough", topK: 2 });
    expect(sources).toContain("incumbent-full");
  });

  it("full-evals incumbent missing style-required ability; candidates still require it", () => {
    // Melee-style required: berserk. User bar omits it; candidate with it wins.
    const incumbent = ["a", "b"] as const;
    const upgrade = ["berserk", "c"] as const;
    const pool: PoolAbility[] = [
      ...tinyPool,
      { id: "berserk", category: "ultimate", averageDamage: 200, occupancyTicks: 3 },
    ];
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        const score =
          barKey(bar) === barKey(upgrade) ? 2_000 : barKey(bar) === barKey(incumbent) ? 1_000 : 100;
        return {
          score,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
          fidelity: "full",
        };
      }
      return {
        score: exploreScore(bar),
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };

    const state = createSearchState({
      pool,
      sizeBounds: { min: 2, max: 3 },
      evaluate,
      config: {
        ...configForTier("thorough", 1),
        evaluationBudget: 80,
        fullShortlistSize: 2,
        topK: 2,
        searchHorizonTicks: 40,
        fullHorizonTicks: 150,
      },
      seeds: [
        ["berserk", "c"],
        ["c", "d"],
        ["c", "e"],
      ],
      incumbentBar: incumbent,
      requiredAbilityIds: ["berserk"],
    });

    // Candidate without berserk must be rejected by candidate policy.
    expect(state.tryEval(["a", "c"], "search", "cand")).toBeNull();
    expect(state.forceEval(["a", "c"], "full", "cand-full")).toBeNull();
    // Candidate with berserk is legal.
    expect(state.forceEval(["berserk", "c"], "search", "cand-ok")).not.toBeNull();

    seedExploreArchive(state, [upgrade, ["c", "d"], ["c", "e"]]);
    const fin = finalizeSearch(state, { tier: "thorough", topK: 2 });

    expect(fin.incumbentBar).toEqual([...incumbent]);
    expect(Number.isFinite(fin.incumbentScore)).toBe(true);
    expect(fin.incumbentScore).toBe(1_000);
    expect(fin.incumbentScore).not.toBe(Number.NEGATIVE_INFINITY);
    expect(fin.isUpgrade).toBe(true);
    expect(fin.best!.bar).toEqual([...upgrade]);
    // Improvement is vs the actual incumbent score, not -Infinity.
    expect(fin.scoreImprovement).toBe(1_000);
    expect(fin.scoreImprovement).toBe(fin.best!.robustScore - fin.incumbentScore);
  });
});

describe("fitAuthoredSeeds vs fitIncumbentBar (Phase 5)", () => {
  function miniSpec(id: string): AbilitySpec {
    return {
      id,
      name: id,
      style: "melee",
      category: "basic",
      hits: [{ band: { minPct: 100, maxPct: 120 } }],
      adrenaline: { gain: 9 },
    };
  }

  it("does not include userBar in authored seeds; fitIncumbentBar preserves it", () => {
    const catalogue = [miniSpec("ua"), miniSpec("ub"), miniSpec("uc")];
    const pool = buildCandidatePool(catalogue, "melee");
    const denySet = new Set<string>();
    const userBar = ["ua", "ub"] as const;
    const request = defaultSerializableRequest({
      style: "melee",
      durationTicks: 100,
      seed: 1,
      minBarSize: 2,
      maxBarSize: 3,
      userBar: [...userBar],
      authoredSeedBars: [{ id: "seed", abilityIds: ["uc", "ua"], baseline: true }],
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

    const seeds = fitAuthoredSeeds(request, pool, denySet);
    const incumbent = fitIncumbentBar(request, pool, denySet);

    expect(incumbent).toEqual(["ua", "ub"]);
    // userBar must not appear as a seed merely by being the current bar.
    expect(seeds.some((s) => s.length === 2 && s[0] === "ua" && s[1] === "ub")).toBe(false);
    // Explicit authored seed still fits.
    expect(seeds.some((s) => s.includes("uc") && s.includes("ua"))).toBe(true);
  });

  it("does not inject style-required abilities or pad the user bar", () => {
    const catalogue = [
      miniSpec("assault"),
      miniSpec("sever"),
      miniSpec("fury"),
      { ...miniSpec("berserk"), category: "ultimate" as const },
      miniSpec("dismember"),
    ];
    const pool = buildCandidatePool(catalogue, "melee");
    const denySet = new Set<string>();
    // User bar is short, omits berserk; candidate path would inject + pad.
    const userBar = ["assault", "sever"] as const;
    const request = defaultSerializableRequest({
      style: "melee",
      durationTicks: 100,
      seed: 1,
      minBarSize: 4,
      maxBarSize: 6,
      userBar: [...userBar],
      authoredSeedBars: [],
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

    const incumbent = fitIncumbentBar(request, pool, denySet);
    expect(incumbent).toEqual(["assault", "sever"]);
    expect(incumbent).not.toContain("berserk");
    expect(incumbent).toHaveLength(2);
  });

  it("drops denied ids only; keeps order of remaining user slots", () => {
    const catalogue = [miniSpec("ua"), miniSpec("ub"), miniSpec("uc")];
    const pool = buildCandidatePool(catalogue, "melee");
    const denySet = new Set<string>(["ub"]);
    const request = defaultSerializableRequest({
      style: "melee",
      durationTicks: 100,
      seed: 1,
      minBarSize: 2,
      maxBarSize: 4,
      userBar: ["ua", "ub", "uc"],
      authoredSeedBars: [],
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

    expect(fitIncumbentBar(request, pool, denySet)).toEqual(["ua", "uc"]);
  });
});
