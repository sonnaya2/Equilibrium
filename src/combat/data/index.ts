import type { RegionId } from "../../league";
import type { CombatStyle } from "../types";
import { isObtainableInRegions } from "./availability";
import {
  combatAbilities,
  combatDataCatalogue,
  combatEffects,
  combatEquipment,
  combatPerks,
  combatPrayers,
  combatRevolutionBars,
} from "./catalogue";
import type {
  AbilityRecord,
  EffectRecord,
  EquipmentRecord,
  PerkRecord,
  PrayerRecord,
  RevolutionBarRecord,
} from "./records";

export type * from "./records";
export type { CombatDataCatalogue, CombatDataSources } from "./catalogue";
export {
  combatDataCatalogue,
  combatAbilities,
  combatEffects,
  combatEquipment,
  combatPerks,
  combatPrayers,
  combatRevolutionBars,
  compileCombatDataCatalogue,
  indexRecordsById,
  assertCatalogueIntegrity,
  assertIndexMatchesRecords,
  assertUniqueRecordIds,
  findDuplicateIds,
} from "./catalogue";

/**
 * Typed accessors over the generated compatibility view.
 * Lookups use the module-init catalogue Maps (not linear scan).
 */

type AnyRecord = AbilityRecord | EffectRecord | EquipmentRecord | PerkRecord | PrayerRecord | RevolutionBarRecord;

/** Map lookup; unknown ids return undefined. Prefer typed helpers below. */
export function recordById<T extends AnyRecord>(index: ReadonlyMap<string, T>, id: string): T | undefined {
  return index.get(id);
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

export const abilityById = (id: string) => combatDataCatalogue.abilitiesById.get(id);
export const effectById = (id: string) => combatDataCatalogue.effectsById.get(id);
export const equipmentById = (id: string) => combatDataCatalogue.equipmentById.get(id);
export const perkById = (id: string) => combatDataCatalogue.perksById.get(id);
export const prayerById = (id: string) => combatDataCatalogue.prayersById.get(id);

export const abilitiesByStyle = (style: CombatStyle) =>
  combatAbilities.records.filter((record) => record.style === style);

export const abilitiesByRegion = (region: RegionId, options?: { regionLockedOnly?: boolean }) =>
  recordsByRegion(combatAbilities.records, region, options);

export const equipmentByRegion = (region: RegionId, options?: { regionLockedOnly?: boolean }) =>
  recordsByRegion(combatEquipment.records, region, options);

export const prayersByRegion = (region: RegionId, options?: { regionLockedOnly?: boolean }) =>
  recordsByRegion(combatPrayers.records, region, options);

export const revolutionBarById = (id: string) => combatDataCatalogue.revolutionBarsById.get(id);
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
