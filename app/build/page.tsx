import type { Metadata } from "next";
import blessingsData from "#data/league/blessings.json";
import questsData from "#data/league/quests.json";
import relicsData from "#data/league/relics.json";
import { Page } from "@/components/Page";
import { BuildPlanner } from "@/components/BuildPlanner";
import type { RegionId } from "@/league";
import { REGION_ANCHOR_BY_ID } from "@/map/data/regionAnchors";
import { getResearchCatalog } from "@/research/catalog";

const BUILD_REGION_ORDER = [
  "misthalin",
  "karamja",
  "kandarin",
  "forinthry",
  "desert",
  "havenhythe",
  "asgarnia",
  "fremennik",
  "morytania",
  "tirannwn",
  "anachronia",
] as const;

export const metadata: Metadata = {
  title: "Build",
};

export default function BuildPage() {
  const catalog = getResearchCatalog();

  const primaryQuests = questsData.primary_region_counts as Record<string, number>;
  const touchedQuests = questsData.region_group_counts as Record<string, number>;

  const regions = catalog.regions.map((region) => ({
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
  })).sort(
    (a, b) => BUILD_REGION_ORDER.indexOf(a.id as (typeof BUILD_REGION_ORDER)[number])
      - BUILD_REGION_ORDER.indexOf(b.id as (typeof BUILD_REGION_ORDER)[number]),
  );

  // Full tier records pass through — later reveals populate choices and the
  // planner renders them without code changes.
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

  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="workbench-fill">
        <BuildPlanner
          regions={regions}
          relicTiers={relicTiers}
          blessingTiers={blessingTiers}
          resetCount={blessingsData.resetCount}
        />
      </div>
    </Page>
  );
}
