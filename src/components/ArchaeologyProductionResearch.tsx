import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import production from "../../data/research/planner-expansions-archaeology-production.json";
import specialRelics from "../../data/research/planner-expansions-archaeology-special-relics.json";
import {
  getArchaeologyCollectionCompletionTools,
  getArchaeologyDataCorrections,
  getArchaeologyGuildShopProgression,
  getArchaeologyQualificationMilestones,
  getCollectionRelicRoutes,
  getCurrentArchaeologyRelicAdditions,
  getRelicLoadoutProgression,
  getRelicSystemProgression,
  getRepeatableCollectionRewards,
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

const collectionRoutes = getCollectionRelicRoutes();
const repeatables = getRepeatableCollectionRewards();
const qualifications = getArchaeologyQualificationMilestones();
const guildShop = getArchaeologyGuildShopProgression();
const completionTools = getArchaeologyCollectionCompletionTools();
const corrections = getArchaeologyDataCorrections();
const additions2026 = getCurrentArchaeologyRelicAdditions();

const TABS: ResearchTab[] = [
  {
    key: "collections",
    label: "Collection relics",
    description: `${collectionRoutes.length} culture/collection routes that grant relic powers. Required dig-site and collector regions stay explicit.`,
    rows: collectionRoutes as unknown as ResearchRow[],
  },
  {
    key: "repeatables",
    label: "Repeatable rewards",
    description: "Repeatable collection rewards that act as material or chronote loops.",
    rows: repeatables as unknown as ResearchRow[],
  },
  {
    key: "production",
    label: "Production routes",
    description: `Alternate supply loops. ${production.alternate_supply_guard.rule}`,
    rows: production.production_collection_routes as unknown as ResearchRow[],
  },
  {
    key: "qualifications",
    label: "Qualifications",
    description: "Archaeology qualification milestones that gate dig sites and tools.",
    rows: qualifications as unknown as ResearchRow[],
  },
  {
    key: "guild",
    label: "Guild shop",
    description: "Archaeology Guild shop progression and collection-completion infrastructure.",
    rows: [...guildShop, ...completionTools] as unknown as ResearchRow[],
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
    key: "corrections",
    label: "Corrections",
    description: "Existing data corrections and 2026 relic additions still pending exact collection metadata.",
    rows: [...corrections, ...additions2026, ...specialRelics.current_2026_pending_exact_collection] as unknown as ResearchRow[],
  },
];

export function ArchaeologyProductionResearch() {
  return (
    <ResearchSection
      title="Archaeology"
      intro="Collections, guild progression, supply loops and relic unlocks. Alternate sources stay visible rather than flattened into certainty."
      tabs={TABS}
      searchPlaceholder="Search Archaeology"
      searchLabel="Search Archaeology data"
    />
  );
}
