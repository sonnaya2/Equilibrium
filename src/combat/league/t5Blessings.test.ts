import { describe, expect, it } from "vitest";
import { rotationOf } from "../engine/simulation/contracts";
import { simulate } from "../engine/simulation/simulate";
import { baseInput } from "../test/fixtures/inputs";
import { blessingRule, resolveLeagueCritualStats, resolveLeagueRules } from "./ruleset";
import { barkscalesOutcome } from "./barkscales";

const picks = (...paths: ("Order" | "Balance" | "Chaos")[]) =>
  resolveLeagueRules({ ruleset: "equilibrium", blessingPicks: paths });

describe("Tier 5 and Tier 6 blessing mechanics", () => {
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
    const league = picks("Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos");
    const cinders = blessingRule(league, "abyssal-cinders")!;
    const perfidious = blessingRule(league, "perfidious")!.perfidious!;
    expect(perfidious.cindersChanceMultiplier).toBe(5);
    expect(perfidious.barkscalesHitsPerTrigger).toBe(2);
    expect(cinders.inferno?.chance).toBe(0.05);
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
