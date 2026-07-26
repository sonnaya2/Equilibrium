import type { RegionId } from "@/league";

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
  upgrades: Array<{ name: string; kind: string }>;
  training: number;
  hardRules: string[];
  warnings: string[];
  /** Region source + content/upgrade/training rows that carry a SourceReference. */
  sourceCount: number;
  verifiedAt: string | null;
}
