import { researchRows, ResearchSection, type ResearchTab } from "./ResearchSection";
import dependencies from "#data/league/region-dependencies.json";

const TABS: ResearchTab[] = [
  {
    key: "overrides",
    label: "Overrides",
    description: "",
    rows: researchRows(dependencies.boundary_overrides),
  },
  {
    key: "dependencies",
    label: "Must unlock",
    description: "",
    rows: researchRows(dependencies.dependencies),
  },
  {
    key: "crossings",
    label: "Edge cases",
    description: "",
    rows: researchRows(
      dependencies.cross_boundary_cases.map((row) => ({
        ...row,
        confidence: (row as { confidence?: string }).confidence ?? row.planner_status,
      })),
    ),
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
