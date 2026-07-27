import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import {
  getAllArchaeologyRelicAcquisitions,
  getAllInventionComponentChains,
  getAllSlayerMethods,
  getStaleSlayerMethodCorrections,
} from "@/research/slayerPlanner";

const methods = getAllSlayerMethods().map((row) => ({
  ...row,
  name: (row as { name?: string; monster?: string }).name || (row as { monster?: string }).monster,
})) as unknown as ResearchRow[];

const stale = getStaleSlayerMethodCorrections().map((row) => {
  const loose = row as { name?: string; topic?: string; method?: string; monster?: string; id?: string };
  return {
    ...row,
    name: loose.name || loose.topic || loose.method || loose.monster || loose.id || "Old method",
  };
}) as unknown as ResearchRow[];

const inventionChains = getAllInventionComponentChains().map((row) => ({
  ...row,
  name: (row as { name?: string; component?: string }).name || (row as { component?: string }).component,
})) as unknown as ResearchRow[];

const archRelics = getAllArchaeologyRelicAcquisitions().map((row) => {
  const loose = row as { name?: string; relic?: string; relic_power?: string; id?: string };
  return {
    ...row,
    name: loose.name || loose.relic || loose.relic_power || loose.id || "Relic",
  };
}) as unknown as ResearchRow[];

const TABS: ResearchTab[] = [
  {
    key: "methods",
    label: "Routes",
    description: "",
    rows: methods,
  },
  {
    key: "stale",
    label: "Outdated",
    description: "",
    rows: stale,
  },
  {
    key: "invention-chains",
    label: "Invention chains",
    description: "",
    rows: inventionChains,
  },
  {
    key: "arch-relics",
    label: "Arch relics",
    description: "",
    rows: archRelics,
  },
];

export function SlayerResearch() {
  return (
    <ResearchSection
      title="Slayer"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search"
      searchLabel="Search Slayer"
    />
  );
}
