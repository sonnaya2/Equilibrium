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
  equipmentStyleDamageBonus,
  equippedWeaponTier,
  loadoutAttackLevel,
  loadoutBase,
  loadoutDamageLevel,
  loadoutEffectiveDamageLevel,
  loadoutStats,
  loadoutWeaponConfig,
  loadoutWeaponTier,
  nonWeaponAccuracyBonus,
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
      if (id === "mock:defence-body") {
        return {
          id,
          name: "Mock defensive body",
          slot: "body" as const,
          tier: 80,
          style: "melee" as const,
          armourClass: "tank" as const,
          bonuses: { armour: 500, life: 1000, prayer: 42 },
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

  it("Attack cape (120) adds 2% melee hit chance to Damage Potential", () => {
    // Strong target so hit chance is below the 100% cap and the cape is visible.
    const target = { defenceLevel: 120, affinity: "strong" as const };
    const plain = loadoutStats({
      ...base,
      style: "melee",
      attackLevel: 99,
      strengthLevel: 99,
      weaponTier: 90,
      target,
    });
    const withCape = loadoutStats({
      ...base,
      style: "melee",
      attackLevel: 99,
      strengthLevel: 99,
      weaponTier: 90,
      target,
      buffs: { ...base.buffs, attackCape120: true },
    });
    expect(withCape.attackCape120).toBe(true);
    expect(plain.dp).toBeLessThan(1);
    expect(withCape.dp).toBeGreaterThan(plain.dp);
    expect(withCape.dp - plain.dp).toBeCloseTo(0.02, 5);
    // Non-melee styles ignore the cape for hit chance.
    const ranged = loadoutStats({
      ...base,
      style: "ranged",
      level: 99,
      weaponTier: 90,
      target,
      buffs: { ...base.buffs, attackCape120: true },
    });
    expect(ranged.attackCape120).toBe(false);
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

  it("exposes the same accuracy rating it feeds into the target-model Damage Potential", () => {
    const loadout: Loadout = {
      ...base,
      style: "magic",
      level: 105,
      weaponTier: 90,
      target: { defenceLevel: 80, affinity: "same" },
      equipmentSlots: { ring: "mock:acc-ring", amulet: "mock:acc-amulet" },
    };
    const stats = loadoutStats(loadout);
    expect(stats.accuracyRating).toBe(playerAccuracy(105, 90) + 150);
    expect(stats.dp).toBeCloseTo(
      targetDamagePotential(stats.accuracyRating, { defenceLevel: 80, affinity: "same" }),
      10,
    );
  });

  it("exposes base crit damage, the persistent bonus, and the total static crit damage", () => {
    const at90 = loadoutStats({ ...base, style: "magic", level: 90 });
    expect(at90.baseCritDamage).toBeCloseTo(1.5, 10);
    expect(at90.critDamageBonus).toBe(0);
    expect(at90.totalCritDamage).toBeCloseTo(1.5, 10);
    expect(at90.baseCritDamageBonus).toBeCloseTo(0.5, 10);
    expect(at90.totalCritDamageBonus).toBeCloseTo(0.5, 10);
    const at80 = loadoutStats({ ...base, style: "magic", level: 80 });
    expect(at80.baseCritDamage).toBeCloseTo(1.45, 10);
    const melee = loadoutStats({ ...base, style: "melee", attackLevel: 1, strengthLevel: 90 });
    expect(melee.baseCritDamage).toBeCloseTo(1.5, 10);
    expect(melee.totalCritDamage).toBeCloseTo(melee.baseCritDamage + melee.critDamageBonus, 10);
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

  it("freezing automatic base into manual stores rawBase so perks/Aegis apply once", () => {
    const autoLoadout: Loadout = {
      ...base,
      perks: { ...base.perks, equilibrium: 4, eruptive: 4 },
    };
    const auto = loadoutStats(autoLoadout);
    expect(auto.rawBase).toBeLessThan(auto.base);

    // Correct freeze path (StatsPanel auto→manual): store pre-perk rawBase.
    const frozen = loadoutStats({
      ...autoLoadout,
      baseDamage: { mode: "manual", manualValue: auto.rawBase },
    });
    expect(frozen.rawBase).toBe(auto.rawBase);
    expect(frozen.base).toBe(auto.base);

    // Freezing stats.base re-applies perks and double-counts.
    const doubleCounted = loadoutStats({
      ...autoLoadout,
      baseDamage: { mode: "manual", manualValue: auto.base },
    });
    expect(doubleCounted.base).toBeGreaterThan(auto.base);
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

  it("set crit wiring: tectonic +3%, elite clamps at 100%, Tumeken is dynamic-only", () => {
    const plain = loadoutStats(base);
    expect(plain.critChance).toBeCloseTo(0.1, 10);

    const tectonic = loadoutStats({
      ...base,
      critChance: 10,
      equipmentSlots: {
        helmet: "item:tectonic-helm",
        body: "item:tectonic-body",
        legs: "item:tectonic-legs",
      },
    });
    expect(tectonic.critChance).toBeCloseTo(0.13, 10);

    const eliteClamp = loadoutStats({
      ...base,
      critChance: 97,
      equipmentSlots: {
        helmet: "item:elite-tectonic-mask",
        body: "item:elite-tectonic-robe-top",
        legs: "item:elite-tectonic-robe-bottom",
      },
    });
    expect(eliteClamp.critChance).toBe(1);
    expect(
      Object.values(eliteClamp.critChanceBreakdown).reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo(eliteClamp.critChance, 10);

    const tumeken = loadoutStats({
      ...base,
      critChance: 10,
      equipmentSlots: {
        helmet: "item:tumekens-resplendence-helm",
        body: "item:tumekens-resplendence-body",
        legs: "item:tumekens-resplendence-legs",
      },
    });
    expect(tumeken.critChance).toBeCloseTo(0.1, 10);
    expect(tumeken.tumekensPieces).toBe(3);
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
        },
      });
      expect(stats.critChance).toBe(0);
      expect(stats.critsDisabled).toBe(true);
      expect(
        Object.values(stats.critChanceBreakdown).reduce((sum, value) => sum + value, 0),
      ).toBeCloseTo(0, 10);
      const mult = 1 + equilibriumDamageBonus(rank);
      expect(mult).toBeCloseTo(1.06 + 0.02 * rank, 10);
      expect(stats.base).toBe(Math.floor(stats.rawBase * mult));
      expect(stats.globalModifiers.some((m) => m.id.startsWith("perk:equilibrium"))).toBe(false);
    }
    expect(loadoutStats(base).critsDisabled).toBe(false);
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
        ...base.buffs,
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
      buffs: { ...base.buffs, vulnerability: false, styleCurse: "none", overload: "none" },
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

  it("classifies shields and defenders without granting full off-hand weapon damage", () => {
    const common: Loadout = {
      ...base,
      style: "melee",
      level: 99,
      attackLevel: 99,
      strengthLevel: 99,
      accuracy: 50,
    };
    const shield: Loadout = {
      ...common,
      equipmentSlots: {
        mainhand: "item:drygore-longsword",
        offhand: "item:malevolent-kiteshield",
      },
    };
    const defender: Loadout = {
      ...common,
      equipmentSlots: {
        mainhand: "item:drygore-longsword",
        offhand: "item:kalphite-defender",
      },
    };
    const dual: Loadout = {
      ...common,
      equipmentSlots: {
        mainhand: "item:drygore-longsword",
        offhand: "item:off-hand-drygore-longsword",
      },
    };

    expect(loadoutWeaponConfig(shield)).toMatchObject({ kind: "mainhand" });
    expect(loadoutWeaponConfig(shield)).not.toHaveProperty("offhand");
    expect(loadoutWeaponConfig(defender)).toMatchObject({
      kind: "mainhand",
      offhand: { tier: 45 },
    });
    expect(loadoutStats(shield).weaponConfiguration).toBe("shield");
    expect(loadoutStats(defender).weaponConfiguration).toBe("defender");
    expect(loadoutBase(shield)).toBeLessThan(loadoutBase(defender));
    expect(loadoutBase(defender)).toBeLessThan(loadoutBase(dual));

    // Ability accuracy comes from the main hand only; the defender's sourced
    // passive multiplies that rating instead of adding its displayed off-hand stat.
    expect(loadoutStats(shield).accuracyRating).toBe(loadoutStats(dual).accuracyRating);
    expect(loadoutStats(defender).accuracyRating).toBeCloseTo(
      loadoutStats(dual).accuracyRating * 1.03,
    );
    // Manual accuracy is a final Damage Potential override when no target is set - 
    // defender ×1.03 does not re-scale the slider (it still multiplies accuracyRating).
    expect(loadoutStats(shield).dp).toBe(0.5);
    expect(loadoutStats(defender).dp).toBe(0.5);
    expect(loadoutStats(defender).activePassives).toContain("Defender accuracy");

    const target = {
      defenceLevel: 99,
      armour: 1000,
      affinity: "strong" as const,
      additiveHitChance: 10,
    };
    const shieldDp = loadoutStats({ ...shield, target }).dp;
    const defenderDp = loadoutStats({ ...defender, target }).dp;
    expect(defenderDp).toBeCloseTo((shieldDp - 0.1) * 1.03 + 0.1);
  });

  it("reports necromancy dual only with a conduit; shield OH is not a conjure shape", () => {
    // Wiki Conjuration: equipment Conduit. Siphon + shield is necrotic-capable, not dual.
    const dual: Loadout = {
      ...DEFAULT_LOADOUT,
      style: "necromancy",
      equipmentSlots: {
        mainhand: "item:omni-guard",
        offhand: "item:soulbound-lantern",
      },
    };
    const tank: Loadout = {
      ...DEFAULT_LOADOUT,
      style: "necromancy",
      equipmentSlots: {
        mainhand: "item:omni-guard",
        offhand: "item:malevolent-kiteshield",
      },
    };
    expect(loadoutStats(dual).weaponConfiguration).toBe("necromancy");
    expect(loadoutStats(tank).weaponConfiguration).toBe("shield");
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
      buffs: { ...base.buffs, vulnerability: false, styleCurse: "turmoil", overload: "elder" },
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

  it("equippedBonuses sums wiki face values; Setup equipment.damage ignores weapon Damage", () => {
    const dual: Loadout = {
      ...base,
      style: "necromancy",
      equipmentSlots: { mainhand: "item:omni-guard", offhand: "item:soulbound-lantern" },
    };
    // Wiki face totals still available for display/debug.
    expect(equippedBonuses(dual)).toEqual({ damage: 1415.5 + 707.7, accuracy: 2765 + 2765 });
    // Setup "Equipment damage" is style bonuses only - weapons are tier-encoded.
    expect(loadoutStats(dual).equipment.damage).toBe(0);
    expect(equipmentStyleDamageBonus(dual)).toBe(0);

    const seismic: Loadout = {
      ...base,
      equipmentSlots: { mainhand: "item:seismic-wand" },
    };
    expect(equippedBonuses(seismic)).toEqual({ damage: 0, accuracy: 2458 });

    expect(equippedBonuses({ ...base, equipmentSlots: {} })).toEqual({ damage: 0, accuracy: 0 });
  });

  it("formula power armour writes style damage into Base AD and Setup equipment.damage", () => {
    // Masterwork ranged is power armour without always-sourced bonuses.damage on every piece.
    const loadout: Loadout = {
      ...base,
      style: "ranged",
      equipmentSlots: {
        helmet: "item:masterwork-ranged-cowl",
        body: "item:masterwork-ranged-body",
        legs: "item:masterwork-ranged-chaps",
      },
    };
    const stats = loadoutStats(loadout);
    const styleB = equipmentStyleDamageBonus(loadout);
    expect(stats.equipment.damage).toBeGreaterThan(0);
    expect(styleB).toBe(stats.equipment.damage);
    expect(styleB).toBe(loadoutWeaponConfig(loadout).styleBonus);
  });

  it("names Channeller's ring in equipment damage and raises magic Base AD", () => {
    const bare: Loadout = {
      ...base,
      style: "magic",
      equipmentSlots: {},
      baseDamage: { mode: "automatic", manualValue: 0 },
    };
    const ring: Loadout = {
      ...bare,
      equipmentSlots: { ring: "item:channelers-ring" },
    };
    const bareS = loadoutStats(bare);
    const ringS = loadoutStats(ring);
    expect(ringS.equipment.damage).toBe(34.5);
    expect(ringS.equipmentDamageBreakdown).toEqual(
      expect.arrayContaining([{ label: "Channeller's ring", value: 34.5 }]),
    );
    expect(ringS.base).toBeGreaterThan(bareS.base);
    expect(ringS.baseAbilityDamageBreakdown.some((row) => row.label === "Style damage")).toBe(true);
    expect(ringS.critConditionalNotes.some((n) => /Channeller/i.test(n))).toBe(true);
  });

  it("flags Channeller's ring when loadout style blocks its damage", () => {
    const ring: Loadout = {
      ...base,
      style: "melee",
      equipmentSlots: { ring: "item:channelers-ring" },
    };
    const stats = loadoutStats(ring);
    expect(stats.equipment.damage).toBe(0);
    expect(stats.styleMismatchNotes.some((n) => /Channeller/i.test(n))).toBe(true);
  });

  it("lists Reaver's ring on crit sources and equipment damage", () => {
    const ring: Loadout = {
      ...base,
      style: "melee",
      equipmentSlots: { ring: "item:reavers-ring" },
    };
    const stats = loadoutStats(ring);
    expect(stats.equipment.damage).toBe(33);
    expect(stats.critChanceSources).toEqual(
      expect.arrayContaining([{ label: "Reaver's ring", value: 0.05 }]),
    );
    expect(stats.critChanceBreakdown.equipment).toBeCloseTo(0.05);
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

    // Impatient / Relentless pass ranks through; rotation drivers branch on
    // them (probability-weighted). EV is not computed at this boundary.
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

  it("race Slayer perks add base modifiers only when the target matches", () => {
    const withDemon = {
      ...base,
      perks: { ...base.perks, demonSlayer: 1 },
      target: {
        defenceLevel: 80,
        armour: 0,
        affinity: "same" as const,
        demon: true,
      },
    };
    expect(loadoutStats(withDemon).globalModifiers.some((m) => m.id === "perk:demon-slayer")).toBe(
      true,
    );
    const offTarget = {
      ...base,
      perks: { ...base.perks, demonSlayer: 1 },
      target: { defenceLevel: 80, armour: 0, affinity: "same" as const },
    };
    const mod = loadoutStats(offTarget).globalModifiers.find((m) => m.id === "perk:demon-slayer");
    expect(mod).toBeDefined();
    // closed over targetMatches=false - no damage when the target is not a demon
    expect(mod!.applies({ style: "melee" })).toBe(false);
  });

  it("Planted Feet surfaces on CalcStats for simulate", () => {
    expect(loadoutStats(base).plantedFeet).toBe(false);
    expect(loadoutStats({ ...base, perks: { ...base.perks, plantedFeet: 1 } }).plantedFeet).toBe(
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
    expect(stats.equipmentEffects.vestments.pieces).toBe(4);
    expect(stats.equipmentEffects.vestments.heraldOfChaos).toBe(true);
    expect(stats.maxAdrenaline).toBe(120);
    expect(stats.startingAdrenaline).toBe(120);
  });

  it("does not activate Vestments with an explicitly non-melee weapon", () => {
    for (const [style, slot, weapon] of [
      ["magic", "mainhand", "item:seismic-wand"],
      ["ranged", "twohand", "item:bow-of-the-last-guardian"],
      ["necromancy", "mainhand", "item:omni-guard"],
    ] as const) {
      const stats = loadoutStats({
        ...base,
        style,
        startingAdrenaline: 120,
        equipmentSlots: {
          [slot]: weapon,
          helmet: "item:vestments-of-havoc-hood",
          body: "item:vestments-of-havoc-robe-top",
          legs: "item:vestments-of-havoc-robe-bottom",
          boots: "item:vestments-of-havoc-boots",
        },
      });
      expect(stats.equipmentEffects.vestments.pieces, style).toBe(4);
      expect(stats.equipmentEffects.vestments.heraldOfChaos, style).toBe(false);
      expect(stats.maxAdrenaline, style).toBe(100);
      expect(stats.startingAdrenaline, style).toBe(100);
    }
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

  describe("Defence and life resolution", () => {
    it("routes equipment Armour/Life into their stats while Prayer remains separate", () => {
      const stats = loadoutStats({
        ...base,
        equipmentSlots: { body: "mock:defence-body" },
      });
      expect(stats.defence.equipmentArmour).toBe(500);
      expect(stats.equipment.armour).toBe(500);
      expect(stats.life.equipmentLife).toBe(1000);
      expect(stats.defence.totalArmour).toBe(500);
      expect(stats.defence.blockArmourRating).toBe(
        Math.floor(500 + stats.defence.blockLevelArmour),
      );
    });

    it("derives blessing inputs from Build picks without replacing the existing stats model", () => {
      const aegisLoadout: Loadout = {
        ...base,
        equipmentSlots: { body: "mock:defence-body" },
      };
      const aegis = loadoutStats(aegisLoadout, {
        blessingPicks: ["Order", "Order", "Order"],
      });
      expect(aegis.leagueBaseAbilityDamageBonus).toBe(125);
      expect(aegis.aegis).toMatchObject({
        qualifyingArmour: 500,
        offhand: "none",
        armourPercent: 0.25,
      });
      expect(aegis.base).toBe(loadoutBase(aegisLoadout) + aegis.leagueBaseAbilityDamageBonus);

      const bigBoned = loadoutStats(base, {
        blessingPicks: ["Balance", "Chaos", "Chaos"],
      });
      expect(bigBoned.life.normalMaxLife).toBe(14_850);
      expect(bigBoned.life.temporaryMaxLife).toBe(14_850);

      const demonsMark = loadoutStats(
        {
          ...base,
          target: { defenceLevel: 80, affinity: "same", hasApplicableWeakness: true },
        },
        { blessingPicks: ["Balance", "Chaos", "Chaos"] },
      );
      expect(demonsMark.damagePotentialSource).toBe("target weakness");
      expect(demonsMark.dp).toBeCloseTo(
        targetDamagePotential(demonsMark.accuracyRating, {
          defenceLevel: 80,
          affinity: "weakness",
        }),
      );

      expect(
        loadoutStats(base, { blessingPicks: ["Chaos", "Balance", "Balance"] }).maxAdrenaline,
      ).toBe(150);
    });

    it("boosts Defence through the overload formula", () => {
      const stats = loadoutStats({
        ...base,
        defenceLevel: 99,
        buffs: { ...base.buffs, overload: "elder" },
      });
      expect(stats.defence.potionBoost).toBe(21);
      expect(stats.defence.visibleLevel).toBe(120);
    });

    it("applies both verified Fortitude effects", () => {
      const stats = loadoutStats({
        ...base,
        buffs: { ...base.buffs, fortitude: true },
      });
      expect(stats.defence.blockLevel).toBeCloseTo(113.85);
      expect(stats.life.temporaryFlatLife).toBe(1000);
      expect(stats.life.temporaryMaxLife).toBe(10_900);
    });

    it.each([
      ["Reaper Crew", { reaperCrew: true }, "normalMaxLife", 10_100],
      ["Font of Life", { fontOfLife: true }, "normalMaxLife", 10_400],
      ["Boon of Het", { boonOfHet: true }, "normalMaxLife", 10_395],
      ["thermal bath", { thermalBath: true }, "temporaryMaxLife", 10_197],
      ["Totem of Vitality", { totemOfVitality: true }, "normalMaxLife", 11_400],
    ] as const)("applies %s", (_name, patch, field, expected) => {
      const stats = loadoutStats({ ...base, buffs: { ...base.buffs, ...patch } });
      expect(stats.life[field]).toBe(expected);
    });

    it("resolves bonfire level, food overheal, and current life separately", () => {
      const stats = loadoutStats({
        ...base,
        currentLife: 10_200,
        buffs: {
          ...base.buffs,
          bonfireFiremakingLevel: 110,
          overheal: "soup-line",
        },
      });
      expect(stats.life.bonfireLife).toBe(554);
      expect(stats.life.temporaryMaxLife).toBe(10_454);
      expect(stats.life.overhealCeiling).toBe(11_939);
      expect(stats.life.currentLife).toBe(10_200);
    });

    it("applies Powerburst only inside its six-second active window", () => {
      const now = 20_000;
      const loadout: Loadout = {
        ...base,
        currentLife: 4000,
        buffs: { ...base.buffs, powerburstOfVitalityUntil: now + 6000 },
      };
      const active = loadoutStats(loadout, { now });
      expect(active.life).toMatchObject({
        currentLife: 8000,
        temporaryMaxLife: 19_800,
        powerburstActive: true,
      });
      // League rules keep undoubled max life + remaining until-tick for land-time resolve.
      expect(active.league.maximumLife).toBe(9_900);
      expect(active.league.powerburstUntilTick).toBe(10);

      const expired = loadoutStats(loadout, { now: now + 6000 });
      expect(expired.life).toMatchObject({
        currentLife: 4000,
        temporaryMaxLife: 9900,
        powerburstActive: false,
      });
      expect(expired.league.maximumLife).toBe(9_900);
      expect(expired.league.powerburstUntilTick).toBe(0);
    });
    it("defaults current life from currentHealthPercent (50%) when absolute is null", () => {
      const stats = loadoutStats({
        ...base,
        currentLife: null,
        currentHealthPercent: 50,
      });
      expect(stats.life.currentLife).toBe(Math.floor(stats.life.temporaryMaxLife * 0.5));
    });

    it("wires Berserker's Fury into globalModifiers at 50% health", () => {
      const off = loadoutStats({
        ...base,
        currentLife: null,
        currentHealthPercent: 50,
        buffs: { ...base.buffs, berserkersFury: false },
      });
      expect(off.berserkersFury.active).toBe(false);
      expect(off.globalModifiers.some((m) => m.id === "relic:berserkers_fury")).toBe(false);

      const on = loadoutStats({
        ...base,
        currentLife: null,
        currentHealthPercent: 50,
        buffs: { ...base.buffs, berserkersFury: true },
      });
      expect(on.berserkersFury.active).toBe(true);
      expect(on.berserkersFury.bonus).toBe(0.03);
      const mod = on.globalModifiers.find((m) => m.id === "relic:berserkers_fury");
      expect(mod).toBeDefined();
      expect(mod!.stage).toBe("roll");
      expect(mod!.apply({ damage: 1000 }, { style: "melee" }).damage).toBe(1030);
      expect(mod!.applies({ style: "melee", dotKind: "bleed" })).toBe(false);
    });

    it("Berserker's Fury is 0 at full health and maxes near 0 LP", () => {
      const full = loadoutStats({
        ...base,
        currentLife: null,
        currentHealthPercent: 100,
        buffs: { ...base.buffs, berserkersFury: true },
      });
      expect(full.berserkersFury.bonus).toBe(0);
      expect(full.globalModifiers.some((m) => m.id === "relic:berserkers_fury")).toBe(false);

      const low = loadoutStats({
        ...base,
        currentLife: 1,
        currentHealthPercent: 0,
        buffs: { ...base.buffs, berserkersFury: true },
      });
      expect(low.berserkersFury.bonus).toBe(0.055);
    });

    it("Berserker's Fury bonus is ratio-stable under Powerburst at 50%", () => {
      const now = 50_000;
      const without = loadoutStats({
        ...base,
        currentLife: null,
        currentHealthPercent: 50,
        buffs: { ...base.buffs, berserkersFury: true },
      });
      const withPb = loadoutStats(
        {
          ...base,
          currentLife: null,
          currentHealthPercent: 50,
          buffs: {
            ...base.buffs,
            berserkersFury: true,
            powerburstOfVitalityUntil: now + 6000,
          },
        },
        { now },
      );
      expect(withPb.life.powerburstActive).toBe(true);
      expect(withPb.life.temporaryMaxLife).toBe(without.life.temporaryMaxLife * 2);
      expect(withPb.berserkersFury.bonus).toBe(without.berserkersFury.bonus);
      expect(withPb.berserkersFury.bonus).toBe(0.03);
    });

    it("Berserker's Fury is 0 while overhealed above temporary max", () => {
      const stats = loadoutStats({
        ...base,
        currentLife: 12_000,
        currentHealthPercent: 100,
        buffs: {
          ...base.buffs,
          berserkersFury: true,
          overheal: "soup-line",
        },
      });
      expect(stats.life.currentLife).toBeGreaterThan(stats.life.temporaryMaxLife);
      expect(stats.berserkersFury.bonus).toBe(0);
      expect(stats.globalModifiers.some((m) => m.id === "relic:berserkers_fury")).toBe(false);
    });
  });

  describe("Archaeology relics via archaeology.selectedIds", () => {
    it("heightened_senses raises maxAdrenaline to 110", () => {
      const off = loadoutStats({
        ...base,
        archaeology: { selectedIds: [], energyCap: 500 },
        buffs: { ...base.buffs, heightenedSenses: false },
      });
      expect(off.maxAdrenaline).toBe(100);
      expect(off.adrenaline?.maxAdrenalineBonus).toBeUndefined();

      const on = loadoutStats({
        ...base,
        archaeology: { selectedIds: ["heightened_senses"], energyCap: 500 },
        buffs: { ...base.buffs, heightenedSenses: false },
      });
      expect(on.maxAdrenaline).toBe(110);
      expect(on.adrenaline?.maxAdrenalineBonus).toBe(10);
    });

    it("fury_of_the_small sets adrenaline.basicAdrenalineFlatBonus", () => {
      const off = loadoutStats({
        ...base,
        archaeology: { selectedIds: [], energyCap: 500 },
        buffs: { ...base.buffs, furyOfTheSmall: false },
      });
      expect(off.adrenaline?.basicAdrenalineFlatBonus).toBeUndefined();

      const on = loadoutStats({
        ...base,
        archaeology: { selectedIds: ["fury_of_the_small"], energyCap: 500 },
        buffs: { ...base.buffs, furyOfTheSmall: false },
      });
      expect(on.adrenaline?.basicAdrenalineFlatBonus).toBe(1);
    });

    it("conservation_of_energy sets adrenaline.ultimateAdrenalineRefund", () => {
      const off = loadoutStats({
        ...base,
        archaeology: { selectedIds: [], energyCap: 500 },
        buffs: { ...base.buffs, conservationOfEnergy: false },
      });
      expect(off.adrenaline?.ultimateAdrenalineRefund).toBeUndefined();

      const on = loadoutStats({
        ...base,
        archaeology: { selectedIds: ["conservation_of_energy"], energyCap: 500 },
        buffs: { ...base.buffs, conservationOfEnergy: false },
      });
      expect(on.adrenaline?.ultimateAdrenalineRefund).toBe(10);
    });

    it("Ring of Vigour equipment sets ultimate refund 10 and ringOfVigour flag", () => {
      const on = loadoutStats({
        ...base,
        equipmentSlots: { ...base.equipmentSlots, ring: "item:ring-of-vigour" },
      });
      expect(on.adrenaline?.ultimateAdrenalineRefund).toBe(10);
      expect(on.adrenaline?.ringOfVigour).toBe(true);
      expect(on.activePassives.some((p) => p.startsWith("Ring of Vigour"))).toBe(true);
    });

    it("permanent Vigour passive with Anachronia activates once without ring", () => {
      const on = loadoutStats(
        {
          ...base,
          buffs: { ...base.buffs, ringOfVigourPassive: true },
        },
        { unlockedRegions: ["anachronia"] },
      );
      expect(on.adrenaline?.ultimateAdrenalineRefund).toBe(10);
      expect(on.adrenaline?.ringOfVigour).toBe(true);
    });

    it("ring + passive do not stack refunds (still 10, not 20)", () => {
      const on = loadoutStats(
        {
          ...base,
          equipmentSlots: { ...base.equipmentSlots, ring: "item:ring-of-vigour" },
          buffs: { ...base.buffs, ringOfVigourPassive: true },
        },
        { unlockedRegions: ["anachronia"] },
      );
      expect(on.adrenaline?.ultimateAdrenalineRefund).toBe(10);
      expect(on.adrenaline?.ringOfVigour).toBe(true);
      const vigourLines = on.activePassives.filter((p) => p.startsWith("Ring of Vigour"));
      expect(vigourLines).toHaveLength(1);
      expect(vigourLines[0]).toContain("Equipped ring");
      expect(vigourLines[0]).toContain("Permanent unlock");
    });

    it("Vigour + CoE stacks to 20 ultimate refund", () => {
      const on = loadoutStats(
        {
          ...base,
          equipmentSlots: { ...base.equipmentSlots, ring: "item:ring-of-vigour" },
          archaeology: { selectedIds: ["conservation_of_energy"], energyCap: 500 },
          buffs: { ...base.buffs, conservationOfEnergy: false, ringOfVigourPassive: true },
        },
        { unlockedRegions: ["anachronia"] },
      );
      expect(on.adrenaline?.ultimateAdrenalineRefund).toBe(20);
    });

    it("passive without Anachronia is inactive; ring still works", () => {
      const passiveOnly = loadoutStats(
        {
          ...base,
          buffs: { ...base.buffs, ringOfVigourPassive: true },
        },
        { unlockedRegions: ["misthalin", "karamja"] },
      );
      expect(passiveOnly.adrenaline?.ultimateAdrenalineRefund).toBeUndefined();
      expect(passiveOnly.adrenaline?.ringOfVigour).toBeUndefined();

      const ringOnly = loadoutStats(
        {
          ...base,
          equipmentSlots: { ...base.equipmentSlots, ring: "item:ring-of-vigour" },
          buffs: { ...base.buffs, ringOfVigourPassive: true },
        },
        { unlockedRegions: ["misthalin"] },
      );
      expect(ringOnly.adrenaline?.ultimateAdrenalineRefund).toBe(10);
      expect(ringOnly.adrenaline?.ringOfVigour).toBe(true);
    });

    it("berserkers_fury via selectedIds wires the roll modifier at 50% health", () => {
      const on = loadoutStats({
        ...base,
        currentLife: null,
        currentHealthPercent: 50,
        archaeology: { selectedIds: ["berserkers_fury"], energyCap: 500 },
        buffs: { ...base.buffs, berserkersFury: false },
      });
      expect(on.berserkersFury.active).toBe(true);
      expect(on.berserkersFury.bonus).toBe(0.03);
      expect(on.globalModifiers.some((m) => m.id === "relic:berserkers_fury")).toBe(true);
    });

    it("stacks Heightened Senses onto Vestments 120 cap", () => {
      const stats = loadoutStats({
        ...base,
        startingAdrenaline: 130,
        archaeology: { selectedIds: ["heightened_senses"], energyCap: 500 },
        buffs: { ...base.buffs, heightenedSenses: false },
        equipmentSlots: {
          helmet: "item:vestments-of-havoc-hood",
          body: "item:vestments-of-havoc-robe-top",
          legs: "item:vestments-of-havoc-robe-bottom",
          boots: "item:vestments-of-havoc-boots",
        },
      });
      expect(stats.maxAdrenaline).toBe(130);
      expect(stats.startingAdrenaline).toBe(130);
    });

    it("activates all three adrenaline relics from selectedIds when energy not region-gated", () => {
      const stats = loadoutStats({
        ...base,
        archaeology: {
          selectedIds: [
            "fury_of_the_small",
            "heightened_senses",
            "conservation_of_energy",
          ],
          energyCap: 650,
        },
        buffs: {
          ...base.buffs,
          furyOfTheSmall: false,
          heightenedSenses: false,
          conservationOfEnergy: false,
        },
      });
      expect(stats.maxAdrenaline).toBe(110);
      expect(stats.adrenaline?.basicAdrenalineFlatBonus).toBe(1);
      expect(stats.adrenaline?.maxAdrenalineBonus).toBe(10);
      expect(stats.adrenaline?.ultimateAdrenalineRefund).toBe(10);
    });
    it("with unlockedRegions without Anachronia, drops over-500 energy from the end", () => {
      // 350 + 350 + 150 = 700; cap 500; trim from end until under budget.
      const stats = loadoutStats(
        {
          ...base,
          archaeology: {
            selectedIds: [
              "heightened_senses",
              "conservation_of_energy",
              "fury_of_the_small",
            ],
            energyCap: 650,
          },
          buffs: {
            ...base.buffs,
            heightenedSenses: false,
            conservationOfEnergy: false,
            furyOfTheSmall: false,
          },
        },
        { unlockedRegions: ["misthalin", "karamja", "havenhythe"] },
      );
      // Keeps first relic only (350); drops CoE and FotS.
      expect(stats.maxAdrenaline).toBe(110);
      expect(stats.adrenaline?.maxAdrenalineBonus).toBe(10);
      expect(stats.adrenaline?.ultimateAdrenalineRefund).toBeUndefined();
      expect(stats.adrenaline?.basicAdrenalineFlatBonus).toBeUndefined();
    });

  });
});