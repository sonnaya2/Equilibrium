import slayerSource from "#shard/research/planner-expansions-slayer.json";
import collectionSource from "#shard/research/planner-expansions-slayer-collection.json";
import edgeSource from "#shard/research/planner-expansions-slayer-edge.json";

export type SlayerMethod =
  | (typeof slayerSource)["slayer_methods"][number]
  | (typeof collectionSource)["slayer_methods"][number]
  | (typeof edgeSource)["slayer_methods"][number];
export type InventionComponentChain = (typeof slayerSource)["invention_component_chains"][number];
export type ArchaeologyRelicAcquisition =
  (typeof slayerSource)["archaeology_relic_acquisition"][number];
export type StaleMethodCorrection = (typeof slayerSource)["stale_method_corrections"][number];

export function getAllSlayerMethods(): SlayerMethod[] {
  return [
    ...slayerSource.slayer_methods,
    ...collectionSource.slayer_methods,
    ...edgeSource.slayer_methods,
  ];
}

export function getSlayerMethodsByRegion(region: string): SlayerMethod[] {
  const needle = region.trim().toLowerCase();
  return getAllSlayerMethods().filter((method) =>
    method.region_options.some((candidate) => candidate.toLowerCase() === needle),
  );
}

export function getAllInventionComponentChains(): InventionComponentChain[] {
  return slayerSource.invention_component_chains;
}

export function getInventionComponentChainsByRegion(region: string): InventionComponentChain[] {
  const needle = region.trim().toLowerCase();
  return getAllInventionComponentChains().filter((entry) => entry.region.toLowerCase() === needle);
}

export function getAllArchaeologyRelicAcquisitions(): ArchaeologyRelicAcquisition[] {
  return slayerSource.archaeology_relic_acquisition;
}

export function getArchaeologyRelicsByRegion(region: string): ArchaeologyRelicAcquisition[] {
  const needle = region.trim().toLowerCase();
  return getAllArchaeologyRelicAcquisitions().filter((entry) =>
    entry.acquisition_regions.some((candidate) => candidate.toLowerCase() === needle),
  );
}

export function getStaleSlayerMethodCorrections(): StaleMethodCorrection[] {
  return slayerSource.stale_method_corrections;
}
