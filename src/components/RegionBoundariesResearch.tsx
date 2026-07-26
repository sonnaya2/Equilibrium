import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import dependencies from "../../data/league/region-dependencies.json";

const TABS: ResearchTab[] = [
  {
    key: "overrides",
    label: "Boundary overrides",
    description: "Named areas that are planned as part of a neighbouring region rather than their map position.",
    rows: dependencies.boundary_overrides as unknown as ResearchRow[],
  },
  {
    key: "dependencies",
    label: "Hard dependencies",
    description: "Content locked behind a specific region with no cross-region alternative.",
    rows: dependencies.dependencies as unknown as ResearchRow[],
  },
  {
    key: "crossings",
    label: "Unresolved crossings",
    description: "Split or cross-boundary content that stays unresolved until Equilibrium publishes the rule. A departure point alone does not assign the destination.",
    rows: dependencies.cross_boundary_cases.map((row) => ({
      ...row,
      confidence: (row as { confidence?: string }).confidence ?? row.planner_status,
    })) as unknown as ResearchRow[],
  },
];

export function RegionBoundariesResearch() {
  return (
    <ResearchSection
      title="Region boundary rules"
      intro="Hard boundary rules, historical working mappings and the cases still unresolved. Catalyst-era labels are precedent, not confirmation."
      tabs={TABS}
      searchPlaceholder="Search boundary rules"
      searchLabel="Search region boundary rules"
    />
  );
}
