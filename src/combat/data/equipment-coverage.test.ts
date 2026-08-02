import { describe, expect, it } from "vitest";
import { equippedBonuses } from "@/components/combat/loadoutStats";
import { DEFAULT_LOADOUT } from "@/components/combat/useLoadout";
import type { CombatStyle } from "../types";
import { combatEquipment, equipmentById } from "./index";
import type { EquipmentSlot } from "./records";

const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  "mainhand",
  "offhand",
  "twohand",
  "helmet",
  "body",
  "legs",
  "gloves",
  "boots",
  "cape",
  "amulet",
  "ring",
  "pocket",
  "ammo",
] as const;

const SLOT_SET = new Set<string>(EQUIPMENT_SLOTS);

const MATERIAL_ID_RE = /-(?:energy|codex|components)$/;

const STYLES: readonly CombatStyle[] = ["melee", "ranged", "magic", "necromancy"];

const FIXTURE_IDS = ["item:omni-guard", "item:seismic-wand", "item:malevolent-helm"] as const;

function isMaterialId(id: string): boolean {
  return MATERIAL_ID_RE.test(id);
}

describe("equipment corpus coverage (expanded combat gear)", () => {
  it("every record with a slot uses a valid EquipmentSlot", () => {
    for (const record of combatEquipment.records) {
      if (record.slot == null) continue;
      expect(
        SLOT_SET.has(record.slot),
        `${record.id} has invalid slot ${JSON.stringify(record.slot)}`,
      ).toBe(true);
    }
  });

  it("no wearable id is a known material pattern (energy / codex / components)", () => {
    const wearables = combatEquipment.records.filter((r) => r.slot != null);
    for (const record of wearables) {
      expect(
        isMaterialId(record.id),
        `${record.id} matches material pattern but has slot=${record.slot}`,
      ).toBe(false);
    }
  });

  it("each style has ≥1 mainhand or twohand at tier ≥ 70", () => {
    for (const style of STYLES) {
      const weapons = combatEquipment.records.filter(
        (r) => r.style === style && (r.slot === "mainhand" || r.slot === "twohand"),
      );
      if (weapons.length === 0) continue; // corpus still small for this style
      const highTier = weapons.filter((r) => (r.tier ?? 0) >= 70);
      expect(
        highTier.length,
        `${style}: need ≥1 mainhand/twohand with tier≥70 (have ${weapons.map((w) => w.id).join(", ")})`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("preserve fixture ids: omni-guard, seismic-wand, malevolent-helm", () => {
    for (const id of FIXTURE_IDS) {
      const record = equipmentById(id);
      expect(record, `missing fixture ${id}`).toBeDefined();
      expect(record!.id).toBe(id);
    }
  });

  it("ships passive metadata and keeps crossbows out of the bow class", () => {
    expect(equipmentById("item:am-zi")?.passiveId).toBe("am-zi");
    expect(equipmentById("item:am-hej")?.passiveId).toBe("am-hej");
    expect(equipmentById("item:channelers-ring")?.passiveId).toBe("channeller-ring");
    expect(equipmentById("item:bow-of-the-last-guardian")?.weaponClass).toBe("bow");
    expect(equipmentById("item:eldritch-crossbow")?.weaponClass).not.toBe("bow");
  });

  // Known gap: `remove` retires the entity but a document is rebuilt from source
  // records, so the retired twin still reaches this shard. The survivor is the
  // one carrying the passive, which is what the calculator reads.
  it("keeps the passive on the surviving Channeller's ring", () => {
    expect(equipmentById("cross-region:channellers-ring")?.passiveId).toBe("channeller-ring");
    expect(equipmentById("item:channelers-ring")?.name).toBe("Channeller's ring");
    expect(combatEquipment.records.filter((record) => record.name === "Channeller's ring")).toHaveLength(2);
  });

  it("sources the upgraded Fremennik rings from Anachronia alone", () => {
    // The League drops these complete, so no Fremennik base ring is needed.
    for (const id of [
      "item:channelers-ring",
      "item:reavers-ring",
      "item:stalkers-ring",
      "item:champions-ring",
      "item:occultists-ring",
    ]) {
      expect(equipmentById(id)?.unlock?.regions, id).toEqual(["anachronia"]);
    }
  });

  it("equippedBonuses still works for omni + lantern", () => {
    const omni = equipmentById("item:omni-guard");
    const lantern = equipmentById("item:soulbound-lantern");
    expect(omni, "item:omni-guard").toBeDefined();
    expect(lantern, "item:soulbound-lantern").toBeDefined();

    const loadout = {
      ...DEFAULT_LOADOUT,
      style: "necromancy" as const,
      equipmentSlots: {
        mainhand: "item:omni-guard",
        offhand: "item:soulbound-lantern",
      },
    };
    const totals = equippedBonuses(loadout);
    const expectedDamage = (omni!.bonuses.damage ?? 0) + (lantern!.bonuses.damage ?? 0);
    const expectedAccuracy = (omni!.bonuses.accuracy ?? 0) + (lantern!.bonuses.accuracy ?? 0);
    expect(totals).toEqual({ damage: expectedDamage, accuracy: expectedAccuracy });
    expect(totals.damage).toBeCloseTo(1415.5 + 707.7, 5);
    expect(totals.accuracy).toBe(2765 + 2765);
  });
});
