import abilitiesData from "#shard/combat/abilities.json";
import effectsData from "#shard/combat/effects.json";
import equipmentData from "#shard/combat/equipment.json";
import perksData from "#shard/combat/perks.json";
import prayersData from "#shard/combat/prayers.json";
import revolutionBarsData from "#shard/combat/revolution-bars.json";
import type {
  AbilityRecord,
  CombatDataset,
  EffectRecord,
  EquipmentRecord,
  PerkRecord,
  PrayerRecord,
  RevolutionBarRecord,
} from "../records";
import { compileCombatDataCatalogue } from "./compile";
import type { CombatDataCatalogue } from "./contracts";

/**
 * Singleton combat data catalogue: indexed once at module init from shards.
 * Maps point at original generated records; no clone, no mutation.
 */
export const combatDataCatalogue: CombatDataCatalogue = compileCombatDataCatalogue({
  abilities: abilitiesData as CombatDataset<AbilityRecord>,
  equipment: equipmentData as CombatDataset<EquipmentRecord>,
  effects: effectsData as CombatDataset<EffectRecord>,
  perks: perksData as CombatDataset<PerkRecord>,
  prayers: prayersData as CombatDataset<PrayerRecord>,
  revolutionBars: revolutionBarsData as CombatDataset<RevolutionBarRecord>,
});

/** Dataset envelopes (records + lastSynced / trackedSince). */
export const combatAbilities = combatDataCatalogue.abilities;
export const combatEquipment = combatDataCatalogue.equipment;
export const combatEffects = combatDataCatalogue.effects;
export const combatPerks = combatDataCatalogue.perks;
export const combatPrayers = combatDataCatalogue.prayers;
export const combatRevolutionBars = combatDataCatalogue.revolutionBars;

export type { CombatDataCatalogue, CombatDataSources, CatalogueIndexKey } from "./contracts";
export { compileCombatDataCatalogue, indexRecordsById } from "./compile";
export {
  assertCatalogueIntegrity,
  assertIndexMatchesRecords,
  assertUniqueRecordIds,
  findDuplicateIds,
} from "./validate";
