import collectionSource from "../../data/research/planner-expansions-archaeology-collections.json";
import repeatableSource from "../../data/research/planner-expansions-archaeology-repeatables.json";
import guildSource from "../../data/research/planner-expansions-archaeology-guild.json";
import utilitySource from "../../data/research/planner-expansions-archaeology-utilities.json";
import museumCollectionMatrix from "../../data/research/planner-expansions-archaeology-museum-collections-matrix.json";

export type ArchaeologyQualificationMilestone =
  (typeof collectionSource)["qualification_milestones"][number];
export type RelicSystemProgression = (typeof collectionSource)["relic_system_progression"][number];
export type RelicLoadoutProgression = (typeof guildSource)["relic_loadout_progression"][number];
export type ArchaeologyGuildShopProgression = (typeof guildSource)["shop_progression"][number];
export type CollectionRelicRoute =
  | (typeof collectionSource)["collection_relic_routes"][number]
  | (typeof repeatableSource)["additional_collection_relic_routes"][number];
export type RepeatableCollectionReward =
  | (typeof collectionSource)["repeatable_collection_rewards"][number]
  | (typeof repeatableSource)["repeatable_collection_rewards"][number];
export type ArchaeologyCollectionCompletionTool =
  | (typeof guildSource)["collection_completion_infrastructure"][number]
  | (typeof utilitySource)["collection_completion_tools"][number];
export type ArchaeologyDataCorrection =
  | (typeof collectionSource)["existing_data_corrections"][number]
  | (typeof guildSource)["stale_data_correction"];
export type CurrentArchaeologyRelicAddition =
  (typeof collectionSource)["current_2026_relic_additions"][number];

export function getArchaeologyQualificationMilestones(): ArchaeologyQualificationMilestone[] {
  return collectionSource.qualification_milestones;
}

export function getRelicSystemProgression(): RelicSystemProgression[] {
  return collectionSource.relic_system_progression.filter(
    (row) => row.id !== guildSource.stale_data_correction.target_id,
  );
}

export function getRelicLoadoutProgression(): RelicLoadoutProgression[] {
  return guildSource.relic_loadout_progression;
}

export function getArchaeologyGuildShopProgression(): ArchaeologyGuildShopProgression[] {
  return guildSource.shop_progression;
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

export function getRepeatableCollectionRewardsByRegion(
  region: string,
): RepeatableCollectionReward[] {
  const needle = region.trim().toLowerCase();
  return getRepeatableCollectionRewards().filter((route) =>
    route.required_regions.some((candidate) => candidate.toLowerCase() === needle),
  );
}

export function getArchaeologyCollectionCompletionTools(): ArchaeologyCollectionCompletionTool[] {
  return [
    ...guildSource.collection_completion_infrastructure,
    ...utilitySource.collection_completion_tools,
  ];
}

export function getArchaeologyDataCorrections(): ArchaeologyDataCorrection[] {
  return [...collectionSource.existing_data_corrections, guildSource.stale_data_correction];
}

export function getCurrentArchaeologyRelicAdditions(): CurrentArchaeologyRelicAddition[] {
  return collectionSource.current_2026_relic_additions;
}

/** Full Velucia + dig-site collector matrix with region combos and unobtainable flags. */
export type MuseumCollectionMatrixRow = (typeof museumCollectionMatrix)["collections"][number];

export function getMuseumCollectionMatrix(): MuseumCollectionMatrixRow[] {
  return museumCollectionMatrix.collections ?? [];
}

export function getMuseumCollectionMatrixByRegion(region: string): MuseumCollectionMatrixRow[] {
  const needle = region.trim().toLowerCase();
  return getMuseumCollectionMatrix().filter((row) => {
    const required = (row.required_regions ?? []) as string[];
    const artifacts = (row.artifact_regions ?? []) as string[];
    const collectors = (row.collector_regions ?? []) as string[];
    return [...required, ...artifacts, ...collectors].some(
      (candidate) => String(candidate).toLowerCase() === needle,
    );
  });
}

export function getUnobtainableMuseumCollections(): MuseumCollectionMatrixRow[] {
  return getMuseumCollectionMatrix().filter((row) => row.status === "unobtainable");
}
