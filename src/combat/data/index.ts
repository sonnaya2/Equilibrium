import abilitiesData from "#data/combat/abilities.json";
import effectsData from "#data/combat/effects.json";
import equipmentData from "#data/combat/equipment.json";
import perksData from "#data/combat/perks.json";
import prayersData from "#data/combat/prayers.json";
import type { RegionId } from "../../league";
import type { CombatStyle } from "../types";
import type {
  AbilityRecord,
  CombatDataset,
  EffectRecord,
  EquipmentRecord,
  PerkRecord,
  PrayerRecord,
} from "./records";

/**
 * Typed accessors over the canonical combat store at repo-root `data/combat/`.
 * The sync scripts own those files; nothing here hand-edits them. The integrity
 * contract (provenance, unique ids, valid regions) is enforced by the contract
 * test in index.test.ts and by scripts/audit-combat-data.mjs — accessors trust it.
 */

export const combatAbilities = abilitiesData as CombatDataset<AbilityRecord>;
export const combatEffects = effectsData as CombatDataset<EffectRecord>;
export const combatEquipment = equipmentData as CombatDataset<EquipmentRecord>;
export const combatPerks = perksData as CombatDataset<PerkRecord>;
export const combatPrayers = prayersData as CombatDataset<PrayerRecord>;

type AnyRecord = AbilityRecord | EffectRecord | EquipmentRecord | PerkRecord | PrayerRecord;

export function recordById<T extends AnyRecord>(dataset: CombatDataset<T>, id: string): T | undefined {
  return dataset.records.find((record) => record.id === id);
}

/** Records available in a League region: region-locked records tagged with it, plus
 *  base-game records (no region list) unless `regionLockedOnly` is set. */
export function recordsByRegion<T extends AnyRecord>(
  records: T[],
  region: RegionId,
  { regionLockedOnly = false }: { regionLockedOnly?: boolean } = {},
): T[] {
  return records.filter((record) => {
    const regions = record.unlock?.regions ?? [];
    if (regions.includes(region)) return true;
    return !regionLockedOnly && regions.length === 0;
  });
}

export const abilityById = (id: string) => recordById(combatAbilities, id);
export const effectById = (id: string) => recordById(combatEffects, id);
export const equipmentById = (id: string) => recordById(combatEquipment, id);

export const abilitiesByStyle = (style: CombatStyle) =>
  combatAbilities.records.filter((record) => record.style === style);

export const abilitiesByRegion = (region: RegionId, options?: { regionLockedOnly?: boolean }) =>
  recordsByRegion(combatAbilities.records, region, options);

export const equipmentByRegion = (region: RegionId, options?: { regionLockedOnly?: boolean }) =>
  recordsByRegion(combatEquipment.records, region, options);

export const prayersByRegion = (region: RegionId, options?: { regionLockedOnly?: boolean }) =>
  recordsByRegion(combatPrayers.records, region, options);

/** Sync facts for the Combat > Reference surface, straight from the envelopes. */
export function combatSyncFacts() {
  const datasets = {
    abilities: combatAbilities,
    effects: combatEffects,
    equipment: combatEquipment,
    perks: combatPerks,
    prayers: combatPrayers,
  } as const;
  return Object.entries(datasets).map(([kind, dataset]) => ({
    kind,
    records: dataset.records.length,
    lastSynced: dataset.lastSynced,
    trackedSince: dataset.trackedSince,
  }));
}
