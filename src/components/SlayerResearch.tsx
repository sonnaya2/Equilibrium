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
    description: "",
    rows: methods as unknown as ResearchRow[],
  },
  {
    key: "stale",
    label: "Stale corrections",
    description: "",
    rows: stale as unknown as ResearchRow[],
  },
  {
    key: "invention-chains",
    label: "Invention chains",
    description: "",
    rows: inventionChains as unknown as ResearchRow[],
  },
  {
    key: "arch-relics",
    label: "Archaeology relics",
    description: "",
    rows: archRelics as unknown as ResearchRow[],
  },
];

export function SlayerResearch() {
  return (
    <ResearchSection
      title="Slayer routes"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search Slayer routes"
      searchLabel="Search Slayer routes"
    />
  );
}
