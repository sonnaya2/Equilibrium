import { describe, expect, it } from "vitest";
import { rotationOf } from "../engine/simulation/contracts";
import { simulate } from "../engine/simulation/simulate";
import { baseInput, necroInput, rangedInput } from "../test/fixtures/inputs";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { PLAYER_POISON_EFFECT_ID, type PlayerPoisonProfile } from "../poison/mechanics";
import {
  blessingRule,
  resolveLeagueCritAtLand,
  resolveLeagueCritualStats,
  resolveLeagueRules,
} from "./ruleset";
import { calculateLeagueAbility, resolveLeagueAttachedRawHost } from "./damage";
import { barkscalesOutcome } from "./barkscales";

const poisonProfile = {
  potion: "weapon",
  potionUntilTick: 250,
  kwuarmPotency: 0,
  cinderbane: false,
  blowpipe: false,
  laniakea: false,
} satisfies PlayerPoisonProfile;

const picks = (...paths: ("Order" | "Balance" | "Chaos")[]) =>
  resolveLeagueRules({ ruleset: "equilibrium", blessingPicks: paths });

describe("Tier 5 and Tier 6 blessing mechanics", () => {
  const blessingStream = (
    result: ReturnType<typeof simulate>,
    blessingId: string,
    abilityId?: string,
  ) =>
    result.events
      .filter(
        (event) =>
          event.family === "blessing" &&
          event.blessingId === blessingId &&
          (abilityId === undefined || event.abilityId === abilityId),
      )
      .map((event) => ({
        abilityId: event.abilityId,
        blessingId: event.blessingId,
        tick: event.tick,
        expectedTriggerRolls: event.expectedTriggerRolls,
        expectedOccurrences: event.expectedOccurrences,
        expectedActivations: event.expectedActivations,
        expectedSeparateHits: event.expectedSeparateHits,
        occurrenceModel: event.occurrenceModel,
      }));

  it("keeps Perfidious scoped by source across paired event and analysis streams", () => {
    const unholyBase = simulate({
      ...baseInput,
      league: picks("Chaos", "Chaos", "Chaos", "Chaos", "Chaos"),
      crit: { chance: 0.5 },
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const unholyPerfidious = simulate({
      ...baseInput,
      league: picks("Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"),
      crit: { chance: 0.5 },
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const tearingBase = simulate({
      ...baseInput,
      league: picks("Balance", "Balance", "Balance", "Balance", "Balance"),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("dismember"),
    });
    const tearingPerfidious = simulate({
      ...baseInput,
      league: picks("Balance", "Balance", "Balance", "Balance", "Balance", "Chaos"),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("dismember"),
    });
    const lordBase = simulate({
      ...baseInput,
      league: picks("Balance", "Balance", "Balance", "Balance", "Order"),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf(...Array.from({ length: 12 }, () => "attack")),
    });
    const lordPerfidious = simulate({
      ...baseInput,
      league: picks("Balance", "Balance", "Balance", "Balance", "Order", "Chaos"),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf(...Array.from({ length: 12 }, () => "attack")),
    });

    const cindersBase = blessingStream(unholyBase, "abyssal-cinders", "inferno-of-zamorak");
    const cindersPerfidious = blessingStream(
      unholyPerfidious,
      "abyssal-cinders",
      "inferno-of-zamorak",
    );
    for (const event of [...cindersBase, ...cindersPerfidious]) {
      expect(event.occurrenceModel).toBeUndefined();
      expect(event.expectedOccurrences).toBe(1);
      expect(event.expectedActivations).toBe(1);
      expect(event.expectedSeparateHits).toBe(1);
    }
    expect(
      unholyBase.analysis.byEffect
        .find((row) => row.id === "inferno-of-zamorak")
        ?.sourceBreakdown?.find((source) => source.blessingId === "abyssal-cinders")
        ?.expectedActivations,
    ).toBeCloseTo(0.05, 1);
    expect(
      unholyPerfidious.analysis.byEffect
        .find((row) => row.id === "inferno-of-zamorak")
        ?.sourceBreakdown?.find((source) => source.blessingId === "abyssal-cinders")
        ?.expectedActivations,
    ).toBeCloseTo(0.25, 1);
    expect(
      unholyBase.analysis.byEffect
        .find((row) => row.id === "inferno-of-zamorak")
        ?.sourceBreakdown?.find((source) => source.blessingId === "unholy-critual")
        ?.expectedActivations,
    ).toBeCloseTo(0.5, 0);
    const infernoRow = unholyPerfidious.analysis.byEffect.find(
      (row) => row.id === "inferno-of-zamorak",
    );
    expect(infernoRow?.sourceBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blessingId: "abyssal-cinders",
          expectedTriggerRolls: 0.25,
          expectedActivations: 0.25,
        }),
        expect.objectContaining({
          blessingId: "unholy-critual",
          expectedTriggerRolls: 0.5,
          expectedActivations: 0.5,
        }),
      ]),
    );
    expect(infernoRow?.totalDamage).toBeGreaterThan(0);

    const tearingEvents = (result: ReturnType<typeof simulate>) => [
      ...blessingStream(result, "tearing-thorns", "grasp-of-guthix-max-life"),
      ...blessingStream(result, "tearing-thorns", "grasp-of-guthix-poison"),
    ];
    expect(tearingBase.events.filter((event) => event.abilityId === "dismember")).toHaveLength(16);
    expect(
      tearingPerfidious.events.filter((event) => event.abilityId === "dismember"),
    ).toHaveLength(16);
    expect(tearingEvents(tearingBase)).toEqual(tearingEvents(tearingPerfidious));
    expect(tearingEvents(tearingBase).map((event) => event.tick)).toEqual([10, 20, 30, 10, 20, 30]);
    for (const effectId of ["grasp-of-guthix-max-life", "grasp-of-guthix-poison"]) {
      const row = tearingBase.analysis.byEffect.find((effect) => effect.id === effectId);
      expect(row?.sourceBreakdown).toEqual(
        expect.arrayContaining([expect.objectContaining({ blessingId: "tearing-thorns" })]),
      );
    }

    const lordEvents = (result: ReturnType<typeof simulate>) =>
      blessingStream(result, "lord-of-light", "light-of-saradomin");
    expect(lordEvents(lordBase)).toEqual(lordEvents(lordPerfidious));
    expect(lordEvents(lordBase).map((event) => event.tick)).toEqual([
      ...Array(5).fill(0),
      ...Array(5).fill(24),
    ]);
    const lightRow = lordBase.analysis.byEffect.find(
      (effect) => effect.id === "light-of-saradomin",
    );
    expect(lightRow?.sourceBreakdown).toEqual(
      expect.arrayContaining([expect.objectContaining({ blessingId: "lord-of-light" })]),
    );

    const strikingBaseLeague = picks("Chaos", "Order", "Balance", "Order", "Order");
    const strikingPerfidiousLeague = picks("Chaos", "Order", "Balance", "Order", "Order", "Chaos");
    const strikingBase = simulate({
      ...baseInput,
      league: strikingBaseLeague,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf(...Array.from({ length: 9 }, () => "attack")),
    });
    const strikingPerfidious = simulate({
      ...baseInput,
      league: strikingPerfidiousLeague,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf(...Array.from({ length: 9 }, () => "attack")),
    });
    expect(blessingRule(strikingBaseLeague, "striking-light")?.light?.cooldownTicks).toBe(15);
    expect(blessingRule(strikingPerfidiousLeague, "perfidious")?.strikingLightCooldownTicks).toBe(
      8,
    );
    expect(
      blessingStream(strikingBase, "striking-light", "light-of-saradomin").map(
        (event) => event.tick,
      ),
    ).toEqual([0, 15]);
    expect(
      blessingStream(strikingPerfidious, "striking-light", "light-of-saradomin").map(
        (event) => event.tick,
      ),
    ).toEqual([0, 9, 18]);
  });

  it("converts Unholy Critual excess while exposing the effective cap", () => {
    const league = picks("Order", "Order", "Order", "Order", "Chaos");
    expect(league.blessingIds.has("unholy-critual")).toBe(true);
    expect(resolveLeagueCritualStats(league, 0.4)).toMatchObject({
      uncappedChance: 0.55,
      effectiveChance: 0.5,
    });
    expect(resolveLeagueCritualStats(league, 0.4).convertedChance).toBeCloseTo(0.05, 12);
  });

  it("caps dynamic and guaranteed crit while keeping conversion idempotent", () => {
    const league = picks("Order", "Order", "Order", "Order", "Chaos");
    const static55 = {
      chance: 0.5,
      damageBonus: 0.05,
      critualConvertedDamageBonus: 0.05,
    };
    const once = resolveLeagueCritAtLand(league, static55);
    const twice = resolveLeagueCritAtLand(league, once);
    expect(once.chance).toBe(0.5);
    expect(once.damageBonus).toBeCloseTo(0.05, 12);
    expect(twice.chance).toBe(0.5);
    expect(twice.damageBonus).toBeCloseTo(0.05, 12);

    const dynamic = resolveLeagueCritAtLand(league, {
      chance: 0.6,
      damageBonus: 0.15,
      critualConvertedDamageBonus: 0.15,
    });
    expect(dynamic.chance).toBe(0.5);
    expect(dynamic.damageBonus).toBeCloseTo(0.25, 12);

    const guaranteed = resolveLeagueCritAtLand(league, {
      chance: 0.5,
      guaranteed: true,
      damageBonus: 0.05,
      critualConvertedDamageBonus: 0.05,
    });
    expect(guaranteed.chance).toBe(0.5);
    expect(guaranteed.damageBonus).toBeCloseTo(0.5, 12);
    expect(guaranteed.guaranteed).toBe(false);
  });

  it("normalizes raw separate hosts and carries conversion into Inferno damage", () => {
    const league = picks("Order", "Order", "Order", "Order", "Chaos");
    const raw = resolveLeagueAttachedRawHost({
      rules: league,
      source: { kind: "blessing", detail: "inferno-of-zamorak" },
      abilityBase: 1_000,
      min: 1_000,
      max: 1_000,
      level: 99,
      accuracy: 1,
      crit: { chance: 1, eligible: true },
      modifiers: [],
      context: { style: "melee", ruleset: "equilibrium" },
    });
    expect(raw.hit.critChance).toBeCloseTo(0.5, 12);
    expect(raw.hit.critDamageBonus).toBeCloseTo(0.5, 12);

    const result = calculateLeagueAbility(
      MELEE_ABILITIES.find((ability) => ability.id === "attack")!,
      {
        base: 1_000,
        level: 99,
        accuracy: 1,
        crit: { chance: 1 },
        modifiers: [],
        context: { style: "melee", ruleset: "equilibrium" },
        rules: league,
      },
    );
    const inferno = result.leagueContributions.find(
      (component) => component.blessingId === "unholy-critual",
    );
    expect(result.hits[0]?.critChance).toBeCloseTo(0.5, 12);
    expect(inferno?.hitDetail?.critChance).toBeCloseTo(0.5, 12);
    expect(inferno?.hitDetail?.critDamageBonus).toBeCloseTo(1, 12);
    expect(inferno?.occurrenceModel).toMatchObject({
      kind: "bernoulli",
      probability: 0.5,
    });
  });

  it("excludes DoT and player-poison hits from Critual", () => {
    const league = picks("Order", "Order", "Order", "Order", "Chaos");
    const result = simulate({
      ...rangedInput,
      startingAdrenaline: 100,
      crit: { chance: 0.5 },
      league,
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("ranged_attack", "corruption_shot"),
      playerPoison: poisonProfile,
    });
    const inferno = result.analysis.byEffect.find((row) => row.id === "inferno-of-zamorak");
    const corruption = result.analysis.byEffect.find((row) => row.id === "corruption_shot");
    const poison = result.analysis.byEffect.find((row) => row.id === PLAYER_POISON_EFFECT_ID);
    expect(inferno).toBeDefined();
    expect(inferno?.expectedTriggerRolls).toBeGreaterThan(0);
    // One ranged_attack at p=0.5 -> 0.5 Inferno (no recursive chain; DoT excluded).
    expect(inferno?.expectedActivations).toBeCloseTo(0.5, 0);
    expect(inferno?.expectedSeparateHits).toBeCloseTo(0.5, 0);
    expect(corruption?.dotDamage).toBeGreaterThan(0);
    expect(poison?.expectedSeparateHits).toBeGreaterThan(0);
    expect(
      result.events
        .filter(
          (event) =>
            event.abilityId === "corruption_shot" || event.abilityId === PLAYER_POISON_EFFECT_ID,
        )
        .every((event) => (event.damage.critical?.mode ?? "none") === "none"),
    ).toBe(true);
  });

  it("lets inherited Death Skulls crits trigger Critual without rerolling bounces", () => {
    const league = picks("Order", "Order", "Order", "Order", "Chaos");
    // Explicit multi-lane ensemble for EV activation totals (product UI is single-path).
    const critical = simulate(
      {
        ...necroInput,
        startingAdrenaline: 100,
        crit: { chance: 0.5, guaranteed: true },
        league,
        context: { style: "necromancy", ruleset: "equilibrium" },
        rotation: rotationOf("death_skulls"),
      },
      { stochasticLanes: 128 },
    );
    // Critual converts guaranteed to p=0.5; three skull hits * 0.5 = 1.5 Infernos (no recursion).
    expect(critical.analysis.byEffect.find((row) => row.id === "inferno-of-zamorak")).toMatchObject(
      {
        expectedActivations: expect.closeTo(1.5, 0),
        expectedSeparateHits: expect.closeTo(1.5, 0),
      },
    );
    const skulls = critical.events.filter((event) => event.abilityId === "death_skulls");
    expect(skulls).toHaveLength(3);
    expect(
      skulls
        .slice(1)
        .every((event) => event.damage.critical?.outcome === skulls[0]?.damage.critical?.outcome),
    ).toBe(true);

    const nonCrit = simulate({
      ...necroInput,
      startingAdrenaline: 100,
      crit: { chance: 0 },
      league,
      context: { style: "necromancy", ruleset: "equilibrium" },
      rotation: rotationOf("death_skulls"),
    });
    expect(
      nonCrit.analysis.byEffect.find((row) => row.id === "inferno-of-zamorak"),
    ).toBeUndefined();
  });

  it("materializes one Unholy Inferno per parent crit without requiring Cinders", () => {
    const league = picks("Order", "Order", "Order", "Order", "Chaos");
    expect(league.blessingIds.has("abyssal-cinders")).toBe(false);
    // Explicit multi-lane ensemble for EV activation totals (product UI is single-path).
    const result = simulate(
      {
        ...rangedInput,
        league,
        crit: { chance: 0.5 },
        context: { style: "ranged", ruleset: "equilibrium" },
        rotation: rotationOf("greater_ricochet"),
      },
      { stochasticLanes: 128 },
    );
    const infernos = result.events.filter((event) => event.abilityId === "inferno-of-zamorak");
    // 7 Greater Ricochet hits * 0.5 crit = 3.5 Infernos EV (no recursive chain).
    expect(result.analysis.byEffect.find((row) => row.id === "inferno-of-zamorak")).toMatchObject({
      expectedActivations: expect.closeTo(3.5, 0),
      expectedSeparateHits: expect.closeTo(3.5, 0),
    });
    for (const event of infernos) {
      expect(event.occurrenceModel).toBeUndefined();
      expect(event.expectedOccurrences).toBe(1);
      expect(event.expectedActivations).toBe(1);
      expect(event.expectedSeparateHits).toBe(1);
    }
    const parents = result.events.filter(
      (event) => event.abilityId === "greater_ricochet" && event.family === "hit",
    );
    const parentCrits = parents.filter((event) => event.damage.critical?.outcome === true);
    expect(infernos).toHaveLength(parentCrits.length);
    for (const parent of parentCrits) {
      expect(infernos.filter((event) => event.derivedFrom === parent.seq)).toHaveLength(1);
    }
  });

  it("keeps Perfidious scoped to original Cinders and Barkscales origins", () => {
    const baseLeague = picks("Chaos", "Chaos", "Chaos", "Chaos", "Chaos");
    const league = picks("Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos");
    const cinders = blessingRule(league, "abyssal-cinders")!;
    const perfidious = blessingRule(league, "perfidious")!.perfidious!;
    expect(perfidious.cindersChanceMultiplier).toBe(5);
    expect(perfidious.barkscalesHitsPerTrigger).toBe(2);
    expect(cinders.inferno?.chance).toBe(0.05);
    expect(
      barkscalesOutcome(blessingRule(baseLeague, "barkscales"), 1_000, 12, {
        incomingHitIntervalSeconds: 1,
      }).hitsPerTrigger,
    ).toBe(5);
    expect(
      barkscalesOutcome(
        blessingRule(league, "barkscales"),
        1_000,
        12,
        { incomingHitIntervalSeconds: 1 },
        perfidious.barkscalesHitsPerTrigger,
      ).triggers,
    ).toBe(6);

    const cindersRun = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    expect(
      cindersRun.events.filter(
        (event) =>
          event.abilityId === "inferno-of-zamorak" && event.blessingId === "abyssal-cinders",
      ),
    ).toEqual([]);
    expect(
      cindersRun.analysis.byEffect
        .find((row) => row.id === "inferno-of-zamorak")
        ?.sourceBreakdown?.find((source) => source.blessingId === "abyssal-cinders")
        ?.expectedActivations,
    ).toBeCloseTo(0.25, 1);
  });

  it("doubles marked DoT duration and triggers Grasp every fifth hit", () => {
    const league = resolveLeagueRules(
      {
        ruleset: "equilibrium",
        blessingPicks: ["Balance", "Balance", "Balance", "Balance", "Balance"],
      },
      { maximumLife: 10_000, areaTargets: 3 },
    );
    const result = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("dismember"),
    });
    expect(result.events.filter((event) => event.abilityId === "dismember")).toHaveLength(16);
    expect(
      result.events.filter((event) => event.abilityId === "grasp-of-guthix-max-life"),
    ).toHaveLength(3);
    expect(
      result.events.filter((event) => event.abilityId === "grasp-of-guthix-poison"),
    ).toHaveLength(3);

    const immuneResult = simulate({
      ...baseInput,
      league,
      targetPoisonImmune: true,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("dismember"),
    });
    expect(
      immuneResult.events.filter((event) => event.abilityId === "grasp-of-guthix-max-life"),
    ).toHaveLength(3);
    expect(
      immuneResult.events.filter((event) => event.abilityId === "grasp-of-guthix-poison"),
    ).toHaveLength(0);
  });
});
