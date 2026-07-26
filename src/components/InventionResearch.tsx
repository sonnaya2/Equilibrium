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
    description: `${activePerks.length} current Invention perks after the July 2026 removals. Names and categories only — recipes live in the armour/utility tabs.`,
    rows: activePerks as unknown as ResearchRow[],
  },
  {
    key: "armour",
    label: "Armour recipes",
    description: "Current weapon/armour perk families with component dependencies.",
    rows: armour as unknown as ResearchRow[],
  },
  {
    key: "utility",
    label: "Utility recipes",
    description: "Utility bridge perk recipes used for account QoL and skilling tools.",
    rows: utility as unknown as ResearchRow[],
  },
  {
    key: "supply",
    label: "Component supply",
    description: "Where perk components come from, including global/account routes.",
    rows: [...supply, ...globalRoutes, ...account] as unknown as ResearchRow[],
  },
  {
    key: "rare",
    label: "Rare components",
    description: `Rare component routes and remaining coverage (coverage after this file: ${rareCoverage}).`,
    rows: [...rare, ...remaining] as unknown as ResearchRow[],
  },
  {
    key: "2026",
    label: "2026 routes",
    description: "Post-2026 component routes and perk dependencies that changed with the mid-game rebalance.",
    rows: [...routes2026, ...perkDeps2026] as unknown as ResearchRow[],
  },
  {
    key: "bottlenecks",
    label: "Material bottlenecks",
    description: "Account-level material bottlenecks for self-sufficient Invention planning.",
    rows: bottlenecks as unknown as ResearchRow[],
  },
];

export function InventionResearch() {
  return (
    <ResearchSection
      title="Invention"
      intro="Active perks, recipes and component supply for self-sufficient League Invention. Removed July 2026 perks are excluded from the active list."
      tabs={TABS}
      searchPlaceholder="Search Invention"
      searchLabel="Search Invention data"
    />
  );
}
