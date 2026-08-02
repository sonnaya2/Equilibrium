import { beforeEach, describe, expect, it } from "vitest";
import type { EquipmentRecord } from "../data/records";
import {
  aggregateEquipmentStats,
  classArmourTier,
  classDamageTier,
  defenderArmourValue,
  defenderDamageValue,
  equipmentArmourValue,
  equipmentDamageValue,
  equipmentLifeValue,
  equipmentTierBase,
  floorOneDecimal,
  shieldLifeValue,
} from "./equipmentStats";

// Anchors are documented item values: rune t50 set, level-60 torso examples,
// t90 kiteshield/defender infoboxes, and the wiki Armour/Equipment tier tables.

describe("equipmentTierBase", () => {
  it("matches the documented tier base f(t) = t³/500 + 10t + 100", () => {
    expect(equipmentTierBase(50)).toBe(850);
    expect(equipmentTierBase(60)).toBe(1132);
    expect(equipmentTierBase(90)).toBe(2458);
  });
});

describe("floorOneDecimal", () => {
  it("floors toward zero at the first decimal, never rounds", () => {
    expect(floorOneDecimal(168.4175)).toBe(168.4);
    expect(floorOneDecimal(226.0325)).toBe(226);
    expect(floorOneDecimal(260.36)).toBe(260.3);
  });

  it("holds exact decimal boundaries despite binary representation error", () => {
    expect(floorOneDecimal(0.2 * 850)).toBe(170);
    expect(floorOneDecimal(0.03 * 850)).toBe(25.5);
    expect(floorOneDecimal(0.05 * 850)).toBe(42.5);
  });
});

describe("equipmentArmourValue", () => {
  it("applies the slot multipliers (rune t50 tank set)", () => {
    expect(equipmentArmourValue("helmet", 50, "tank")).toBe(170);
    expect(equipmentArmourValue("body", 50, "tank")).toBe(195.5);
    expect(equipmentArmourValue("legs", 50, "tank")).toBe(187);
    expect(equipmentArmourValue("gloves", 50, "tank")).toBe(42.5);
    expect(equipmentArmourValue("boots", 50, "tank")).toBe(42.5);
    expect(equipmentArmourValue("cape", 50, "tank")).toBe(25.5);
    expect(equipmentArmourValue("ring", 50, "tank")).toBe(17);
  });

  it("adjusts the armour tier by class: tank t, power t−5, hybrid t−15", () => {
    // Documented level-60 torso example: tank 260, power 226, hybrid 168.
    expect(equipmentArmourValue("body", 60, "tank")).toBe(260.3);
    expect(equipmentArmourValue("body", 60, "power")).toBe(226);
    expect(equipmentArmourValue("body", 60, "hybrid")).toBe(168.4);
    expect(classArmourTier(80, "power")).toBe(75);
    expect(classArmourTier(80, "pvp")).toBe(80);
  });

  it("honours an explicit armourTier over the class-adjusted tier", () => {
    // Rune chainbody: 50 Defence requirement, treated as a tier-48 item.
    expect(equipmentArmourValue("body", 50, "tank", { armourTier: 48 })).toBe(
      floorOneDecimal(0.23 * equipmentTierBase(48)),
    );
  });

  it("returns null for slots with no Armour stat and unusable effective tiers", () => {
    expect(equipmentArmourValue("amulet", 90, "power")).toBeNull();
    expect(equipmentArmourValue("pocket", 90, "power")).toBeNull();
    expect(equipmentArmourValue("mainhand", 90, "power")).toBeNull();
    expect(equipmentArmourValue("body", 10, "hybrid")).toBeNull();
  });
});

describe("shield armour", () => {
  it("uses the head multiplier via the shield flag (t90 kiteshield 491.6)", () => {
    expect(equipmentArmourValue("offhand", 90, "tank", { shield: true })).toBe(491.6);
    expect(equipmentArmourValue("offhand", 50, "tank", { shield: true })).toBe(170);
  });

  it("keeps non-shield off-hands at no Armour stat", () => {
    expect(equipmentArmourValue("offhand", 90, "tank")).toBeNull();
  });
});

describe("defenderArmourValue", () => {
  it("is 0.1 × f(t) at full tier (rune 85.0, kalphite 245.8)", () => {
    expect(defenderArmourValue(50)).toBe(85);
    expect(defenderArmourValue(90)).toBe(245.8);
  });
});

describe("equipmentLifeValue", () => {
  it("derives tank life per slot (t90: 900/1350/1350/450/450)", () => {
    expect(equipmentLifeValue("helmet", 90, "tank")).toBe(900);
    expect(equipmentLifeValue("body", 90, "tank")).toBe(1350);
    expect(equipmentLifeValue("legs", 90, "tank")).toBe(1350);
    expect(equipmentLifeValue("gloves", 90, "tank")).toBe(450);
    expect(equipmentLifeValue("boots", 90, "tank")).toBe(450);
  });

  it("gives power armour no life unless an explicit lifeTier marks an exception", () => {
    expect(equipmentLifeValue("body", 92, "power")).toBe(0);
    // Torva platebody: t80 power with LP at t75.
    expect(equipmentLifeValue("body", 80, "power", { lifeTier: 75 })).toBe(1125);
    // Masterwork magic robe top: t100 power with LP at t95.
    expect(equipmentLifeValue("body", 100, "power", { lifeTier: 95 })).toBe(1425);
  });

  it("gives hybrid and PvP armour no life", () => {
    expect(equipmentLifeValue("body", 70, "hybrid")).toBe(0);
    expect(equipmentLifeValue("body", 65, "pvp")).toBe(0);
  });

  it("returns null for slots with no Life stat", () => {
    expect(equipmentLifeValue("amulet", 90, "tank")).toBeNull();
    expect(equipmentLifeValue("ring", 90, "tank")).toBeNull();
  });
});

describe("shieldLifeValue", () => {
  it("is zero below tier 70 and 35 × (t−69) at tier 70+", () => {
    expect(shieldLifeValue(69)).toBe(0);
    expect(shieldLifeValue(70)).toBe(35);
    expect(shieldLifeValue(90)).toBe(735);
    expect(shieldLifeValue(99)).toBe(1050);
  });

  it("applies through equipmentLifeValue via the shield flag", () => {
    expect(equipmentLifeValue("offhand", 69, "tank", { shield: true })).toBe(0);
    expect(equipmentLifeValue("offhand", 90, "tank", { shield: true })).toBe(735);
  });
});

describe("equipmentDamageValue", () => {
  it("applies the normalised slot multipliers per item (post 9 Mar 2026 values)", () => {
    // Tectonic mask t90; Torva platebody t80; elite tectonic mask t92.
    expect(equipmentDamageValue("helmet", 90)).toBe(22.5);
    expect(equipmentDamageValue("body", 80)).toBe(30);
    expect(equipmentDamageValue("helmet", 92)).toBe(23);
    // Vestments of havoc robe top: damage tier 110 on a t95-requirement item.
    expect(equipmentDamageValue("body", 110)).toBe(41.2);
  });

  it("covers jewellery, cape and pocket slots (Amulet of souls, Reaver's ring, Kal-Zuk, grimoire)", () => {
    expect(equipmentDamageValue("amulet", 84)).toBe(48.3);
    expect(equipmentDamageValue("ring", 88)).toBe(33);
    expect(equipmentDamageValue("cape", 99)).toBe(37.1);
    expect(equipmentDamageValue("pocket", 95)).toBe(14.8);
  });

  it("floors to one decimal per item (t40 gloves 6.25 → 6.2)", () => {
    expect(equipmentDamageValue("gloves", 40)).toBe(6.2);
    expect(equipmentDamageValue("boots", 92)).toBe(14.3);
  });

  it("restricts the ammo multiplier to melee ammo-harness items (Nodon spike harness 24.1)", () => {
    expect(equipmentDamageValue("ammo", 90)).toBeNull();
    expect(equipmentDamageValue("ammo", 90, { meleeAmmoHarness: true })).toBe(24.1);
  });

  it("gives weapon slots no damage bonus — weapon damage is tier-encoded", () => {
    expect(equipmentDamageValue("mainhand", 90)).toBeNull();
    expect(equipmentDamageValue("twohand", 90)).toBeNull();
    expect(equipmentDamageValue("offhand", 90)).toBeNull();
  });

  it("gates the damage tier by class: power and PvP at full tier, tank and hybrid none", () => {
    expect(classDamageTier(80, "power")).toBe(80);
    expect(classDamageTier(80, "pvp")).toBe(80);
    expect(classDamageTier(80, "tank")).toBeNull();
    expect(classDamageTier(80, "hybrid")).toBeNull();
  });
});

describe("defenderDamageValue", () => {
  it("is an off-hand fastest weapon of half tier (rune 120.0, dragon 144.0, kalphite 216.0)", () => {
    expect(defenderDamageValue(50)).toBe(120);
    expect(defenderDamageValue(60)).toBe(144);
    expect(defenderDamageValue(90)).toBe(216);
  });
});

describe("aggregateEquipmentStats", () => {
  const records = new Map<string, EquipmentRecord>();
  const add = (record: EquipmentRecord) => records.set(record.id, record);
  const resolve = (id: string) => records.get(id);
  const base = { id: "", name: "", sources: [], bonuses: {} };

  beforeEach(() => records.clear());

  it("sums exact bonuses and derives missing ones by formula", () => {
    add({ ...base, id: "item:h", slot: "helmet", tier: 80, style: "melee", armourClass: "power" });
    add({ ...base, id: "item:b", slot: "body", tier: 80, style: "melee", armourClass: "power" });
    add({ ...base, id: "item:l", slot: "legs", tier: 90, style: "melee", armourClass: "tank" });
    const totals = aggregateEquipmentStats(
      { style: "melee", equipmentSlots: { helmet: "item:h", body: "item:b", legs: "item:l" } },
      resolve,
    );
    // f(75) = 1693.75: helm 0.2× = 338.7, body 0.23× = 389.5; tank legs 0.22×f(90) = 540.7.
    expect(totals.armour).toBeCloseTo(338.7 + 389.5 + 540.7, 5);
    expect(totals.damage).toBeCloseTo(20 + 30, 5); // power at full tier; tank none
    expect(totals.life).toBe(1350); // power 0 without lifeTier; tank 15×90
    expect(totals.incomplete).toEqual([]);
  });

  it("lets an exact sourced bonus override the formula-derived value", () => {
    add({
      ...base,
      id: "item:h",
      slot: "helmet",
      tier: 80,
      armourClass: "power",
      bonuses: { armour: 999 },
    });
    const totals = aggregateEquipmentStats(
      { style: "melee", equipmentSlots: { helmet: "item:h" } },
      resolve,
    );
    expect(totals.armour).toBe(999);
  });

  it("resolves shields and defenders through their own rules", () => {
    add({
      ...base,
      id: "item:s",
      slot: "offhand",
      tier: 90,
      style: "melee",
      armourClass: "tank",
      shield: true,
    });
    add({
      ...base,
      id: "item:d",
      slot: "offhand",
      tier: 90,
      style: "melee",
      defender: true,
      bonuses: { accuracy: 2458 },
    });
    const shield = aggregateEquipmentStats(
      { style: "melee", equipmentSlots: { offhand: "item:s" } },
      resolve,
    );
    expect(shield.armour).toBe(491.6);
    expect(shield.life).toBe(735);
    const defender = aggregateEquipmentStats(
      { style: "melee", equipmentSlots: { offhand: "item:d" } },
      resolve,
    );
    expect(defender.armour).toBe(245.8);
    expect(defender.damage).toBe(216);
    expect(defender.life).toBe(0);
    expect(defender.displayedAccuracy).toBe(2458);
    expect(defender.appliedAccuracy).toBe(0); // weapon-slot accuracy is tier-encoded
  });

  it("flags missing metadata instead of inventing values", () => {
    add({ ...base, id: "item:b", slot: "body", tier: 80 });
    add({ ...base, id: "item:r", slot: "ring", tier: 88, bonuses: {} });
    const totals = aggregateEquipmentStats(
      { style: "melee", equipmentSlots: { body: "item:b", ring: "item:r" } },
      resolve,
    );
    expect(totals.incomplete).toEqual(
      expect.arrayContaining([
        { id: "item:b", stat: "armour", reason: "missing-armourClass" },
        { id: "item:b", stat: "life", reason: "missing-armourClass" },
        { id: "item:b", stat: "damage", reason: "missing-armourClass" },
      ]),
    );
    expect(totals.incomplete).toHaveLength(3);
    // A ring is not class-gated: armour derives at raw tier (0.02 × f(88)),
    // and its damage/life absence is a silent zero.
    expect(totals.armour).toBeCloseTo(46.8, 5);
    expect(totals.damage).toBe(0);
    expect(totals.life).toBe(0);
  });

  it("flags records the catalogue cannot resolve", () => {
    const totals = aggregateEquipmentStats(
      { style: "melee", equipmentSlots: { helmet: "item:gone" } },
      resolve,
    );
    expect(totals.incomplete).toEqual([
      { id: "item:gone", stat: "armour", reason: "missing-record" },
    ]);
  });

  it("counts duplicate item ids once and ignores unlock pins", () => {
    add({
      ...base,
      id: "item:a",
      slot: "amulet",
      tier: 90,
      style: "hybrid",
      bonuses: { prayer: 5 },
    });
    const totals = aggregateEquipmentStats(
      {
        style: "melee",
        equipmentSlots: { amulet: "item:a" },
        equipmentIds: ["item:a", "item:pinned"],
      },
      resolve,
    );
    expect(totals.prayer).toBe(5);
    expect(totals.incomplete).toEqual([]);
  });

  it("locks mainhand/offhand out when a two-handed weapon is equipped", () => {
    add({
      ...base,
      id: "item:2h",
      slot: "twohand",
      tier: 90,
      style: "melee",
      bonuses: { accuracy: 2458 },
    });
    add({ ...base, id: "item:oh", slot: "offhand", tier: 90, style: "melee", defender: true });
    const totals = aggregateEquipmentStats(
      { style: "melee", equipmentSlots: { twohand: "item:2h", offhand: "item:oh" } },
      resolve,
    );
    expect(totals.armour).toBe(0); // defender ignored with the twohand equipped
    expect(totals.displayedAccuracy).toBe(2458);
  });

  it("keeps weapon accuracy out of the applied term but in the displayed total", () => {
    add({
      ...base,
      id: "item:mh",
      slot: "mainhand",
      tier: 90,
      style: "melee",
      bonuses: { accuracy: 2458 },
    });
    add({
      ...base,
      id: "item:ring",
      slot: "ring",
      tier: 88,
      style: "melee",
      bonuses: { accuracy: 300 },
    });
    const totals = aggregateEquipmentStats(
      { style: "melee", equipmentSlots: { mainhand: "item:mh", ring: "item:ring" } },
      resolve,
    );
    expect(totals.displayedAccuracy).toBe(2758);
    expect(totals.appliedAccuracy).toBe(300);
  });

  it("aggregates prayer and direct crit chance regardless of style matching", () => {
    add({
      ...base,
      id: "item:p1",
      slot: "body",
      tier: 80,
      style: "ranged",
      armourClass: "power",
      bonuses: { prayer: 3 },
    });
    add({
      ...base,
      id: "item:p2",
      slot: "amulet",
      tier: 90,
      style: "hybrid",
      bonuses: { prayer: 4, critChance: 0.02 },
    });
    const totals = aggregateEquipmentStats(
      { style: "melee", equipmentSlots: { body: "item:p1", amulet: "item:p2" } },
      resolve,
    );
    expect(totals.prayer).toBe(7);
    expect(totals.critChance).toBeCloseTo(0.02);
    // Ranged armour still counts armour/life for a melee loadout, but not damage.
    expect(totals.armour).toBeCloseTo(389.5, 5);
    expect(totals.damage).toBe(0);
  });
});
