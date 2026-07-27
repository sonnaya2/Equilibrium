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
  getRareComponentRoutes,
  getRemainingRareComponentRoutes,
  getUtilityPerkRecipes,
} from "@/research/inventionPlanner";
import activePerkData from "../../data/research/planner-expansions-invention-active-perks.json";

const activeSourceUrls = (activePerkData.source_urls ?? []).filter(
  (url): url is string => typeof url === "string" && url.startsWith("https://"),
);

const activePerks = getActiveInventionPerks().map((row) => ({
  ...row,
  source_urls: activeSourceUrls,
})) as unknown as ResearchRow[];

const armour = getCurrentArmourPerkRecipes();
const utility = getUtilityPerkRecipes();
const supply = getPerkComponentSupplyRoutes();
const globalRoutes = getGlobalOrAccountComponentRoutes();
const rare = getRareComponentRoutes();
const remaining = getRemainingRareComponentRoutes();
const routes2026 = getNew2026ComponentRoutes();
const perkDeps2026 = getCurrent2026PerkDependencies();
const account = getAccountComponentRoutes();

/** Bottlenecks use `material` — ResearchSection titles name/component/perk only. */
const bottlenecks = getPerkMaterialBottlenecks().map((row) => ({
  ...row,
  name: row.material,
})) as unknown as ResearchRow[];

const TABS: ResearchTab[] = [
  {
    key: "active",
    label: "Perks",
    description: "",
    rows: activePerks,
  },
  {
    key: "armour",
    label: "Armour",
    description: "",
    rows: armour as unknown as ResearchRow[],
  },
  {
    key: "utility",
    label: "Utility",
    description: "",
    rows: utility as unknown as ResearchRow[],
  },
  {
    key: "supply",
    label: "Components",
    description: "",
    rows: [...supply, ...globalRoutes, ...account] as unknown as ResearchRow[],
  },
  {
    key: "rare",
    label: "Rares",
    description: "",
    rows: [...rare, ...remaining] as unknown as ResearchRow[],
  },
  {
    key: "2026",
    label: "Routes",
    description: "",
    rows: [...routes2026, ...perkDeps2026] as unknown as ResearchRow[],
  },
  {
    key: "bottlenecks",
    label: "Bottlenecks",
    description: "",
    rows: bottlenecks,
  },
];

export function InventionResearch() {
  return (
    <ResearchSection
      title="Invention"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search"
      searchLabel="Search invention"
    />
  );
}
