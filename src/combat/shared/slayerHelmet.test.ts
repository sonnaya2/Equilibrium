import { describe, expect, it } from "vitest";
import { mulFloor } from "../core/rounding";
import { runPipeline } from "../pipeline/modifierPipeline";
import {
  FULL_SLAYER_HELMET_ITEM_ID,
  CORRUPTED_SLAYER_HELMET_ITEM_ID,
  REINFORCED_SLAYER_HELMET_ITEM_ID,
  SLAYER_HELMET_TIERS,
  resolveSlayerHelmet,
  slayerHelmetDamageModifier,
  type SlayerHelmetTierId,
} from "./slayerHelmet";

describe("slayerHelmet tiers", () => {
  it("pins wiki damage and hit-chance mults for every Full+ tier", () => {
    const expected: Record<SlayerHelmetTierId, { d: number; h: number }> = {
      full: { d: 1.075, h: 1.125 },
      reinforced: { d: 1.08, h: 1.13 },
      strong: { d: 1.085, h: 1.135 },
      mighty: { d: 1.09, h: 1.14 },
      corrupted: { d: 1.095, h: 1.145 },
    };
    for (const tier of SLAYER_HELMET_TIERS) {
      expect(tier.damageMult).toBe(expected[tier.id].d);
      expect(tier.hitChanceMult).toBe(expected[tier.id].h);
    }
  });
});

describe("resolveSlayerHelmet", () => {
  it("Full helmet + on-task melee: damage 1.075, hit chance 1.125", () => {
    const r = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      onSlayerTask: true,
      style: "melee",
    });
    expect(r.active).toBe(true);
    expect(r.damageMult).toBe(1.075);
    expect(r.hitChanceMult).toBe(1.125);
    expect(r.source).toBe("equipped");
  });

  it("off task: no damage or accuracy bonus", () => {
    const r = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      onSlayerTask: false,
      style: "melee",
    });
    expect(r.active).toBe(false);
    expect(r.damageMult).toBe(1);
    expect(r.hitChanceMult).toBe(1);
  });

  it("equipped + stand: exactly one effect (stronger tier wins)", () => {
    const r = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      standTier: "corrupted",
      unlockedRegions: ["anachronia"],
      onSlayerTask: true,
      style: "melee",
    });
    expect(r.active).toBe(true);
    expect(r.source).toBe("stand");
    expect(r.tier?.id).toBe("corrupted");
    expect(r.damageMult).toBe(1.095);
    expect(r.hitChanceMult).toBe(1.145);
  });

  it("equal tier prefers equipped over stand", () => {
    const r = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      standTier: "full",
      unlockedRegions: ["anachronia"],
      onSlayerTask: true,
      style: "ranged",
    });
    expect(r.source).toBe("equipped");
    expect(r.damageMult).toBe(1.075);
  });

  it("each upgraded tier has exact values when equipped", () => {
    for (const tier of SLAYER_HELMET_TIERS) {
      const r = resolveSlayerHelmet({
        equipmentSlots: { helmet: tier.itemId },
        onSlayerTask: true,
        style: "magic",
      });
      expect(r.active).toBe(true);
      expect(r.damageMult).toBe(tier.damageMult);
      expect(r.hitChanceMult).toBe(tier.hitChanceMult);
    }
  });

  it("non-necromancy styles are eligible without spectral lens", () => {
    for (const style of ["melee", "ranged", "magic"] as const) {
      const r = resolveSlayerHelmet({
        equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
        onSlayerTask: true,
        style,
        ensouledSpectralLens: false,
      });
      expect(r.active).toBe(true);
    }
  });

  it("necromancy inactive without spectral lens", () => {
    const r = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      onSlayerTask: true,
      style: "necromancy",
      ensouledSpectralLens: false,
    });
    expect(r.active).toBe(false);
    expect(r.damageMult).toBe(1);
  });

  it("necromancy active with spectral lens", () => {
    const r = resolveSlayerHelmet({
      equipmentSlots: { helmet: CORRUPTED_SLAYER_HELMET_ITEM_ID },
      onSlayerTask: true,
      style: "necromancy",
      ensouledSpectralLens: true,
    });
    expect(r.active).toBe(true);
    expect(r.damageMult).toBe(1.095);
    expect(r.hitChanceMult).toBe(1.145);
  });

  it("removing Anachronia disables stand only, not equipped helmet", () => {
    const equipped = resolveSlayerHelmet({
      equipmentSlots: { helmet: REINFORCED_SLAYER_HELMET_ITEM_ID },
      standTier: "corrupted",
      unlockedRegions: [],
      onSlayerTask: true,
      style: "melee",
    });
    expect(equipped.active).toBe(true);
    expect(equipped.source).toBe("equipped");
    expect(equipped.damageMult).toBe(1.08);

    const standOnly = resolveSlayerHelmet({
      equipmentSlots: {},
      standTier: "corrupted",
      unlockedRegions: [],
      onSlayerTask: true,
      style: "melee",
    });
    expect(standOnly.active).toBe(false);
    expect(standOnly.damageMult).toBe(1);
  });
});

describe("slayerHelmetDamageModifier", () => {
  it("applies on direct hits only", () => {
    const r = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      onSlayerTask: true,
      style: "melee",
    });
    const mod = slayerHelmetDamageModifier(r)!;
    expect(mod).toBeTruthy();
    expect(
      runPipeline({ damage: 1000 }, [mod], { style: "melee", damageSource: "direct" }).damage,
    ).toBe(mulFloor(1000, 1.075));
    expect(
      runPipeline({ damage: 1000 }, [mod], {
        style: "melee",
        damageSource: "dot",
        dotKind: "bleed",
      }).damage,
    ).toBe(1000);
    expect(
      runPipeline({ damage: 1000 }, [mod], { style: "melee", damageSource: "conjure" }).damage,
    ).toBe(1000);
    expect(
      runPipeline({ damage: 1000 }, [mod], { style: "melee", damageSource: "command" }).damage,
    ).toBe(1000);
  });
});
