import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import harvest from "../../data/research/reference-site-harvest.json";
import midgame from "../../data/reference/midgame-rebalance-2026-07-20.json";

/**
 * Notes-only surfaces: never treat as combat/math constants.
 * Harvest = mechanic/dependency notes; midgame = official Jul 2026 rebalance tables.
 */

function asRows(value: unknown): ResearchRow[] {
  if (!Array.isArray(value)) return [];
  return value as ResearchRow[];
}

function midgameSectionRows(): ResearchRow[] {
  const rows: ResearchRow[] = [];
  const bag = midgame as Record<string, unknown>;
  for (const [key, value] of Object.entries(bag)) {
    if (key === "date" || key === "name" || key === "source" || key === "source_type" || key === "sources") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object") {
          rows.push({ ...(entry as object), category: key, name: (entry as { name?: string }).name ?? key } as ResearchRow);
        } else {
          rows.push({ name: String(entry), category: key });
        }
      }
      continue;
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      rows.push({
        name: key.replaceAll("_", " "),
        category: "system",
        detail: Object.entries(obj)
          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
          .join(" · "),
        ...obj,
      });
    }
  }
  return rows;
}

const harvestRows = asRows(harvest.records);
const midgameRows = midgameSectionRows();

const TABS: ResearchTab[] = [
  {
    key: "harvest",
    label: "Site harvest notes",
    description: `${harvestRows.length} PvME / RS Analysis mechanic and dependency notes. Not optimizer constants or boss guides.`,
    rows: harvestRows,
  },
  {
    key: "midgame",
    label: "July 2026 rebalance",
    description: `Official mid-game rebalance reference (${midgame.date ?? "2026-07-20"}). Use for freshness, not as a second combat engine.`,
    rows: midgameRows,
  },
];

export function ReferenceNotesResearch() {
  return (
    <ResearchSection
      title="Reference notes"
      intro="Sourced research notes and official rebalance tables kept out of the combat calculator. Read as context when planning skills and unlocks."
      tabs={TABS}
      searchPlaceholder="Search reference notes"
      searchLabel="Search reference notes"
    />
  );
}
