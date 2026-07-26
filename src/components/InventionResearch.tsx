import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import {
  getAccountComponentRoutes,
  getActiveInventionPerks,
  getCurrent2026PerkDependencies,
  getCurrentArmourPerkRecipes,
  getGlobalOrAccountComponentRoutes,
  getNew2026ComponentRoutes,
  getPerkComponentSupplyRoutes,
  getPerkMaterialBottlenecks,
  getRareComponentCoverageCount,
  getRareComponentRoutes,
  getRemainingRareComponentRoutes,
  getUtilityPerkRecipes,
} from "@/research/inventionPlanner";

const activePerks = getActiveInventionPerks();
const armour = getCurrentArmourPerkRecipes();
const utility = getUtilityPerkRecipes();
const supply = getPerkComponentSupplyRoutes();
const globalRoutes = getGlobalOrAccountComponentRoutes();
const rare = getRareComponentRoutes();
const remaining = getRemainingRareComponentRoutes();
const routes2026 = getNew2026ComponentRoutes();
const perkDeps2026 = getCurrent2026PerkDependencies();
const account = getAccountComponentRoutes();
const bottlenecks = getPerkMaterialBottlenecks();
const rareCoverage = getRareComponentCoverageCount();

const TABS: ResearchTab[] = [
  {
    key: "active",
    label: "Active perks",
    description: "",
    rows: activePerks as unknown as ResearchRow[],
  },
  {
    key: "armour",
    label: "Armour recipes",
    description: "",
    rows: armour as unknown as ResearchRow[],
  },
  {
    key: "utility",
    label: "Utility recipes",
    description: "",
    rows: utility as unknown as ResearchRow[],
  },
  {
    key: "supply",
    label: "Component supply",
    description: "",
    rows: [...supply, ...globalRoutes, ...account] as unknown as ResearchRow[],
  },
  {
    key: "rare",
    label: "Rare components",
    description: "",
    rows: [...rare, ...remaining] as unknown as ResearchRow[],
  },
  {
    key: "2026",
    label: "2026 routes",
    description: "",
    rows: [...routes2026, ...perkDeps2026] as unknown as ResearchRow[],
  },
  {
    key: "bottlenecks",
    label: "Material bottlenecks",
    description: "",
    rows: bottlenecks as unknown as ResearchRow[],
  },
];

export function InventionResearch() {
  return (
    <ResearchSection
      title="Invention"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search invention"
      searchLabel="Search invention"
    />
  );
}
