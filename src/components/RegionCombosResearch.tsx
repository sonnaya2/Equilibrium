import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import combosData from "../../data/research/region-combos.json";
import combat from "../../data/research/regional-combat-unlocks.json";
import {
  getMuseumCollectionMatrix,
  getUnobtainableMuseumCollections,
  type MuseumCollectionMatrixRow,
} from "@/research/archaeologyPlanner";

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

const museumMatrix = getMuseumCollectionMatrix();
const unobtainableMuseum = getUnobtainableMuseumCollections();
const museumMulti = museumMatrix.filter((row) => (row.required_regions ?? []).length > 1);

function museumToRow(row: MuseumCollectionMatrixRow): ResearchRow {
  const required = (row.required_regions ?? []) as string[];
  const artifacts = (row.artifact_regions ?? []) as string[];
  const collectors = (row.collector_regions ?? []) as string[];
  const status = String(row.status || "obtainable");
  const combo =
    row.comboLabel ||
    (required.length > 1 ? `Region combo (all required): ${required.join(" + ")}` : "");
  const reason = row.unobtainable_reason ? ` · ${row.unobtainable_reason}` : "";
  return {
    id: row.id,
    name: row.name,
    recordType: "activity",
    category: status === "unobtainable" ? "museum collection (unobtainable)" : "museum collection",
    regionHints: [...new Set([...required, ...artifacts, ...collectors])],
    requiredRegions: required,
    regionRequirementType: required.length > 1 ? "all_required" : "single",
    comboLabel: combo,
    isRegionCombo: required.length > 1,
    status,
    dig_sites: row.dig_sites,
    collector: row.collector,
    first_reward: row.first_reward,
    chronotes: row.chronotes,
    archaeology_level: row.archaeology_level,
    detail: [
      combo,
      status === "unobtainable" ? `UNOBTAINABLE${reason}` : "Obtainable in Equilibrium elective regions",
      row.collector ? `Collector: ${row.collector}` : "",
      Array.isArray(row.dig_sites) && row.dig_sites.length
        ? `Dig sites: ${row.dig_sites.join(", ")}`
        : "",
      row.first_reward ? `First reward: ${row.first_reward}` : "",
      row.chronotes != null ? `Chronotes: ${row.chronotes}` : "",
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
}

const museumRows = museumMulti.map(museumToRow);

const combatRows = (combat.records || []) as ResearchRow[];
const combatCombos = combatRows.filter(
  (row) =>
    Boolean(row.comboLabel) ||
    (Array.isArray(row.requiredRegions) && (row.requiredRegions as string[]).length > 1),
);

const TABS: ResearchTab[] = [
  {
    key: "all-combos",
    label: "All combos",
    description: "",
    rows: combos as ResearchRow[],
  },
  {
    key: "hard-required",
    label: "Hard multi-region",
    description: "",
    rows: hard as ResearchRow[],
  },
  {
    key: "pressure-only",
    label: "Pressure only",
    description: "",
    rows: pressure as ResearchRow[],
  },
  {
    key: "museum-multi",
    label: "Museum multi-region",
    description: "",
    rows: museumRows,
  },
  {
    key: "combat-multi",
    label: "Combat multi-region",
    description: "",
    rows: combatCombos,
  },
  {
    key: "modeled",
    label: "Already modeled",
    description: "",
    rows: [...modeled, ...partial] as ResearchRow[],
  },
  {
    key: "gaps",
    label: "Planner gaps",
    description: "",
    rows: gaps as ResearchRow[],
  },
  {
    key: "global-issues",
    label: "Global issues",
    description: "",
    rows: issues as ResearchRow[],
  },
];

export function RegionCombosResearch() {
  const counts = combosData.counts as { combos?: number; globalIssues?: number } | undefined;
  return (
    <ResearchSection
      title="Region combos"
      intro={`${counts?.combos ?? combos.length} skilling · ${museumMulti.length} museum · ${combatCombos.length} combat · ${counts?.globalIssues ?? issues.length} issues`}
      tabs={TABS}
      searchPlaceholder="Search region combos"
      searchLabel="Search region combos"
    />
  );
}
