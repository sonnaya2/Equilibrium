import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import harvest from "../../data/research/reference-site-harvest.json";
import midgame from "../../data/reference/midgame-rebalance-2026-07-20.json";

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
    label: "Harvest",
    description: "",
    rows: harvestRows,
  },
  {
    key: "midgame",
    label: "Rebalance",
    description: "",
    rows: midgameRows,
  },
];

export function ReferenceNotesResearch() {
  return (
    <ResearchSection
      title="Notes"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search notes"
      searchLabel="Search notes"
    />
  );
}
