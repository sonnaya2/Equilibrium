import { describe, expect, it } from "vitest";
import { EQUIPMENT_SET_ACTIVATION } from "../shared/equipment";
import {
  buildResolvedCombatModel,
  buildSimulationInputBase,
  isResolvedCombatModel,
  projectSerializableSimBase,
  type HostCombatResolveInput,
  type ResolvedCombatModel,
} from "./index";

function baseInput(patch: Partial<HostCombatResolveInput> = {}): HostCombatResolveInput {
  return {
    style: "melee",
    base: 2000,
    level: 99,
    accuracy: 0.95,
    crit: { chance: 0.12, disabled: false, damageBonus: 0.05 },
    adrenaline: { ringOfVigour: true, basicGainMultiplier: 1.1 },
    procs: { cracklingRank: 2 },
    plantedFeet: true,
    strengthCape99: true,
    preciseRank: 4,
    enchantedBoltChanceModifiers: { rangedCape: true, eliteSeersVillage: true },
    conjureBasicDamageMult: 1,
    conjureDurationMult: 1,
    tumekensPieces: 0,
    equipmentEffects: {
      activation: EQUIPMENT_SET_ACTIVATION,
      setCritChance: { unconditional: 0, conditional: {} },
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
      ruleset: "base",
      blessings: [],
      blessingIds: [],
      relics: ["Berserker's Fury"],
      totalArmour: 100,
      maximumLife: 10000,
      powerburstUntilTick: 12,
      targetSize: 1,
      occupiedTiles: 1,
    },
    context: { style: "melee", ruleset: "base", targetSize: 1, occupiedTiles: 1 },
    targetHpPercent: 55,
    cap: { cap: 30_000, bypass: false },
    startingAdrenaline: 100,
    equipmentIds: ["item:a", "item:b"],
    weaponConfiguration: "twohand",
    setCounts: [
      ["t95-melee", 5],
      ["vestments-of-havoc", 2],
    ],
    vulnerability: true,
    styleCurseId: "turmoil",
    slayer: { demon: 1, dragon: 0, undead: 0 },
    target: { demon: true, elementalWeakness: "water", dragonfireImmune: true },
    slayerHelmet: { tierId: "full", source: "equipped", damageMult: 1.125 },
    salve: null,
    ultimatums: 2,
    lunging: 3,
    berserkersFuryBonus: 0.05,
    diagnostics: {
      slayerHelmet: { tierId: "full", source: "equipped", damageMult: 1.125 },
      salve: null,
      berserkersFury: {
        active: true,
        bonus: 0.05,
        currentLifePoints: 5000,
        maximumLifePoints: 10000,
        currentHealthPercent: 50,
      },
      powerburstRemainingTicks: 12,
      ringOfVigourActive: true,
      ringOfVigourSources: ["Ring of Vigour · Active via: Equipped ring"],
      archaeologySelectedIds: ["berserkers_fury"],
      maxAdrenaline: 100,
    },
    ...patch,
  };
}

function keyFields(model: ResolvedCombatModel) {
  return {
    style: model.style,
    base: model.base,
    level: model.level,
    accuracy: model.accuracy,
    weaponConfiguration: model.weaponConfiguration,
    modifierSources: model.modifierSources,
    cap: model.cap,
    target: model.target,
    powerburst: model.league.powerburstUntilTick,
    plantedFeet: model.plantedFeet,
    strengthCape99: model.strengthCape99,
    preciseRank: model.preciseRank,
    enchantedBoltChanceModifiers: model.enchantedBoltChanceModifiers,
  };
}

describe("ResolvedCombatModel equality", () => {
  it("isDetected by type guard", () => {
    const model = buildResolvedCombatModel(baseInput());
    expect(isResolvedCombatModel(model)).toBe(true);
    expect(isResolvedCombatModel({ base: 1 })).toBe(false);
  });

  it.each([
    ["melee", "twohand"] as const,
    ["ranged", "dualwield"] as const,
    ["magic", "mainhand"] as const,
    ["necromancy", "necromancy"] as const,
  ])("freezes style=%s weaponConfiguration=%s", (style, weaponConfiguration) => {
    const model = buildResolvedCombatModel(
      baseInput({
        style,
        weaponConfiguration,
        context: { style, ruleset: "base", targetSize: 1, occupiedTiles: 1 },
      }),
    );
    expect(model.style).toBe(style);
    expect(model.weaponConfiguration).toBe(weaponConfiguration);
    expect(keyFields(model).style).toBe(style);
  });

  it("preserves slayer helmet and salve descriptors", () => {
    const model = buildResolvedCombatModel(
      baseInput({
        salve: { variantId: "salve-e", damageMult: 1.2 },
        target: { undead: true },
        diagnostics: {
          ...baseInput().diagnostics,
          salve: { variantId: "salve-e", damageMult: 1.2 },
        },
      }),
    );
    expect(model.modifierSources.slayerHelmet).toEqual({
      tierId: "full",
      source: "equipped",
      damageMult: 1.125,
    });
    expect(model.modifierSources.salve).toEqual({ variantId: "salve-e", damageMult: 1.2 });
    expect(model.diagnostics.salve?.variantId).toBe("salve-e");
  });

  it("preserves berserker fury, powerburst ticks, hit-cap bypass, race flags", () => {
    const model = buildResolvedCombatModel(
      baseInput({
        cap: { cap: 30_000, bypass: true },
        target: {
          demon: true,
          dragon: true,
          undead: false,
          elementalWeakness: "water",
          dragonfireImmune: true,
        },
        targetHpPercent: 33,
        league: {
          ...baseInput().league,
          powerburstUntilTick: 7,
        },
        diagnostics: {
          ...baseInput().diagnostics,
          powerburstRemainingTicks: 7,
        },
      }),
    );
    expect(model.cap.bypass).toBe(true);
    expect(model.league.powerburstUntilTick).toBe(7);
    expect(model.diagnostics.powerburstRemainingTicks).toBe(7);
    expect(model.diagnostics.berserkersFury.bonus).toBe(0.05);
    expect(model.target).toMatchObject({ demon: true, dragon: true, hpPercent: 33 });
    expect(model.modifierSources.target).toMatchObject({ demon: true, dragon: true });
    const byId = new Map();
    const basicByStyle = new Map();
    const simulation = buildSimulationInputBase(model, {
      catalogue: [],
      byId,
      basicByStyle,
      strengthCape99: false,
      abilityRegistry: { byId, basicByStyle },
    });
    expect(simulation.targetClassification).toEqual({
      demon: true,
      dragon: true,
      undead: false,
      elementalWeakness: "water",
      dragonfireImmune: true,
    });
  });

  it("projects to serializable sim base without Maps", () => {
    const model = buildResolvedCombatModel(baseInput());
    const sim = projectSerializableSimBase(model);
    expect(sim.base).toBe(model.base);
    expect(sim.accuracy).toBe(model.accuracy);
    expect(sim.modifierSources.setCounts).toEqual([
      ["t95-melee", 5],
      ["vestments-of-havoc", 2],
    ]);
    expect(sim.modifierSources.setCounts instanceof Map).toBe(false);
    expect(Array.isArray(sim.league.blessingIds)).toBe(true);
    expect(sim.targetHpPercent).toBe(55);
    expect(sim.league.powerburstUntilTick).toBe(12);
    expect(sim.enchantedBoltChanceModifiers).toEqual({
      rangedCape: true,
      eliteSeersVillage: true,
    });
  });

  it("carries exact player vitality through model and simulation projections", () => {
    const model = buildResolvedCombatModel(
      baseInput({ playerVitality: { maximumLifePoints: 9_900, currentLifePoints: 7_321 } }),
    );
    const simulation = buildSimulationInputBase(model, {
      catalogue: [],
      byId: new Map(),
      basicByStyle: new Map(),
      strengthCape99: false,
      abilityRegistry: { byId: new Map(), basicByStyle: new Map() },
    });
    expect(model.playerVitality).toEqual({ maximumLifePoints: 9_900, currentLifePoints: 7_321 });
    expect(simulation.playerVitality).toEqual(model.playerVitality);
    expect(projectSerializableSimBase(model).playerVitality).toEqual(model.playerVitality);
  });

  it("preserves the resolved target accuracy profile across model and simulation projections", () => {
    const targetAccuracyProfile = {
      playerAccuracyRating: 1200,
      originalTargetArmourRating: 900,
      affinity: 60,
      additiveHitChance: 0.02,
      damagePotentialOverride: 0.42,
    };
    const model = buildResolvedCombatModel(baseInput({ targetAccuracyProfile }));
    expect(model.targetAccuracyProfile).toEqual(targetAccuracyProfile);
    expect(Object.isFrozen(model.targetAccuracyProfile)).toBe(true);
    expect(projectSerializableSimBase(model).targetAccuracyProfile).toEqual(targetAccuracyProfile);
  });

  it("shield / defender / necromancy configurations stay distinct", () => {
    for (const weaponConfiguration of ["shield", "defender", "necromancy"] as const) {
      const model = buildResolvedCombatModel(baseInput({ weaponConfiguration }));
      expect(model.weaponConfiguration).toBe(weaponConfiguration);
    }
  });
});
