import { describe, expect, it } from "vitest";
import {
  emptyModifierSources,
  isSerializableSimBase,
  SOLVER_SCHEMA_VERSION,
  type SerializableRevolutionSimBase,
  type SerializableSolverRequest,
} from "./serializable";
import {
  buildRevolutionInput,
  requireSimBase,
  reviveLeague,
  reviveModifiers,
  reviveRevolutionBase,
  serializeLeague,
} from "./revive";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { EQUIPMENT_SET_ACTIVATION } from "../../shared/equipment";

const basicAbility: AbilitySpec = {
  id: "melee:slice",
  name: "Slice",
  style: "melee",
  category: "basic",
  hits: [{ band: { minPct: 20, maxPct: 100 } }],
  adrenaline: { gain: 8 },
};

function sampleSimBase(): SerializableRevolutionSimBase {
  return {
    base: 1200,
    level: 99,
    accuracy: 1,
    crit: { chance: 0.1, damageBonus: 0 },
    equipmentEffects: {
      activation: EQUIPMENT_SET_ACTIVATION,
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
    },
    league: {
      ruleset: "equilibrium",
      blessings: [],
      blessingIds: ["striking-light", "splash-zone"],
      totalArmour: 1000,
      maximumLife: 10000,
      powerburstUntilTick: 0,
      targetTiles: 1,
      areaTargets: 6,
      prayerBonus: 24,
    },
    context: { style: "melee", ruleset: "equilibrium", targetTiles: 1 },
    cap: { cap: 30000, bypass: false },
    startingAdrenaline: 100,
    equipmentIds: ["item:example"],
    weaponConfiguration: "dualwield",
    modifierSources: {
      ...emptyModifierSources(),
      vulnerability: true,
      styleCurseId: "turmoil",
      ultimatums: 2,
      lunging: 1,
      slayer: { demon: 1, dragon: 0, undead: 0 },
      target: { demon: true },
      setCounts: [["vestments-of-havoc", 4]],
    },
    adrenaline: { abilityGainMultiplier: 1, basicGainMultiplier: 1 },
    procs: { cracklingRank: 0, aftershockRank: 0 },
    plantedFeet: false,
    preciseRank: 0,
  };
}

function sampleRequest(): SerializableSolverRequest {
  return {
    schemaVersion: SOLVER_SCHEMA_VERSION,
    seed: 42,
    tier: "thorough",
    profileId: "balanced",
    maxBarSize: 9,
    minBarSize: 4,
    style: "melee",
    permittedCategories: ["basic", "enhanced", "ultimate"],
    unlockedRegions: ["misthalin", "asgarnia"],
    durationTicks: 100,
    exploreDurationTicks: 40,
    loadout: sampleSimBase(),
    blessingPicks: ["Order", "Chaos"],
    ruleset: "equilibrium",
    now: 1_700_000_000_000,
    authoredSeedBars: [{ id: "seed-a", abilityIds: ["melee:slice"], baseline: true }],
    userBar: ["melee:slice"],
  };
}

describe("solver worker serializable boundary", () => {
  it("structuredClone round-trips SerializableSolverRequest", () => {
    const request = sampleRequest();
    const cloned = structuredClone(request);
    expect(cloned).toEqual(request);
    expect(isSerializableSimBase(cloned.loadout)).toBe(true);
    expect(requireSimBase(cloned.loadout).base).toBe(1200);
  });

  it("revives league blessingIds into a Set", () => {
    const league = sampleSimBase().league;
    const revived = reviveLeague(league);
    expect(revived.blessingIds).toBeInstanceOf(Set);
    expect(revived.blessingIds.has("striking-light")).toBe(true);
    expect(revived.blessingIds.has("splash-zone")).toBe(true);
    expect(revived.blessingIds.size).toBe(2);
    expect(revived.powerburstUntilTick).toBe(0);
    expect(revived.areaTargets).toBe(6);
    expect(revived.prayerBonus).toBe(24);

    const again = serializeLeague(revived);
    expect(again.blessingIds).toEqual(["striking-light", "splash-zone"]);
    expect(Array.isArray(again.blessingIds)).toBe(true);
    expect(again).toMatchObject({ areaTargets: 6, prayerBonus: 24 });
  });

  it("revives modifiers as a function without shipping closures across clone", () => {
    const sim = structuredClone(sampleSimBase());
    const base = reviveRevolutionBase(sim);
    expect(typeof base.modifiers).toBe("function");
    expect(base.league?.blessingIds).toBeInstanceOf(Set);
    if (!base.league) throw new Error("expected revived league");

    const mods = reviveModifiers(sim.modifierSources, base.league);
    const forBasic = mods(basicAbility);
    expect(forBasic.some((m) => m.id === "vulnerability")).toBe(true);
    expect(forBasic.some((m) => m.id.startsWith("prayer:turmoil"))).toBe(true);
    expect(forBasic.some((m) => m.id === "perk:demon-slayer")).toBe(true);

    const ultimate: AbilitySpec = { ...basicAbility, category: "ultimate", id: "melee:berserk" };
    const forUlt = mods(ultimate);
    expect(forUlt.some((m) => m.id.startsWith("perk:ultimatums"))).toBe(true);
  });

  it("buildRevolutionInput attaches bar and abilities", () => {
    const input = buildRevolutionInput(sampleSimBase(), {
      bar: [basicAbility],
      style: "melee",
      durationTicks: 50,
      abilities: [basicAbility],
    });
    expect(input.bar).toHaveLength(1);
    expect(input.durationTicks).toBe(50);
    expect(input.base).toBe(1200);
    expect(input.league?.blessingIds.has("striking-light")).toBe(true);
  });

  it("overrideBase and overrideLevel survive pack → structuredClone → revive", () => {
    const sim: SerializableRevolutionSimBase = {
      ...sampleSimBase(),
      overrideBase: 2400,
      overrideLevel: 255,
    };
    const cloned = structuredClone(sim);
    expect(cloned.overrideBase).toBe(2400);
    expect(cloned.overrideLevel).toBe(255);

    const base = reviveRevolutionBase(cloned);
    expect(base.overrideBase).toBe(2400);
    expect(base.overrideLevel).toBe(255);

    const input = buildRevolutionInput(cloned, {
      bar: [basicAbility],
      style: "melee",
      durationTicks: 50,
      abilities: [basicAbility],
    });
    expect(input.overrideBase).toBe(2400);
    expect(input.overrideLevel).toBe(255);
  });

  it("activateNaragiAtStart survives structuredClone → revive", () => {
    const sim: SerializableRevolutionSimBase = {
      ...sampleSimBase(),
      activateNaragiAtStart: true,
      overrideBase: 2400,
      overrideLevel: 255,
    };
    const cloned = structuredClone(sim);
    expect(cloned.activateNaragiAtStart).toBe(true);
    const base = reviveRevolutionBase(cloned);
    expect(base.activateNaragiAtStart).toBe(true);
    const input = buildRevolutionInput(cloned, {
      bar: [basicAbility],
      style: "melee",
      durationTicks: 50,
      abilities: [basicAbility],
    });
    expect(input.activateNaragiAtStart).toBe(true);
  });

  it("rejects plain loadout snapshots in requireSimBase", () => {
    expect(() =>
      requireSimBase({
        kind: "loadout",
        style: "melee",
      }),
    ).toThrow(/precompute SerializableRevolutionSimBase/);
  });
});
