import blessingsData from "#data/league/blessings.json";
import questsData from "#data/league/quests.json";
import relicsData from "#data/league/relics.json";
import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";
import { BuildPlanner } from "@/components/BuildPlanner";
import { getResearchCatalog } from "@/research/catalog";

export default function BuildPage() {
  const catalog = getResearchCatalog();
  const tierOne = relicsData.records.find((tier) => tier.tier === 1);

  const primaryQuests = questsData.primary_region_counts as Record<string, number>;
  const touchedQuests = questsData.region_group_counts as Record<string, number>;

  const regions = catalog.regions.map((region) => ({
    id: region.id,
    name: region.name,
    availability: region.availability,
    skills: region.skills,
    trainingCount: region.training.length,
    upgradeCount: region.upgrades.length,
    hardRules: region.hardRules,
    primaryQuests: primaryQuests[region.id] ?? 0,
    touchedQuests: touchedQuests[region.id] ?? 0,
  }));

  const tierOneRelics = (tierOne?.choices ?? []).map((choice) => ({
    name: choice.name,
    effects: choice.effects,
    sourceUrl: choice.source?.url,
  }));

  const blessingTiers = blessingsData.records.map((tier) => ({
    tier: tier.tier,
    revealed: tier.revealed,
    paths: tier.paths,
    godTier: tier.godTier,
  }));

  return (
    <Page>
      <PageHeading
        title="Build planner"
        note="Regions, relics, blessings and gear in one plan. The picks are the same ones you make on the map."
      />
      <BuildPlanner
        regions={regions}
        tierOneRelics={tierOneRelics}
        blessingTiers={blessingTiers}
        resetCount={blessingsData.resetCount}
      />
    </Page>
  );
}
