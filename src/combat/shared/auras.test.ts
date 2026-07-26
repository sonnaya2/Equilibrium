import { describe, expect, it } from "vitest";
import { runPipeline } from "../pipeline/modifierPipeline";
import {
  COMBAT_AURAS,
  auraBlocksCrits,
  auraByEquipmentId,
  auraDamageModifier,
  auraDamageModifiers,
  auraStyleMatches,
  equippedAura,
} from "./auras";

describe("combat auras (historical catalogue)", () => {
  it("documents the equipment.json aura slot set with wiki sources", () => {
    const expected = [
      "item:berserker-aura",
      "item:reckless-aura",
      "item:maniacal-aura",
      "item:mahjarrat-aura",
      "item:equilibrium-aura",
      "item:dark-magic-aura",
      "item:vampyrism-aura",
    ];
    expect(COMBAT_AURAS.map((a) => a.equipmentId).sort()).toEqual([...expected].sort());
    for (const a of COMBAT_AURAS) {
      expect(a.status).toBe("removed");
      expect(a.sources.length).toBeGreaterThan(0);
      expect(a.sources[0].url).toContain("runescape.wiki");
      expect(a.sources[0].verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("Berserker: +10% melee damage, +10% accuracy (wiki last live)", () => {
    const def = auraByEquipmentId("item:berserker-aura");
    expect(def).toMatchObject({
      style: "melee",
      damageBonus: 0.1,
      accuracyBonus: 0.1,
      styleLevelBoostPercent: 0.1,
      defenceLevelReductionPercent: 0.15,
      damageTakenIncrease: 0.15,
      preventsCriticalStrikes: false,
      removedAt: "2026-03-02",
    });
    const mod = auraDamageModifier(def!);
    expect(mod).not.toBeNull();
    expect(runPipeline({ damage: 1000 }, [mod!], { style: "melee" }).damage).toBe(1100);
    expect(runPipeline({ damage: 1000 }, [mod!], { style: "magic" }).damage).toBe(1000);
  });

  it("Reckless / Maniacal mirror Berserker for ranged / magic", () => {
    expect(auraByEquipmentId("item:reckless-aura")).toMatchObject({
      style: "ranged",
      damageBonus: 0.1,
      accuracyBonus: 0.1,
    });
    expect(auraByEquipmentId("item:maniacal-aura")).toMatchObject({
      style: "magic",
      damageBonus: 0.1,
      accuracyBonus: 0.1,
    });
  });

  it("Mahjarrat: hybrid +5% damage, style-agnostic", () => {
    const def = auraByEquipmentId("item:mahjarrat-aura")!;
    expect(def.damageBonus).toBe(0.05);
    expect(auraStyleMatches(def, "melee")).toBe(true);
    expect(auraStyleMatches(def, "necromancy")).toBe(true);
    const mod = auraDamageModifier(def)!;
    expect(runPipeline({ damage: 1000 }, [mod], { style: "ranged" }).damage).toBe(1050);
  });

  it("Equilibrium aura: +12% AD, blocks crits", () => {
    const def = auraByEquipmentId("item:equilibrium-aura")!;
    expect(def).toMatchObject({
      damageBonus: 0.12,
      preventsCriticalStrikes: true,
      style: "hybrid",
    });
    const mod = auraDamageModifier(def)!;
    expect(runPipeline({ damage: 1000 }, [mod], { style: "necromancy" }).damage).toBe(1120);
    expect(
      auraBlocksCrits({ equipmentSlots: { aura: "item:equilibrium-aura" } }),
    ).toBe(true);
  });

  it("Dark magic and Vampyrism have no static damage mult", () => {
    expect(auraDamageModifier(auraByEquipmentId("item:dark-magic-aura")!)).toBeNull();
    expect(auraDamageModifier(auraByEquipmentId("item:vampyrism-aura")!)).toBeNull();
    expect(auraByEquipmentId("item:vampyrism-aura")).toMatchObject({
      lifestealPercent: 0.05,
      lifestealCapPerHit: 50,
      removedAt: "2026-04-13",
    });
  });

  it("loadout helpers read equipmentSlots.aura", () => {
    const loadout = { equipmentSlots: { aura: "item:berserker-aura" } };
    expect(equippedAura(loadout)?.id).toBe("aura:berserker");
    expect(auraDamageModifiers(loadout)).toHaveLength(1);
    expect(auraDamageModifiers({ equipmentSlots: {} })).toEqual([]);
    expect(auraBlocksCrits({ equipmentSlots: { aura: "item:berserker-aura" } })).toBe(false);
  });
});
