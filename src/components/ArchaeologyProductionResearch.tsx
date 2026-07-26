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
  getMuseumCollectionMatrix,
  getRelicLoadoutProgression,
  getRelicSystemProgression,
  getRepeatableCollectionRewards,
  getUnobtainableMuseumCollections,
  type MuseumCollectionMatrixRow,
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
const museumMatrix = getMuseumCollectionMatrix();
const unobtainableMuseum = getUnobtainableMuseumCollections();

const museumRows = museumMatrix.map((row) => {
  // Museum matrix rows are snake_case JSON; optional fields vary by collection kind.
  const loose = row as MuseumCollectionMatrixRow & {
    requiredRegions?: string[];
    chronotes_first?: number | string | null;
    comboLabel?: string;
  };
  const required = (loose.required_regions ?? loose.requiredRegions ?? []) as string[];
  const artifacts = (loose.artifact_regions ?? []) as string[];
  const collectors = (loose.collector_regions ?? []) as string[];
  const combo =
    loose.comboLabel ||
    (required.length > 1 ? `Region combo (all required): ${required.join(" + ")}` : "");
  const status = String(loose.status || "obtainable");
  const reason = loose.unobtainable_reason ? ` · ${loose.unobtainable_reason}` : "";
  const chronotesFirst = loose.chronotes_first;
  return {
    id: loose.id,
    name: loose.name,
    recordType: "activity",
    category: status === "unobtainable" ? "museum collection (unobtainable)" : "museum collection",
    regionHints: [...new Set([...required, ...artifacts, ...collectors])],
    requiredRegions: required,
    regionRequirementType: required.length > 1 ? "all_required" : "single",
    comboLabel: combo,
    isRegionCombo: required.length > 1,
    status,
    dig_sites: loose.dig_sites,
    collector: loose.collector,
    first_reward: loose.first_reward,
    chronotes_first: chronotesFirst,
    archaeology_level: loose.archaeology_level,
    detail: [
      combo,
      status === "unobtainable" ? `UNOBTAINABLE${reason}` : "Obtainable in Equilibrium elective regions",
      loose.collector ? `Collector: ${loose.collector}` : "",
      Array.isArray(loose.dig_sites) && loose.dig_sites.length
        ? `Dig sites: ${loose.dig_sites.join(", ")}`
        : "",
      loose.first_reward ? `First reward: ${loose.first_reward}` : "",
      chronotesFirst != null ? `Chronotes (collection reward): ${chronotesFirst}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    requirements: [
      row.archaeology_level != null ? `Archaeology ${row.archaeology_level}` : "",
      ...required.map((region) => `Region: ${region}`),
    ].filter(Boolean),
    confidence: row.confidence || "confirmed_wiki",
    source: row.source_urls?.[0]
      ? { source: "runescape-wiki", url: row.source_urls[0], title: row.name }
      : null,
  };
}) as unknown as ResearchRow[];

const TABS: ResearchTab[] = [
  {
    key: "museum-matrix",
    label: "Museum matrix",
    description: `${museumMatrix.length} permanent museum/dig-site collections with region combos. Seasonal Harvest Hollow content excluded. Waiko charms not tracked.`,
    rows: museumRows,
  },
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
