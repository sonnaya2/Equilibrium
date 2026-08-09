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
import { modifiersFromSources, reviveLeague as hostReviveLeague } from "../../model";
import { activeEquipmentEffects, EQUIPMENT_SET_ACTIVATION } from "../../shared/equipment";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { simulateRevolution } from "../../engine/simulation/revolution";

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
      ruleset: "equilibrium",
      blessings: [],
      blessingIds: ["striking-light", "splash-zone"],
      totalArmour: 1000,
      maximumLife: 10000,
      powerburstUntilTick: 0,
      targetSize: 1,
      occupiedTiles: 1,
      areaTargets: 6,
      prayerBonus: 24,
    },
    context: { style: "melee", ruleset: "equilibrium", targetSize: 1, occupiedTiles: 1 },
    cap: { cap: 30000, bypass: false },
    startingAdrenaline: 100,
    naturalInstinctUntilTick: 20,
    startingResidualSouls: 3,
    slayerOnTask: true,
    slayerLevel: 120,
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

  it("carries the resolved target accuracy profile through worker revival", () => {
    const sim = {
      ...sampleSimBase(),
      targetAccuracyProfile: {
        playerAccuracyRating: 1200,
        originalTargetArmourRating: 900,
        affinity: "weakness" as const,
        additiveHitChance: 0.02,
        damagePotentialOverride: 0.42,
      },
    } satisfies SerializableRevolutionSimBase;
    const cloned = structuredClone(sim);
    expect(reviveRevolutionBase(cloned).targetAccuracyProfile).toEqual(sim.targetAccuracyProfile);
  });

  it("carries enchanted-bolt chance modifiers through worker revival", () => {
    const sim = {
      ...sampleSimBase(),
      enchantedBoltChanceModifiers: { rangedCape: true, eliteSeersVillage: true },
    } satisfies SerializableRevolutionSimBase;

    expect(reviveRevolutionBase(structuredClone(sim)).enchantedBoltChanceModifiers).toEqual(
      sim.enchantedBoltChanceModifiers,
    );
  });

  it("preserves exact player vitality through worker revival", () => {
    const sim = {
      ...sampleSimBase(),
      playerVitality: { maximumLifePoints: 9_900, currentLifePoints: 7_321 },
    } satisfies SerializableRevolutionSimBase;
    const revived = reviveRevolutionBase(structuredClone(sim));
    expect(revived.playerVitality).toEqual(sim.playerVitality);
  });

  it("preserves Critual conversion metadata through worker revival", () => {
    const sim = {
      ...sampleSimBase(),
      crit: {
        chance: 0.5,
        damageBonus: 0.05,
        critualConvertedDamageBonus: 0.05,
      },
    } satisfies SerializableRevolutionSimBase;
    const revived = reviveRevolutionBase(structuredClone(sim));

    expect(revived.crit.critualConvertedDamageBonus).toBeCloseTo(0.05, 12);
  });

  it("revives target classification from modifier-source target facts", () => {
    const sim = sampleSimBase();
    sim.modifierSources.target = {
      demon: true,
      dragon: false,
      undead: true,
      elementalWeakness: "fire",
      dragonfireImmune: true,
    };
    const revived = reviveRevolutionBase(structuredClone(sim));

    expect(revived.targetClassification).toEqual({
      demon: true,
      dragon: false,
      undead: true,
      elementalWeakness: "fire",
      dragonfireImmune: true,
    });
  });

  it("preserves Dracolich effects through clone and worker revival", () => {
    const effects = {
      ...activeEquipmentEffects({
        style: "ranged",
        equipmentSlots: {
          twohand: "item:noxious-longbow",
          body: "item:dracolich-body",
        },
        pieceContribution: { additionalPiecesPerItem: 2 },
      }),
      setCritChance: { unconditional: 0.03, conditional: { sunshine: 0.045 } },
    };
    const sim = {
      ...sampleSimBase(),
      equipmentIds: ["item:noxious-longbow", "item:dracolich-body"],
      equipmentEffects: effects,
    } satisfies SerializableRevolutionSimBase;
    const cloned = structuredClone(sim);
    const revived = reviveRevolutionBase(cloned);

    expect(cloned.equipmentEffects).toEqual(effects);
    expect(revived.equipmentEffects).toEqual(effects);
    expect(revived.equipmentEffects?.dracolich).toMatchObject({
      setId: "dracolich",
      physicalPieces: 1,
      effectivePieces: 3,
      bowEligible: true,
      infusionDurationTicks: 5,
    });
    expect(revived.equipmentEffects?.setCritChance).toEqual({
      unconditional: 0.03,
      conditional: { sunshine: 0.045 },
    });
  });

  it("preserves Deathdealer target state inputs through clone and worker revival", () => {
    const effects = activeEquipmentEffects({
      style: "necromancy",
      equipmentSlots: {
        helmet: "item:deathdealer-hood-t90",
        body: "item:deathdealer-robe-top-t90",
        legs: "item:deathdealer-robe-bottom-t90",
        gloves: "item:deathdealer-gloves-t90",
        boots: "item:deathdealer-boots-t90",
      },
    });
    const sim = {
      ...sampleSimBase(),
      equipmentIds: Object.values({
        helmet: "item:deathdealer-hood-t90",
        body: "item:deathdealer-robe-top-t90",
        legs: "item:deathdealer-robe-bottom-t90",
        gloves: "item:deathdealer-gloves-t90",
        boots: "item:deathdealer-boots-t90",
      }),
      equipmentEffects: effects,
      targetMaximumLifePoints: 250_000,
    } satisfies SerializableRevolutionSimBase;
    const revived = reviveRevolutionBase(structuredClone(sim));
    expect(revived.equipmentEffects?.deathdealer).toEqual(effects.deathdealer);
    expect(revived.targetMaximumLifePoints).toBe(250_000);
  });

  it("keeps Death Mark host and worker Revolution results identical", () => {
    const effects = activeEquipmentEffects({
      style: "necromancy",
      equipmentSlots: {
        helmet: "item:deathdealer-hood-t90",
        body: "item:deathdealer-robe-top-t90",
        legs: "item:deathdealer-robe-bottom-t90",
        gloves: "item:deathdealer-gloves-t90",
        boots: "item:deathdealer-boots-t90",
      },
    });
    const sim = {
      ...sampleSimBase(),
      context: { style: "necromancy", ruleset: "equilibrium", targetSize: 1, occupiedTiles: 1 },
      equipmentIds: [
        "item:deathdealer-hood-t90",
        "item:deathdealer-robe-top-t90",
        "item:deathdealer-robe-bottom-t90",
        "item:deathdealer-gloves-t90",
        "item:deathdealer-boots-t90",
      ],
      equipmentEffects: {
        ...effects,
        deathdealer: { ...effects.deathdealer!, applicationChance: 1 },
      },
      targetMaximumLifePoints: 100_000,
      targetHpPercent: 19,
      startingAdrenaline: 0,
    } satisfies SerializableRevolutionSimBase;
    const basic = NECROMANCY_ABILITIES.find((ability) => ability.id === "necromancy_basic")!;
    const parts = {
      bar: [basic],
      style: "necromancy" as const,
      durationTicks: 10,
      abilities: [basic],
    };
    const league = hostReviveLeague(sim.league);
    const host = simulateRevolution(
      {
        base: sim.base,
        level: sim.level,
        accuracy: sim.accuracy,
        crit: sim.crit,
        modifiers: modifiersFromSources(sim.modifierSources, league),
        context: sim.context,
        cap: sim.cap,
        startingAdrenaline: sim.startingAdrenaline,
        equipmentIds: sim.equipmentIds,
        weaponConfiguration: sim.weaponConfiguration,
        equipmentEffects: sim.equipmentEffects,
        targetMaximumLifePoints: sim.targetMaximumLifePoints,
        targetHpPercent: sim.targetHpPercent,
        league,
        adrenaline: sim.adrenaline,
        procs: sim.procs,
        bar: parts.bar,
        style: parts.style,
        durationTicks: parts.durationTicks,
        abilities: parts.abilities,
      },
      { stochasticLanes: 1 },
    );
    const worker = simulateRevolution(buildRevolutionInput(structuredClone(sim), parts), {
      stochasticLanes: 1,
    });
    expect(worker.totalExpected).toBe(host.totalExpected);
    expect(worker.perAbility.death_mark).toBe(host.perAbility.death_mark);
    expect(worker.targetStatus).toEqual(host.targetStatus);
  });

  it("keeps main and revived Revolution Rapid Fire results identical", () => {
    const effects = activeEquipmentEffects({
      style: "ranged",
      equipmentSlots: {
        twohand: "item:noxious-longbow",
        body: "item:dracolich-body",
      },
      pieceContribution: { additionalPiecesPerItem: 2 },
    });
    const rapidFire = RANGED_ABILITIES.find((ability) => ability.id === "rapid_fire")!;
    const rangedAttack = RANGED_ABILITIES.find((ability) => ability.id === "ranged_attack")!;
    const sim = {
      ...sampleSimBase(),
      context: { style: "ranged", ruleset: "equilibrium", targetSize: 1, occupiedTiles: 1 },
      equipmentIds: ["item:noxious-longbow", "item:dracolich-body"],
      equipmentEffects: effects,
      weaponConfiguration: "twohand" as const,
    } satisfies SerializableRevolutionSimBase;
    const cloned = structuredClone(sim);
    const parts = {
      bar: [rapidFire, rangedAttack],
      style: "ranged" as const,
      durationTicks: 20,
      abilities: [rapidFire, rangedAttack],
    };
    const hostLeague = hostReviveLeague(sim.league);
    const host = simulateRevolution({
      base: sim.base,
      level: sim.level,
      accuracy: sim.accuracy,
      crit: sim.crit,
      modifiers: modifiersFromSources(sim.modifierSources, hostLeague),
      context: sim.context,
      cap: sim.cap,
      startingAdrenaline: sim.startingAdrenaline,
      equipmentIds: sim.equipmentIds,
      weaponConfiguration: sim.weaponConfiguration,
      equipmentEffects: sim.equipmentEffects,
      league: hostLeague,
      adrenaline: sim.adrenaline,
      procs: sim.procs,
      plantedFeet: sim.plantedFeet,
      preciseRank: sim.preciseRank,
      bar: parts.bar,
      style: parts.style,
      durationTicks: parts.durationTicks,
      abilities: parts.abilities,
    });
    const worker = simulateRevolution(buildRevolutionInput(cloned, parts));

    expect(worker.casts).toEqual(host.casts);
    expect(worker.casts[1]?.result.hits[0]?.critChance).toBeCloseTo(0.3, 10);
    const eventResults = (events: typeof host.events) =>
      events.map((event) => ({
        tick: event.tick,
        seq: event.seq,
        family: event.family,
        abilityId: event.abilityId,
        sourceCast: event.sourceCast,
        hitIndex: event.hitIndex,
        damage: event.damage,
        components: event.components,
      }));
    expect(eventResults(worker.events)).toEqual(eventResults(host.events));
    expect(worker.totalExpected).toBe(host.totalExpected);
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

  it("preserves state-changing simulation inputs across the worker boundary", () => {
    const cloned = structuredClone(sampleSimBase());
    const base = reviveRevolutionBase(cloned);
    expect(base).toMatchObject({
      naturalInstinctUntilTick: 20,
      startingResidualSouls: 3,
      slayerOnTask: true,
      slayerLevel: 120,
    });

    const input = buildRevolutionInput(cloned, {
      bar: [basicAbility],
      style: "melee",
      durationTicks: 50,
      abilities: [basicAbility],
    });
    expect(input).toMatchObject({
      naturalInstinctUntilTick: 20,
      startingResidualSouls: 3,
      slayerOnTask: true,
      slayerLevel: 120,
    });
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
