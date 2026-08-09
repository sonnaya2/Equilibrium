import type {
  AbilityRecord,
  CombatDataset,
  EffectRecord,
  EquipmentRecord,
  PerkRecord,
  PrayerRecord,
  RevolutionBarRecord,
  TargetPresetRecord,
} from "../records";

/**
 * Shard envelopes fed into the combat data catalogue compiler.
 * Datasets stay available for iteration; Maps are the lookup path.
 */
export interface CombatDataSources {
  abilities: CombatDataset<AbilityRecord>;
  equipment: CombatDataset<EquipmentRecord>;
  effects: CombatDataset<EffectRecord>;
  perks: CombatDataset<PerkRecord>;
  prayers: CombatDataset<PrayerRecord>;
  revolutionBars: CombatDataset<RevolutionBarRecord>;
  targetPresets: CombatDataset<TargetPresetRecord>;
}

/**
 * Indexed combat data catalogue (Pass 1).
 * Maps hold the same object refs as dataset.records - never clones.
 * Does not include AbilitySpec / ABILITY_REGISTRY.
 */
export interface CombatDataCatalogue {
  /** Source envelopes (records + verification metadata). */
  abilities: CombatDataset<AbilityRecord>;
  equipment: CombatDataset<EquipmentRecord>;
  effects: CombatDataset<EffectRecord>;
  perks: CombatDataset<PerkRecord>;
  prayers: CombatDataset<PrayerRecord>;
  revolutionBars: CombatDataset<RevolutionBarRecord>;
  targetPresets: CombatDataset<TargetPresetRecord>;

  abilitiesById: ReadonlyMap<string, AbilityRecord>;
  equipmentById: ReadonlyMap<string, EquipmentRecord>;
  effectsById: ReadonlyMap<string, EffectRecord>;
  perksById: ReadonlyMap<string, PerkRecord>;
  prayersById: ReadonlyMap<string, PrayerRecord>;
  revolutionBarsById: ReadonlyMap<string, RevolutionBarRecord>;
  targetPresetsById: ReadonlyMap<string, TargetPresetRecord>;
}

export type CatalogueIndexKey =
  | "abilitiesById"
  | "equipmentById"
  | "effectsById"
  | "perksById"
  | "prayersById"
  | "revolutionBarsById"
  | "targetPresetsById";
