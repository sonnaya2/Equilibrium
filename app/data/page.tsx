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
import { MasterworkChainResearch } from "@/components/MasterworkChainResearch";
import { RegionBoundariesResearch } from "@/components/RegionBoundariesResearch";
import { getResearchCatalog } from "@/research/catalog";

export const metadata: Metadata = {
  title: "Data",
  description:
    "Browse region content, progression notes, and sourced game data behind the Equilibrium planner.",
};

const SECTION_LINKS = [
  ["browse", "Browse"],
  ["progression", "Progression"],
  ["unlocks", "Permanent unlocks"],
  ["consumables", "Consumables"],
  ["systems", "Systems"],
  ["archaeology", "Archaeology supply"],
  ["masterwork", "Masterwork staff"],
  ["boundaries", "Boundary rules"],
] as const;

export default function DataPage() {
  const catalog = getResearchCatalog();

  return (
    <Page>
      <PageHeading
        title="Data"
        note={`Region unlocks, upgrades and training routes checked on ${catalog.snapshotDate}. Most links go to the Wiki; PvME, RS Analysis and fresh Jagex updates stay attached when they are the actual source.`}
      />
      <nav aria-label="Data sections" className="sticky top-0 z-10 -mx-4 border-b border-stone-750 bg-stone-950 px-4">
        <ul className="flex gap-1 overflow-x-auto text-xs">
          {SECTION_LINKS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block whitespace-nowrap px-3 py-2 text-parch-300 transition-colors duration-150 hover:text-parch-50">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div id="browse" className="scroll-mt-16">
        <ResearchBrowser catalog={catalog} />
      </div>
      <div id="progression" className="scroll-mt-16">
        <ProgressionResearch />
      </div>
      <div id="unlocks" className="scroll-mt-16">
        <PermanentUnlockResearch />
      </div>
      <div id="consumables" className="scroll-mt-16">
        <ConsumablesResearch />
      </div>
      <div id="systems" className="scroll-mt-16">
        <ProgressionSystemsResearch />
      </div>
      <div id="archaeology" className="scroll-mt-16">
        <ArchaeologyProductionResearch />
      </div>
      <div id="masterwork" className="scroll-mt-16">
        <MasterworkChainResearch />
      </div>
      <div id="boundaries" className="scroll-mt-16">
        <RegionBoundariesResearch />
      </div>

      <section className="border-t border-stone-750 pt-7 pb-2">
        <h2 className="text-lg font-semibold tracking-tight text-parch-50">Research notes</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">
          Mechanic and dependency notes harvested from PvME and RS Analysis stay in the research index rather than a table here; the
          canonical source for every row above is linked on the row itself. Source policy and credits live on the{" "}
          <Link href="/sources" className="text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300">
            sources page
          </Link>
          .
        </p>
      </section>
    </Page>
  );
}
