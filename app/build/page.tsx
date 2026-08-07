import type { Metadata } from "next";
import blessingsData from "#shard/league/blessings.json";
import questsData from "#shard/league/quests.json";
import relicsData from "#shard/league/relics.json";
import { Page } from "@/components/Page";
import { BuildPlanner } from "@/components/BuildPlanner";
import type { RegionId } from "@/league";
import { parseBlessingTier, parseRelicTier, readDatasetRecords } from "@/lib/dataValidate";
import { sortByRegionOrder } from "@/lib/regionOrder";
import { REGION_ANCHOR_BY_ID } from "@/map/data/regionAnchors";
import { getResearchCatalog } from "@/research/catalog";

/** Display order on Build - first-3 A-Z, then electives A-Z; unknowns trail via sortByRegionOrder. */
export const BUILD_REGION_ORDER = [
  "havenhythe",
  "karamja",
  "misthalin",
  "anachronia",
  "asgarnia",
  "desert",
  "forinthry",
  "fremennik",
  "kandarin",
  "morytania",
  "tirannwn",
] as const;

export const metadata: Metadata = {
  title: "Build",
};

export default function BuildPage() {
  const catalog = getResearchCatalog();

  const primaryQuests = questsData.primary_region_counts as Record<string, number>;
  const touchedQuests = questsData.region_group_counts as Record<string, number>;

  const regions = sortByRegionOrder(
    catalog.regions.map((region) => ({
      id: region.id,
      // Same display names as the map (Wilderness, Kharidian Desert, Fremennik Province).
      name: REGION_ANCHOR_BY_ID.get(region.id as RegionId)?.name ?? region.name,
      availability: region.availability,
      skills: region.skills,
      trainingCount: region.training.length,
      upgradeCount: region.upgrades.length,
      hardRules: region.hardRules,
      primaryQuests: primaryQuests[region.id] ?? 0,
      touchedQuests: touchedQuests[region.id] ?? 0,
    })),
    BUILD_REGION_ORDER,
  );

  // Full tier records pass through - later reveals populate choices and the
  // planner renders them without code changes. Validated once at the boundary.
  const relicTiers = readDatasetRecords(relicsData, parseRelicTier, "relics").map((tier) => ({
    tier: tier.tier,
    revealed: tier.revealed,
    verified: tier.verified,
    sourceUrl: tier.source?.url,
    choices: tier.choices.map((choice) => ({
      name: choice.name,
      seat: choice.seat,
      effects: choice.effects,
      sourceUrl: choice.source?.url,
      verified: choice.verified,
    })),
  }));

  const blessingTiers = readDatasetRecords(blessingsData, parseBlessingTier, "blessings").map(
    (tier) => ({
      progressionSlot: tier.progressionSlot,
      tier: tier.tier,
      revealed: tier.revealed,
      paths: tier.paths,
      godTier: tier.godTier,
      passives: tier.passives,
      choices: tier.choices,
      sourceUrl: tier.source?.url,
      verified: tier.verified,
    }),
  );

  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="route-fill">
        <BuildPlanner regions={regions} relicTiers={relicTiers} blessingTiers={blessingTiers} />
      </div>
    </Page>
  );
}
