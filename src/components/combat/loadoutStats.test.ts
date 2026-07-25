import { describe, expect, it } from "vitest";
import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { hitChance, playerAccuracy } from "@/combat/target/genericTarget";
import { loadoutBase, loadoutStats } from "./loadoutStats";
import { DEFAULT_LOADOUT, type Loadout } from "./useLoadout";

const base: Loadout = { ...DEFAULT_LOADOUT };

describe("loadoutStats", () => {
  it("uses the manual base when set, computes from level + weapon tier otherwise", () => {
    expect(loadoutBase(base)).toBe(1000);
    const computed = loadoutBase({ ...base, base: NaN, level: 99, weaponTier: 90, style: "melee" });
    expect(computed).toBe(baseAbilityDamage(99, { kind: "twohand", weapon: { tier: 90 }, style: "melee" }));
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
