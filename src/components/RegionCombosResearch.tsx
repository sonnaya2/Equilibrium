import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import combosData from "../../data/research/region-combos.json";

type ComboRecord = ResearchRow & {
  modeled?: boolean | string;
  regions?: string[];
};

const combos = (combosData.combos || []) as ComboRecord[];
const issues = (combosData.globalIssues || []) as ComboRecord[];

const hard = combos.filter((row) => Array.isArray(row.regions) && row.regions.length > 0);
const pressure = combos.filter((row) => !Array.isArray(row.regions) || row.regions.length === 0);
const modeled = combos.filter((row) => row.modeled === true);
const partial = combos.filter((row) => row.modeled === "partial");
const gaps = combos.filter((row) => row.modeled === false);

const TABS: ResearchTab[] = [
  {
    key: "all-combos",
    label: "All combos",
    description: `${combos.length} multi-region skilling dependency edges for ironman / no-trade planning.`,
    rows: combos as ResearchRow[],
  },
  {
    key: "hard-required",
    label: "Hard multi-region",
    description: `${hard.length} combos with required regions on the self-sufficient path.`,
    rows: hard as ResearchRow[],
  },
  {
    key: "pressure-only",
    label: "Pressure only",
    description: `${pressure.length} supply / routing pressure stacks without a single hard lock.`,
    rows: pressure as ResearchRow[],
  },
  {
    key: "modeled",
    label: "Already modeled",
    description: `${modeled.length} fully encoded · ${partial.length} partial.`,
    rows: [...modeled, ...partial] as ResearchRow[],
  },
  {
    key: "gaps",
    label: "Planner gaps",
    description: `${gaps.length} combos not yet encoded as cross-region edges.`,
    rows: gaps as ResearchRow[],
  },
  {
    key: "global-issues",
    label: "Global issues",
    description: `${issues.length} taxonomy / dual-home issues that affect many skills.`,
    rows: issues as ResearchRow[],
  },
];

export function RegionCombosResearch() {
  const counts = combosData.counts as { combos?: number; globalIssues?: number } | undefined;
  return (
    <ResearchSection
      title="Region combos"
      intro={`Self-sufficient multi-region stacks Leagues planners miss when scoring one region at a time. ${counts?.combos ?? combos.length} combos · ${counts?.globalIssues ?? issues.length} global issues. Ironman / no-trade only — no GE dual mode.`}
      tabs={TABS}
      searchPlaceholder="Search region combos"
      searchLabel="Search region combos"
    />
  );
}
