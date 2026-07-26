import blessingsData from "#data/league/blessings.json";
import questsData from "#data/league/quests.json";
import relicsData from "#data/league/relics.json";
import type { RegionId } from "@/league";
import { REGION_ANCHOR_BY_ID } from "@/map/data/regionAnchors";
import { getResearchCatalog } from "@/research/catalog";

export function loadConceptBuildProps() {
  const catalog = getResearchCatalog();
  const primaryQuests = questsData.primary_region_counts as Record<string, number>;
  const touchedQuests = questsData.region_group_counts as Record<string, number>;

  const regions = catalog.regions.map((region) => ({
    id: region.id,
    name: REGION_ANCHOR_BY_ID.get(region.id as RegionId)?.name ?? region.name,
    availability: region.availability,
    skills: region.skills,
    trainingCount: region.training.length,
    upgradeCount: region.upgrades.length,
    hardRules: region.hardRules,
    primaryQuests: primaryQuests[region.id] ?? 0,
    touchedQuests: touchedQuests[region.id] ?? 0,
  }));

  const relicTiers = relicsData.records.map((tier) => ({
    tier: tier.tier,
    revealed: tier.revealed,
    verified: tier.verified,
    sourceUrl: tier.source?.url,
    choices: tier.choices.map((choice) => ({
      name: choice.name,
      effects: choice.effects,
      sourceUrl: choice.source?.url,
      verified: choice.verified,
    })),
  }));

  const blessingTiers = blessingsData.records.map((tier) => ({
    tier: tier.tier,
    revealed: tier.revealed,
    paths: tier.paths,
    godTier: tier.godTier,
    choices: tier.choices,
    sourceUrl: tier.source?.url,
    verified: tier.verified,
  }));

  return {
    regions,
    relicTiers,
    blessingTiers,
    resetCount: blessingsData.resetCount,
    snapshotDate: catalog.snapshotDate,
  };
}
