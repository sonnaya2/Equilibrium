import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import {
  getAllArchaeologyRelicAcquisitions,
  getAllInventionComponentChains,
  getAllSlayerMethods,
  getStaleSlayerMethodCorrections,
} from "@/research/slayerPlanner";

const methods = getAllSlayerMethods();
const stale = getStaleSlayerMethodCorrections();
const inventionChains = getAllInventionComponentChains();
const archRelics = getAllArchaeologyRelicAcquisitions();

const TABS: ResearchTab[] = [
  {
    key: "methods",
    label: "Slayer routes",
    description: `${methods.length} high-value, collection-log and boundary-sensitive Slayer routes. Region options stay multi-choice; PvME metrics are guide context, not optimizer ranks.`,
    rows: methods as unknown as ResearchRow[],
  },
  {
    key: "stale",
    label: "Stale corrections",
    description: "Methods still carried as candidates after the March 2026 combat modernisation. Do not treat them as current XP tables.",
    rows: stale as unknown as ResearchRow[],
  },
  {
    key: "invention-chains",
    label: "Invention chains",
    description: "Slayer-adjacent invention component chains from the same expansion pack.",
    rows: inventionChains as unknown as ResearchRow[],
  },
  {
    key: "arch-relics",
    label: "Archaeology relics",
    description: "Combat/relic acquisition rows indexed next to Slayer routes in the expansion pack.",
    rows: archRelics as unknown as ResearchRow[],
  },
];

export function SlayerResearch() {
  return (
    <ResearchSection
      title="Slayer routes"
      intro="Deduplicated high-value Slayer routes with alternate regions and source freshness. Use these when picking electives for task access — not as a kill-time calculator."
      tabs={TABS}
      searchPlaceholder="Search Slayer routes"
      searchLabel="Search Slayer routes"
    />
  );
}
