import { describe, expect, it } from "vitest";
import { baseInput } from "../../test/fixtures/inputs";
import type { PlayerPoisonProfile } from "../../poison/mechanics";
import { PLAYER_POISON_EFFECT_ID } from "../../poison/mechanics";
import { rotationOf } from "./contracts";
import { createCastContext, simulate } from "./simulate";
import { leagueModifiers, resolveLeagueRules } from "../../league/ruleset";
import { vulnerabilityModifier } from "../../shared/vulnerability";

const profile = (patch: Partial<PlayerPoisonProfile> = {}): PlayerPoisonProfile => ({
  potion: "weapon",
  potionUntilTick: 250,
  kwuarmPotency: 0,
  cinderbane: false,
  blowpipe: false,
  laniakea: false,
  ...patch,
});

describe("player poison simulation", () => {
  it("keeps one qualifying landed hit at 12.5% inside unit poison mass", () => {
    const result = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile(),
    });
    const poison = result.analysis.byEffect.find((row) => row.id === PLAYER_POISON_EFFECT_ID);
    expect(result.ok).toBe(true);
    expect(result.rng).toBeUndefined();
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
    const poisonEvents = result.events.filter(
      (event) => event.abilityId === PLAYER_POISON_EFFECT_ID,
    );
    expect(poisonEvents.some((event) => (event.expectedOccurrences ?? 0) < 1)).toBe(true);
    expect(
      poisonEvents.reduce((sum, event) => sum + (event.expectedOccurrences ?? 0), 0),
    ).toBeCloseTo(result.playerPoison?.separateHits ?? 0, 12);
  });

  it("uses 17.5% for Laniakea without creating a source by itself", () => {
    const active = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile({ laniakea: true }),
    });
    expect(active.playerPoison?.successfulApplications).toBeCloseTo(0.175, 12);
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
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile(),
    });
    const bik = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      ammo: "bik",
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
    const ctx = createCastContext({
      ...baseInput,
      horizonTicks: 3,
      startingAdrenaline: 100,
      playerPoison: profile({ cinderbane: true }),
    });
    expect(ctx.performCast(ctx.byId.get("hurricane")!, 0, false)).toEqual({ ok: true });
    const result = ctx.finish(undefined, 3);
    const tickTwoMass = result.events
      .filter((event) => event.abilityId === PLAYER_POISON_EFFECT_ID && event.tick === 2)
      .reduce((sum, event) => sum + (event.expectedOccurrences ?? 0), 0);
    expect(tickTwoMass).toBeCloseTo(0.25, 12);
    expect(tickTwoMass).not.toBeCloseTo(1 - 0.875 ** 2, 12);
    expect(
      result.analysis.byEffect.find((row) => row.id === "hurricane")?.expectedPlayerPoisonHits,
    ).toBeCloseTo(0.25, 12);
    expect(result.playerPoison?.probabilityMass).toBeCloseTo(1, 12);

    const ordinary = createCastContext({
      ...baseInput,
      horizonTicks: 3,
      startingAdrenaline: 100,
      playerPoison: profile(),
    });
    expect(ordinary.performCast(ordinary.byId.get("hurricane")!, 0, false)).toEqual({ ok: true });
    const ordinaryResult = ordinary.finish(undefined, 3);
    const ordinaryMass = ordinaryResult.events
      .filter((event) => event.abilityId === PLAYER_POISON_EFFECT_ID && event.tick === 2)
      .reduce((sum, event) => sum + (event.expectedOccurrences ?? 0), 0);
    expect(ordinaryMass).toBeCloseTo(1 - 0.875 ** 2, 12);
  });

  it("lands Assault's tick-1 application hit with 12.5% mass at tick 3", () => {
    const ctx = createCastContext({
      ...baseInput,
      horizonTicks: 4,
      startingAdrenaline: 100,
      playerPoison: profile(),
    });
    expect(ctx.performCast(ctx.byId.get("assault")!, 0, false)).toEqual({ ok: true });
    const result = ctx.finish(undefined, 4);
    const tickThreeMass = result.events
      .filter((event) => event.abilityId === PLAYER_POISON_EFFECT_ID && event.tick === 3)
      .reduce((sum, event) => sum + (event.expectedOccurrences ?? 0), 0);
    expect(tickThreeMass).toBeCloseTo(0.125, 12);
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
    expect(result.playerPoison?.applicationAttempts).toBeCloseTo(1.05, 12);
    expect(result.playerPoison?.successfulApplications).toBeCloseTo(0.125 * 1.05, 12);
    expect(result.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
    const infernos = result.events.filter((event) => event.abilityId === "inferno-of-zamorak");
    expect(infernos).toHaveLength(1);
    expect(infernos[0]).toMatchObject({
      attached: false,
      expectedTriggerRolls: 1,
      expectedActivations: 0.05,
      occurrenceModel: { kind: "bernoulli", probability: 0.05 },
    });
    const attached = result.events.filter(
      (event) =>
        event.tick === 0 &&
        (event.abilityId === "abyssal-cinders" || event.abilityId === "big-boned"),
    );
    expect(attached).toHaveLength(3);
    expect(attached.every((event) => event.attached)).toBe(true);
    expect(
      result.events.some(
        (event) => event.abilityId === "abyssal-cinders" && event.derivedFrom === infernos[0]!.seq,
      ),
    ).toBe(false);
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
    const poisonHits = result.events.filter((event) => event.abilityId === PLAYER_POISON_EFFECT_ID);
    const riders = result.events.filter(
      (event) => event.abilityId === "big-boned" && event.bonusTargetId === PLAYER_POISON_EFFECT_ID,
    );
    expect(riders).toHaveLength(poisonHits.length);
    expect(riders.length).toBeGreaterThan(0);
    expect(
      riders.every(
        (event) =>
          event.attached &&
          event.expectedSeparateHits === 0 &&
          !event.procEligible &&
          event.originKind === "poison" &&
          poisonHits.some((poison) => poison.seq === event.derivedFrom),
      ),
    ).toBe(true);
    expect(result.playerPoison?.applicationAttempts).toBe(1);
    expect(result.playerPoison?.successfulApplications).toBeCloseTo(0.125, 12);
    expect(riders.reduce((sum, event) => sum + event.damage.expected, 0)).toBeGreaterThan(0);
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
      return result.events
        .filter(
          (event) =>
            event.abilityId === "big-boned" && event.bonusTargetId === PLAYER_POISON_EFFECT_ID,
        )
        .reduce((sum, event) => sum + event.damage.expected, 0);
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
      const ctx = createCastContext({
        ...baseInput,
        horizonTicks: 17,
        playerPoison: profile({
          potion: "none",
          potionUntilTick: 0,
          cinderbane: true,
          laniakea,
        }),
      });
      expect(ctx.performCast(ctx.byId.get("attack")!, 0, false)).toEqual({ ok: true });
      const result = ctx.finish(undefined, 17);
      const boundedOracle = Array.from({ length: 9 }, (_, index) => chance ** (index + 1)).reduce(
        (sum, value) => sum + value,
        0,
      );
      expect(result.playerPoison?.successfulApplications).toBeCloseTo(boundedOracle, 10);
      expect(result.playerPoison?.successfulCinderbaneContinuations).toBeCloseTo(
        boundedOracle - chance,
        10,
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

  it("materializes each recursive Cinderbane poison hit at successive 1/8 powers", () => {
    const chance = 1 / 8;
    const ctx = createCastContext({
      ...baseInput,
      horizonTicks: 18,
      playerPoison: profile({
        potion: "none",
        potionUntilTick: 0,
        cinderbane: true,
      }),
    });
    expect(ctx.performCast(ctx.byId.get("attack")!, 0, false)).toEqual({ ok: true });
    const result = ctx.finish(undefined, 18);
    const poisonHits = result.events.filter((event) => event.abilityId === PLAYER_POISON_EFFECT_ID);
    expect(poisonHits.map((event) => event.tick)).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
    expect(poisonHits.map((event) => event.expectedOccurrences ?? 0)).toEqual(
      Array.from({ length: 8 }, (_, index) => chance ** (index + 1)),
    );
    const conditionalExtraHits =
      (poisonHits.reduce((sum, event) => sum + (event.expectedOccurrences ?? 0), 0) - chance) /
      chance;
    const finiteOracle = Array.from({ length: 7 }, (_, index) => chance ** (index + 1)).reduce(
      (sum, value) => sum + value,
      0,
    );
    expect(conditionalExtraHits).toBeCloseTo(finiteOracle, 12);
    expect(conditionalExtraHits).toBeCloseTo(1 / 7, 6);
    expect(
      result.analysis.byEffect.find((row) => row.id === PLAYER_POISON_EFFECT_ID)
        ?.expectedPlayerPoisonHits,
    ).toBeCloseTo(chance * finiteOracle, 12);
    expect(result.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
  });

  it("keeps full-analysis and score-only totals aligned for multi-hit Cinderbane plus Bik", () => {
    const run = (detailLevel: "full-analysis" | "score-only") => {
      const ctx = createCastContext({
        ...baseInput,
        horizonTicks: 40,
        detailLevel,
        startingAdrenaline: 100,
        ammo: "bik",
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

  it("does not spend or discard global branch mass at a one-branch cap", () => {
    const ctx = createCastContext(
      {
        ...baseInput,
        horizonTicks: 20,
        startingAdrenaline: 100,
        ammo: "bik",
        playerPoison: profile({ cinderbane: true }),
      },
      { maxLiveBranches: 1, maxIntermediateBranches: 1, maximumResidualWeight: 0 },
    );
    expect(ctx.performCast(ctx.byId.get("hurricane")!, 0, false)).toEqual({ ok: true });
    const result = ctx.finish(undefined, 20);
    expect(result.rng).toBeUndefined();
    expect(result.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
    expect(result.playerPoison?.expectedDamage).toBeGreaterThan(0);
    expect(result.damage.scope).toBe("unit-mass");
  });
});
