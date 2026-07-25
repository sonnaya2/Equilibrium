import type { RegionId } from "@/league";

/** One catalog row, flattened for the map route. The server page projects the
 *  research catalog into this so nothing under src/map/ reads the store twice. */
export interface PlannerRegion {
  id: RegionId;
  name: string;
  availability: "starting" | "automatic_early" | "elective";
  /** Quests touching the region — the count a pick unlocks. */
  quests: number;
  areas: string[];
  content: Array<{ name: string; kind: string; confidence: string }>;
  upgrades: Array<{ name: string; kind: string }>;
  training: number;
  hardRules: string[];
  warnings: string[];
  /** Region-level source plus every content-level source. */
  sourceCount: number;
  verifiedAt: string | null;
}
