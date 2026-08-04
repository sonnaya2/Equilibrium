import { describe, expect, it } from "vitest";
import { equipmentById } from "@/combat/data";
import { equipmentRecordDamage, aggregateEquipmentStats } from "@/combat/shared/equipmentStats";
import { equipmentStyleDamageBonus } from "@/components/combat/loadout/weaponConfiguration";
import { loadoutStats } from "@/components/combat/loadoutStats";
import { DEFAULT_LOADOUT } from "@/components/combat/loadout/model";
import { equippedPassiveSummaries } from "@/combat/shared/equipment";
import { RING_OF_VIGOUR_ITEM_ID } from "@/combat/shared/ringOfVigour";

describe("Ring of vigour equipment", () => {
  const rec = equipmentById(RING_OF_VIGOUR_ITEM_ID)!;

  it("catalogue damage is wiki 16.8 hybrid style", () => {
    expect(rec).toBeTruthy();
    expect(rec.bonuses.damage).toBe(16.8);
    expect(rec.style).toBe("hybrid");
    expect(equipmentRecordDamage(rec)).toBe(16.8);
  });

  it("contributes 16.8 style damage on every combat style", () => {
    for (const style of ["melee", "ranged", "magic", "necromancy"] as const) {
      const loadout = {
        ...DEFAULT_LOADOUT,
        style,
        equipmentSlots: { ring: RING_OF_VIGOUR_ITEM_ID },
      };
      expect(equipmentStyleDamageBonus(loadout), style).toBe(16.8);
      const agg = aggregateEquipmentStats(loadout, equipmentById);
      expect(agg.damage, style).toBe(16.8);
    }
  });

  it("catalogue attaches passiveId ring-of-vigour", () => {
    expect(rec.passiveId).toBe("ring-of-vigour");
  });

  it("appears in Gear passives when equipped (catalogue-driven, not item-id special case)", () => {
    const rows = equippedPassiveSummaries({
      style: "melee",
      equipmentSlots: { ring: RING_OF_VIGOUR_ITEM_ID },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      passiveId: "ring-of-vigour",
      itemId: RING_OF_VIGOUR_ITEM_ID,
      label: "Ring of Vigour",
      support: "modeled",
    });
    expect(rows[0]!.effects.some((e) => /adrenaline/i.test(e))).toBe(true);
  });

  it("loadoutStats folds ring damage into equipment style damage", () => {
    const bare = loadoutStats({ ...DEFAULT_LOADOUT, style: "melee" });
    const withRing = loadoutStats({
      ...DEFAULT_LOADOUT,
      style: "melee",
      equipmentSlots: { ring: RING_OF_VIGOUR_ITEM_ID },
    });
    expect(withRing.equipmentStyleDamageBonus - bare.equipmentStyleDamageBonus).toBeCloseTo(16.8, 5);
  });
});
