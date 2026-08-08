import { describe, expect, it } from "vitest";
import { rotationOf } from "../engine/simulation/contracts";
import { simulate } from "../engine/simulation/simulate";
import { baseInput } from "../test/fixtures/inputs";
import { blessingRule, resolveLeagueCritualStats, resolveLeagueRules } from "./ruleset";
import { barkscalesOutcome } from "./barkscales";

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
    expect(cindersBase[0]).toMatchObject({
      occurrenceModel: { kind: "geometric", startProbability: 0.05 },
    });
    expect(cindersPerfidious[0]).toMatchObject({
      occurrenceModel: { kind: "geometric", startProbability: 0.25 },
    });
    expect(blessingStream(unholyBase, "unholy-critual", "inferno-of-zamorak")).toEqual(
      blessingStream(unholyPerfidious, "unholy-critual", "inferno-of-zamorak"),
    );
    const infernoRow = unholyPerfidious.analysis.byEffect.find(
      (row) => row.id === "inferno-of-zamorak",
    );
    expect(infernoRow?.sourceBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blessingId: "abyssal-cinders",
          expectedTriggerRolls: 1,
          expectedActivations: 0.5,
        }),
        expect.objectContaining({
          blessingId: "unholy-critual",
          expectedTriggerRolls: 1,
          expectedActivations: 1,
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

  it("packs Unholy Inferno recursion without requiring Cinders", () => {
    const league = picks("Order", "Order", "Order", "Order", "Chaos");
    expect(league.blessingIds.has("abyssal-cinders")).toBe(false);
    const result = simulate({
      ...baseInput,
      league,
      crit: { chance: 0.5 },
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const infernos = result.events.filter((event) => event.abilityId === "inferno-of-zamorak");
    expect(infernos).toHaveLength(1);
    expect(infernos[0]).toMatchObject({
      blessingId: "unholy-critual",
      occurrenceModel: {
        kind: "geometric",
        startProbability: 0.5,
        continuationProbability: 0.5,
      },
      expectedActivations: 1,
      expectedSeparateHits: 1,
    });
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
    ).toMatchObject([{ expectedActivations: 0.25 }]);
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
