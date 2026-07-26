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

function withCollectionName<T extends Record<string, unknown>>(rows: T[]): ResearchRow[] {
  return rows.map((row) => {
    const collections = Array.isArray(row.collections)
      ? (row.collections as unknown[]).filter((v): v is string => typeof v === "string")
      : [];
    const name =
      (typeof row.name === "string" && row.name) ||
      (typeof row.collection === "string" && row.collection) ||
      collections[0] ||
      (typeof row.relic_power === "string" && row.relic_power) ||
      (typeof row.id === "string" && row.id) ||
      "—";
    return { ...row, name };
  }) as unknown as ResearchRow[];
}

const collectionRoutes = withCollectionName(
  getCollectionRelicRoutes() as unknown as Record<string, unknown>[],
);
const repeatables = withCollectionName(
  getRepeatableCollectionRewards() as unknown as Record<string, unknown>[],
);
const qualifications = getArchaeologyQualificationMilestones().map((row) => ({
  ...row,
  name: row.qualification,
})) as unknown as ResearchRow[];
const guildShop = getArchaeologyGuildShopProgression().map((row) => {
  const loose = row as { name?: string; qualification?: string; stage?: string; id?: string };
  return {
    ...row,
    name: loose.name || loose.qualification || loose.stage || loose.id || "Shop tier",
  };
}) as unknown as ResearchRow[];
const completionTools = getArchaeologyCollectionCompletionTools() as unknown as ResearchRow[];
const corrections = getArchaeologyDataCorrections().map((row) => {
  const loose = row as {
    name?: string;
    target_relic?: string;
    target_id?: string;
    id?: string;
    correction?: string;
    topic?: string;
  };
  return {
    ...row,
    name:
      loose.name ||
      loose.target_relic ||
      loose.target_id ||
      loose.id ||
      loose.topic ||
      loose.correction ||
      "Correction",
  };
}) as unknown as ResearchRow[];
const additions2026 = getCurrentArchaeologyRelicAdditions().map((row) => {
  const loose = row as { name?: string; relic_power?: string; id?: string };
  return {
    ...row,
    name: loose.name || loose.relic_power || loose.id || "Addition",
  };
}) as unknown as ResearchRow[];
const museumMatrix = getMuseumCollectionMatrix();
const productionRoutes = withCollectionName(
  production.production_collection_routes as unknown as Record<string, unknown>[],
);
const specialRelicRoutes = withCollectionName(
  specialRelics.collection_relic_routes as unknown as Record<string, unknown>[],
);
const pending2026 = withCollectionName(
  specialRelics.current_2026_pending_exact_collection as unknown as Record<string, unknown>[],
);

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
    (required.length > 1 ? required.join(" + ") : "");
  const status = String(loose.status || "obtainable");
  const reason = loose.unobtainable_reason ? ` · ${loose.unobtainable_reason}` : "";
  const chronotesFirst = loose.chronotes_first;
  return {
    id: loose.id,
    name: loose.name,
    recordType: "activity",
    category: status === "unobtainable" ? "museum · unobtainable" : "museum",
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
      status === "unobtainable" ? `Unobtainable${reason}` : "Obtainable",
      loose.collector ? `Collector ${loose.collector}` : "",
      Array.isArray(loose.dig_sites) && loose.dig_sites.length
        ? `Sites ${loose.dig_sites.join(", ")}`
        : "",
      loose.first_reward ? `Reward ${loose.first_reward}` : "",
      chronotesFirst != null ? `Chronotes ${chronotesFirst}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    requirements: [
      row.archaeology_level != null ? `Archaeology ${row.archaeology_level}` : "",
      ...required,
    ].filter(Boolean),
    confidence: row.confidence || "confirmed_wiki",
    // Pass full source_urls through — ResearchSection links() reads the array.
    source_urls: Array.isArray(row.source_urls) ? row.source_urls : undefined,
    source: row.source_urls?.[0]
      ? { source: "runescape-wiki", url: row.source_urls[0], title: row.name }
      : null,
  };
}) as unknown as ResearchRow[];

const TABS: ResearchTab[] = [
  {
    key: "museum-matrix",
    label: "Collections",
    description: "",
    rows: museumRows,
  },
  {
    key: "collections",
    label: "Collection relics",
    description: "",
    rows: collectionRoutes,
  },
  {
    key: "repeatables",
    label: "Repeatable rewards",
    description: "",
    rows: repeatables,
  },
  {
    key: "production",
    label: "Production routes",
    description: "",
    rows: productionRoutes,
  },
  {
    key: "qualifications",
    label: "Qualifications",
    description: "",
    rows: qualifications,
  },
  {
    key: "guild",
    label: "Guild shop",
    description: "",
    rows: [...guildShop, ...completionTools],
  },
  {
    key: "relic-system",
    label: "Relic system",
    description: "",
    rows: relicSystemRows,
  },
  {
    key: "relic-loadouts",
    label: "Relic loadouts",
    description: "",
    rows: relicLoadoutRows,
  },
  {
    key: "special-relics",
    label: "Special relics",
    description: "",
    rows: specialRelicRoutes,
  },
  {
    key: "corrections",
    label: "Updates",
    description: "",
    rows: [...corrections, ...additions2026, ...pending2026],
  },
];

export function ArchaeologyProductionResearch() {
  return (
    <ResearchSection
      title="Archaeology"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search"
      searchLabel="Search Archaeology"
    />
  );
}
