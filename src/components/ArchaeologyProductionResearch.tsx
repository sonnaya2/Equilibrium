import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import production from "../../data/research/planner-expansions-archaeology-production.json";
import specialRelics from "../../data/research/planner-expansions-archaeology-special-relics.json";
import {
  getRelicLoadoutProgression,
  getRelicSystemProgression,
} from "@/research/archaeologyPlanner";

// Loader drops the stale guildmaster-second-loadout claim (see guild stale_data_correction).
const relicSystemRows = getRelicSystemProgression().map((row) => ({
  ...row,
  name: row.requirement,
})) as unknown as ResearchRow[];

const relicLoadoutRows = getRelicLoadoutProgression().map((row) => ({
  ...row,
  name: String(row.stage).replaceAll("-", " "),
})) as unknown as ResearchRow[];

const TABS: ResearchTab[] = [
  {
    key: "production",
    label: "Production routes",
    description: `Repeatable collection rewards that act as alternate supply loops. ${production.alternate_supply_guard.rule}`,
    rows: production.production_collection_routes as unknown as ResearchRow[],
  },
  {
    key: "relic-system",
    label: "Relic system",
    description: "Active-slot and monolith power progression. Stale loadout claims are filtered via the archaeology loader correction.",
    rows: relicSystemRows,
  },
  {
    key: "relic-loadouts",
    label: "Relic loadouts",
    description: "Corrected loadout-tab unlock ladder: tutorial (2), Professor purchase (3), Guildmaster award (4).",
    rows: relicLoadoutRows,
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
