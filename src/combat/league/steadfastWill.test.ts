import { describe, expect, it } from "vitest";
import { blessingChoice } from "../../league/blessings";
import { allEngineSpecs, entryByEngineId } from "../abilities/registry";
import { rotationOf } from "../engine/simulation/contracts";
import { createCastContext, simulate } from "../engine/simulation/simulate";
import { reduceActiveCooldowns } from "../engine/cast/effects/cooldowns";
import { createRuntime } from "../engine/runtime/runtime";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { shieldBashingPerkModifier } from "../shared/perks";
import { meetsWeaponRequirement } from "../shared/requirements";
import { buildCandidatePool } from "../solver/candidatePool";
import { abilityStyleForBar } from "../styles/shared/allStyleAbilities";
import { revengeDamageMultiplier } from "../styles/shared/revenge";
import {
  BASH,
  DEBILITATE,
  PREPARATION,
  REVENGE,
  bashRawDamageBand,
  bashSource,
  debilitateSource,
  preparationSource,
  revengeSource,
} from "../styles/shared/defenceAbilities";
import { baseInput } from "../test/fixtures/inputs";
import { resolveLeagueRules } from "./ruleset";

const steadfast = resolveLeagueRules(
  { ruleset: "equilibrium", blessingPicks: ["Order", "Order", "Order"] },
  { totalArmour: 100, offhandArmourValue: 50, defenceLevel: 99 },
);

describe("Steadfast Will shield DPS", () => {
  it("keeps sourced ability metadata and exposes the defensive abilities to each style", () => {
    expect(BASH).toMatchObject({ category: "basic", cooldownSeconds: 15, adrenaline: { gain: 9 } });
    expect(PREPARATION).toMatchObject({
      category: "basic",
      cooldownSeconds: 20.4,
      adrenaline: { gain: 9 },
    });
    expect(DEBILITATE).toMatchObject({
      category: "threshold",
      cooldownSeconds: 30,
      adrenaline: { cost: 15 },
    });
    expect(REVENGE).toMatchObject({
      category: "threshold",
      cooldownSeconds: 45,
      adrenaline: { cost: 15 },
    });
    for (const source of [bashSource(), preparationSource(), debilitateSource(), revengeSource()]) {
      expect(source.verifiedAt).toBe("2026-08-19");
    }
    expect(entryByEngineId("bash")?.linkKind).toBe("factory");
    expect(entryByEngineId("bash")?.support.status).toBe("full");
    expect(entryByEngineId("preparation")?.support.status).toBe("full");
    expect(entryByEngineId("preparation")?.solverEligibleDefault).toBe(true);
    expect(entryByEngineId("revenge")?.solverEligibleDefault).toBe(true);
    expect(entryByEngineId("reflect")).toBeUndefined();

    const pool = buildCandidatePool(allEngineSpecs(), "magic", {
      weaponConfiguration: "shield",
    });
    expect(pool.byId.has("preparation")).toBe(true);
    expect(pool.byId.has("revenge")).toBe(true);
    expect(pool.byId.has("reflect")).toBe(false);
  });

  it("requires a wielded shield or defender for Bash, Preparation, and Revenge", () => {
    for (const ability of [BASH, PREPARATION, REVENGE]) {
      expect(meetsWeaponRequirement(ability, "shield")).toBe(true);
      expect(meetsWeaponRequirement(ability, "defender")).toBe(true);
      expect(meetsWeaponRequirement(ability, "twohand")).toBe(false);
      expect(meetsWeaponRequirement(ability, "mainhand")).toBe(false);
    }
  });

  it("adds the Steadfast armour band to ordinary Bash damage", () => {
    expect(
      bashRawDamageBand(1_000, {
        offhandArmourValue: 50,
        defenceLevel: 99,
        totalArmour: 100,
      }),
    ).toEqual({ min: 229, max: 1_149 });
    expect(
      bashRawDamageBand(1_000, {
        offhandArmourValue: 50,
        defenceLevel: 99,
        totalArmour: 100,
        steadfastArmourBand: [3.5, 4.5],
      }),
    ).toEqual({ min: 579, max: 1_599 });

    const bash = abilityStyleForBar(BASH, "melee");
    const run = simulate({
      ...baseInput,
      abilities: [...baseInput.abilities, bash],
      league: steadfast,
      context: { style: "melee", ruleset: "equilibrium" },
      weaponConfiguration: "shield",
      rotation: rotationOf("bash"),
    });
    expect(run.ok, run.error).toBe(true);
    expect(run.events[0]?.damage).toMatchObject({ min: 579, max: 1_599, expected: 1_089 });
    expect(run.perAbility.bash).toBe(1_089);
  });

  it("reduces active cooldowns by 20 ticks when Preparation is cast", () => {
    const longCooldown: AbilitySpec = {
      id: "test_long_cooldown",
      name: "Test long cooldown",
      style: "melee",
      category: "basic",
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { gain: 9 },
      cooldownSeconds: 30,
    };
    const preparation = abilityStyleForBar(PREPARATION, "melee");
    const run = (league: typeof steadfast | undefined) =>
      simulate({
        ...baseInput,
        abilities: [...baseInput.abilities, longCooldown, preparation],
        league,
        weaponConfiguration: "shield",
        rotation: rotationOf("test_long_cooldown", "preparation", "test_long_cooldown"),
      });

    expect(run(steadfast).casts.map((cast) => cast.tick)).toEqual([0, 3, 15]);
    expect(run(undefined).casts.map((cast) => cast.tick)).toEqual([0, 3, 50]);
  });

  it("reduces single and charge clocks without finishing them", () => {
    const state = {
      ...createRuntime(baseInput).state,
      cooldowns: { long: 40, short: 10, preparation: 50 },
      charges: { stun: [8, 30], preparation: [45] },
    };
    const reduced = reduceActiveCooldowns(state, 20, 6, ["preparation"]);
    expect(reduced.cooldowns).toEqual({ long: 20, short: 6, preparation: 50 });
    expect(reduced.charges).toEqual({ stun: [6, 10], preparation: [45] });
  });

  it("builds Revenge stacks from the target incoming-hit interval", () => {
    const revenge = abilityStyleForBar(REVENGE, "melee");
    const attack: AbilitySpec = {
      id: "revenge_test_attack",
      name: "Revenge test attack",
      style: "melee",
      category: "basic",
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { gain: 9 },
    };
    const run = (weaponConfiguration: "shield" | "defender", interval?: number) =>
      simulate({
        ...baseInput,
        abilities: [...baseInput.abilities, revenge, attack],
        startingAdrenaline: 100,
        weaponConfiguration,
        ...(interval ? { incomingHitIntervalSeconds: interval } : {}),
        rotation: rotationOf("revenge", "revenge_test_attack"),
      });

    const noIncoming = run("shield");
    const shield = run("shield", 2.4);
    const defender = run("defender", 2.4);
    expect(noIncoming.ok && shield.ok && defender.ok).toBe(true);
    expect(shield.casts.map((cast) => cast.tick)).toEqual([0, 3]);
    expect(noIncoming.perAbility.revenge_test_attack).toBe(1_000);
    expect(shield.perAbility.revenge_test_attack).toBe(1_050);
    expect(defender.perAbility.revenge_test_attack).toBe(1_025);
  });

  it("doubles Revenge before Sacred Fervor cooldown reduction and raises its cap to 20", () => {
    const revenge = abilityStyleForBar(REVENGE, "melee");
    const ctx = createCastContext({
      ...baseInput,
      abilities: [...baseInput.abilities, revenge],
      startingAdrenaline: 100,
      weaponConfiguration: "shield",
      incomingHitIntervalSeconds: 0.6,
      league: steadfast,
    });
    expect(ctx.performCast(revenge, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.revenge).toBe(105);
    expect(ctx.getState().defence.revenge).toMatchObject({
      maximumStacks: 20,
      untilTick: 64,
    });
    expect(ctx.getState().defence.revenge.stacks).toBe(4);
    ctx.advanceTo(20);
    expect(ctx.getState().defence.revenge.stacks).toBe(20);
    expect(revengeDamageMultiplier(ctx.getState().defence.revenge, 20)).toBe(2);
  });

  it("records the disclosed partial support boundary", () => {
    const choice = blessingChoice(3, "Order")!;
    expect(choice.combat.steadfastWill).toEqual({
      bashArmourDamageBand: [3.5, 4.5],
      preparationCooldownReductionTicks: 20,
      revengeDurationMultiplier: 2,
      revengeCooldownMultiplier: 2,
      revengeMaximumStacks: 20,
    });
    expect(choice.support.status).toBe("partially-modeled");
    expect(choice.support.mechanicsUnverified).toBe(true);
    expect(choice.support.excluded.join(" ")).toMatch(/Reflect/);
    expect(choice.support.excluded.join(" ")).not.toMatch(/Revenge/);
  });

  it("includes Debilitate and its Shield Bashing perk damage", () => {
    const debilitate = abilityStyleForBar(DEBILITATE, "melee");
    const run = simulate({
      ...baseInput,
      abilities: [...baseInput.abilities, debilitate],
      startingAdrenaline: 100,
      modifiers: [shieldBashingPerkModifier(4, "debilitate")],
      rotation: rotationOf("debilitate"),
    });
    expect(run.ok, run.error).toBe(true);
    expect(run.perAbility.debilitate).toBeCloseTo(959.6004993757803, 10);
  });
});
