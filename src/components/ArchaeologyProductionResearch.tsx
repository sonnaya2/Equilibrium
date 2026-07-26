import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import production from "../../data/research/planner-expansions-archaeology-production.json";
import specialRelics from "../../data/research/planner-expansions-archaeology-special-relics.json";

const TABS: ResearchTab[] = [
  {
    key: "production",
    label: "Production routes",
    description: `Repeatable collection rewards that act as alternate supply loops. ${production.alternate_supply_guard.rule}`,
    rows: production.production_collection_routes as unknown as ResearchRow[],
  },
  {
    key: "special-relics",
    label: "Special relics",
    description: "Relic chains outside the culture-specific collections, including mixed-dig-site collections.",
    rows: specialRelics.collection_relic_routes as unknown as ResearchRow[],
  },
  {
    key: "pending-2026",
    label: "2026 pending",
    description: "Current 2026 additions whose exact collection metadata is not yet grounded. Shown as pending, not promoted to verified routes.",
    rows: specialRelics.current_2026_pending_exact_collection as unknown as ResearchRow[],
  },
];

export function ArchaeologyProductionResearch() {
  return (
    <ResearchSection
      title="Archaeology supply loops"
      intro="Collection routes that keep an account supplied without turning every ingredient into a hard region lock. Alternate sources stay visible rather than flattened into certainty."
      tabs={TABS}
      searchPlaceholder="Search supply loops"
      searchLabel="Search Archaeology supply loops"
    />
  );
}
