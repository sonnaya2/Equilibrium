import { describe, expect, it } from "vitest";
import { equipmentById } from "./index";
import {
  activeEquipmentEffects,
  equippedPassiveSummaries,
  hasPassive,
  resolvedEquipmentSlots,
} from "../shared/equipment";
import { aggregateLoadoutEquipment } from "../shared/equipmentStats";

describe("Spear of Annihilation equipment records", () => {
  const soa = () => equipmentById("item:spear-of-annihilation");
  const mwsoa = () => equipmentById("item:masterwork-spear-of-annihilation");

  it("resolves both spears as two-handed melee at the sourced tiers", () => {
    expect(soa()).toMatchObject({
      id: "item:spear-of-annihilation",
      name: "Spear of Annihilation",
      slot: "twohand",
      style: "melee",
      tier: 90,
    });
    expect(mwsoa()).toMatchObject({
      id: "item:masterwork-spear-of-annihilation",
      name: "Masterwork Spear of Annihilation",
      slot: "twohand",
      style: "melee",
      tier: 92,
    });
  });

  it("keeps the ordinary spear passive-free and wires only Masterwork", () => {
    expect(soa()?.passiveId).toBeUndefined();
    expect(mwsoa()?.passiveId).toBe("masterwork-spear-bleed-extension");
    expect(soa()?.setId).toBeUndefined();
    expect(mwsoa()?.setId).toBeUndefined();
  });

  it("stores wiki face accuracy and tooltip damage for gear display (tier still drives AD)", () => {
    expect(soa()?.bonuses).toMatchObject({ accuracy: 2458, damage: 2011.5 });
    expect(mwsoa()?.bonuses).toMatchObject({ accuracy: 2577, damage: 2056.2 });
    // Weapons do not contribute style-damage equipment totals - face dmg is display only.
    for (const id of ["item:spear-of-annihilation", "item:masterwork-spear-of-annihilation"] as const) {
      const r = equipmentById(id)!;
      expect(r.bonuses.armour, id).toBeUndefined();
      expect(r.bonuses.life, id).toBeUndefined();
      expect(r.bonuses.prayer, id).toBeUndefined();
      expect(r.bonuses.critChance, id).toBeUndefined();
    }
  });

  it("masks stale main-hand and off-hand when either spear is equipped", () => {
    for (const twohand of [
      "item:spear-of-annihilation",
      "item:masterwork-spear-of-annihilation",
    ] as const) {
      const slots = resolvedEquipmentSlots({
        equipmentSlots: {
          twohand,
          mainhand: "item:drygore-longsword",
          offhand: "item:drygore-mace",
        },
      });
      expect(slots.twohand).toBe(twohand);
      expect(slots.mainhand).toBeUndefined();
      expect(slots.offhand).toBeUndefined();
    }
  });

  it("activates the bleed-extension passive only while the Masterwork spear is equipped", () => {
    const withMw = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { twohand: "item:masterwork-spear-of-annihilation" },
    });
    const withSoa = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { twohand: "item:spear-of-annihilation" },
    });
    const bare = activeEquipmentEffects({ style: "melee", equipmentSlots: {} });
    expect(hasPassive(withMw, "masterwork-spear-bleed-extension")).toBe(true);
    expect(hasPassive(withSoa, "masterwork-spear-bleed-extension")).toBe(false);
    expect(hasPassive(bare, "masterwork-spear-bleed-extension")).toBe(false);

    const rows = equippedPassiveSummaries({
      style: "melee",
      equipmentSlots: { twohand: "item:masterwork-spear-of-annihilation" },
    });
    expect(rows.some((r) => r.passiveId === "masterwork-spear-bleed-extension")).toBe(true);
    expect(rows.find((r) => r.passiveId === "masterwork-spear-bleed-extension")?.support).toBe(
      "modeled",
    );
  });

  it("weapon tier drives loadout stats; spears add no equipment style damage", () => {
    const totals = aggregateLoadoutEquipment({
      style: "melee",
      equipmentSlots: { twohand: "item:masterwork-spear-of-annihilation" },
    });
    expect(totals.damage).toBe(0);
    // Weapon accuracy is display-only (not appliedAccuracy for weapons).
    expect(totals.appliedAccuracy).toBe(0);
    expect(totals.displayedAccuracy).toBe(2577);
  });
});
