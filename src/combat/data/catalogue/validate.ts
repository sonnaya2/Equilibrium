import { AFFINITY_MAX, AFFINITY_MIN } from "../../target/genericTarget";
import type { CombatDataset, TargetPresetRecord } from "../records";
import type { CombatDataCatalogue } from "./contracts";

type IdRecord = { readonly id: string };

/** Throw when any id appears more than once in a record array. */
export function assertUniqueRecordIds(records: readonly IdRecord[], label: string): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) {
      throw new Error(`Duplicate ${label} id: ${record.id}`);
    }
    seen.add(record.id);
  }
}

/**
 * Map size must match array length, and every array entry must be the same
 * object reference as the Map value for that id.
 */
export function assertIndexMatchesRecords<T extends IdRecord>(
  records: readonly T[],
  byId: ReadonlyMap<string, T>,
  label: string,
): void {
  if (byId.size !== records.length) {
    throw new Error(
      `${label} index size ${byId.size} !== record array size ${records.length}`,
    );
  }
  for (const record of records) {
    const indexed = byId.get(record.id);
    if (indexed === undefined) {
      throw new Error(`${label} index missing id ${record.id}`);
    }
    if (indexed !== record) {
      throw new Error(`${label} index entry for ${record.id} is not the source record`);
    }
  }
}

function assertDatasetIndex<T extends IdRecord>(
  dataset: CombatDataset<T>,
  byId: ReadonlyMap<string, T>,
  label: string,
): void {
  assertUniqueRecordIds(dataset.records, label);
  assertIndexMatchesRecords(dataset.records, byId, label);
}

function assertAffinityInRange(value: number | null | undefined, label: string): void {
  if (value == null) return;
  if (!Number.isFinite(value) || value < AFFINITY_MIN || value > AFFINITY_MAX) {
    throw new Error(`${label}: affinity ${value} out of range ${AFFINITY_MIN}-${AFFINITY_MAX}`);
  }
}

/** Field-level checks for target presets (ranges, required support metadata). */
export function assertTargetPresetRecords(records: readonly TargetPresetRecord[]): void {
  for (const record of records) {
    if (!record.id || !record.name || !record.encounter) {
      throw new Error(`target-preset missing id/name/encounter: ${record.id ?? "(no id)"}`);
    }
    if (!record.wiki?.pageName) {
      throw new Error(`target-preset ${record.id}: missing wiki.pageName`);
    }
    if (record.sources.length === 0) {
      throw new Error(`target-preset ${record.id}: sources required`);
    }
    if (record.stats.defenceLevel != null && record.stats.defenceLevel < 0) {
      throw new Error(`target-preset ${record.id}: defenceLevel must be nonnegative`);
    }
    if (record.stats.armour != null && record.stats.armour < 0) {
      throw new Error(`target-preset ${record.id}: armour must be nonnegative`);
    }
    const aff = record.stats.affinities;
    if (aff) {
      assertAffinityInRange(aff.melee, `target-preset ${record.id} melee`);
      assertAffinityInRange(aff.ranged, `target-preset ${record.id} ranged`);
      assertAffinityInRange(aff.magic, `target-preset ${record.id} magic`);
      assertAffinityInRange(aff.weakness ?? null, `target-preset ${record.id} weakness`);
    }
    if (record.support === "unsupported" && !record.unsupportedReason) {
      throw new Error(`target-preset ${record.id}: unsupportedReason required`);
    }
  }
}

/** Full catalogue integrity: unique ids, size equality, reference identity. */
export function assertCatalogueIntegrity(catalogue: CombatDataCatalogue): void {
  assertDatasetIndex(catalogue.abilities, catalogue.abilitiesById, "ability");
  assertDatasetIndex(catalogue.equipment, catalogue.equipmentById, "equipment");
  assertDatasetIndex(catalogue.effects, catalogue.effectsById, "effect");
  assertDatasetIndex(catalogue.perks, catalogue.perksById, "perk");
  assertDatasetIndex(catalogue.prayers, catalogue.prayersById, "prayer");
  assertDatasetIndex(catalogue.revolutionBars, catalogue.revolutionBarsById, "revolution-bar");
  assertDatasetIndex(catalogue.targetPresets, catalogue.targetPresetsById, "target-preset");
  assertTargetPresetRecords(catalogue.targetPresets.records);
}

/** Non-throwing unique-id check for tests (returns duplicates). */
export function findDuplicateIds(records: readonly IdRecord[]): string[] {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const record of records) {
    if (seen.has(record.id)) dups.push(record.id);
    else seen.add(record.id);
  }
  return dups;
}
