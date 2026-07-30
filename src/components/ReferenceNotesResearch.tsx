import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import harvest from "#data/research/reference-site-harvest.json";
import midgame from "#data/reference/midgame-rebalance-2026-07-20.json";

function asRows(value: unknown): ResearchRow[] {
  if (!Array.isArray(value)) return [];
  return value as ResearchRow[];
}

function humanizeId(id: string): string {
  return id
    .replace(/^(rsa|pvme)-/, "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sourceUrlsFromSources(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.startsWith("https://")) {
      if (!out.includes(item)) out.push(item);
      continue;
    }
    if (item && typeof item === "object" && "url" in item) {
      const url = (item as { url?: unknown }).url;
      if (typeof url === "string" && url.startsWith("https://") && !out.includes(url)) {
        out.push(url);
      }
    }
  }
  return out;
}

/** Harvest rows use `sources` (objects) + `id`/`summary` — ResearchSection only links source_urls/source. */
function harvestRows(): ResearchRow[] {
  return asRows(harvest.records).map((row) => {
    const id = typeof row.id === "string" ? row.id : "";
    const summary = typeof row.summary === "string" ? row.summary : "";
    const urls = sourceUrlsFromSources(row.sources);
    return {
      ...row,
      name: humanizeId(id) || summary.slice(0, 64) || "Note",
      category: typeof row.kind === "string" ? row.kind : "harvest",
      source_urls: urls.length ? urls : undefined,
      source: urls[0] ? { source: "harvest", url: urls[0], title: id } : row.source,
    };
  });
}

function midgameSectionRows(): ResearchRow[] {
  const rows: ResearchRow[] = [];
  const bag = midgame as Record<string, unknown>;
  const rootSource =
    typeof midgame.source === "string" && midgame.source.startsWith("https://")
      ? midgame.source
      : null;

  for (const [key, value] of Object.entries(bag)) {
    if (
      key === "date" ||
      key === "name" ||
      key === "source" ||
      key === "source_type" ||
      key === "sources"
    ) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object") {
          const e = entry as Record<string, unknown>;
          rows.push({
            ...e,
            category: key,
            name:
              (typeof e.name === "string" && e.name) ||
              (typeof e.course === "string" && e.course) ||
              key,
            source_url: rootSource,
          } as ResearchRow);
        } else {
          rows.push({ name: String(entry), category: key, source_url: rootSource });
        }
      }
      continue;
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const nestedOfficial =
        typeof obj.official_source === "string" && obj.official_source.startsWith("https://")
          ? obj.official_source
          : null;
      const summary =
        (typeof obj.summary === "string" && obj.summary) ||
        (typeof obj.planner_impact === "string" && obj.planner_impact) ||
        (typeof obj.note === "string" && obj.note) ||
        "";
      rows.push({
        name: key.replaceAll("_", " "),
        category: "system",
        detail: summary,
        ...obj,
        source_url: nestedOfficial || rootSource,
      });
    }
  }
  return rows;
}

const harvestMapped = harvestRows();
const midgameRows = midgameSectionRows();

const TABS: ResearchTab[] = [
  {
    key: "harvest",
    label: "Site notes",
    description: "",
    rows: harvestMapped,
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
      searchPlaceholder="Search"
      searchLabel="Search notes"
    />
  );
}
