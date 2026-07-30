import plannerSource from "#data/research/planner-expansions.json";
import supportSource from "#data/research/planner-support-items-2026-07-25.json";

export type PlannerExpansionData = typeof plannerSource;
export type CombatTrainingSpot = PlannerExpansionData["combat_training_spots"][number];
export type RunecraftingAltar = PlannerExpansionData["runecrafting_altars"][number];
export type InventionProgression = PlannerExpansionData["invention_progression"][number];
export type InventionComponentSource = PlannerExpansionData["invention_component_sources"][number];
export type ArchaeologyProgression = PlannerExpansionData["archaeology_progression"][number];
export type ArchaeologyCombatRelic = PlannerExpansionData["archaeology_combat_relics"][number];
export type RegionalUniqueDrop = PlannerExpansionData["regional_unique_drops"][number];
export type SupportUniqueDrop = (typeof supportSource)["regional_unique_drops"][number];

export function getPlannerExpansions(): PlannerExpansionData {
  return plannerSource;
}

/** Full-section getters — ProgressionResearch and any planner consumer. */

export function getCombatTrainingSpots(): CombatTrainingSpot[] {
  return plannerSource.combat_training_spots;
}

export function getRunecraftingAltars(): RunecraftingAltar[] {
  return plannerSource.runecrafting_altars;
}

export function getInventionProgression(): InventionProgression[] {
  return plannerSource.invention_progression;
}

export function getInventionComponentSources(): InventionComponentSource[] {
  return plannerSource.invention_component_sources;
}

export function getArchaeologyProgression(): ArchaeologyProgression[] {
  return plannerSource.archaeology_progression;
}

export function getArchaeologyCombatRelics(): ArchaeologyCombatRelic[] {
  return plannerSource.archaeology_combat_relics;
}

export function getAllRegionalUniqueDrops(): RegionalUniqueDrop[] {
  return plannerSource.regional_unique_drops;
}

/** Support-item overlay rows (merge on id over base unique drops). */
export function getSupportUniqueDropOverlay(): SupportUniqueDrop[] {
  return supportSource.regional_unique_drops;
}

export function getCombatTrainingForSkill(skill: string): CombatTrainingSpot[] {
  const needle = skill.trim().toLowerCase();
  return plannerSource.combat_training_spots.filter((spot) =>
    spot.skills.some((candidate) => candidate.toLowerCase() === needle),
  );
}

export function getCombatTrainingByRegion(region: string): CombatTrainingSpot[] {
  const needle = region.trim().toLowerCase();
  return plannerSource.combat_training_spots.filter((spot) => spot.region.toLowerCase() === needle);
}

export function getRunecraftingAltarsByRegion(region: string): RunecraftingAltar[] {
  const needle = region.trim().toLowerCase();
  return plannerSource.runecrafting_altars.filter((altar) => altar.region.toLowerCase() === needle);
}

export function getRegionalUniqueDrops(region: string): RegionalUniqueDrop[] {
  const needle = region.trim().toLowerCase();
  return plannerSource.regional_unique_drops.filter((drop) => drop.region.toLowerCase() === needle);
}

export function getInventionComponentsByRegion(region: string): InventionComponentSource[] {
  const needle = region.trim().toLowerCase();
  return plannerSource.invention_component_sources.filter(
    (entry) => entry.region.toLowerCase() === needle,
  );
}

export function getArchaeologyProgressionByRegion(region: string): ArchaeologyProgression[] {
  const needle = region.trim().toLowerCase();
  return plannerSource.archaeology_progression.filter(
    (entry) => entry.region.toLowerCase() === needle,
  );
}
