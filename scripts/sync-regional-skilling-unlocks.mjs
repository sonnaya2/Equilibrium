import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const ENRICHMENT_PATH = "scraped-data/progression-enrichment-regional-skilling-2026-07-25.json";
const CATALOG_PATH = "data/research/catalog.json";
const OUTPUT_PATH = "data/research/regional-skilling-unlocks.json";

const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const write = (path, value) => {
  const target = join(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

const enrichment = read(ENRICHMENT_PATH);
const catalog = read(CATALOG_PATH);
const verifiedAt = enrichment.snapshot_date || catalog.snapshotDate;

function list(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(compact).filter(Boolean).join(", ");
  return Object.entries(value)
    .map(([key, entry]) => `${key.replaceAll("_", " ")}: ${compact(entry)}`)
    .join(" · ");
}

function sourceKind(url) {
  if (!url) return "derived";
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host === "runescape.wiki" || host.endsWith(".runescape.wiki")) return "runescape-wiki";
  if (host === "secure.runescape.com" || host.endsWith(".runescape.com")) return "jagex";
  if (host === "pvme.io" || host.endsWith(".pvme.io")) return "pvme";
  if (host === "rs-analysis.xyz" || host.endsWith(".rs-analysis.xyz")) return "rs-analysis";
  return "derived";
}

function sourceReference(row) {
  const url = row.source_url || list(row.source_urls)[0];
  if (!url) return null;
  return {
    source: sourceKind(url),
    url,
    title: row.name,
    verifiedAt,
  };
}

function regionHints(row) {
  return [...new Set([
    row.region_hint,
    ...list(row.region_hints),
  ].filter(Boolean).map(String))];
}

function detail(row) {
  const pieces = [
    row.notes,
    row.league_treatment,
    row.rarity ? `Rarity: ${compact(row.rarity)}` : "",
    list(row.effects).length ? `Effects: ${compact(row.effects)}` : "",
    list(row.unlocks).length ? `Unlocks: ${compact(row.unlocks)}` : "",
    list(row.region_pressure).length ? `Region pressure: ${compact(row.region_pressure)}` : "",
    row.region_status ? `Region status: ${compact(row.region_status)}` : "",
  ].filter(Boolean);
  return pieces.join(" · ");
}

function normalizeRow(row, recordType) {
  return {
    id: row.id,
    name: row.name,
    recordType,
    category: row.category || "skilling unlock",
    regionHints: regionHints(row),
    detail: detail(row),
    requirements: [...new Set([
      ...list(row.requirements).map(String),
      ...list(row.access_requirements).map(String),
    ])],
    confidence: row.confidence || "unclassified",
    source: sourceReference(row),
  };
}

const activities = list(enrichment.activity_additions).map((row) => normalizeRow(row, "activity"));
const equipment = list(enrichment.equipment_additions).map((row) => normalizeRow(row, "equipment"));
const records = [...activities, ...equipment];

for (const region of catalog.regions || []) {
  const additions = records.filter((row) => row.regionHints.includes(region.id));
  region.upgrades ||= [];
  const existing = new Set(region.upgrades.map((row) => row.name));

  for (const row of additions) {
    if (existing.has(row.name)) continue;
    region.upgrades.push({
      name: row.name,
      category: row.category,
      detail: row.detail,
      requirements: row.requirements,
      confidence: row.confidence,
      source: row.source,
      regionId: region.id,
    });
    existing.add(row.name);
  }
}

catalog.datasets ||= {};
catalog.datasets.regionalSkillingUnlocks = records.length;
catalog.datasets.regionalSkillingActivities = activities.length;
catalog.datasets.regionalSkillingEquipment = equipment.length;

write(CATALOG_PATH, catalog);
write(OUTPUT_PATH, {
  snapshotDate: verifiedAt,
  purpose: enrichment.purpose,
  policy: enrichment.policy,
  records,
});

console.log(
  `REGIONAL SKILLING SYNC\nActivities: ${activities.length}   Equipment: ${equipment.length}   Total: ${records.length}`,
);
