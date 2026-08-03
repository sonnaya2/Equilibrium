import abilitiesData from "#shard/combat/abilities.json";
import effectsData from "#shard/combat/effects.json";
import equipmentData from "#shard/combat/equipment.json";
import perksData from "#shard/combat/perks.json";
import prayersData from "#shard/combat/prayers.json";
import revolutionBarsData from "#shard/combat/revolution-bars.json";
import type { RegionId } from "../../league";
import type { CombatStyle } from "../types";
import { isObtainableInRegions } from "./availability";
import type {
  AbilityRecord,
  CombatDataset,
  EffectRecord,
  EquipmentRecord,
  PerkRecord,
  PrayerRecord,
  RevolutionBarRecord,
} from "./records";

export type * from "./records";

/**
 * Typed accessors over the generated compatibility view. The SQLite rebuild owns
 * these shapes; provenance, unique IDs, and region constraints are validated there.
 */

export const combatAbilities = abilitiesData as CombatDataset<AbilityRecord>;
export const combatEffects = effectsData as CombatDataset<EffectRecord>;
export const combatEquipment = equipmentData as CombatDataset<EquipmentRecord>;
export const combatPerks = perksData as CombatDataset<PerkRecord>;
export const combatPrayers = prayersData as CombatDataset<PrayerRecord>;
export const combatRevolutionBars = revolutionBarsData as CombatDataset<RevolutionBarRecord>;

type AnyRecord = AbilityRecord | EffectRecord | EquipmentRecord | PerkRecord | PrayerRecord | RevolutionBarRecord;

export function recordById<T extends AnyRecord>(dataset: CombatDataset<T>, id: string): T | undefined {
  return dataset.records.find((record) => record.id === id);
}

/** Records tagged with `region`. Empty regions is NOT global - use
 *  `recordsAvailableInRegion` / `resolveAvailability` for obtainability. */
export function recordsByRegion<T extends AnyRecord>(
  records: T[],
  region: RegionId,
  _opts?: { regionLockedOnly?: boolean },
): T[] {
  return records.filter((record) => (record.unlock?.regions ?? []).includes(region));
}

/** Records obtainable when only `region` is unlocked (globals + regionals for it). */
export function recordsAvailableInRegion<T extends AnyRecord>(
  records: T[],
  region: RegionId,
  options?: { includeUnknown?: boolean },
): T[] {
  return records.filter(
    (record) => isObtainableInRegions(record.unlock, [region], options).obtainable,
  );
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

export const revolutionBarById = (id: string) => recordById(combatRevolutionBars, id);
export const revolutionBarsByStyle = (style: CombatStyle) =>
  combatRevolutionBars.records.filter((record) => record.style === style);

/** Sync facts for the Combat > Reference surface, straight from the envelopes. */
export function combatSyncFacts() {
  const datasets = {
    abilities: combatAbilities,
    effects: combatEffects,
    equipment: combatEquipment,
    perks: combatPerks,
    prayers: combatPrayers,
    "revolution-bars": combatRevolutionBars,
  } as const;
  return Object.entries(datasets).map(([kind, dataset]) => ({
    kind,
    records: dataset.records.length,
    lastSynced: dataset.lastSynced,
    trackedSince: dataset.trackedSince,
  }));
}
