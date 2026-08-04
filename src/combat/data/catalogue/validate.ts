import type { CombatDataset } from "../records";
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

/** Full catalogue integrity: unique ids, size equality, reference identity. */
export function assertCatalogueIntegrity(catalogue: CombatDataCatalogue): void {
  assertDatasetIndex(catalogue.abilities, catalogue.abilitiesById, "ability");
  assertDatasetIndex(catalogue.equipment, catalogue.equipmentById, "equipment");
  assertDatasetIndex(catalogue.effects, catalogue.effectsById, "effect");
  assertDatasetIndex(catalogue.perks, catalogue.perksById, "perk");
  assertDatasetIndex(catalogue.prayers, catalogue.prayersById, "prayer");
  assertDatasetIndex(catalogue.revolutionBars, catalogue.revolutionBarsById, "revolution-bar");
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
