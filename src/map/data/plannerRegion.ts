import type { RegionId } from "@/league";

export interface PlannerRegion {
  id: RegionId;
  name: string;
  availability: "starting" | "automatic_early" | "elective";
  quests: number;
}
