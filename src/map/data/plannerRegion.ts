import type { RegionId } from "@/league";

/** Flattened catalog upgrade for the map route (combo / combat BiS fields included). */
export interface PlannerUpgrade {
  name: string;
  kind: string;
  comboLabel?: string;
  requiredRegions?: string[];
  isRegionCombo?: boolean;
}

/** One catalog row, flattened for the map route. The server page projects the
 *  research catalog into this so nothing under src/map/ reads the store twice. */
export interface PlannerRegion {
  id: RegionId;
  name: string;
  availability: "starting" | "automatic_early" | "elective";
  /** Quests touching the region (quests.json region_group_counts). */
  quests: number;
  areas: string[];
  content: Array<{ name: string; kind: string; confidence: string }>;
  upgrades: PlannerUpgrade[];
  training: number;
  hardRules: string[];
  warnings: string[];
  /** Combat / BiS / boss / gear category upgrades in this region. */
  combatUnlocks?: number;
  /** Upgrades that need more than one region (combo or multi-required). */
  multiRegionUnlocks?: number;
  /** Region source + content/upgrade/training rows that carry a SourceReference. */
  sourceCount: number;
  verifiedAt: string | null;
}
