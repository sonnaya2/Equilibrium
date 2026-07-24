import blessingsData from "#data/league/blessings.json";
import relicsData from "#data/league/relics.json";
import { BuildPlanner } from "@/components/BuildPlanner";
import { getResearchCatalog } from "@/research/catalog";

export default function BuildPage() {
  const catalog = getResearchCatalog();
  const tierOne = relicsData.records.find((tier) => tier.tier === 1);

  const regions = catalog.regions.map((region) => ({
    id: region.id,
    name: region.name,
    availability: region.availability,
    skills: region.skills,
    trainingCount: region.training.length,
    upgradeCount: region.upgrades.length,
    hardRules: region.hardRules,
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
    <section>
      <header className="border-b border-stone-750 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-parch-50">Build</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">
          Pick regions and the currently revealed relic. Unrevealed relic and Blessing choices stay unavailable until they have a source.
        </p>
      </header>
      <BuildPlanner
        regions={regions}
        tierOneRelics={tierOneRelics}
        blessingTiers={blessingTiers}
        resetCount={blessingsData.resetCount}
      />
    </section>
  );
}
