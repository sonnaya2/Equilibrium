import { describe, expect, it } from "vitest";
import { createCastContext, simulate } from "../engine/simulation/simulate";
import { rotationOf } from "../engine/simulation/contracts";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { baseInput, magicInput } from "../test/fixtures/inputs";
import { secondsToTicks } from "../core/ticks";
import { AFFINITY } from "../target/genericTarget";
import { blessingChoice } from "../../league/blessings";
import {
  aegisArmourBonus,
  effectiveCooldownTicks,
  effectiveTargetAffinity,
  envenomedPoisonDamageMultiplier,
  leagueModifiers,
  resolveLeagueRules,
  type ResolveLeagueRulesDerived,
} from "./ruleset";

const rules = (
  picks: readonly ("Order" | "Balance" | "Chaos")[],
  derived: ResolveLeagueRulesDerived = {},
) => resolveLeagueRules({ ruleset: "equilibrium", blessingPicks: picks }, derived);

describe("Teragard's Aegis and Basic Attacks", () => {
  it("scales the melee Basic Attack through ability damage", () => {
    const attack = MELEE_ABILITIES.find((ability) => ability.id === "attack")!;
    expect(attack.category).toBe("basic");
    expect(attack.hits[0]!.band).toEqual({ minPct: 110, maxPct: 130 });

    const plain = simulate({ ...baseInput, rotation: rotationOf("attack") });
    expect(plain.totalExpected).toBe(1_200);

    // Aegis is applied at loadout resolve (aegisArmourBonus → base), not inside simulate.
    const aegisBonus = aegisArmourBonus(
      blessingChoice(1, "Order")!.combat,
      { totalArmour: 1_000 },
      null,
    ).baseAbilityDamageBonus;
    expect(aegisBonus).toBe(250);

    const aegis = simulate({
      ...baseInput,
      base: baseInput.base + aegisBonus,
      rotation: rotationOf("attack"),
    });
    // Mid of 110-130% on 1,250 ability damage.
    expect(aegis.totalExpected).toBe(1_500);
  });
});

describe("Avernic Rampage window boundary", () => {
  const avernic = rules(["Chaos", "Chaos", "Chaos"]);
  const assault = MELEE_ABILITIES.find((ability) => ability.id === "assault")!;

  it("opens a 12-tick half-open window that the triggering cast does not benefit from", () => {
    const context = createCastContext({
      ...baseInput,
      league: avernic,
      startingAdrenaline: 100,
      context: { style: "melee", ruleset: "equilibrium" },
    });
    expect(context.performCast(assault, 0, false, { "avernic-rampage": true }).ok).toBe(true);
    // The proccing cast paid in full.
    expect(context.getState().adrenaline).toBe(100 - (assault.adrenaline?.cost ?? 0));
    expect(context.getState().league?.avernicRampageUntilTick).toBe(12);
  });

  it("is free at tick 11 and charges again at tick 12", () => {
    const at = (tick: number) => {
      const context = createCastContext({
        ...baseInput,
        league: avernic,
        startingAdrenaline: 100,
        context: { style: "melee", ruleset: "equilibrium" },
      });
      context.performCast(assault, 0, false, { "avernic-rampage": true });
      const before = context.getState().adrenaline;
      context.performCast(assault, tick, false, { "avernic-rampage": false });
      return before - context.getState().adrenaline;
    };
    expect(at(11)).toBe(0);
    expect(at(12)).toBe(assault.adrenaline?.cost ?? 0);
  });

  it("does not reroll or refresh while active", () => {
    const attack = MELEE_ABILITIES.find((ability) => ability.id === "attack")!;
    const context = createCastContext({
      ...baseInput,
      league: avernic,
      context: { style: "melee", ruleset: "equilibrium" },
    });
    context.performCast(attack, 0, false, { "avernic-rampage": true });
    context.performCast(attack, 3, false, { "avernic-rampage": true });
    expect(context.getState().league?.avernicRampageUntilTick).toBe(12);
  });
});

describe("Sacred Fervor cooldown reduction", () => {
  const fervor = rules(["Order", "Order", "Order"]);

  it("floors the reduced cooldown in ticks and keeps positive CDs at least 1", () => {
    expect(effectiveCooldownTicks(10, fervor)).toBe(7);
    // 17 x 0.7 = 11.9 -> 11, not 12: the rounding is a floor, in ticks.
    expect(effectiveCooldownTicks(17, fervor)).toBe(11);
    // Positive base cooldowns cannot become zero after Sacred Fervor.
    expect(effectiveCooldownTicks(1, fervor)).toBe(1);
    expect(effectiveCooldownTicks(0, fervor)).toBe(0);
  });

  it("leaves cooldowns untouched without the blessing", () => {
    expect(effectiveCooldownTicks(17, rules(["Chaos"]))).toBe(17);
    expect(effectiveCooldownTicks(17, undefined)).toBe(17);
  });

  it("applies to the clock a shared or replacement group starts", () => {
    const dragonBreath = MAGIC_ABILITIES.find((ability) => ability.id === "dragon_breath")!;
    const full = secondsToTicks(dragonBreath.cooldownSeconds!);
    const context = createCastContext({
      ...magicInput,
      league: fervor,
      context: { style: "magic", ruleset: "equilibrium" },
    });
    expect(context.performCast(dragonBreath, 0, false).ok).toBe(true);
    expect(context.firstLegalTick(dragonBreath.id)).toBe(Math.floor(full * 0.7));
  });
});

describe("Splash Zone", () => {
  const splashModifier = (targetSize: number, occupiedTiles = 1) =>
    leagueModifiers(rules(["Chaos", "Balance", "Balance"], { targetSize, occupiedTiles })).find(
      (modifier) => modifier.id === "blessing:splash-zone",
    )!;

  it("adds 30% to multi-target attacks with no per-tile term", () => {
    const modifier = splashModifier(5);
    const context = { style: "ranged", ruleset: "equilibrium", area: "multi-target" } as const;
    expect(modifier.applies(context)).toBe(true);
    expect(modifier.apply({ damage: 1_000 }, context).damage).toBe(1_300);
  });

  it("adds 30% plus 5% per target size dimension to AoE, additively", () => {
    const context = { style: "magic", ruleset: "equilibrium", area: "aoe" } as const;
    // 1 + 0.30 + 5 x 0.05 = 1.55
    expect(splashModifier(5).apply({ damage: 1_000 }, context).damage).toBe(1_550);
    // A size-1 target grants one step: 1 + 0.30 + 0.05 = 1.35
    expect(splashModifier(1).apply({ damage: 1_000 }, context).damage).toBe(1_350);
  });

  it("does not use occupied footprint tiles as target size", () => {
    const context = { style: "magic", ruleset: "equilibrium", area: "aoe" } as const;
    expect(splashModifier(2, 25).apply({ damage: 1_000 }, context).damage).toBe(1_400);
    expect(splashModifier(5, 1).apply({ damage: 1_000 }, context).damage).toBe(1_550);
  });

  it("ignores untagged attacks and blessing-generated damage", () => {
    const modifier = splashModifier(5);
    expect(modifier.applies({ style: "magic", ruleset: "equilibrium" })).toBe(false);
    expect(
      modifier.applies({
        style: "magic",
        ruleset: "equilibrium",
        area: "aoe",
        provenance: { kind: "blessing" },
      }),
    ).toBe(false);
  });
});

describe("Striking Light ability mult", () => {
  // Tier-2 Order path pick.
  const strikingModifier = () =>
    leagueModifiers(rules(["Chaos", "Order"])).find(
      (modifier) => modifier.id === "blessing:striking-light",
    )!;

  it("applies to Basic Attacks only and ignores blessing provenance damage", () => {
    const modifier = strikingModifier();
    expect(
      modifier.applies({
        style: "magic",
        ruleset: "equilibrium",
        abilityCategory: "basic",
        basicAttack: true,
      }),
    ).toBe(true);
    expect(
      modifier.applies({
        style: "magic",
        ruleset: "equilibrium",
        abilityCategory: "basic",
      }),
    ).toBe(false);
    expect(
      modifier.applies({
        style: "magic",
        ruleset: "equilibrium",
        abilityCategory: "basic",
        basicAttack: true,
        provenance: { kind: "blessing" },
      }),
    ).toBe(false);
  });
});

describe("Demon's Mark affinity resolution", () => {
  // Two Chaos picks in the segment grant the Chaos god tier.
  const mark = rules(["Chaos", "Chaos", "Balance"]);

  it("uses the target's weakness when one is declared", () => {
    expect(effectiveTargetAffinity("same", true, mark)).toBe("weakness");
  });

  it("leaves a target with no declared weakness alone", () => {
    expect(effectiveTargetAffinity("same", false, mark)).toBe("same");
  });

  it("never makes the affinity worse, and higher is more favourable here", () => {
    // AFFINITY: strong 50 < same 60 < weak 70 < weakness 90. The blessing only
    // ever raises the value, so no target picks up a worse affinity from it, and
    // a target already at the weakness affinity is left exactly as it was.
    for (const affinity of ["strong", "same", "weak"] as const) {
      expect(AFFINITY[effectiveTargetAffinity(affinity, true, mark)]).toBeGreaterThanOrEqual(
        AFFINITY[affinity],
      );
    }
    expect(effectiveTargetAffinity("weakness", true, mark)).toBe("weakness");
  });

  it("does nothing without the blessing", () => {
    expect(effectiveTargetAffinity("same", true, rules(["Order"]))).toBe("same");
    expect(effectiveTargetAffinity("same", true, undefined)).toBe("same");
  });
});

describe("Envenomed", () => {
  const picks = ["Chaos", "Order", "Chaos", "Order", "Order", "Balance"] as const;

  it("uses the selected Herblore level for every poison hit", () => {
    expect(envenomedPoisonDamageMultiplier(rules(picks, { herbloreLevel: 1 }))).toBe(1.52);
    expect(envenomedPoisonDamageMultiplier(rules(picks, { herbloreLevel: 99 }))).toBe(3.48);
    expect(envenomedPoisonDamageMultiplier(rules(picks, { herbloreLevel: 120 }))).toBe(3.9);

    const modifier = leagueModifiers(rules(picks, { herbloreLevel: 99 })).find(
      (entry) => entry.id === "blessing:envenomed",
    )!;
    const poison = { style: "necromancy", ruleset: "equilibrium", dotKind: "poison" } as const;
    expect(modifier.applies(poison)).toBe(true);
    expect(modifier.apply({ damage: 1_000 }, poison).damage).toBe(3_480);
    expect(modifier.applies({ style: "necromancy", ruleset: "equilibrium" })).toBe(false);
  });
});

describe("Big Boned maximum-life basis", () => {
  it("takes 5% of the maximum life the loadout resolves, not a fixed figure", () => {
    const summary = (maximumLife: number) => {
      const result = simulate({
        ...baseInput,
        league: rules(["Balance"], { maximumLife }),
        context: { style: "melee", ruleset: "equilibrium" },
        rotation: rotationOf("attack"),
      });
      return result.events[0]?.components?.find((component) => component.id === "big-boned")?.damage
        .expected;
    };
    expect(summary(15_000)).toBe(750);
    expect(summary(20_000)).toBe(1_000);
  });

  it("default rules attach Big Boned without emitting another event", () => {
    const summary = simulate({
      ...baseInput,
      league: rules(["Balance"], { maximumLife: 15_000 }),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    expect(summary.events.filter((event) => event.abilityId === "big-boned")).toHaveLength(0);
    expect(summary.events[0]?.components?.map((component) => component.id)).toEqual(["big-boned"]);
    // Base 1200 + BB 750.
    expect(summary.totalExpected).toBe(1_950);
  });
});
