import type { CombatDataCatalogue, CombatDataSources } from "./contracts";
import { assertCatalogueIntegrity } from "./validate";

/** Build an id->record Map; throws on duplicate ids. Points at original objects. */
export function indexRecordsById<T extends { id: string }>(
  records: readonly T[],
  label: string,
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const record of records) {
    if (byId.has(record.id)) {
      throw new Error(`Duplicate ${label} id: ${record.id}`);
    }
    byId.set(record.id, record);
  }
  return byId;
}

/**
 * Pure compile: index every combat dataset once.
 * Does not mutate source records or arrays.
 * @param assert when true (default), run integrity checks after indexing
 */
export function compileCombatDataCatalogue(
  sources: CombatDataSources,
  options?: { assert?: boolean },
): CombatDataCatalogue {
  const catalogue: CombatDataCatalogue = {
    abilities: sources.abilities,
    equipment: sources.equipment,
    effects: sources.effects,
    perks: sources.perks,
    prayers: sources.prayers,
    revolutionBars: sources.revolutionBars,
    abilitiesById: indexRecordsById(sources.abilities.records, "ability"),
    equipmentById: indexRecordsById(sources.equipment.records, "equipment"),
    effectsById: indexRecordsById(sources.effects.records, "effect"),
    perksById: indexRecordsById(sources.perks.records, "perk"),
    prayersById: indexRecordsById(sources.prayers.records, "prayer"),
    revolutionBarsById: indexRecordsById(sources.revolutionBars.records, "revolution-bar"),
  };
  if (options?.assert !== false) {
    assertCatalogueIntegrity(catalogue);
  }
  return catalogue;
}
