import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const CATALOG_PATH = "data/research/catalog.json";
const OUTPUT_PATH = "data/research/regional-combat-unlocks.json";
const ENRICHMENT_PATTERN = /^progression-enrichment-regional-combat.*\.json$/;

const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const write = (path, value) => {
  const target = join(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

const enrichmentFiles = readdirSync(join(ROOT, "scraped-data"))
  .filter((name) => ENRICHMENT_PATTERN.test(name))
  .sort();
if (!enrichmentFiles.length) throw new Error("No regional combat enrichment files found");

const enrichments = enrichmentFiles.map((name) => ({ name, data: read(`scraped-data/${name}`) }));
const catalog = read(CATALOG_PATH);
const verifiedAt = [catalog.snapshotDate, ...enrichments.map(({ data }) => data.snapshot_date)]
  .filter(Boolean)
  .sort()
  .at(-1);

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
  return [
    row.notes,
    row.league_treatment,
    list(row.effects).length ? `Effects: ${compact(row.effects)}` : "",
    list(row.unlocks).length ? `Unlocks: ${compact(row.unlocks)}` : "",
    list(row.rewards).length ? `Rewards: ${compact(row.rewards)}` : "",
    list(row.region_pressure).length ? `Region pressure: ${compact(row.region_pressure)}` : "",
    row.region_status ? `Region status: ${compact(row.region_status)}` : "",
  ].filter(Boolean).join(" · ");
}

function normalizeRow(row, recordType, sourceFile) {
  const hints = regionHints(row);
  return {
    id: row.id,
    name: row.name,
    recordType,
    category: row.category || "combat unlock",
    regionHints: hints,
    requiredRegions: list(row.required_regions).map(String),
    regionRequirementType: row.region_requirement_type || "",
    detail: detail(row),
    requirements: [...new Set([
      ...list(row.requirements).map(String),
      ...list(row.access_requirements).map(String),
      ...list(row.quest_dependencies).map(String),
    ])],
    confidence: row.confidence || "unclassified",
    source: sourceReference(row),
    sourceFile,
  };
}

const recordMap = new Map();
for (const { name, data } of enrichments) {
  for (const [recordType, rows] of [
    ["account", data.account_additions],
    ["activity", data.activity_additions],
    ["equipment", data.equipment_additions],
  ]) {
    for (const row of list(rows)) recordMap.set(row.id, normalizeRow(row, recordType, name));
  }
}
const records = [...recordMap.values()];

for (const region of catalog.regions || []) {
  region.upgrades ||= [];

  for (const upgrade of region.upgrades) {
    if (upgrade.name === "TzKal-Zuk progression" && typeof upgrade.detail === "string") {
      upgrade.detail = upgrade.detail
        .replace(/^Igneous capes,\s*/, "")
        .replace(/,\s*Igneous capes\b/, "")
        .replace(/\bIgneous capes,\s*/, "")
        .trim();
      const suffix = "Igneous cape acquisition is indexed separately as a Karamja + Misthalin chain.";
      if (!upgrade.detail.includes(suffix)) upgrade.detail = [upgrade.detail, suffix].filter(Boolean).join(" · ");
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
catalog.datasets.regionalCombatUnlocks = records.length;
catalog.datasets.regionalCombatAccounts = records.filter((row) => row.recordType === "account").length;
catalog.datasets.regionalCombatActivities = records.filter((row) => row.recordType === "activity").length;
catalog.datasets.regionalCombatEquipment = records.filter((row) => row.recordType === "equipment").length;

write(CATALOG_PATH, catalog);
write(OUTPUT_PATH, {
  snapshotDate: verifiedAt,
  purpose: "Region-defining combat support items, achievement passives, Archaeology relic chains, and cross-region equipment dependencies.",
  sourceFiles: enrichmentFiles,
  records,
});

console.log(
  `REGIONAL COMBAT SYNC\nFiles: ${enrichmentFiles.length}   Records: ${records.length}`,
);
