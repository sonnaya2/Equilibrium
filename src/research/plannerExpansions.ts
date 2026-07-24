import plannerSource from "../../data/research/planner-expansions.json";

export type PlannerExpansionData = typeof plannerSource;
export type CombatTrainingSpot = PlannerExpansionData["combat_training_spots"][number];
export type RunecraftingAltar = PlannerExpansionData["runecrafting_altars"][number];
export type InventionProgression = PlannerExpansionData["invention_progression"][number];
export type InventionComponentSource = PlannerExpansionData["invention_component_sources"][number];
export type ArchaeologyProgression = PlannerExpansionData["archaeology_progression"][number];
export type ArchaeologyCombatRelic = PlannerExpansionData["archaeology_combat_relics"][number];
export type RegionalUniqueDrop = PlannerExpansionData["regional_unique_drops"][number];

export function getPlannerExpansions(): PlannerExpansionData {
  return plannerSource;
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
  return plannerSource.invention_component_sources.filter((entry) => entry.region.toLowerCase() === needle);
}

export function getArchaeologyProgressionByRegion(region: string): ArchaeologyProgression[] {
  const needle = region.trim().toLowerCase();
  return plannerSource.archaeology_progression.filter((entry) => entry.region.toLowerCase() === needle);
}
