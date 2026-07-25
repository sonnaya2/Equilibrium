import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const CATALOG_PATH = "data/research/catalog.json";
const OUTPUT_PATH = "data/research/regional-skilling-unlocks.json";
const ENRICHMENT_PATTERN = /^progression-enrichment-regional-skilling.*\.json$/;

const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const write = (path, value) => {
  const target = join(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

const enrichmentFiles = readdirSync(join(ROOT, "scraped-data"))
  .filter((name) => ENRICHMENT_PATTERN.test(name))
  .sort();
if (enrichmentFiles.length === 0) {
  throw new Error("No regional skilling enrichment files found");
}

const enrichments = enrichmentFiles.map((name) => ({ name, data: read(`scraped-data/${name}`) }));
const catalog = read(CATALOG_PATH);
const verifiedAt = [
  catalog.snapshotDate,
  ...enrichments.map(({ data }) => data.snapshot_date),
].filter(Boolean).sort().at(-1);

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
    ...list(row.required_regions),
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

function normalizeRow(row, recordType, sourceFile) {
  return {
    id: row.id,
    name: row.name,
    recordType,
    regionHints: regionHints(row),
    requiredRegions: list(row.required_regions).map(String),
    regionRequirementType: row.region_requirement_type || "",
    category: row.category || "skilling unlock",
    detail: detail(row),
    requirements: [...new Set([
      ...list(row.requirements).map(String),
      ...list(row.access_requirements).map(String),
    ])],
    confidence: row.confidence || "unclassified",
    source: sourceReference(row),
    sourceFile,
  };
}

const activityMap = new Map();
const equipmentMap = new Map();
for (const { name, data } of enrichments) {
  for (const row of list(data.activity_additions)) {
    activityMap.set(row.id, normalizeRow(row, "activity", name));
  }
  for (const row of list(data.equipment_additions)) {
    equipmentMap.set(row.id, normalizeRow(row, "equipment", name));
  }
}
const activities = [...activityMap.values()];
const equipment = [...equipmentMap.values()];
const records = [...activities, ...equipment];

for (const region of catalog.regions || []) {
  region.upgrades ||= [];

  // Canonicalize two old Croesus placeholder labels while the source dataset is
  // gradually migrated to first-class equipment records.
  for (const upgrade of region.upgrades) {
    if (upgrade.name === "Croesus progression" && typeof upgrade.detail === "string") {
      upgrade.detail = upgrade.detail
        .replaceAll("Croesus foultorch", "Sana's fyrtorch")
        .replaceAll("Croesus sporehammer", "Tagga's corehammer");
    }
  }

  const additions = records.filter((row) => row.regionHints.includes(region.id));
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
      regionHints: row.regionHints,
      requiredRegions: row.requiredRegions,
      regionRequirementType: row.regionRequirementType,
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
  purpose: "Region-defining skilling activities, shops, outfits, off-hands, tool chains and production infrastructure for Equilibrium planning.",
  sourceFiles: enrichmentFiles,
  records,
});

console.log(
  `REGIONAL SKILLING SYNC\nFiles: ${enrichmentFiles.length}   Activities: ${activities.length}   Equipment: ${equipment.length}   Total: ${records.length}`,
);
