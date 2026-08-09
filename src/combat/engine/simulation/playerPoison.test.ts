import { describe, expect, it } from "vitest";
import { baseInput, rangedInput } from "../../test/fixtures/inputs";
import type { PlayerPoisonProfile } from "../../poison/mechanics";
import { PLAYER_POISON_EFFECT_ID } from "../../poison/mechanics";
import { rotationOf } from "./contracts";
import { createCastContext, simulate } from "./simulate";
import { leagueModifiers, resolveLeagueRules } from "../../league/ruleset";
import { vulnerabilityModifier } from "../../shared/vulnerability";
import { testRangedAmmunition } from "../../testing/rangedAmmunition";

const profile = (patch: Partial<PlayerPoisonProfile> = {}): PlayerPoisonProfile => ({
  potion: "weapon",
  potionUntilTick: 250,
  kwuarmPotency: 0,
  cinderbane: false,
  blowpipe: false,
  laniakea: false,
  ...patch,
});

const expectWithinLanes = (actual: number | undefined, expected: number, lanes = 1) => {
  expect(actual).toBeDefined();
  expect(Math.abs(actual! - expected)).toBeLessThanOrEqual(lanes / 128 + 1e-12);
};

describe("player poison simulation", () => {
  it("keeps one qualifying landed hit at 12.5% inside unit poison mass", () => {
    const result = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile(),
    });
    const poison = result.analysis.byEffect.find((row) => row.id === PLAYER_POISON_EFFECT_ID);
    expect(result.ok).toBe(true);
    expect(result.rng).toMatchObject({ lanes: 128, residualWeight: 0, exactness: "estimated" });
    expect(poison?.expectedTriggerRolls).toBe(1);
    expect(poison?.expectedActivations).toBeCloseTo(0.125, 12);
    expect(poison?.expectedSeparateHits).toBeCloseTo(18 * 0.125, 12);
    expect(result.playerPoison).toMatchObject({
      procChance: 0.125,
      applicationAttempts: 1,
      successfulApplications: 0.125,
      separateHits: 2.25,
      probabilityMass: 1,
      supportStatus: "partially-modeled",
    });
    expect(result.rng?.representative.eventsReconcileWithWeightedTotals).toBe(false);
  });

  it("uses 17.5% for Laniakea without creating a source by itself", () => {
    const active = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile({ laniakea: true }),
    });
    expectWithinLanes(active.playerPoison?.successfulApplications, 0.175);
    const inactive = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile({ potion: "none", potionUntilTick: 0, laniakea: true }),
    });
    expect(inactive.playerPoison).toBeUndefined();
    expect(inactive.analysis.byEffect.some((row) => row.id === PLAYER_POISON_EFFECT_ID)).toBe(
      false,
    );
  });

  it("applies Bik before the delayed poison hit and blocks all output on immunity", () => {
    const ordinary = simulate({
      ...rangedInput,
      rotation: rotationOf("ranged_attack"),
      playerPoison: profile(),
    });
    const bik = simulate({
      ...rangedInput,
      rotation: rotationOf("ranged_attack"),
      ammunition: testRangedAmmunition("bik"),
      playerPoison: profile(),
    });
    expect(bik.playerPoison?.expectedDamage).toBeGreaterThan(
      ordinary.playerPoison?.expectedDamage ?? 0,
    );
    expect(bik.playerPoison?.expectedDamage).toBeLessThan(
      (ordinary.playerPoison?.expectedDamage ?? 0) * 1.03,
    );
    const immune = simulate({
      ...baseInput,
      startingAdrenaline: 100,
      rotation: rotationOf("attack"),
      playerPoison: profile(),
      targetPoisonImmune: true,
    });
    expect(immune.playerPoison).toBeUndefined();
    expect(immune.perAbility[PLAYER_POISON_EFFECT_ID]).toBeUndefined();
  });

  it("ignores explicit Bik ammo without a ranged weapon", () => {
    const ordinary = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile(),
    });
    const bik = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      ammunition: testRangedAmmunition("bik"),
      playerPoison: profile(),
    });
    expect(bik.playerPoison?.expectedDamage).toBe(ordinary.playerPoison?.expectedDamage);
    expect(bik.playerPoison?.targetState.bikStacks).toBe(0);
  });

  it("keeps sampled Bik stacks concrete while exposing stochastic state separately", () => {
    const result = simulate({
      ...rangedInput,
      horizonTicks: 20,
      rotation: rotationOf("ranged_attack", "ranged_attack", "ranged_attack"),
      ammunition: testRangedAmmunition("bik"),
      playerPoison: profile(),
    });
    expect(result.rng).toBeDefined();
    expect(Number.isInteger(result.playerPoison?.targetState.bikStacks)).toBe(true);
    expect(Number.isInteger(result.playerPoison?.targetState.bikRemainingTicks)).toBe(true);
    expect(result.playerPoison?.expectedTargetState).toEqual(
      expect.objectContaining({
        bikStacks: expect.any(Number),
        bikRemainingTicks: expect.any(Number),
      }),
    );
  });

  it("makes one application attempt per independent Hurricane hit", () => {
    const result = simulate({
      ...baseInput,
      startingAdrenaline: 100,
      rotation: rotationOf("hurricane"),
      playerPoison: profile(),
    });
    const poison = result.analysis.byEffect.find((row) => row.id === PLAYER_POISON_EFFECT_ID);
    expect(poison?.expectedTriggerRolls).toBe(2);
  });

  it("only Cinderbane turns both simultaneous Hurricane applications into extra hits", () => {
    const result = simulate({
      ...baseInput,
      horizonTicks: 3,
      startingAdrenaline: 100,
      rotation: rotationOf("hurricane"),
      playerPoison: profile({ cinderbane: true }),
    });
    expectWithinLanes(result.playerPoison?.separateHits, 0.25, 2);
    expectWithinLanes(
      result.analysis.byEffect.find((row) => row.id === "hurricane")?.expectedPlayerPoisonHits,
      0.25,
      2,
    );
    expect(result.playerPoison?.probabilityMass).toBeCloseTo(1, 12);

    const ordinaryResult = simulate({
      ...baseInput,
      horizonTicks: 3,
      startingAdrenaline: 100,
      rotation: rotationOf("hurricane"),
      playerPoison: profile(),
    });
    expectWithinLanes(ordinaryResult.playerPoison?.separateHits, 1 - 0.875 ** 2, 2);
  });

  it("lands Assault's tick-1 application hit with 12.5% mass at tick 3", () => {
    const result = simulate({
      ...baseInput,
      horizonTicks: 4,
      startingAdrenaline: 100,
      rotation: rotationOf("assault"),
      playerPoison: profile(),
    });
    expectWithinLanes(result.playerPoison?.separateHits, 0.125);
    expect(result.damageByTick[3]).toBeGreaterThan(0);
    expect(result.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
  });

  it("rolls from player damage-over-time hits", () => {
    const result = simulate({
      ...baseInput,
      rotation: rotationOf("dismember"),
      playerPoison: profile(),
    });
    expect(result.playerPoison?.applicationAttempts).toBe(8);
  });

  it("uses one poison application attempt for the 5% Inferno hit", () => {
    const league = resolveLeagueRules(
      {
        ruleset: "equilibrium",
        blessingPicks: ["Balance", "Chaos"],
      },
      { maximumLife: 15_000 },
    );
    const result = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      modifiers: leagueModifiers(league),
      rotation: rotationOf("attack"),
      playerPoison: profile(),
    });
    expectWithinLanes(result.playerPoison?.applicationAttempts, 1.05);
    expectWithinLanes(result.playerPoison?.successfulApplications, 0.125 * 1.05, 2);
    expect(result.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
    const infernoRow = result.analysis.byEffect.find((row) => row.id === "inferno-of-zamorak");
    expect(infernoRow?.expectedActivations).toBeCloseTo(0.05, 1);
    expect(result.playerPoison?.applicationAttempts).toBeCloseTo(
      1 + (infernoRow?.expectedActivations ?? 0),
      12,
    );
    const infernos = result.events.filter((event) => event.abilityId === "inferno-of-zamorak");
    for (const inferno of infernos) {
      expect(inferno).toMatchObject({ attached: false, expectedTriggerRolls: 1 });
      expect(inferno.expectedOccurrences).toBe(1);
      expect(inferno.expectedActivations).toBe(1);
      expect(inferno.expectedSeparateHits).toBe(1);
      expect(inferno.occurrenceModel).toBeUndefined();
    }
    const attached = result.events
      .filter((event) => event.tick === 0)
      .flatMap((event) => event.components ?? [])
      .filter((component) => component.id === "abyssal-cinders" || component.id === "big-boned");
    expect(attached.length).toBeGreaterThanOrEqual(2);
    expect(attached.every((component) => component.attached)).toBe(true);
    if (infernos[0]) {
      expect(infernos[0].components?.some((component) => component.id === "abyssal-cinders")).toBe(
        false,
      );
    }
  });

  it("adds Big Boned to poison hits without creating another poison roll or hit", () => {
    const league = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Balance"] },
      { maximumLife: 15_000 },
    );
    const result = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      modifiers: leagueModifiers(league),
      rotation: rotationOf("attack"),
      playerPoison: profile(),
    });
    const poison = result.analysis.byEffect.find((row) => row.id === PLAYER_POISON_EFFECT_ID);
    const bigBoned = result.analysis.byEffect.find((row) => row.id === "big-boned");
    expect(bigBoned?.totalDamage).toBeGreaterThan(0);
    expect(bigBoned?.expectedAttachedComponents).toBeGreaterThan(0);
    expect(poison?.bonusDamage).toBeGreaterThan(0);
    expect(poison?.bonusDamage).toBeLessThan(bigBoned?.totalDamage ?? 0);
    expect(result.playerPoison?.applicationAttempts).toBe(1);
    expect(result.playerPoison?.successfulApplications).toBeCloseTo(0.125, 12);
  });

  it("applies poison source and target multipliers to Big Boned poison riders", () => {
    const league = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Balance"] },
      { maximumLife: 15_000 },
    );
    const run = (kwuarmPotency: 0 | 4, vulnerable: boolean) => {
      const result = simulate({
        ...baseInput,
        league,
        context: { style: "melee", ruleset: "equilibrium" },
        modifiers: [...leagueModifiers(league), ...(vulnerable ? [vulnerabilityModifier()] : [])],
        rotation: rotationOf("attack"),
        playerPoison: profile({ kwuarmPotency }),
      });
      return (
        result.analysis.byEffect.find((row) => row.id === PLAYER_POISON_EFFECT_ID)?.bonusDamage ?? 0
      );
    };
    const plain = run(0, false);
    expect(run(4, false)).toBeCloseTo(plain * 1.1, 8);
    expect(run(0, true)).toBeGreaterThan(plain * 1.09);
  });

  it("routes Vulnerability, Havoc Born, and Envenomed through the poison modifier pipeline", () => {
    const run = (
      league = resolveLeagueRules({ ruleset: "base", blessingPicks: [] }),
      modifiers = leagueModifiers(league),
    ) =>
      simulate({
        ...baseInput,
        league,
        context: { style: "melee", ruleset: league.ruleset },
        modifiers,
        rotation: rotationOf("attack"),
        playerPoison: profile(),
      }).playerPoison!.expectedDamage;
    const plain = run();
    const vulnerable = run(undefined, [vulnerabilityModifier()]);
    const havoc = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Balance", "Balance", "Chaos"],
    });
    const envenomed = resolveLeagueRules(
      {
        ruleset: "equilibrium",
        blessingPicks: ["Chaos", "Order", "Chaos", "Order", "Order", "Balance"],
      },
      { herbloreLevel: 99 },
    );
    expect(vulnerable).toBeGreaterThan(plain * 1.09);
    expect(run(havoc)).toBeGreaterThan(plain * 1.19);
    expect(run(envenomed)).toBeGreaterThan(plain * 3.4);
  });

  it("lets the triggering Envenomed hit bypass and refresh poison immunity", () => {
    const league = resolveLeagueRules(
      {
        ruleset: "equilibrium",
        blessingPicks: ["Order", "Balance", "Order", "Order", "Balance", "Balance"],
      },
      { herbloreLevel: 99 },
    );
    const result = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
      modifiers: leagueModifiers(league),
      playerPoison: profile(),
      targetPoisonImmune: true,
    });
    expect(result.playerPoison?.successfulApplications).toBeCloseTo(0.125, 12);
    expect(result.playerPoison?.expectedDamage).toBeGreaterThan(0);
  });

  it("matches the bounded Cinderbane continuation oracle for base and Laniakea chance", () => {
    for (const [laniakea, chance] of [
      [false, 0.125],
      [true, 0.175],
    ] as const) {
      const result = simulate({
        ...baseInput,
        horizonTicks: 17,
        rotation: rotationOf("attack"),
        playerPoison: profile({
          potion: "none",
          potionUntilTick: 0,
          cinderbane: true,
          laniakea,
        }),
      });
      const boundedOracle = Array.from({ length: 9 }, (_, index) => chance ** (index + 1)).reduce(
        (sum, value) => sum + value,
        0,
      );
      expectWithinLanes(result.playerPoison?.successfulApplications, boundedOracle, 3);
      expectWithinLanes(
        result.playerPoison?.successfulCinderbaneContinuations,
        boundedOracle - chance,
        3,
      );
      expect(result.playerPoison?.cinderbaneContinuationChance).toBe(chance);
      expect(result.playerPoison).toMatchObject({
        supportStatus: "partially-modeled",
        supportNote: expect.stringMatching(/successive 1\/8 rolls/i),
      });
      expect((result.rng?.concreteMass ?? 1) + (result.rng?.residualWeight ?? 0)).toBeCloseTo(
        1,
        10,
      );
    }
  });

  it("keeps recursive Cinderbane continuation bounded by the simulation horizon", () => {
    const chance = 1 / 8;
    const input = {
      ...baseInput,
      horizonTicks: 18,
      rotation: rotationOf("attack"),
      playerPoison: profile({
        potion: "none",
        potionUntilTick: 0,
        cinderbane: true,
      }),
    };
    const result = simulate(input);
    const poisonHits = result.events.filter((event) => event.abilityId === PLAYER_POISON_EFFECT_ID);
    expect(poisonHits.every((event) => event.tick >= 2 && event.tick < 18)).toBe(true);
    expect(poisonHits.length).toBeLessThanOrEqual(8);
    const finiteOracle = Array.from({ length: 7 }, (_, index) => chance ** (index + 1)).reduce(
      (sum, value) => sum + value,
      0,
    );
    expectWithinLanes(
      result.playerPoison?.successfulCinderbaneContinuations,
      chance * finiteOracle,
      2,
    );
    expect(result.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
    expect(result.rng?.residualWeight).toBe(0);
    expect(simulate(input)).toEqual(result);
  });

  it("keeps full-analysis and score-only totals aligned for multi-hit Cinderbane", () => {
    const run = (detailLevel: "full-analysis" | "score-only") => {
      const ctx = createCastContext({
        ...baseInput,
        horizonTicks: 40,
        detailLevel,
        startingAdrenaline: 100,
        playerPoison: profile({
          potion: "weapon-plus-plus-plus",
          potionUntilTick: 1_200,
          cinderbane: true,
        }),
      });
      expect(ctx.performCast(ctx.byId.get("hurricane")!, 0, false)).toEqual({ ok: true });
      return ctx.finish(undefined, 40);
    };
    const full = run("full-analysis");
    const score = run("score-only");
    expect(score.totalExpected).toBeCloseTo(full.totalExpected, 10);
    expect(score.damage.concreteMass ?? 1).toBeCloseTo(full.damage.concreteMass ?? 1, 12);
  });

  it("keeps poison probability mass inside one stateful runtime", () => {
    const result = simulate({
      ...baseInput,
      horizonTicks: 20,
      startingAdrenaline: 100,
      rotation: rotationOf("hurricane"),
      playerPoison: profile({ cinderbane: true }),
    });
    expect(result.rng).toMatchObject({ lanes: 128, residualWeight: 0 });
    expect(result.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
    expect(result.playerPoison?.expectedDamage).toBeGreaterThan(0);
    expect(result.damage.scope).toBe("unit-mass");
  });
});
