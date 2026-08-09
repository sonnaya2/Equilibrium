import type { CombatDataset, TargetPresetRecord } from "./records";

/**
 * Target preset dataset for the combat catalogue.
 * Empty until Wiki import patches land (PR3). Offline rebuild must not fetch Wiki.
 */
export const combatTargetPresetsData: CombatDataset<TargetPresetRecord> = {
  lastSynced: null,
  trackedSince: "2024-03-04",
  records: [],
};
