import { describe, expect, it } from "vitest";
import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { runPipeline } from "@/combat/pipeline/modifierPipeline";
import { equilibriumDamageBonus } from "@/combat/shared/perks";
import { overloadBoostedLevel } from "@/combat/shared/potions";
import { prayerBoostedStyleLevel, styleCurseById } from "@/combat/shared/prayers";
import { hitChance, playerAccuracy, targetDamagePotential } from "@/combat/target/genericTarget";
import {
  equippedBonuses,
  equippedWeaponTier,
  loadoutAttackLevel,
  loadoutBase,
  loadoutDamageLevel,
  loadoutStats,
  loadoutWeaponTier,
} from "./loadoutStats";
import { DEFAULT_LOADOUT, type Loadout } from "./useLoadout";

const base: Loadout = { ...DEFAULT_LOADOUT };

describe("loadoutStats", () => {
  it("uses the manual base when set, computes from level + weapon tier otherwise", () => {
    expect(loadoutBase(base)).toBe(1000);
    const computed = loadoutBase({ ...base, base: NaN, level: 99, weaponTier: 90, style: "melee" });
    expect(computed).toBe(baseAbilityDamage(99, { kind: "twohand", weapon: { tier: 90 }, style: "melee" }));
  });

  it("melee Attack feeds accuracy; Strength feeds base AD / crit damage level", () => {
    const melee: Loadout = {
      ...base,
      style: "melee",
      attackLevel: 80,
      strengthLevel: 110,
      level: 110,
      base: NaN,
      weaponTier: 90,
      target: { defenceLevel: 80, affinity: "same" },
    };
    expect(loadoutAttackLevel(melee)).toBe(80);
    expect(loadoutDamageLevel(melee)).toBe(110);
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
      base: NaN,
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
    expect(loadoutStats({ ...base, accuracy: 70 }).dp).toBeCloseTo(0.7, 10);
  });

  it("derives Damage Potential from the target model when set", () => {
    const stats = loadoutStats({ ...base, target: { defenceLevel: 80, affinity: "same" } });
    const expected = hitChance(playerAccuracy(99, 90), { defenceLevel: 80, affinity: "same" });
    expect(stats.dp).toBeCloseTo(expected, 10);
  });

  it("adds Energising's flat accuracy inside the target model only", () => {
    const withPerk = loadoutStats({
      ...base,
      perks: { ...base.perks, energising: 4 },
      target: { defenceLevel: 80, affinity: "same" },
    });
    const expected = hitChance(playerAccuracy(99, 90) + 150, { defenceLevel: 80, affinity: "same" });
    expect(withPerk.dp).toBeCloseTo(expected, 10);
    // Without a target the accuracy% input stays authoritative.
    expect(loadoutStats({ ...base, perks: { ...base.perks, energising: 4 } }).dp).toBe(1);
  });

  it("stacks set crit-chance bonuses onto the crit layer and clamps at 100%", () => {
    const stats = loadoutStats({
      ...base,
      critChance: 97,
      perks: { ...base.perks, tectonicPieces: 5, tumekensPieces: 3, insideSunshine: true },
    });
    expect(stats.critChance).toBe(1);
    const plain = loadoutStats(base);
    expect(plain.critChance).toBeCloseTo(0.1, 10);
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
          tectonicPieces: 5,
          eliteTectonic: true,
        },
      });
      expect(stats.critChance).toBe(0);
      const mod = stats.globalModifiers.find((m) => m.id === `perk:equilibrium:${rank}`);
      expect(mod).toBeDefined();
      // R1 +8% … R4 +14% → mult 1.08–1.14 (wiki Equilibrium perk).
      const mult = 1 + equilibriumDamageBonus(rank);
      expect(mult).toBeCloseTo(1.06 + 0.02 * rank, 10);
      expect(runPipeline({ damage: 1000 }, [mod!], { style: "melee" }).damage).toBe(
        Math.floor(1000 * mult),
      );
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
    // Overload is accuracy-only (not a damage global).
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

  it("equippedWeaponTier prefers twohand then mainhand when record.tier is set", () => {
    // Corpus: item:omni-guard has tier 95 (slot may be absent — slotted path still reads tier).
    const twohand: Loadout = {
      ...base,
      equipmentSlots: { twohand: "item:omni-guard", mainhand: "item:roar-of-awakening" },
      weaponTier: 90,
    };
    expect(equippedWeaponTier(twohand)).toBe(95);
    expect(loadoutWeaponTier(twohand)).toBe(95);

    const mainhand: Loadout = {
      ...base,
      equipmentSlots: { mainhand: "item:soulbound-lantern" },
      weaponTier: 90,
    };
    expect(equippedWeaponTier(mainhand)).toBe(95);

    const none: Loadout = { ...base, equipmentSlots: { pocket: "item:scripture-of-amascut" }, weaponTier: 90 };
    // Pocket with tier must not win — only twohand/mainhand (or legacy weapon slots).
    expect(equippedWeaponTier(none)).toBeNull();
    expect(loadoutWeaponTier(none)).toBe(90);

    expect(equippedWeaponTier({ ...base, equipmentSlots: { mainhand: "missing:id" } })).toBeNull();
  });

  it("equippedBonuses sums wiki damage/accuracy from slotted pieces", () => {
    // Omni guard: dmg 1415.5 acc 2765; Soulbound lantern: dmg 707.7 acc 2765 (wiki 2026-07-26).
    const dual: Loadout = {
      ...base,
      equipmentSlots: { mainhand: "item:omni-guard", offhand: "item:soulbound-lantern" },
    };
    expect(equippedBonuses(dual)).toEqual({ damage: 1415.5 + 707.7, accuracy: 2765 + 2765 });

    // Seismic wand has accuracy only (tooltip damage 0 — not stored).
    const seismic: Loadout = {
      ...base,
      equipmentSlots: { mainhand: "item:seismic-wand" },
    };
    expect(equippedBonuses(seismic)).toEqual({ damage: 0, accuracy: 2458 });

    expect(equippedBonuses({ ...base, equipmentSlots: {} })).toEqual({ damage: 0, accuracy: 0 });
  });

  it("Eruptive adds a global base-stage damage modifier", () => {
    const stats = loadoutStats({ ...base, perks: { ...base.perks, eruptive: 4 } });
    expect(stats.globalModifiers.some((m) => m.id === "perk:eruptive:4")).toBe(true);
  });

  it("Invigorating and Impatient feed adrenaline rules (rank 0 = defaults)", () => {
    const off = loadoutStats(base);
    expect(off.adrenaline?.basicGainMultiplier).toBe(1);
    expect(off.adrenaline?.impatientExpectedExtra).toBe(0);

    const inv4 = loadoutStats({ ...base, perks: { ...base.perks, invigorating: 4 } });
    expect(inv4.adrenaline?.basicGainMultiplier).toBeCloseTo(1.2, 10);

    // R4 non-l20: 0.09*4 * 3 = 1.08
    const imp4 = loadoutStats({ ...base, perks: { ...base.perks, impatient: 4 } });
    expect(imp4.adrenaline?.impatientExpectedExtra).toBeCloseTo(1.08, 10);

    // R4 l20: 0.099*4 * 3 = 1.188
    const imp4l20 = loadoutStats({
      ...base,
      perks: { ...base.perks, impatient: 4, impatientLevel20: true },
    });
    expect(imp4l20.adrenaline?.impatientExpectedExtra).toBeCloseTo(1.188, 10);
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

  it("rank-0 perks produce no modifiers; ranked perks produce gated ones", () => {
    const ability = { id: "melee:rend", category: "basic" } as Parameters<
      ReturnType<typeof loadoutStats>["castModifiersFor"]
    >[0];
    expect(loadoutStats(base).castModifiersFor(ability)).toHaveLength(0);
    const ranked = loadoutStats({ ...base, perks: { ...base.perks, equilibrium: 4, ultimatums: 4 } });
    expect(ranked.globalModifiers).toHaveLength(1);
    expect(ranked.castModifiersFor(ability)).toHaveLength(2);
    const ultimate = { id: "melee:overpower", category: "ultimate" } as typeof ability;
    expect(ranked.castModifiersFor(ultimate).find((m) => m.id.startsWith("perk:ultimatums"))?.applies({ style: "melee" })).toBe(true);
    expect(ranked.castModifiersFor(ability).find((m) => m.id.startsWith("perk:ultimatums"))?.applies({ style: "melee" })).toBe(false);
  });
});
