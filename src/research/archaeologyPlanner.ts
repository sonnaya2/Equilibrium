import collectionSource from "../../data/research/planner-expansions-archaeology-collections.json";
import repeatableSource from "../../data/research/planner-expansions-archaeology-repeatables.json";
import utilitySource from "../../data/research/planner-expansions-archaeology-utilities.json";

export type ArchaeologyQualificationMilestone = (typeof collectionSource)["qualification_milestones"][number];
export type RelicSystemProgression =
  | (typeof collectionSource)["relic_system_progression"][number]
  | (typeof utilitySource)["relic_system_progression"][number];
export type RelicPresetProgression = (typeof utilitySource)["relic_system_progression"][number];
export type CollectionRelicRoute =
  | (typeof collectionSource)["collection_relic_routes"][number]
  | (typeof repeatableSource)["additional_collection_relic_routes"][number];
export type RepeatableCollectionReward =
  | (typeof collectionSource)["repeatable_collection_rewards"][number]
  | (typeof repeatableSource)["repeatable_collection_rewards"][number];
export type ArchaeologyCollectionCompletionTool = (typeof utilitySource)["collection_completion_tools"][number];
export type ArchaeologyDataCorrection =
  | (typeof collectionSource)["existing_data_corrections"][number]
  | (typeof utilitySource)["existing_data_corrections"][number];
export type CurrentArchaeologyRelicAddition = (typeof collectionSource)["current_2026_relic_additions"][number];

export function getArchaeologyQualificationMilestones(): ArchaeologyQualificationMilestone[] {
  return collectionSource.qualification_milestones;
}

export function getRelicSystemProgression(): RelicSystemProgression[] {
  const supersededIds = new Set(
    utilitySource.existing_data_corrections
      .filter((correction) => correction.action === "replace_in_runtime_with_relic_system_progression_overlay")
      .map((correction) => correction.target_id),
  );

  return [
    ...collectionSource.relic_system_progression.filter((row) => !supersededIds.has(row.id)),
    ...utilitySource.relic_system_progression,
  ];
}

export function getRelicPresetProgression(): RelicPresetProgression[] {
  return utilitySource.relic_system_progression;
}

export function getCollectionRelicRoutes(): CollectionRelicRoute[] {
  return [
    ...collectionSource.collection_relic_routes,
    ...repeatableSource.additional_collection_relic_routes,
  ];
}

export function getCollectionRelicRoutesByRegion(region: string): CollectionRelicRoute[] {
  const needle = region.trim().toLowerCase();
  return getCollectionRelicRoutes().filter((route) =>
    route.required_regions.some((candidate) => candidate.toLowerCase() === needle),
  );
}

export function getRepeatableCollectionRewards(): RepeatableCollectionReward[] {
  return [
    ...collectionSource.repeatable_collection_rewards,
    ...repeatableSource.repeatable_collection_rewards,
  ];
}

export function getRepeatableCollectionRewardsByRegion(region: string): RepeatableCollectionReward[] {
  const needle = region.trim().toLowerCase();
  return getRepeatableCollectionRewards().filter((route) =>
    route.required_regions.some((candidate) => candidate.toLowerCase() === needle),
  );
}

export function getArchaeologyCollectionCompletionTools(): ArchaeologyCollectionCompletionTool[] {
  return utilitySource.collection_completion_tools;
}

export function getArchaeologyDataCorrections(): ArchaeologyDataCorrection[] {
  return [
    ...collectionSource.existing_data_corrections,
    ...utilitySource.existing_data_corrections,
  ];
}

export function getCurrentArchaeologyRelicAdditions(): CurrentArchaeologyRelicAddition[] {
  return collectionSource.current_2026_relic_additions;
}
