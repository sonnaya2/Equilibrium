import { describe, expect, it } from "vitest";
import {
  applyHostIncumbentBaseline,
  evaluateHostIncumbentBaseline,
  type HostIncumbentBaseline,
} from "./hostIncumbent";
import { mergeResults } from "./worker/pool";
import {
  defaultSerializableRequest,
  emptyModifierSources,
  type SerializableRevolutionSimBase,
  type SerializableSolverRequest,
  type SolverResultDTO,
} from "./worker/serializable";
import { solveIdentityFromRequest } from "./identity";
import type { ActiveEquipmentEffects } from "../shared/equipment";
import {
  buildCandidatePoolForRequest,
  fitIncumbentBar,
  minimumConstrainedBarSizeForRequest,
  regionDenyList,
  requiredAbilitiesForRequest,
} from "./requestContext";
import { buildCandidatePool } from "./candidatePool";
import { packSolverRequest } from "./packRequest";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { DEFAULT_LOADOUT } from "@/components/combat/useLoadout";
import { toResolvedCombatModel } from "@/components/combat/toResolvedCombatModel";
import { emptyBuild, REGION_IDS } from "@/league";

const emptyEffects: ActiveEquipmentEffects = {
  activation: "pre-activated-static-loadout",
  setCritChance: { unconditional: 0, conditional: {} },
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

function agentDto(
  partial: Partial<SolverResultDTO> & Pick<SolverResultDTO, "bar" | "score">,
): SolverResultDTO {
  return {
    windowDpms: 0,
    evaluations: 10,
    uniqueCandidates: 5,
    seed: 1,
    profileId: "balanced",
    tier: "thorough",
    durationTicks: 100,
    solveIdentity: "agent",
    proofLabel: "heuristic-best-found",
    isUpgrade: true,
    validForApply: true,
    baselineBar: null,
    baselineScore: Number.NEGATIVE_INFINITY,
    winnerScore: partial.score,
    scoreImprovement: partial.score,
    percentImprovement: null,
    honesty: {
      status: "ok",
      fullyValidated: true,
      beatsBar: true,
      stochasticExactness: "exact",
      residualMass: 0,
      currentBarScore: Number.NEGATIVE_INFINITY,
      proposedBarScore: partial.score,
      improvement: partial.score,
      applyAllowed: true,
    },
    proof: { label: "heuristic-best-found", notes: [] },
    top: [],
    ...partial,
  };
}

describe("applyHostIncumbentBaseline", () => {
  it("blocks false upgrade when agent treated incumbent as -Infinity", () => {
    const baseline: HostIncumbentBaseline = {
      bar: ["a", "b", "c", "d", "e", "f", "g", "h"],
      score: 12_000,
    };
    // Length-4 worker: no score for 8-slot bar → claimed upgrade at 9k.
    const agent = agentDto({
      bar: ["w", "x", "y", "z"],
      score: 9_000,
      isUpgrade: true,
      validForApply: true,
      baselineScore: Number.NEGATIVE_INFINITY,
    });
    const fixed = applyHostIncumbentBaseline(agent, baseline);
    expect(fixed.isUpgrade).toBe(false);
    expect(fixed.validForApply).toBe(false);
    expect(fixed.bar).toEqual(baseline.bar);
    expect(fixed.score).toBe(12_000);
    expect(fixed.baselineScore).toBe(12_000);
    expect(fixed.honesty?.beatsBar).toBe(false);
    expect(fixed.scoreImprovement).toBe(0);
  });

  it("keeps true upgrade when candidate beats host baseline", () => {
    const baseline: HostIncumbentBaseline = {
      bar: ["a", "b", "c", "d"],
      score: 8_000,
    };
    const agent = agentDto({
      bar: ["w", "x", "y", "z", "q"],
      score: 15_000,
    });
    const fixed = applyHostIncumbentBaseline(agent, baseline);
    expect(fixed.isUpgrade).toBe(true);
    expect(fixed.bar).toEqual(["w", "x", "y", "z", "q"]);
    expect(fixed.score).toBe(15_000);
    expect(fixed.baselineBar).toEqual(baseline.bar);
    expect(fixed.baselineScore).toBe(8_000);
    expect(fixed.scoreImprovement).toBe(7_000);
    expect(fixed.honesty?.beatsBar).toBe(true);
  });

  it("mergeResults rewrites upgrade against host baseline across length workers", () => {
    const hostRequest = defaultSerializableRequest({
      style: "melee",
      durationTicks: 100,
      minBarSize: 4,
      maxBarSize: 11,
      seed: 1,
      tier: "thorough",
      userBar: ["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8", "i9", "i10", "i11"],
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
          targetSize: 1,
          occupiedTiles: 1,
        },
        equipmentIds: [],
        weaponConfiguration: "dualwield",
        startingAdrenaline: 100,
        modifierSources: emptyModifierSources(),
      },
    });
    const hostId = solveIdentityFromRequest(hostRequest);
    // Four thorough workers: lengths 4-7; none can score 11-slot incumbent.
    const workers = [4, 5, 6, 7].map((len, i) =>
      agentDto({
        bar: Array.from({ length: len }, (_, j) => `c${i}_${j}`),
        score: 5_000 + len * 100,
        seed: i + 1,
        solveIdentity: `agent-${len}`,
        isUpgrade: true,
        baselineScore: Number.NEGATIVE_INFINITY,
      }),
    );
    const baseline: HostIncumbentBaseline = {
      bar: hostRequest.userBar!,
      score: 20_000,
    };
    const merged = mergeResults(workers, hostRequest, undefined, baseline);
    expect(merged.solveIdentity).toBe(hostId);
    expect(merged.isUpgrade).toBe(false);
    expect(merged.bar).toEqual(hostRequest.userBar);
    expect(merged.score).toBe(20_000);
    expect(merged.baselineScore).toBe(20_000);
  });
});

describe("fitIncumbentBar catalogue vs pool", () => {
  function miniSpec(id: string, extra: Partial<AbilitySpec> = {}): AbilitySpec {
    return {
      id,
      name: id,
      style: "melee",
      category: "basic",
      hits: [{ band: { minPct: 100, maxPct: 120 } }],
      adrenaline: { gain: 9 },
      ...extra,
    };
  }

  function miniRequest(
    partial: Partial<SerializableSolverRequest> = {},
  ): SerializableSolverRequest {
    return defaultSerializableRequest({
      style: "melee",
      durationTicks: 100,
      minBarSize: 2,
      maxBarSize: 6,
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
          targetSize: 1,
          occupiedTiles: 1,
        },
        equipmentIds: [],
        weaponConfiguration: "dualwield",
        startingAdrenaline: 100,
        modifierSources: emptyModifierSources(),
      },
      ...partial,
    });
  }

  it("keeps forceSolver-excluded catalogue ids on the user bar", () => {
    // Pool only has a,b; catalogue also has an implicit Basic Attack and claws.
    const attack = miniSpec("attack", { basicAttack: true });
    const claws = miniSpec("claws_of_guthix", { category: "enhanced" as const });
    const catalogue = [miniSpec("a"), miniSpec("b"), attack, claws];
    const pool = buildCandidatePool([miniSpec("a"), miniSpec("b")], "melee");
    expect(pool.byId.has("claws_of_guthix")).toBe(false);
    const request = miniRequest({
      userBar: ["a", "attack", "claws_of_guthix", "b"],
    });
    const catMap = new Map(catalogue.map((s) => [s.id, s] as const));
    const fitted = fitIncumbentBar(request, pool, new Set(), catMap);
    expect(fitted).toEqual(["a", "attack", "claws_of_guthix", "b"]);
  });

  it("unions locks with style-required abilities", () => {
    const catalogue = [miniSpec("a"), miniSpec("berserk", { category: "ultimate" })];
    const pool = buildCandidatePool(catalogue, "melee");
    const required = requiredAbilitiesForRequest(
      miniRequest({ lockedAbilityIds: ["a", "a"] }),
      pool,
    );
    expect(required).toEqual(["berserk", "a"]);
  });

  it("derives the worker length floor from style defaults and locks", () => {
    const request = miniRequest({
      lockedAbilityIds: ["punish"],
      unlockedRegions: [...REGION_IDS],
      includeUnknownAvailability: true,
    });
    expect(minimumConstrainedBarSizeForRequest(request)).toBe(2);
  });

  it.each([
    ["magic", "sunshine", "greater_sunshine"],
    ["ranged", "deaths_swiftness", "greater_deaths_swiftness"],
  ] as const)(
    "does not restore %s's base ultimate when its greater form is disabled",
    (style, baseId, greaterId) => {
      const request = miniRequest({
        style,
        disabledAbilityIds: [greaterId],
        unlockedRegions: [...REGION_IDS],
        includeUnknownAvailability: true,
      });
      const disabled = new Set(request.disabledAbilityIds);
      const denySet = new Set(
        regionDenyList(
          request.style,
          request.unlockedRegions,
          request.includeUnknownAvailability === true,
          disabled,
        ),
      );
      const { pool } = buildCandidatePoolForRequest(
        request,
        request.loadout as SerializableRevolutionSimBase,
        denySet,
      );

      expect(pool.ids).not.toContain(baseId);
      expect(pool.ids).not.toContain(greaterId);
      expect(denySet).toContain(baseId);
      expect(denySet).toContain(greaterId);
    },
  );

  it("rejects overlapping, unavailable, exclusive, and oversized locks", () => {
    const catalogue = [
      miniSpec("a"),
      miniSpec("b"),
      miniSpec("fury", { replacementGroup: "fury" }),
      miniSpec("greater_fury", { replacementGroup: "fury" }),
    ];
    const pool = buildCandidatePool(catalogue, "melee");

    expect(() =>
      requiredAbilitiesForRequest(
        miniRequest({ lockedAbilityIds: ["a"], disabledAbilityIds: ["a"] }),
        pool,
      ),
    ).toThrow('ability "a" cannot be both locked and disabled');
    expect(() =>
      requiredAbilitiesForRequest(miniRequest({ lockedAbilityIds: ["missing"] }), pool),
    ).toThrow('locked ability "missing" is unavailable');
    expect(() =>
      requiredAbilitiesForRequest(
        miniRequest({ lockedAbilityIds: ["fury", "greater_fury"] }),
        pool,
      ),
    ).toThrow('required abilities "fury" and "greater_fury" conflict in group "fury"');
    expect(() =>
      requiredAbilitiesForRequest(
        miniRequest({ lockedAbilityIds: ["a", "b"], maxBarSize: 1 }),
        pool,
      ),
    ).toThrow("2 required abilities exceed max bar size 1");
  });

  it("keeps locks out of the current-bar baseline", () => {
    const catalogue = [
      miniSpec("a"),
      miniSpec("fury", { replacementGroup: "fury" }),
      miniSpec("greater_fury", { replacementGroup: "fury" }),
    ];
    const pool = buildCandidatePool(catalogue, "melee");
    const request = miniRequest({
      userBar: ["a", "fury"],
      lockedAbilityIds: ["greater_fury"],
      maxBarSize: 2,
    });
    const catMap = new Map(catalogue.map((ability) => [ability.id, ability] as const));

    expect(fitIncumbentBar(request, pool, new Set(), catMap)).toEqual(["a", "fury"]);
  });

  it("preserves an oversized incumbent that already contains its locks", () => {
    const catalogue = [miniSpec("a"), miniSpec("b"), miniSpec("c")];
    const pool = buildCandidatePool(catalogue, "melee");
    const request = miniRequest({
      userBar: ["a", "b", "c"],
      lockedAbilityIds: ["b"],
      maxBarSize: 2,
    });
    const catMap = new Map(catalogue.map((ability) => [ability.id, ability] as const));

    expect(fitIncumbentBar(request, pool, new Set(), catMap)).toEqual(["a", "b", "c"]);
  });

  it("keeps search-only exclusions on the host incumbent bar", () => {
    const request = miniRequest({
      style: "magic",
      userBar: ["asphyxiate", "sunshine"],
      disabledAbilityIds: ["asphyxiate"],
      lockedAbilityIds: ["greater_sunshine"],
      permittedCategories: ["ultimate"],
      unlockedRegions: [...REGION_IDS],
      includeUnknownAvailability: true,
    });

    const baseline = evaluateHostIncumbentBaseline(request);

    expect(baseline?.bar).toEqual(["asphyxiate", "sunshine"]);
    expect(Number.isFinite(baseline?.score)).toBe(true);
  });
});

describe("packSolverRequest userBar necro", () => {
  it("does not inject conjures into userBar", () => {
    const loadout = { ...DEFAULT_LOADOUT, style: "necromancy" as const };
    const model = toResolvedCombatModel(loadout, { now: 1_700_000_000_000 });
    const userBar = ["soul_sap", "touch_of_death", "finger_of_death", "volley_of_souls"];
    const req = packSolverRequest({
      model,
      style: "necromancy",
      build: emptyBuild(),
      tier: "thorough",
      minBarSize: 4,
      maxBarSize: 9,
      userBar,
      seed: 1,
      now: 1_700_000_000_000,
    });
    expect(req.userBar?.some((id) => id.startsWith("conjure_"))).toBe(false);
    expect(req.userBar).toEqual(userBar);
  });
});
