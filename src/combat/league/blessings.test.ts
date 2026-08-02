import { describe, expect, it } from "vitest";
import type { BlessingPath } from "../../league/blessings";
import { createCastContext, simulate } from "../engine/simulation/simulate";
import { rotationOf } from "../engine/simulation/contracts";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { baseInput } from "../test/fixtures/inputs";
import { calculateLeagueAbility } from "./damage";
import {
  blessingAdrenalineGenerationMultiplier,
  blessingLifeMultiplier,
  leagueModifiers,
  resolveLeagueRules,
} from "./ruleset";

const rules = (
  blessingPicks: readonly BlessingPath[],
  derived: {
    totalArmour?: number;
    maximumLife?: number;
    targetTiles?: number;
  } = {},
) => resolveLeagueRules({ ruleset: "equilibrium", blessingPicks }, derived);

describe("Equilibrium blessing combat rules", () => {
  it("adds Big Boned and Cinders as explicit non-recursive damage events", () => {
    // Default product path: BB per-hit rider + Cinders on the same parent hits.
    const league = rules(["Balance", "Chaos", "Chaos"], { maximumLife: 15_000 });
    const result = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    expect(result.totalExpected).toBe(2_175);
    expect(
      result.events.filter((event) => event.blessingId).map((event) => event.abilityId),
    ).toEqual(["big-boned", "abyssal-cinders", "inferno-of-zamorak"]);
    expect(result.events.find((event) => event.abilityId === "inferno-of-zamorak")).toMatchObject({
      family: "blessing",
      expectedOccurrences: 0.05,
      triggerRolls: 1,
      expectedActivations: 0.05,
      expectedSeparateHits: 0.05,
      damage: { min: 0, max: 2_000, expected: 75 },
    });
    expect(
      result.analysis.byEffect.find((effect) => effect.id === "inferno-of-zamorak"),
    ).toMatchObject({ expectedActivations: 0.05, averagePerActivation: 1_500 });
    expect(simulate({ ...baseInput, rotation: rotationOf("attack") }).totalExpected).toBe(1_200);
  });

  it("includes Big Boned outgoing damage while keeping max-life multiplier", () => {
    const league = rules(["Balance", "Chaos", "Chaos"], { maximumLife: 15_000 });
    expect(blessingLifeMultiplier({ ruleset: "equilibrium", blessingPicks: ["Balance"] })).toBe(
      1.5,
    );
    const result = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    // Base 1200 + BB 750 + cinders 150 + inferno EV 75.
    expect(result.totalExpected).toBe(2_175);
    expect(result.events.filter((event) => event.abilityId === "big-boned")).toHaveLength(1);
    expect(
      result.events.filter((event) => event.blessingId).map((event) => event.abilityId),
    ).toEqual(["big-boned", "abyssal-cinders", "inferno-of-zamorak"]);
  });

  it("enforces Striking Light's 15-tick cooldown and Sacred Fervor's cooldown clock", () => {
    const league = rules(["Order", "Order", "Order"], { totalArmour: 1_000 });
    const result = simulate({
      ...baseInput,
      league,
      modifiers: leagueModifiers(league),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack", "attack", "attack", "attack", "attack", "attack"),
    });
    expect(
      result.events
        .filter((event) => event.abilityId === "light-of-saradomin")
        .map((event) => event.tick),
    ).toEqual([0, 15]);

    const dragonBreath = MAGIC_ABILITIES.find((ability) => ability.id === "dragon_breath")!;
    const context = createCastContext({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      league,
      context: { style: "magic", ruleset: "equilibrium" },
    });
    expect(context.performCast(dragonBreath, 0, false).ok).toBe(true);
    expect(context.firstLegalTick(dragonBreath.id)).toBe(8);
  });

  it("applies Splash Zone only to tagged attacks and Adrenaline Junkie only to ability gains", () => {
    const league = rules(["Chaos", "Balance", "Balance"], { targetTiles: 4 });
    const dragonBreath = MAGIC_ABILITIES.find((ability) => ability.id === "dragon_breath")!;
    const result = calculateLeagueAbility(dragonBreath, {
      base: 1_000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      modifiers: leagueModifiers(league),
      context: { style: "magic", ruleset: "equilibrium" },
      rules: league,
    });
    expect(result).toMatchObject({ min: 1_650, max: 1_950 });
    expect(result.expected).toBeCloseTo(1_800, 0);
    expect(blessingAdrenalineGenerationMultiplier(league)).toBe(1.5);
    expect(result.adrenalineDelta).toBe(13.5);
  });

  it("branches Avernic Rampage and makes only later casts inside its window free", () => {
    const league = rules(["Chaos", "Chaos", "Chaos"]);
    const assault = baseInput.abilities.find((ability) => ability.id === "assault")!;
    const context = createCastContext({
      ...baseInput,
      league,
      startingAdrenaline: 100,
      context: { style: "melee", ruleset: "equilibrium" },
    });
    expect(context.performCast(assault, 0, false, { "avernic-rampage": true }).ok).toBe(true);
    expect(context.getState()).toMatchObject({
      adrenaline: 75,
      league: { avernicRampageUntilTick: 12 },
    });
    expect(
      context.performCast(assault, context.firstLegalTick(assault.id), false, {
        "avernic-rampage": false,
      }).ok,
    ).toBe(true);
    expect(context.getState().adrenaline).toBe(75);

    const branched = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    expect(branched.rng).toMatchObject({
      method: "probability-weighted branching",
      terminalClasses: 2,
      representativeClassWeight: 0.95,
    });
  });
});
