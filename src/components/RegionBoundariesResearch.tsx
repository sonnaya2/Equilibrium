import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import dependencies from "../../data/league/region-dependencies.json";

const TABS: ResearchTab[] = [
  {
    key: "overrides",
    label: "Overrides",
    description: "",
    rows: dependencies.boundary_overrides as unknown as ResearchRow[],
  },
  {
    key: "dependencies",
    label: "Must unlock",
    description: "",
    rows: dependencies.dependencies as unknown as ResearchRow[],
  },
  {
    key: "crossings",
    label: "Edge cases",
    description: "",
    rows: dependencies.cross_boundary_cases.map((row) => ({
      ...row,
      confidence: (row as { confidence?: string }).confidence ?? row.planner_status,
    })) as unknown as ResearchRow[],
  },
];

export function RegionBoundariesResearch() {
  return (
    <ResearchSection
      title="Boundaries"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search"
      searchLabel="Search boundaries"
    />
  );
}
