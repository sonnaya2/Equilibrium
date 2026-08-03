import { researchRows, ResearchSection, type ResearchTab } from "./ResearchSection";
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
import activePerkData from "#shard/research/planner-expansions-invention-active-perks.json";

const activeSourceUrls = (activePerkData.source_urls ?? []).filter(
  (url): url is string => typeof url === "string" && url.startsWith("https://"),
);

const activePerks = researchRows(
  getActiveInventionPerks().map((row) => ({
    ...row,
    source_urls: activeSourceUrls,
  })),
);

const armour = getCurrentArmourPerkRecipes();
const utility = getUtilityPerkRecipes();
const supply = getPerkComponentSupplyRoutes();
const globalRoutes = getGlobalOrAccountComponentRoutes();
const rare = getRareComponentRoutes();
const remaining = getRemainingRareComponentRoutes();
const routes2026 = getNew2026ComponentRoutes();
const perkDeps2026 = getCurrent2026PerkDependencies();
const account = getAccountComponentRoutes();

/** Bottlenecks use `material` - ResearchSection titles name/component/perk only. */
const bottlenecks = researchRows(
  getPerkMaterialBottlenecks().map((row) => ({
    ...row,
    name: row.material,
  })),
);

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
    rows: researchRows(armour),
  },
  {
    key: "utility",
    label: "Utility",
    description: "",
    rows: researchRows(utility),
  },
  {
    key: "supply",
    label: "Components",
    description: "",
    rows: researchRows([...supply, ...globalRoutes, ...account]),
  },
  {
    key: "rare",
    label: "Rares",
    description: "",
    rows: researchRows([...rare, ...remaining]),
  },
  {
    key: "2026",
    label: "Routes",
    description: "",
    rows: researchRows([...routes2026, ...perkDeps2026]),
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
