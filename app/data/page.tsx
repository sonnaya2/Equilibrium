import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";
import { PermanentUnlockResearch } from "@/components/PermanentUnlockResearch";
import { ProgressionResearch } from "@/components/ProgressionResearch";
import { ResearchBrowser } from "@/components/ResearchBrowser";
import { ConsumablesResearch } from "@/components/ConsumablesResearch";
import { ProgressionSystemsResearch } from "@/components/ProgressionSystemsResearch";
import { ArchaeologyProductionResearch } from "@/components/ArchaeologyProductionResearch";
import { InventionResearch } from "@/components/InventionResearch";
import { SlayerResearch } from "@/components/SlayerResearch";
import { PrayerSpellbookResearch } from "@/components/PrayerSpellbookResearch";
import { RegionalUnlocksResearch } from "@/components/RegionalUnlocksResearch";
import { MasterworkChainResearch } from "@/components/MasterworkChainResearch";
import { RegionBoundariesResearch } from "@/components/RegionBoundariesResearch";
import { DataWorkbench } from "@/components/DataWorkbench";
import { getResearchCatalog } from "@/research/catalog";

export const metadata: Metadata = {
  title: "Data",
  description:
    "Browse region content, progression notes, and sourced game data behind the Equilibrium planner.",
};

export default function DataPage() {
  const catalog = getResearchCatalog();

  return (
    <Page>
      <PageHeading
        title="Data"
        note={`Region unlocks, upgrades and training routes checked on ${catalog.snapshotDate}. Most links go to the Wiki; PvME, RS Analysis and fresh Jagex updates stay attached when they are the actual source.`}
      />

      <DataWorkbench
        browse={<ResearchBrowser catalog={catalog} />}
        progression={<ProgressionResearch />}
        unlocks={<PermanentUnlockResearch />}
        regional={<RegionalUnlocksResearch />}
        slayer={<SlayerResearch />}
        invention={<InventionResearch />}
        prayers={<PrayerSpellbookResearch />}
        consumables={<ConsumablesResearch />}
        systems={<ProgressionSystemsResearch />}
        archaeology={<ArchaeologyProductionResearch />}
        masterwork={<MasterworkChainResearch />}
        boundaries={<RegionBoundariesResearch />}
        notes={
          <section>
            <h2 className="text-base font-medium text-parch-50">Research notes</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">
              Slayer, Invention, Archaeology, prayers and regional unlocks load through typed research
              loaders so corrections apply. Each row links its own source. Policy and credits live on
              the{" "}
              <Link
                href="/sources"
                className="text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300"
              >
                sources page
              </Link>
              .
            </p>
          </section>
        }
      />
    </Page>
  );
}
