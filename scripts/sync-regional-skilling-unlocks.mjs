import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const ROOT = process.cwd();
const CATALOG_PATH = "data/research/catalog.json";
const OUTPUT_PATH = "data/research/regional-skilling-unlocks.json";
const ENRICHMENT_PATTERN = /^progression-enrichment-regional-skilling.*\.json$/;

/** Valid Equilibrium elective region ids. */
const VALID_REGIONS = new Set([
  "misthalin",
  "havenhythe",
  "karamja",
  "asgarnia",
  "kandarin",
  "fremennik",
  "forinthry",
  "desert",
  "morytania",
  "tirannwn",
  "anachronia",
]);

const INVALID_REGION_TOKENS = new Set([
  "multi-region",
  "multi_region",
  "cross-region",
  "cross_region",
  "global",
  "global_once_supplied",
  "unresolved_zanaris",
  "arc_unresolved",
]);

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

function normalizeRegionToken(raw) {
  const token = String(raw || "").trim().toLowerCase().replaceAll(" ", "_");
  if (!token || INVALID_REGION_TOKENS.has(token)) return "";
  if (token === "wilderness" || token === "wildy") return "forinthry";
  if (token.startsWith("cross-region:") || token.startsWith("multi-region:")) return "";
  if (VALID_REGIONS.has(token)) return token;
  return "";
}

function collectRegions(row) {
  const candidates = [
    row.region_hint,
    ...list(row.region_hints),
    ...list(row.required_regions),
    ...list(row.artifact_regions),
    ...list(row.collector_regions),
    ...list(row.additional_item_regions),
    ...list(row.optional_pressure_regions),
    ...list(row.region_pressure).map((entry) =>
      typeof entry === "string" ? entry : entry?.region || entry?.id || "",
    ),
  ];
  return [...new Set(candidates.map(normalizeRegionToken).filter(Boolean))];
}

function collectRequired(row, hints) {
  const explicit = list(row.required_regions).map(normalizeRegionToken).filter(Boolean);
  if (explicit.length) return [...new Set(explicit)];

  const type = String(row.region_requirement_type || row.combo_type || "").toLowerCase();
  if (type === "support" || type === "any" || type === "optional" || type === "pressure") {
    return [];
  }
  if (
    type === "all_required" ||
    type === "combo" ||
    type === "hard" ||
    row.hard_region_requirement === true ||
    String(row.id || "").startsWith("cross-region:") ||
    /stack|combo|chain/i.test(String(row.name || "")) ||
    /stack|combo|chain/i.test(String(row.category || ""))
  ) {
    return hints.length > 1 ? hints : explicit;
  }

  if (String(row.id || "").startsWith("multi-region:") && hints.length > 1) {
    return hints;
  }
  return explicit;
}

function regionRequirementType(row, hints, required) {
  const raw = String(row.region_requirement_type || row.combo_type || "").toLowerCase();
  let type = "single";
  if (raw === "all_required" || raw === "combo" || raw === "hard") type = "all_required";
  else if (raw === "any") type = "any";
  else if (raw === "support" || raw === "pressure" || raw === "optional") type = "support";
  else if (raw === "single") type = "single";
  else if (required.length > 1) type = "all_required";
  else if (hints.length > 1) type = "support";
  // Hygiene: all_required with only one concrete region is noise — coerce to single
  if (type === "all_required" && required.length <= 1 && hints.length <= 1) return "single";
  return type;
}

function comboLabel(required, hints, type, id = "") {
  const regions = required.length > 1 ? required : hints.length > 1 ? hints : [];
  if (regions.length >= 2) {
    const joiner = type === "all_required" ? " + " : " / ";
    const prefix = type === "all_required" ? "Region combo (all required)" : "Region chain (support pressure)";
    return `${prefix}: ${regions.join(joiner)}`;
  }
  // multi/cross id with only one concrete region after token filter still needs a label
  const multiId = String(id).startsWith("multi-region:") || String(id).startsWith("cross-region:");
  if (multiId) {
    if (regions.length === 1) {
      return type === "all_required"
        ? `Region combo (all required): ${regions[0]} + (see requirements)`
        : `Region chain (support pressure): ${regions[0]} / (see requirements)`;
    }
    return type === "all_required"
      ? "Region combo (multi-source; see requirements)"
      : "Region chain (multi-source; see requirements)";
  }
  return "";
}

function detail(row, combo) {
  const pieces = [
    row.notes,
    row.league_treatment,
    combo,
    row.rarity ? `Rarity: ${compact(row.rarity)}` : "",
    list(row.effects).length ? `Effects: ${compact(row.effects)}` : "",
    list(row.unlocks).length ? `Unlocks: ${compact(row.unlocks)}` : "",
    list(row.region_pressure).length ? `Region pressure: ${compact(row.region_pressure)}` : "",
    row.region_status ? `Region status: ${compact(row.region_status)}` : "",
  ].filter(Boolean);
  return pieces.join(" · ");
}

function scoreRow(row) {
  let score = 0;
  if (row.source?.url) score += 3;
  if (row.requiredRegions?.length > 1) score += 4;
  if (row.regionHints?.length > 1) score += 2;
  if (row.detail?.length > 80) score += 2;
  if (row.requirements?.length) score += 1;
  if (String(row.id).startsWith("cross-region:")) score += 2;
  if (/pointer|boundary|overview|not a |hygiene|removed/i.test(row.name || "")) score -= 3;
  if (/pointer|boundary|no-area|removed/i.test(row.id || "")) score -= 2;
  return score;
}


/** Catalog emit hosts only. Pressure stays on row.regionHints for labels; do not clone there. */
function emitHostRegions(row) {
  const req = list(row.requiredRegions).filter(Boolean);
  if (req.length) return [...new Set(req)];
  const home = list(row.regionHints).filter(Boolean)[0];
  return home ? [home] : [];
}

function normalizeRow(row, recordType, sourceFile) {
  const regionHints = collectRegions(row);
  const requiredRegions = collectRequired(row, regionHints);
  const type = regionRequirementType(row, regionHints, requiredRegions);
  const hints = [...new Set([...regionHints, ...requiredRegions])];
  const combo = comboLabel(requiredRegions, hints, type, row.id);
  const multiId =
    String(row.id || "").startsWith("multi-region:") ||
    String(row.id || "").startsWith("cross-region:");

  return {
    id: row.id,
    name: row.name,
    recordType,
    regionHints: hints,
    requiredRegions,
    regionRequirementType: type,
    comboLabel: combo,
    isRegionCombo:
      requiredRegions.length > 1 ||
      (type === "all_required" && hints.length > 1) ||
      (multiId && Boolean(combo)),
    category: row.category || "skilling unlock",
    detail: detail(row, combo),
    requirements: [...new Set([
      ...list(row.requirements).map(String),
      ...list(row.access_requirements).map(String),
    ])],
    confidence: row.confidence || "unclassified",
    source: sourceReference(row),
    sourceFile,
  };
}

const NAME_CANONICAL = new Map([
  ["underworld grimoire 1-4", "misthalin:underworld-grimoire"],
  ["underworld grimoire", "misthalin:underworld-grimoire"],
  ["varrock armour 1-4", "misthalin:varrock-armour"],
  ["varrock armour", "misthalin:varrock-armour"],
  ["explorer's ring 1-4", "misthalin:explorers-ring"],
  ["explorer's ring", "misthalin:explorers-ring"],
  ["herb bag (herby werby)", "anachronia:herby-werby-herb-bag"],
  ["herb bag", "anachronia:herby-werby-herb-bag"],
  ["skillchompas", "kandarin:skillchompas"],
  ["skillchompa hunter and player-owned farm supply", "kandarin:skillchompas"],
  ["seedicide", "forinthry:seedicide-named"],
  ["seedicide (not a daemonheim reward)", "forinthry:seedicide-named"],
  ["always adze (seed of the charyou tree)", "kandarin:always-adze-relic"],
  ["always adze", "kandarin:always-adze-relic"],
  ["black ibis outfit", "desert:black-ibis-outfit"],
  ["first age outfit", "morytania:first-age-outfit-equipment"],
  ["first age outfit equipment", "morytania:first-age-outfit-equipment"],
  ["fishing outfit", "kandarin:fishing-outfit"],
  ["enhanced yaktwee stick", "kandarin:enhanced-yaktwee-stick"],
  ["sceptre of the gods", "desert:sceptre-of-the-gods"],
  ["warforge dig site", "kandarin:warforge-dig-site"],
  ["senntisten dig site", "misthalin:senntisten-dig-site"],
  ["wilderness herb patch", "forinthry:wilderness-herb-patch"],
  ["calquat farming patch", "karamja:calquat-farming-patch"],
  ["calquat patch", "karamja:calquat-farming-patch"],
  ["calquat tree patch (tai bwo wannai)", "karamja:calquat-farming-patch"],
  ["thieves' guild", "misthalin:thieves-guild"],
  ["thieves guild", "misthalin:thieves-guild"],
  ["thieves' guild master thief tools", "misthalin:thieves-guild-master-tools"],
  ["master thief's lockpick + master thief's stethoscope", "misthalin:thieves-guild-master-tools"],
  ["seers' village achievements", "kandarin:seers-headband"],
  ["seers' village achievements and seer's headband", "kandarin:seers-headband"],
  ["seers headband 1-4", "kandarin:seers-headband"],
  ["seer's headband 1-4", "kandarin:seers-headband"],
  ["seers' headband", "kandarin:seers-headband"],
  ["karamja gloves 1-4", "karamja:area-tasks-karamja-gloves"],
  ["karamja gloves skilling perks", "karamja:area-tasks-karamja-gloves"],
  ["slayer codex", "desert:slayer-codex-and-sunken-pyramid"],
  ["slayer codex and sunken pyramid soul system", "desert:slayer-codex-and-sunken-pyramid"],
  ["master runecrafter robes", "misthalin:master-runecrafter-robes"],
  ["runespan reward shop and master runecrafter robes", "misthalin:master-runecrafter-robes"],
  ["ritualist's outfit", "misthalin:ritualists-outfit"],
  ["austin's place and ritualist's outfit", "misthalin:ritualists-outfit"],
  ["ardougne cloak (ourania rune output)", "kandarin:area-tasks-ardougne-cloak"],
  ["ardougne cloak 1-4", "kandarin:area-tasks-ardougne-cloak"],
  ["morytania legs 1-4", "morytania:area-tasks-morytania-legs"],
  ["morytania legs", "morytania:area-tasks-morytania-legs"],
  ["fremennik sea boots 1-4", "fremennik:area-tasks-sea-boots"],
  ["fremennik sea boots", "fremennik:area-tasks-sea-boots"],
  ["perfect juju potions", "karamja:perfect-juju-potions"],
  ["perfect juju recipe hub", "karamja:perfect-juju-potions"],
  ["harmony pillars", "prifddinas:meilyr-harmony-pillars"],
  ["meilyr harmony pillars", "prifddinas:meilyr-harmony-pillars"],
  // GOTE planner dual-home (forinthry+tirannwn); thin name collapses to same id
  ["grace of the elves", "tirannwn:grace-of-the-elves"],
  ["grace of the elves (gote)", "tirannwn:grace-of-the-elves"],
]);

const DROP_IDS = new Set([
  "anachronia:herb-bag-skilling-pointer",
  "seedicide-not-daemonheim",
  "desert:no-master-farmer-outfit",
  // global:area-tasks-overview RESTORED — multi-host all_required diary frame (user KEEP)
  "kandarin:warforge-dig-site-boundary",
  "kandarin:fishing-trawler-boundary",
  "forinthry:crafteneering-boundary",
  "misthalin:area-tasks-underworld-grimoire",
  "misthalin:area-tasks-varrock-armour",
  "misthalin:area-tasks-explorers-ring",
  "anachronia:always-adze-relic",
  // skillchompa-supply RESTORED as first-class supply hub (continue pass; equipment row stays)
  // orthen-superheat-autoheater RESTORED as canonical 3-region AFK stack (final pass B5)
  "asgarnia:artisans-workshop-rewards",
  "forinthry:daemonheim-skilling-rewards",
  "desert:pyramid-plunder-black-ibis",
  "morytania:ectofuntus-first-age-outfit",
  "havenhythe:no-tear-of-the-mists",
  "misthalin:croesus-skilling-boss-boundary",
  "forinthry:demonic-skull-removed",
  "global:no-area-tasks",
  "desert:desert-amulet-4",
  "desert:dominion-tower-combat-pointer",
  "morytania:temple-trekking-construction-dependency",
  "anachronia:no-area-tasks-diary",
  "havenhythe:no-area-tasks-diary",
  "misthalin:infernal-source-dig-site",
  "misthalin:rune-goldberg-vis-wax", // removed from game 2026-03-16
  // FINAL PASS near-dup collapses
  "karamja:calquat-patch",
  "asgarnia:thieves-guild-master-tools",
  "kandarin:area-tasks-seers-headband",
  "kandarin:seers-village-achievements",
  "karamja:karamja-gloves-skilling",
  "desert:slayer-codex",
  "misthalin:runespan-master-runecrafter-robes",
  "misthalin:city-of-um-ritualist-outfit",
  "kandarin:ardougne-cloak-ourania",
  "karamja:juju-potions-pointer",
  // diary micro-splits → keep area-tasks ladder only
  "morytania:morytania-legs-1",
  "morytania:morytania-legs-2",
  "morytania:morytania-legs-3",
  "morytania:morytania-legs-4",
  "morytania:morytania-legs-1-4", // prefer morytania:area-tasks-morytania-legs
  "fremennik:fremennik-sea-boots", // prefer fremennik:area-tasks-sea-boots
  // near-dup collapse (continue pass)
  "karamja:perfect-juju-recipe-hub", // prefer karamja:perfect-juju-potions production row
  "tirannwn:harmony-pillars", // prefer prifddinas:meilyr-harmony-pillars
  // gatherer meta checklists
  "cross-region:pickaxe-progression-checklist",
  "cross-region:hatchet-progression-checklist",
  "cross-region:mattock-progression-checklist",
  "cross-region:gote-gather-porter-checklist",
  // fort residual micro-splits (parent fort hubs remain)
  "misthalin:fort-kitchen-never-fail-web-slash",
  "misthalin:fort-kitchen-soup-creation-station",
  "misthalin:fort-workshop-invention-machine-power",
  "misthalin:fort-chapel-burner-save-ladder",
  "misthalin:fort-guardhouse-slayer-passives",
  "misthalin:fort-town-hall-rested-conversion",
  "misthalin:fort-rangers-workroom-fletch-save",
  "misthalin:fort-botanist-unfinished-overload-prep",
  "misthalin:fort-grove-wood-spirit-and-box-storage",
  "fremennik:dragon-pickaxe-chaos-battlefield", // prefer fremennik:dragon-pickaxe
]);

const activityMap = new Map();
const equipmentMap = new Map();
for (const { name, data } of enrichments) {
  for (const row of list(data.activity_additions)) {
    if (!row?.id || !row?.name) continue;
    if (DROP_IDS.has(row.id)) continue;
    activityMap.set(row.id, normalizeRow(row, "activity", name));
  }
  for (const row of list(data.equipment_additions)) {
    if (!row?.id || !row?.name) continue;
    if (DROP_IDS.has(row.id)) continue;
    equipmentMap.set(row.id, normalizeRow(row, "equipment", name));
  }
}

function mergeMaps(...maps) {
  const out = new Map();
  for (const map of maps) {
    for (const [id, row] of map) {
      const prev = out.get(id);
      if (!prev || scoreRow(row) >= scoreRow(prev)) out.set(id, row);
    }
  }
  return out;
}

const mergedById = mergeMaps(activityMap, equipmentMap);

const byName = new Map();
for (const row of mergedById.values()) {
  const key = String(row.name || "").toLowerCase().trim();
  if (!key) continue;
  const canonicalId = NAME_CANONICAL.get(key);
  if (canonicalId && row.id !== canonicalId && mergedById.has(canonicalId)) {
    continue;
  }
  const prev = byName.get(key);
  if (!prev || scoreRow(row) > scoreRow(prev)) byName.set(key, row);
}

const keepIds = new Set([...byName.values()].map((r) => r.id));
for (const row of mergedById.values()) {
  if (row.id.startsWith("cross-region:") || row.isRegionCombo) keepIds.add(row.id);
}

const seenNames = new Map();
for (const row of mergedById.values()) {
  if (DROP_IDS.has(row.id)) continue;
  const key = String(row.name || "").toLowerCase().trim();
  if (NAME_CANONICAL.has(key) && row.id !== NAME_CANONICAL.get(key)) continue;
  const prev = seenNames.get(key);
  if (!prev || scoreRow(row) > scoreRow(prev)) seenNames.set(key, row);
}

const winners = new Set([...seenNames.values()].map((r) => r.id));
let records = [...mergedById.values()].filter((row) => {
  if (DROP_IDS.has(row.id)) return false;
  const key = String(row.name || "").toLowerCase().trim();
  if (NAME_CANONICAL.has(key) && row.id !== NAME_CANONICAL.get(key)) return false;
  if (seenNames.has(key)) return winners.has(row.id);
  return keepIds.has(row.id);
});

records.sort((a, b) => a.id.localeCompare(b.id));

const activities = records.filter((r) => r.recordType === "activity");
const equipment = records.filter((r) => r.recordType === "equipment");
const comboCount = records.filter((r) => r.isRegionCombo).length;
const labeledChains = records.filter((r) => r.comboLabel).length;

for (const region of catalog.regions || []) {
  region.upgrades ||= [];

  for (const upgrade of region.upgrades) {
    if (upgrade.name === "Croesus progression" && typeof upgrade.detail === "string") {
      upgrade.detail = upgrade.detail
        .replaceAll("Croesus foultorch", "Sana's fyrtorch")
        .replaceAll("Croesus sporehammer", "Tagga's corehammer");
    }
  }

  const skillingNames = new Set(records.map((r) => r.name));
  // Also drop catalog aliases whose name canonicalizes to a skilling winner id
  const skillingIds = new Set(records.map((r) => r.id));
  region.upgrades = region.upgrades.filter((u) => {
    if (skillingNames.has(u.name)) return false;
    const canon = NAME_CANONICAL.get(String(u.name || "").toLowerCase().trim());
    if (canon && skillingIds.has(canon) && !skillingNames.has(u.name)) return false;
    return true;
  });

  const additions = records.filter((row) => emitHostRegions(row).includes(region.id));
  const existing = new Set(region.upgrades.map((row) => row.name));

  for (const row of additions) {
    if (existing.has(row.name)) {
      // Backfill combo fields on pre-existing catalog upgrade rows (diaries, GOTE, etc.)
      const prior = region.upgrades.find((u) => u.name === row.name);
      if (prior) {
        if (row.comboLabel) prior.comboLabel = row.comboLabel;
        if (row.requiredRegions?.length) prior.requiredRegions = row.requiredRegions;
        if (row.regionHints?.length) prior.regionHints = row.regionHints;
        if (row.regionRequirementType) prior.regionRequirementType = row.regionRequirementType;
        if (row.isRegionCombo != null) prior.isRegionCombo = row.isRegionCombo;
        if (!prior.regionId) prior.regionId = region.id;
      }
      continue;
    }
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
      comboLabel: row.comboLabel,
      isRegionCombo: row.isRegionCombo,
    });
    existing.add(row.name);
  }

  // Synthesize comboLabel for any multi-req upgrade still missing it
  for (const upgrade of region.upgrades) {
    const req = Array.isArray(upgrade.requiredRegions) ? upgrade.requiredRegions : [];
    if (req.length > 1 && !upgrade.comboLabel) {
      upgrade.comboLabel = `Region combo (all required): ${req.join(" + ")}`;
      upgrade.isRegionCombo = true;
      if (!upgrade.regionRequirementType) upgrade.regionRequirementType = "all_required";
    }
  }
}

catalog.datasets ||= {};
catalog.datasets.regionalSkillingUnlocks = records.length;
catalog.datasets.regionalSkillingActivities = activities.length;
catalog.datasets.regionalSkillingEquipment = equipment.length;
catalog.datasets.regionalSkillingCombos = comboCount;

const upgradeDedupe = dedupeRegionUpgrades(catalog);

write(CATALOG_PATH, catalog);
write(OUTPUT_PATH, {
  snapshotDate: verifiedAt,
  purpose:
    "Region-defining skilling activities, shops, outfits, off-hands, tool chains and production infrastructure for Equilibrium planning. Multi-region unlocks carry requiredRegions + comboLabel.",
  sourceFiles: enrichmentFiles,
  stats: {
    total: records.length,
    activities: activities.length,
    equipment: equipment.length,
    regionCombos: comboCount,
    comboLabeled: labeledChains,
  },
  records,
});

console.log(
  [
    "REGIONAL SKILLING SYNC",
    `Files: ${enrichmentFiles.length}`,
    `Activities: ${activities.length}`,
    `Equipment: ${equipment.length}`,
    `Total: ${records.length}`,
    `Combos (all required): ${comboCount}`,
    `Combo-labeled rows: ${labeledChains}`,
    `Upgrade fence: dropped ${upgradeDedupe.foreignSingleHomeDropped} foreign, moved ${upgradeDedupe.movedToHome}, within-dupes ${upgradeDedupe.withinRegionDupesRemoved}`,
  ].join("   "),
);
