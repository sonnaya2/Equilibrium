import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

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

const VALID_REGIONS = new Set([
  "misthalin", "havenhythe", "karamja", "asgarnia", "kandarin",
  "fremennik", "forinthry", "desert", "morytania", "tirannwn", "anachronia",
]);

function normalizeRegionToken(raw) {
  const token = String(raw || "").trim().toLowerCase().replaceAll(" ", "_");
  if (!token) return "";
  if (token === "wilderness" || token === "wildy") return "forinthry";
  if (VALID_REGIONS.has(token)) return token;
  return "";
}

function regionHints(row) {
  const candidates = [
    row.region_hint,
    ...list(row.region_hints),
    ...list(row.required_regions),
  ];
  return [...new Set(candidates.map(normalizeRegionToken).filter(Boolean))];
}

function comboLabel(required, type) {
  if (required.length < 2) return "";
  const joiner = type === "all_required" ? " + " : " / ";
  const prefix = type === "all_required" ? "Region combo (all required)" : "Region chain (support pressure)";
  return `${prefix}: ${required.join(joiner)}`;
}

function detail(row, combo) {
  return [
    row.notes,
    row.league_treatment,
    combo,
    list(row.effects).length ? `Effects: ${compact(row.effects)}` : "",
    list(row.unlocks).length ? `Unlocks: ${compact(row.unlocks)}` : "",
    list(row.rewards).length ? `Rewards: ${compact(row.rewards)}` : "",
    list(row.region_pressure).length ? `Region pressure: ${compact(row.region_pressure)}` : "",
    row.region_status ? `Region status: ${compact(row.region_status)}` : "",
  ].filter(Boolean).join(" · ");
}

function normalizeRow(row, recordType, sourceFile) {
  const hints = regionHints(row);
  const required = [...new Set(list(row.required_regions).map(normalizeRegionToken).filter(Boolean))];
  let type = String(row.region_requirement_type || "").toLowerCase();
  if (type === "acquisition_region" && required.length <= 1) type = "single";
  if (!type) type = required.length > 1 ? "all_required" : hints.length > 1 ? "support" : "single";
  if (type === "all_required" && required.length <= 1 && hints.length <= 1) type = "single";
  const combo = comboLabel(required.length ? required : hints, type === "all_required" ? "all_required" : "support");
  return {
    id: row.id,
    name: row.name,
    recordType,
    category: row.category || "combat unlock",
    regionHints: [...new Set([...hints, ...required])],
    requiredRegions: required,
    regionRequirementType: type,
    comboLabel: combo,
    isRegionCombo: required.length > 1,
    detail: detail(row, combo),
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

/** Prefer skilling first-class rows when combat re-files the same item under a twin id. */
const DROP_IDS = new Set([
  "dungeoneering:bonecrusher-current", // keep forinthry:bonecrusher
  "dungeoneering:charming-imp-current", // keep forinthry:charming-imp
  "dungeoneering:demon-horn-necklace-current", // keep forinthry:demon-horn-necklace
  "dungeoneering:split-dragontooth-necklace-current", // keep forinthry:split-dragontooth-necklace
  "rum-deal:holy-wrench", // keep morytania:holy-wrench
  "salve-amulet:enchanted", // keep morytania:salve-amulet-enchanted
  // ring dual-file: keep cross-region combos, drop anachronia-only twins if both exist after sync
  "anachronia:channellers-ring",
  "anachronia:reavers-ring",
  // Mazcab = desert; Arc (Seiryu/ED1/seasinger) = asgarnia — restored in enrichment, not dropped
  "karamja:tokkul-zo", // keep skilling karamja:tokkul-zo
  "cross-region:eof-hydrix-component-pressure", // meta checklist; EoF equipment remains
  "cross-region:blessed-flask", // user remove 2026-07-26; keep skilling tirannwn:blessed-flask if present
]);

const recordMap = new Map();
for (const { name, data } of enrichments) {
  for (const [recordType, rows] of [
    ["account", data.account_additions],
    ["activity", data.activity_additions],
    ["equipment", data.equipment_additions],
  ]) {
    for (const row of list(rows)) {
      if (!row?.id || DROP_IDS.has(row.id)) continue;
      recordMap.set(row.id, normalizeRow(row, recordType, name));
    }
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
  const existingByName = new Map(region.upgrades.map((row) => [row.name, row]));
  for (const row of additions) {
    const prior = existingByName.get(row.name);
    if (prior) {
      // Backfill combo metadata — earlier syncs skipped existing names, so
      // multi-region combat rows often had requiredRegions without comboLabel.
      if (row.comboLabel) prior.comboLabel = row.comboLabel;
      if (row.requiredRegions?.length) prior.requiredRegions = row.requiredRegions;
      if (row.regionHints?.length) {
        prior.regionHints = [...new Set([...(prior.regionHints || []), ...row.regionHints])];
      }
      if (row.regionRequirementType) prior.regionRequirementType = row.regionRequirementType;
      if (row.isRegionCombo != null) prior.isRegionCombo = Boolean(row.isRegionCombo || prior.isRegionCombo);
      if (!prior.regionId) prior.regionId = region.id;
      continue;
    }
    const upgrade = {
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
      comboLabel: row.comboLabel,
      isRegionCombo: row.isRegionCombo,
    };
    region.upgrades.push(upgrade);
    existingByName.set(row.name, upgrade);
  }
}

catalog.datasets ||= {};
catalog.datasets.regionalCombatUnlocks = records.length;
catalog.datasets.regionalCombatAccounts = records.filter((row) => row.recordType === "account").length;
catalog.datasets.regionalCombatActivities = records.filter((row) => row.recordType === "activity").length;
catalog.datasets.regionalCombatEquipment = records.filter((row) => row.recordType === "equipment").length;
catalog.datasets.regionalCombatCombos = records.filter((row) => row.isRegionCombo).length;

const upgradeDedupe = dedupeRegionUpgrades(catalog);

write(CATALOG_PATH, catalog);
write(OUTPUT_PATH, {
  snapshotDate: verifiedAt,
  purpose: "Region-defining combat support items, achievement passives, Archaeology relic chains, and cross-region equipment dependencies.",
  sourceFiles: enrichmentFiles,
  records,
});

console.log(
  `REGIONAL COMBAT SYNC\nFiles: ${enrichmentFiles.length}   Records: ${records.length}   Upgrade fence: dropped ${upgradeDedupe.foreignSingleHomeDropped} foreign, moved ${upgradeDedupe.movedToHome}, within-dupes ${upgradeDedupe.withinRegionDupesRemoved}`,
);
