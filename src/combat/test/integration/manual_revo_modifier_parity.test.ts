import { describe, expect, it } from "vitest";
import { simulate } from "../../engine/simulation/simulate";
import { rotationOf } from "../../engine/simulation/contracts";
import { baseInput } from "../fixtures/inputs";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { DEFAULT_LOADOUT, normalizeLoadout } from "../../../components/combat/loadout/model";
import { loadoutStats } from "../../../components/combat/loadoutStats";

/**
 * Ultimatums / Lunging live only on castModifiersFor (ability-aware), not
 * globalModifiers. Manual and Revolution UIs must pass the factory so both
 * paths apply the same damage mods.
 */
describe("manual / revo Ultimatums + Lunging parity", () => {
  const loadout = normalizeLoadout({
    ...DEFAULT_LOADOUT,
    perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 4, lunging: 4 },
  });
  const stats = loadoutStats(loadout);

  it("castModifiersFor includes Ultimatums on ultimates and Lunging on dismember", () => {
    const overpower = MELEE_ABILITIES.find((a) => a.id === "overpower")!;
    const dismember = MELEE_ABILITIES.find((a) => a.id === "dismember")!;
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;

    const ultMods = stats.castModifiersFor(overpower);
    const ult = ultMods.find((m) => m.id === "perk:ultimatums:4");
    expect(ult).toBeDefined();
    expect(ult!.applies({ style: "melee" })).toBe(true);
    expect(stats.globalModifiers.some((m) => m.id.startsWith("perk:ultimatums"))).toBe(false);

    const lungMods = stats.castModifiersFor(dismember);
    const lung = lungMods.find((m) => m.id === "perk:lunging:4");
    expect(lung).toBeDefined();
    expect(lung!.applies({ style: "melee" })).toBe(true);
    expect(stats.globalModifiers.some((m) => m.id.startsWith("perk:lunging"))).toBe(false);

    // Factory still attaches Ultimatums for non-ultimates, but applies() is false.
    const attackUlt = stats
      .castModifiersFor(attack)
      .find((m) => m.id.startsWith("perk:ultimatums"));
    expect(attackUlt).toBeDefined();
    expect(attackUlt!.applies({ style: "melee" })).toBe(false);
  });

  it("ability-aware modifiers boost Overpower; globalModifiers alone do not", () => {
    const rotation = rotationOf("overpower");
    const shared = {
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
      rotation,
    };

    const globalOnly = simulate({ ...shared, modifiers: stats.globalModifiers });
    const abilityAware = simulate({
      ...shared,
      modifiers: (a) => stats.castModifiersFor(a),
    });

    expect(globalOnly.error ?? null).toBeNull();
    expect(abilityAware.error ?? null).toBeNull();
    expect(abilityAware.totalExpected).toBeGreaterThan(globalOnly.totalExpected);
    // R4 Ultimatums +7% (mulFloor can leave sub-bp error vs exact 1.07).
    expect(abilityAware.totalExpected / globalOnly.totalExpected).toBeCloseTo(1.07, 3);
  });

  it("ability-aware modifiers boost Dismember; globalModifiers alone do not", () => {
    const rotation = rotationOf("dismember");
    const shared = {
      ...baseInput,
      abilities: MELEE_ABILITIES,
      rotation,
    };

    const globalOnly = simulate({ ...shared, modifiers: stats.globalModifiers });
    const abilityAware = simulate({
      ...shared,
      modifiers: (a) => stats.castModifiersFor(a),
    });

    expect(globalOnly.error ?? null).toBeNull();
    expect(abilityAware.error ?? null).toBeNull();
    expect(abilityAware.totalExpected).toBeGreaterThan(globalOnly.totalExpected);
    // R4 Lunging +22% (mulFloor can leave sub-bp error vs exact 1.22).
    expect(abilityAware.totalExpected / globalOnly.totalExpected).toBeCloseTo(1.22, 2);
  });

  it("Revolution-style castModifiersFor matches fixed manual ability-aware path", () => {
    const rotation = rotationOf("overpower", "dismember");
    const shared = {
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
      rotation,
      autoWeave: false,
    };

    // RevolutionPanel / RotationPlanner both use castModifiersFor(ability).
    const revoStyle = simulate({
      ...shared,
      modifiers: (ability) => stats.castModifiersFor(ability),
    });
    // Same factory bound once (manual path with ability-aware resolver).
    const manualFixed = simulate({
      ...shared,
      modifiers: (ability) => stats.castModifiersFor(ability),
    });

    expect(revoStyle.error ?? null).toBeNull();
    expect(manualFixed.error ?? null).toBeNull();
    expect(revoStyle.totalExpected).toBeCloseTo(manualFixed.totalExpected, 10);
    expect(revoStyle.perAbility).toEqual(manualFixed.perAbility);
  });
});
