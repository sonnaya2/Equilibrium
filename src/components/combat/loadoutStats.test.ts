import { describe, expect, it, vi } from "vitest";
import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { runPipeline } from "@/combat/pipeline/modifierPipeline";
import { sumNonWeaponAccuracy } from "@/combat/shared/equipment";
import { equilibriumDamageBonus } from "@/combat/shared/perks";
import { overloadBoostedLevel } from "@/combat/shared/potions";
import { prayerBoostedStyleLevel, styleCurseById } from "@/combat/shared/prayers";
import { hitChance, playerAccuracy, targetDamagePotential } from "@/combat/target/genericTarget";
import {
  computedLoadoutBase,
  equippedBonuses,
  equippedSetCounts,
  equippedWeaponTier,
  loadoutAttackLevel,
  loadoutBase,
  loadoutDamageLevel,
  loadoutEffectiveDamageLevel,
  loadoutStats,
  loadoutWeaponConfig,
  loadoutWeaponTier,
  nonWeaponAccuracyBonus,
  setEffectsSummary,
} from "./loadoutStats";
import { DEFAULT_LOADOUT, type Loadout } from "./useLoadout";

vi.mock("@/combat/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/combat/data")>();
  return {
    ...actual,
    equipmentById: (id: string) => {
      if (id === "mock:acc-ring") {
        return {
          id,
          name: "Mock accuracy ring",
          slot: "ring" as const,
          bonuses: { accuracy: 100 },
          sources: [],
        };
      }
      if (id === "mock:acc-amulet") {
        return {
          id,
          name: "Mock accuracy amulet",
          slot: "amulet" as const,
          bonuses: { accuracy: 50 },
          sources: [],
        };
      }
      if (id === "mock:weapon-main") {
        return {
          id,
          name: "Mock mainhand",
          slot: "mainhand" as const,
          tier: 90,
          bonuses: { accuracy: 9999 },
          sources: [],
        };
      }
      return actual.equipmentById(id);
    },
  };
});

const base: Loadout = { ...DEFAULT_LOADOUT };

describe("loadoutStats", () => {
  it("defaults to automatic base; no weapon equipped uses the selected configuration", () => {
    const fallback: Loadout = { ...base, level: 99, weaponTier: 90, style: "melee" };
    expect(loadoutWeaponConfig(fallback)).toEqual({
      kind: "twohand",
      weapon: { tier: 90 },
      style: "melee",
      styleBonus: 0,
    });
    expect(loadoutBase(fallback)).toBe(
      baseAbilityDamage(99, { kind: "twohand", weapon: { tier: 90 }, style: "melee" }),
    );
  });

  it("melee Attack feeds accuracy; Strength feeds base AD / crit damage level", () => {
    const melee: Loadout = {
      ...base,
      style: "melee",
      attackLevel: 80,
      strengthLevel: 110,
      level: 110,
      weaponTier: 90,
      target: { defenceLevel: 80, affinity: "same" },
    };
    expect(loadoutAttackLevel(melee)).toBe(80);
    expect(loadoutDamageLevel(melee)).toBe(110);
    expect(loadoutBase(melee)).toBe(computedLoadoutBase(melee));
    // No weapon equipped: twohand slider fallback.
    expect(loadoutBase(melee)).toBe(
      baseAbilityDamage(110, { kind: "twohand", weapon: { tier: 90 }, style: "melee" }),
    );
    const stats = loadoutStats(melee);
    expect(stats.level).toBe(110);
    expect(stats.attackLevel).toBe(80);
    expect(stats.dp).toBeCloseTo(
      targetDamagePotential(playerAccuracy(80, 90), { defenceLevel: 80, affinity: "same" }),
      10,
    );
  });

  it("non-melee styles use a single style level for both accuracy and damage", () => {
    const magic: Loadout = {
      ...base,
      style: "magic",
      level: 105,
      attackLevel: 1,
      strengthLevel: 1,
      weaponTier: 90,
      target: { defenceLevel: 80, affinity: "same" },
    };
    expect(loadoutAttackLevel(magic)).toBe(105);
    expect(loadoutDamageLevel(magic)).toBe(105);
    const stats = loadoutStats(magic);
    expect(stats.level).toBe(105);
    expect(stats.attackLevel).toBe(105);
    expect(stats.dp).toBeCloseTo(
      targetDamagePotential(playerAccuracy(105, 90), { defenceLevel: 80, affinity: "same" }),
      10,
    );
  });

  it("passes accuracy% through as Damage Potential when no target is set", () => {
    const stats = loadoutStats({ ...base, accuracy: 70 });
    expect(stats.dp).toBeCloseTo(0.7, 10);
    expect(stats.damagePotentialSource).toBe("manual override");
    expect(loadoutStats(base).damagePotentialSource).toBe("100% assumption");
  });

  it("derives Damage Potential from the target model when set", () => {
    const stats = loadoutStats({ ...base, target: { defenceLevel: 80, affinity: "same" } });
    const expected = hitChance(playerAccuracy(99, 90), { defenceLevel: 80, affinity: "same" });
    expect(stats.dp).toBeCloseTo(expected, 10);
    expect(stats.damagePotentialSource).toBe("target stats");
  });

  it("surfaces manual target DP override provenance", () => {
    const stats = loadoutStats({
      ...base,
      target: {
        defenceLevel: 80,
        affinity: "same",
        damagePotentialOverride: 0.42,
      },
    });
    expect(stats.dp).toBe(0.42);
    expect(stats.damagePotentialSource).toBe("manual override");
  });

  it("keeps automatic base reactive while manual base is an explicit raw-AD override", () => {
    const automatic = loadoutStats({ ...base, level: 110, strengthLevel: 110 });
    expect(automatic.rawBase).toBe(
      computedLoadoutBase({ ...base, level: 110, strengthLevel: 110 }),
    );

    const manual = loadoutStats({
      ...base,
      level: 110,
      strengthLevel: 110,
      baseDamage: { mode: "manual", manualValue: 2345 },
      startingAdrenaline: 72,
      hitCapEnabled: false,
    });
    expect(manual.rawBase).toBe(2345);
    expect(manual.base).toBe(2345);
    expect(manual.startingAdrenaline).toBe(72);
    expect(manual.cap).toEqual({ cap: 30_000, bypass: true });
  });

  it("adds Energising's flat accuracy inside the target model only", () => {
    const withPerk = loadoutStats({
      ...base,
      perks: { ...base.perks, energising: 4 },
      target: { defenceLevel: 80, affinity: "same" },
    });
    const expected = hitChance(playerAccuracy(99, 90) + 150, {
      defenceLevel: 80,
      affinity: "same",
    });
    expect(withPerk.dp).toBeCloseTo(expected, 10);
    expect(loadoutStats({ ...base, perks: { ...base.perks, energising: 4 } }).dp).toBe(1);
  });

  it("stacks set crit-chance bonuses onto the crit layer and clamps at 100%", () => {
    const stats = loadoutStats({
      ...base,
      critChance: 97,
      perks: { ...base.perks, tectonicPieces: 3, tumekensPieces: 3, insideSunshine: true },
    });
    expect(stats.critChance).toBe(1);
    const plain = loadoutStats(base);
    expect(plain.critChance).toBeCloseTo(0.1, 10);
  });

  it("3 tectonic pieces from equipped gear → +3% crit (perk 0)", () => {
    const stats = loadoutStats({
      ...base,
      critChance: 10,
      equipmentSlots: {
        helmet: "item:tectonic-helm",
        body: "item:tectonic-body",
        legs: "item:tectonic-legs",
      },
    });
    expect(
      equippedSetCounts({
        equipmentSlots: {
          helmet: "item:tectonic-helm",
          body: "item:tectonic-body",
          legs: "item:tectonic-legs",
        },
      }).get("tectonic"),
    ).toBe(3);
    expect(stats.critChance).toBeCloseTo(0.13, 10);
  });

  it("tumeken 3 gear in sunshine → +4.5% crit", () => {
    const stats = loadoutStats({
      ...base,
      critChance: 10,
      equipmentSlots: {
        helmet: "item:tumekens-resplendence-helm",
        body: "item:tumekens-resplendence-body",
        legs: "item:tumekens-resplendence-legs",
      },
      perks: { ...base.perks, insideSunshine: true },
    });
    expect(stats.critChance).toBeCloseTo(0.145, 10);
    expect(stats.simulationCritChance).toBeCloseTo(0.1, 10);
    expect(stats.tumekensPieces).toBe(3);
  });

  it("empty gear + zero perk set pieces → no set crit", () => {
    expect(
      loadoutStats({
        ...base,
        critChance: 10,
        equipmentSlots: {},
        perks: { ...base.perks, tectonicPieces: 0, tumekensPieces: 0 },
      }).critChance,
    ).toBeCloseTo(0.1, 10);
  });

  it("setEffectsSummary exposes equipped sets for GearPanel", () => {
    expect(
      setEffectsSummary({
        equipmentSlots: {
          helmet: "item:tectonic-helm",
          body: "item:tectonic-body",
          legs: "item:tectonic-legs",
        },
      }),
    ).toEqual([
      {
        setId: "tectonic",
        pieces: 3,
        label: "Tectonic (Fracture Point)",
        support: "modeled",
      },
    ]);
  });

  it("Math.max(gear, perk) does not double-count tectonic", () => {
    const stats = loadoutStats({
      ...base,
      critChance: 10,
      equipmentSlots: {
        helmet: "item:tectonic-helm",
        body: "item:tectonic-body",
        legs: "item:tectonic-legs",
      },
      perks: { ...base.perks, tectonicPieces: 3 },
    });
    expect(stats.critChance).toBeCloseTo(0.13, 10);
  });

  it("Biting adds +2%/rank crit (+2.2% with level-20 flag)", () => {
    const r4 = loadoutStats({ ...base, critChance: 10, perks: { ...base.perks, biting: 4 } });
    expect(r4.critChance).toBeCloseTo(0.18, 10);
    const r4l20 = loadoutStats({
      ...base,
      critChance: 10,
      perks: { ...base.perks, biting: 4, bitingLevel20: true },
    });
    expect(r4l20.critChance).toBeCloseTo(0.188, 10);
  });

  it("Equilibrium rank >0 forces critChance 0 and damage mult 1.08–1.14 by rank", () => {
    for (const rank of [1, 2, 3, 4] as const) {
      const stats = loadoutStats({
        ...base,
        critChance: 25,
        perks: {
          ...base.perks,
          equilibrium: rank,
          biting: 4,
          tectonicPieces: 3,
          eliteTectonic: true,
        },
      });
      expect(stats.critChance).toBe(0);
      const mult = 1 + equilibriumDamageBonus(rank);
      expect(mult).toBeCloseTo(1.06 + 0.02 * rank, 10);
      expect(stats.base).toBe(Math.floor(stats.rawBase * mult));
      expect(stats.globalModifiers.some((m) => m.id.startsWith("perk:equilibrium"))).toBe(false);
    }
  });

  it("Vulnerability + style curse damage + overload accuracy boost apply when buffs present", () => {
    const turmoil = styleCurseById("turmoil")!;
    const loadout: Loadout = {
      ...base,
      style: "melee",
      attackLevel: 99,
      strengthLevel: 99,
      weaponTier: 90,
      target: { defenceLevel: 80, affinity: "same" },
      buffs: {
        vulnerability: true,
        styleCurse: "turmoil",
        overload: "elder",
      },
    };
    const stats = loadoutStats(loadout);
    const boostedAttack = prayerBoostedStyleLevel(overloadBoostedLevel(99, "elder"), turmoil);
    expect(stats.attackLevel).toBe(boostedAttack);
    expect(stats.dp).toBeCloseTo(
      targetDamagePotential(playerAccuracy(boostedAttack, 90), {
        defenceLevel: 80,
        affinity: "same",
      }),
      10,
    );
    expect(stats.globalModifiers.some((m) => m.id === "vulnerability")).toBe(true);
    expect(stats.globalModifiers.some((m) => m.id === "prayer:turmoil")).toBe(true);
    expect(stats.globalModifiers.some((m) => m.id.includes("overload"))).toBe(false);
    expect(runPipeline({ damage: 1000 }, stats.globalModifiers, { style: "melee" }).damage).toBe(
      Math.floor(Math.floor(1000 * 1.1) * 1.1),
    );
  });

  it("buffs off leave accuracy unboosted and omit vuln/curse modifiers", () => {
    const stats = loadoutStats({
      ...base,
      target: { defenceLevel: 80, affinity: "same" },
      buffs: { vulnerability: false, styleCurse: "none", overload: "none" },
    });
    expect(stats.attackLevel).toBe(99);
    expect(stats.globalModifiers.some((m) => m.id === "vulnerability")).toBe(false);
    expect(stats.globalModifiers.some((m) => m.id.startsWith("prayer:"))).toBe(false);
  });

  it("equippedWeaponTier (accuracy path) prefers twohand then mainhand record tier", () => {
    const twohand: Loadout = {
      ...base,
      equipmentSlots: { twohand: "item:noxious-scythe", mainhand: "item:roar-of-awakening" },
      weaponTier: 92,
    };
    expect(equippedWeaponTier(twohand)).toBe(90);
    expect(loadoutWeaponTier(twohand)).toBe(90);

    const mainhand: Loadout = {
      ...base,
      style: "necromancy",
      equipmentSlots: { mainhand: "item:soulbound-lantern" },
      weaponTier: 90,
    };
    expect(equippedWeaponTier(mainhand)).toBe(95);

    const none: Loadout = {
      ...base,
      equipmentSlots: { pocket: "item:scripture-of-amascut" },
      weaponTier: 90,
    };
    expect(equippedWeaponTier(none)).toBeNull();
    expect(loadoutWeaponTier(none)).toBe(90);

    expect(equippedWeaponTier({ ...base, equipmentSlots: { mainhand: "missing:id" } })).toBeNull();
  });

  it("routes base AD through the equipped weapon configuration", () => {
    const twohand: Loadout = {
      ...base,
      style: "melee",
      level: 99,
      strengthLevel: 99,
      equipmentSlots: { twohand: "item:noxious-scythe" },
    };
    expect(loadoutWeaponConfig(twohand)).toEqual({
      kind: "twohand",
      weapon: { tier: 90 },
      style: "melee",
      styleBonus: 0,
    });
    expect(loadoutBase(twohand)).toBe(
      baseAbilityDamage(99, {
        kind: "twohand",
        weapon: { tier: 90 },
        style: "melee",
        styleBonus: 0,
      }),
    );

    const dual: Loadout = {
      ...base,
      style: "magic",
      level: 99,
      equipmentSlots: { mainhand: "item:seismic-wand", offhand: "item:seismic-singularity" },
    };
    expect(loadoutWeaponConfig(dual)).toEqual({
      kind: "mainhand",
      style: "magic",
      weapon: { tier: 90 },
      offhand: { tier: 90 },
      styleBonus: equippedBonuses(dual).damage,
      spellTier: 90,
    });
    expect(loadoutBase(dual)).toBe(
      baseAbilityDamage(99, {
        kind: "mainhand",
        style: "magic",
        weapon: { tier: 90 },
        offhand: { tier: 90 },
        spellTier: 90,
        styleBonus: equippedBonuses(dual).damage,
      }),
    );

    const mainOnly: Loadout = {
      ...base,
      style: "magic",
      level: 99,
      equipmentSlots: { mainhand: "item:seismic-wand" },
    };
    expect(loadoutWeaponConfig(mainOnly)).toEqual({
      kind: "mainhand",
      style: "magic",
      weapon: { tier: 90 },
      styleBonus: equippedBonuses(mainOnly).damage,
      spellTier: 90,
    });
    expect(loadoutBase(mainOnly)).toBe(
      baseAbilityDamage(99, {
        kind: "mainhand",
        style: "magic",
        weapon: { tier: 90 },
        spellTier: 90,
        styleBonus: equippedBonuses(mainOnly).damage,
      }),
    );
  });

  it("necromancy mainhand + conduit uses the explicit necromancy formula", () => {
    const necro: Loadout = {
      ...base,
      style: "necromancy",
      level: 99,
      equipmentSlots: { mainhand: "item:omni-guard", offhand: "item:soulbound-lantern" },
    };
    expect(loadoutWeaponConfig(necro)).toEqual({
      kind: "necromancy",
      deathGuard: { tier: 95 },
      conduit: { tier: 95 },
      styleBonus: 0,
    });
    expect(loadoutBase(necro)).toBe(
      baseAbilityDamage(99, {
        kind: "necromancy",
        deathGuard: { tier: 95 },
        conduit: { tier: 95 },
        styleBonus: 0,
      }),
    );
  });

  it("overload-boosted level feeds computed base AD; prayer curse never does", () => {
    const loadout: Loadout = {
      ...base,
      style: "melee",
      attackLevel: 99,
      strengthLevel: 99,
      level: 99,
      weaponTier: 90,
      buffs: { vulnerability: false, styleCurse: "turmoil", overload: "elder" },
    };
    const boosted = overloadBoostedLevel(99, "elder");
    expect(loadoutEffectiveDamageLevel(loadout)).toBe(boosted);
    // Turmoil's level boost is accuracy-only; its damage stays a pipeline modifier.
    expect(loadoutBase(loadout)).toBe(
      baseAbilityDamage(boosted, { kind: "twohand", weapon: { tier: 90 }, style: "melee" }),
    );
    const stats = loadoutStats(loadout);
    expect(stats.base).toBe(loadoutBase(loadout));
    // Crit damage level stays the natural style level.
    expect(stats.level).toBe(99);
  });

  it("equippedBonuses sums wiki damage/accuracy from slotted pieces", () => {
    const dual: Loadout = {
      ...base,
      equipmentSlots: { mainhand: "item:omni-guard", offhand: "item:soulbound-lantern" },
    };
    expect(equippedBonuses(dual)).toEqual({ damage: 1415.5 + 707.7, accuracy: 2765 + 2765 });

    const seismic: Loadout = {
      ...base,
      equipmentSlots: { mainhand: "item:seismic-wand" },
    };
    expect(equippedBonuses(seismic)).toEqual({ damage: 0, accuracy: 2458 });

    expect(equippedBonuses({ ...base, equipmentSlots: {} })).toEqual({ damage: 0, accuracy: 0 });
  });

  it("sumNonWeaponAccuracy keeps only accessory/armour accuracy (not weapons)", () => {
    expect(
      sumNonWeaponAccuracy([
        { slot: "mainhand", bonuses: { accuracy: 2765 } },
        { slot: "offhand", bonuses: { accuracy: 2765 } },
        { slot: "twohand", bonuses: { accuracy: 2458 } },
        { slot: "ring", bonuses: { accuracy: 100 } },
        { slot: "amulet", bonuses: { accuracy: 50 } },
        { slot: "gloves", bonuses: { accuracy: 25 } },
        { slot: null, bonuses: { accuracy: 999 } },
        { bonuses: { accuracy: 999 } },
      ]),
    ).toBe(175);
  });

  it("nonWeaponAccuracyBonus ignores weapon slots and sums accessories", () => {
    expect(
      nonWeaponAccuracyBonus({
        ...base,
        equipmentSlots: {
          mainhand: "mock:weapon-main",
          ring: "mock:acc-ring",
          amulet: "mock:acc-amulet",
        },
      }),
    ).toBe(150);

    expect(
      nonWeaponAccuracyBonus({
        ...base,
        equipmentSlots: { mainhand: "mock:weapon-main" },
      }),
    ).toBe(0);

    expect(
      nonWeaponAccuracyBonus({
        ...base,
        equipmentSlots: { mainhand: "item:omni-guard" },
      }),
    ).toBe(0);
  });

  it("accessory accuracy 100 raises DP vs target vs same loadout without it", () => {
    const target = { defenceLevel: 120, affinity: "strong" as const };
    const without = loadoutStats({
      ...base,
      attackLevel: 70,
      strengthLevel: 70,
      level: 70,
      weaponTier: 70,
      target,
      equipmentSlots: { mainhand: "mock:weapon-main" },
    });
    const withRing = loadoutStats({
      ...base,
      attackLevel: 70,
      strengthLevel: 70,
      level: 70,
      weaponTier: 70,
      target,
      equipmentSlots: { mainhand: "mock:weapon-main", ring: "mock:acc-ring" },
    });
    expect(without.dp).toBeLessThan(1);
    expect(withRing.dp).toBeGreaterThan(without.dp);
    expect(without.dp).toBeCloseTo(targetDamagePotential(playerAccuracy(70, 90), target), 10);
    expect(withRing.dp).toBeCloseTo(
      targetDamagePotential(playerAccuracy(70, 90) + 100, target),
      10,
    );
    const withBoth = loadoutStats({
      ...base,
      weaponTier: 90,
      target,
      perks: { ...base.perks, energising: 4 },
      equipmentSlots: { ring: "mock:acc-ring" },
    });
    expect(withBoth.dp).toBeCloseTo(hitChance(playerAccuracy(99, 90) + 150 + 100, target), 10);
  });

  it("Eruptive changes the canonical base without a second hit-stage modifier", () => {
    const stats = loadoutStats({ ...base, perks: { ...base.perks, eruptive: 4 } });
    expect(stats.base).toBe(Math.floor(stats.rawBase * 1.02));
    expect(stats.globalModifiers.some((m) => m.id === "perk:eruptive:4")).toBe(false);
  });

  it("applies Equilibrium then Eruptive once at the shared AD-stat boundary", () => {
    const stats = loadoutStats({
      ...base,
      perks: { ...base.perks, equilibrium: 4, eruptive: 4 },
    });
    expect(stats.base).toBe(Math.floor(Math.floor(stats.rawBase * 1.14) * 1.02));
    expect(stats.critChance).toBe(0);
    expect(stats.globalModifiers.some((modifier) => modifier.id.includes("equilibrium"))).toBe(
      false,
    );
    expect(stats.globalModifiers.some((modifier) => modifier.id.includes("eruptive"))).toBe(false);
  });

  it("Invigorating and Impatient feed adrenaline rules (rank 0 = defaults)", () => {
    const off = loadoutStats(base);
    expect(off.adrenaline?.basicGainMultiplier).toBe(1);
    expect(off.adrenaline?.impatientRank).toBe(0);
    expect(off.adrenaline?.relentlessRank).toBe(0);

    const inv4 = loadoutStats({ ...base, perks: { ...base.perks, invigorating: 4 } });
    expect(inv4.adrenaline?.basicGainMultiplier).toBeCloseTo(1.2, 10);

    // Impatient / Relentless pass ranks through: the rotation drivers branch
    // on them (probability-weighted), so no EV values live here anymore.
    const imp4 = loadoutStats({ ...base, perks: { ...base.perks, impatient: 4 } });
    expect(imp4.adrenaline?.impatientRank).toBe(4);

    const imp4l20 = loadoutStats({
      ...base,
      perks: { ...base.perks, impatient: 4, impatientLevel20: true },
    });
    expect(imp4l20.adrenaline?.impatientLevel20).toBe(true);

    const rel5 = loadoutStats({ ...base, perks: { ...base.perks, relentless: 5 } });
    expect(rel5.adrenaline?.relentlessRank).toBe(5);
  });

  it("Crackling / Aftershock ranks feed procs rules (rank 0 = off)", () => {
    const off = loadoutStats(base);
    expect(off.procs?.cracklingRank).toBe(0);
    expect(off.procs?.aftershockRank).toBe(0);

    const ranked = loadoutStats({
      ...base,
      perks: { ...base.perks, crackling: 4, aftershock: 2 },
    });
    expect(ranked.procs?.cracklingRank).toBe(4);
    expect(ranked.procs?.aftershockRank).toBe(2);
  });

  it("Planted Feet surfaces on CalcStats for simulate", () => {
    expect(loadoutStats(base).plantedFeet).toBe(false);
    expect(loadoutStats({ ...base, perks: { ...base.perks, plantedFeet: true } }).plantedFeet).toBe(
      true,
    );
  });

  it("First Necromancer gear surfaces conjureBasicDamageMult for spirit autos", () => {
    expect(loadoutStats(base).conjureBasicDamageMult).toBe(1);
    expect(loadoutStats(base).conjureDurationMult).toBe(1);
    const full = loadoutStats({
      ...base,
      equipmentSlots: {
        ...base.equipmentSlots,
        helmet: "item:first-necromancer-helm",
        body: "item:first-necromancer-body",
        legs: "item:first-necromancer-legs",
        gloves: "item:first-necromancer-gloves",
        boots: "item:first-necromancer-boots",
      },
    });
    expect(full.conjureBasicDamageMult).toBeCloseTo(1.35, 10);
    expect(full.conjureDurationMult).toBeCloseTo(1.25, 10);
  });

  it("Vestments gear surfaces its piece count and 120 adrenaline cap", () => {
    const stats = loadoutStats({
      ...base,
      startingAdrenaline: 120,
      equipmentSlots: {
        helmet: "item:vestments-of-havoc-hood",
        body: "item:vestments-of-havoc-robe-top",
        legs: "item:vestments-of-havoc-robe-bottom",
        boots: "item:vestments-of-havoc-boots",
      },
    });
    expect(stats.vestmentsPieces).toBe(4);
    expect(stats.maxAdrenaline).toBe(120);
    expect(stats.startingAdrenaline).toBe(120);
  });

  it("rank-0 perks produce no modifiers; ranked perks produce gated ones", () => {
    const ability = { id: "melee:rend", category: "basic" } as Parameters<
      ReturnType<typeof loadoutStats>["castModifiersFor"]
    >[0];
    expect(loadoutStats(base).castModifiersFor(ability)).toHaveLength(0);
    const ranked = loadoutStats({
      ...base,
      perks: { ...base.perks, equilibrium: 4, ultimatums: 4 },
    });
    expect(ranked.globalModifiers).toHaveLength(0);
    expect(ranked.castModifiersFor(ability)).toHaveLength(1);
    const ultimate = { id: "melee:overpower", category: "ultimate" } as typeof ability;
    expect(
      ranked
        .castModifiersFor(ultimate)
        .find((m) => m.id.startsWith("perk:ultimatums"))
        ?.applies({ style: "melee" }),
    ).toBe(true);
    expect(
      ranked
        .castModifiersFor(ability)
        .find((m) => m.id.startsWith("perk:ultimatums"))
        ?.applies({ style: "melee" }),
    ).toBe(false);
  });
});
