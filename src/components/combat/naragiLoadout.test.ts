import { describe, expect, it } from "vitest";
import { equipmentById } from "@/combat/data";
import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import {
  NARAGI_EDICT_RELIC,
  NARAGI_LEVEL_OVERRIDE,
  SLIVER_OF_EDICTS_ID,
  SLIVER_PASSIVE,
} from "@/combat/league/naragiEdict";
import {
  AVERNIC_STAR_ID,
  INFERNAL_FIRE_RELIC,
  stripUnavailableRelicItems,
} from "@/combat/league/relicGrantedItems";
import {
  DEFAULT_LOADOUT,
  equipGrantedItemForRelic,
  equipInSlot,
  syncRelicGrantedEquipment,
  syncRelicGrantedEquipmentWithAutoEquip,
  type Loadout,
} from "./useLoadout";
import { loadoutStats } from "./loadoutStats";
import { computedLoadoutBase, loadoutWeaponConfig } from "./loadout/weaponConfiguration";
import { naragiBaseDamageCompare } from "./toResolvedCombatModel";

const RELICS = [NARAGI_EDICT_RELIC] as const;

function of(
  loadout: Partial<Loadout> = {},
  relics: readonly string[] = [],
): ReturnType<typeof loadoutStats> {
  return loadoutStats(
    {
      ...DEFAULT_LOADOUT,
      ...loadout,
      equipmentSlots: loadout.equipmentSlots ?? {},
      buffs: { ...DEFAULT_LOADOUT.buffs, ...loadout.buffs },
      perks: { ...DEFAULT_LOADOUT.perks, ...loadout.perks },
    },
    { ruleset: "equilibrium", relics: [...relics] },
  );
}

describe("Sliver of Edicts catalogue", () => {
  it("exists as hybrid pocket with face passives", () => {
    const sliver = equipmentById(SLIVER_OF_EDICTS_ID);
    expect(sliver, "Sliver missing; run npm run data:rebuild").toBeDefined();
    expect(sliver!.slot).toBe("pocket");
    expect(sliver!.style).toBe("hybrid");
    expect(sliver!.bonuses.armour).toBe(SLIVER_PASSIVE.armour);
    expect(sliver!.bonuses.damage).toBe(SLIVER_PASSIVE.styleDamage);
    expect(sliver!.bonuses.life).toBe(SLIVER_PASSIVE.life);
    expect(sliver!.bonuses.prayer).toBe(SLIVER_PASSIVE.prayer);
  });
});

describe("naragiBaseDamageCompare", () => {
  it("scales effective base AD from loadout level to level 255", () => {
    const loadout: Loadout = {
      ...DEFAULT_LOADOUT,
      equipmentSlots: { pocket: SLIVER_OF_EDICTS_ID },
    };
    const stats = of(loadout, RELICS);
    const { off, on } = naragiBaseDamageCompare(loadout, stats.base);
    expect(off).toBe(stats.base);
    const formulaNormal = computedLoadoutBase(loadout);
    const formulaOverride = baseAbilityDamage(NARAGI_LEVEL_OVERRIDE, loadoutWeaponConfig(loadout));
    expect(on).toBe(Math.floor((stats.base * formulaOverride) / formulaNormal));
    expect(on).toBeGreaterThan(off);
  });
});

describe("Naragi loadout passives", () => {
  it("grants no passive stats from relic alone", () => {
    const bare = of({}, []);
    const withRelic = of({}, RELICS);
    expect(withRelic.league.relicNames.has(NARAGI_EDICT_RELIC)).toBe(true);
    expect(withRelic.equipment.armour).toBe(bare.equipment.armour);
    expect(withRelic.equipment.damage).toBe(bare.equipment.damage);
    expect(withRelic.equipment.life).toBe(bare.equipment.life);
    expect(withRelic.equipment.prayer).toBe(bare.equipment.prayer);
  });

  it("applies exact passive deltas when Sliver is equipped with Naragi", () => {
    const bare = of({}, RELICS);
    const withSliver = of({ equipmentSlots: { pocket: SLIVER_OF_EDICTS_ID } }, RELICS);
    expect(withSliver.equipment.armour - bare.equipment.armour).toBe(SLIVER_PASSIVE.armour);
    expect(withSliver.equipment.damage - bare.equipment.damage).toBe(SLIVER_PASSIVE.styleDamage);
    expect(withSliver.equipment.life - bare.equipment.life).toBe(SLIVER_PASSIVE.life);
    expect(withSliver.equipment.prayer - bare.equipment.prayer).toBe(SLIVER_PASSIVE.prayer);
    expect(withSliver.equipmentStyleDamageBonus - bare.equipmentStyleDamageBonus).toBe(
      SLIVER_PASSIVE.styleDamage,
    );
  });

  it("does not double-count after recomputation", () => {
    const loadout = {
      equipmentSlots: { pocket: SLIVER_OF_EDICTS_ID },
    } as Loadout;
    const a = of(loadout, RELICS);
    const b = of(loadout, RELICS);
    expect(a.equipment.armour).toBe(b.equipment.armour);
    expect(a.equipment.life).toBe(b.equipment.life);
  });
});

describe("Tier 7 granted-item equip rules", () => {
  it("rejects equipping Sliver without Naragi when relics are provided", () => {
    const base = { ...DEFAULT_LOADOUT, equipmentSlots: {} };
    const blocked = equipInSlot(base, "pocket", SLIVER_OF_EDICTS_ID, []);
    expect(blocked.equipmentSlots.pocket).toBeUndefined();
    const allowed = equipInSlot(base, "pocket", SLIVER_OF_EDICTS_ID, RELICS);
    expect(allowed.equipmentSlots.pocket).toBe(SLIVER_OF_EDICTS_ID);
  });

  it("strips Sliver when Naragi is deselected", () => {
    const worn = {
      ...DEFAULT_LOADOUT,
      equipmentSlots: { pocket: SLIVER_OF_EDICTS_ID },
    };
    const next = syncRelicGrantedEquipment(worn, []);
    expect(next.equipmentSlots.pocket).toBeUndefined();
    expect(stripUnavailableRelicItems(worn.equipmentSlots, []).pocket).toBeUndefined();
  });

  it("equipGrantedItemForRelic pockets the Sliver when Naragi is active", () => {
    const empty = { ...DEFAULT_LOADOUT, equipmentSlots: {} };
    const next = equipGrantedItemForRelic(empty, NARAGI_EDICT_RELIC, RELICS);
    expect(next.equipmentSlots.pocket).toBe(SLIVER_OF_EDICTS_ID);
  });

  it("equipGrantedItemForRelic pockets the Tome when Icyenic is active", () => {
    const empty = { ...DEFAULT_LOADOUT, equipmentSlots: {} };
    const next = equipGrantedItemForRelic(empty, "Icyenic Faith", ["Icyenic Faith"]);
    expect(next.equipmentSlots.pocket).toBe("item:tome-of-the-icyene");
  });

  it("equipGrantedItemForRelic pockets the Avernic Star when Infernal Fire is active", () => {
    const empty = { ...DEFAULT_LOADOUT, equipmentSlots: {} };
    const next = equipGrantedItemForRelic(empty, INFERNAL_FIRE_RELIC, [INFERNAL_FIRE_RELIC]);
    expect(next.equipmentSlots.pocket).toBe(AVERNIC_STAR_ID);
  });

  it("auto-equips the selected T7 grant after build hydration or selection", () => {
    const empty = { ...DEFAULT_LOADOUT, equipmentSlots: {} };
    const next = syncRelicGrantedEquipmentWithAutoEquip(empty, RELICS);
    expect(next.equipmentSlots.pocket).toBe(SLIVER_OF_EDICTS_ID);
  });

  it("swaps the pocket grant when the selected T7 relic changes", () => {
    const worn = {
      ...DEFAULT_LOADOUT,
      equipmentSlots: { pocket: SLIVER_OF_EDICTS_ID },
    };
    const next = syncRelicGrantedEquipmentWithAutoEquip(worn, ["Icyenic Faith"]);
    expect(next.equipmentSlots.pocket).toBe("item:tome-of-the-icyene");
  });

  it("swaps the Sliver for the Avernic Star when Infernal Fire is selected", () => {
    const worn = {
      ...DEFAULT_LOADOUT,
      equipmentSlots: { pocket: SLIVER_OF_EDICTS_ID },
    };
    const next = syncRelicGrantedEquipmentWithAutoEquip(worn, [INFERNAL_FIRE_RELIC]);
    expect(next.equipmentSlots.pocket).toBe(AVERNIC_STAR_ID);
  });
});
