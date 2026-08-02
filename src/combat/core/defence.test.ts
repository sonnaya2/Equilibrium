import { describe, expect, it } from "vitest";
import type { EquipmentRecord } from "../data/records";
import { aggregateEquipmentStats } from "../shared/equipmentStats";
import { defenceStats } from "./defence";

// Reference values from f(x) = x³/1250 + 4x + 40 (wiki Hit chance / Defence):
// f(99) = 1212.2392, f(120) = 1902.4, f(126) = 2144.3008.

describe("defenceStats", () => {
  it("keeps equipment Armour and total Armour rating separate", () => {
    const stats = defenceStats({ baseLevel: 99, equipmentArmour: 1217.5 });
    expect(stats.equipmentArmour).toBe(1217.5);
    expect(stats.levelArmour).toBeCloseTo(1212.2392);
    expect(stats.totalArmour).toBe(Math.floor(1217.5 + 1212.2392));
    expect(stats.totalArmour).toBe(2429);
  });

  it("floors the total, not the level-derived term", () => {
    // f(99) = 1212.2392: flooring the term first would give 1212 + 0.8 = 1212.8 → 1212,
    // the sourced chain floors the sum: floor(0.8 + 1212.2392) = 1213.
    expect(defenceStats({ baseLevel: 99, equipmentArmour: 0.8 }).totalArmour).toBe(1213);
  });

  it("stacks boost layers in order: base → potion → prayer block levels", () => {
    const base = defenceStats({ baseLevel: 99 });
    expect(base.potionBoost).toBe(0);
    expect(base.visibleLevel).toBe(99);
    expect(base.blockLevel).toBe(99);

    const overloaded = defenceStats({ baseLevel: 99, overloadTier: "overload" });
    expect(overloaded.potionBoost).toBe(Math.floor(99 * 0.15) + 3);
    expect(overloaded.visibleLevel).toBe(116);

    const prayed = defenceStats({
      baseLevel: 99,
      overloadTier: "overload",
      prayerBlockLevels: 10,
    });
    expect(prayed.visibleLevel).toBe(116);
    expect(prayed.blockLevel).toBe(126);
    expect(prayed.levelArmour).toBeCloseTo(2144.3008);
    expect(prayed.totalArmour).toBe(2144);
  });

  it("boosts Defence with elder overloads (17% + 5)", () => {
    const stats = defenceStats({ baseLevel: 99, overloadTier: "elder" });
    expect(stats.potionBoost).toBe(21);
    expect(stats.visibleLevel).toBe(120);
    expect(stats.totalArmour).toBe(1902);
  });

  it("matches the documented level-1 and level-120 reference values", () => {
    expect(defenceStats({ baseLevel: 1 }).totalArmour).toBe(44);
    expect(defenceStats({ baseLevel: 120 }).totalArmour).toBe(1902);
  });

  it("has no Prayer-bonus input: only block levels and equipment Armour feed the rating", () => {
    // Equipment Prayer bonus lowers prayer drain only; the model's armour inputs
    // are exactly equipmentArmour and the block-calculation level.
    const stats = defenceStats({ baseLevel: 90, prayerBlockLevels: 8, equipmentArmour: 500 });
    expect(stats.totalArmour).toBe(
      Math.floor(500 + (stats.blockLevel ** 3) / 1250 + 4 * stats.blockLevel + 40),
    );
  });

  it("keeps aggregated Prayer bonus out of the Armour rating end to end", () => {
    const record: EquipmentRecord = {
      id: "item:b",
      name: "",
      sources: [],
      slot: "body",
      tier: 80,
      style: "melee",
      armourClass: "power",
      bonuses: { prayer: 42 },
    };
    const totals = aggregateEquipmentStats(
      { style: "melee", equipmentSlots: { body: "item:b" } },
      (id) => (id === record.id ? record : undefined),
    );
    expect(totals.prayer).toBe(42);
    const stats = defenceStats({ baseLevel: 99, equipmentArmour: totals.armour });
    expect(stats.totalArmour).toBe(Math.floor(totals.armour + stats.levelArmour));
  });

  it("rejects invalid inputs", () => {
    expect(() => defenceStats({ baseLevel: 0 })).toThrow(RangeError);
    expect(() => defenceStats({ baseLevel: Number.NaN })).toThrow(RangeError);
    expect(() => defenceStats({ baseLevel: 99, prayerBlockLevels: -1 })).toThrow(RangeError);
    expect(() => defenceStats({ baseLevel: 99, equipmentArmour: -0.1 })).toThrow(RangeError);
  });
});
