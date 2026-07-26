/**
 * Merge scraped-data/training-gap-*.json into data/research/catalog.json.
 * Does not invent XP/h — location, region options, requirements and notes only.
 * Idempotent by method id: later gap files win on the same skill|method key.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const CATALOG_PATH = "data/research/catalog.json";
const GAP_PATTERN = /^training-gap-.*\.json$/;

const REGION_IDS = new Set([
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

const REGION_ALIASES = {
  wilderness: "forinthry",
  wildy: "forinthry",
  "kharidian desert": "desert",
  "fremennik province": "fremennik",
  "city of um": "misthalin",
  underworld: "misthalin",
  "fort forinthry": "misthalin",
};

const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const write = (path, value) => {
  const target = join(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((v) => text(v)).filter(Boolean).join(" · ");
  return fallback;
}

function normalizeRegionId(raw) {
  if (!raw) return null;
  const key = String(raw).toLowerCase().trim();
  if (REGION_IDS.has(key)) return key;
  if (REGION_ALIASES[key]) return REGION_ALIASES[key];
  // Drop planner-only pseudo regions like multi-region.
  return null;
}

function sourceKind(url) {
  if (!url) return "derived";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "runescape.wiki" || host.endsWith(".runescape.wiki")) return "runescape-wiki";
    if (host === "secure.runescape.com" || host.endsWith(".runescape.com")) return "jagex";
    if (host === "pvme.io" || host.endsWith(".pvme.io")) return "pvme";
    if (host === "rs-analysis.xyz" || host.endsWith(".rs-analysis.xyz")) return "rs-analysis";
  } catch {
    return "derived";
  }
  return "derived";
}

function sourceReference(url, title, verifiedAt) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) return null;
  return {
    source: sourceKind(url),
    url,
    title,
    verifiedAt,
  };
}

function collectRegionHints(raw) {
  const hints = new Set();
  for (const key of ["region", "method_region"]) {
    const id = normalizeRegionId(raw[key]);
    if (id) hints.add(id);
  }
  for (const value of list(raw.regions)) {
    const id = normalizeRegionId(value);
    if (id) hints.add(id);
  }
  for (const value of list(raw.multi_region_combo)) {
    const id = normalizeRegionId(value);
    if (id) hints.add(id);
  }
  for (const opt of list(raw.region_options)) {
    const id = normalizeRegionId(opt?.region);
    if (id) hints.add(id);
  }
  return [...hints];
}

function locationFrom(raw) {
  if (text(raw.location)) return text(raw.location);
  const opts = list(raw.region_options);
  if (opts.length === 0) return "";
  return opts
    .map((opt) => {
      const region = normalizeRegionId(opt.region) || text(opt.region);
      const place = text(opt.location);
      return place ? `${region}: ${place}` : region;
    })
    .filter(Boolean)
    .join(" · ");
}

function requirementsFrom(raw) {
  const out = new Set(list(raw.requirements).map(String));
  for (const opt of list(raw.region_options)) {
    for (const req of list(opt.requirements)) out.add(String(req));
  }
  return [...out];
}

function notesFrom(raw) {
  const parts = [];
  if (Array.isArray(raw.notes)) parts.push(...raw.notes.map(String));
  else if (raw.notes) parts.push(String(raw.notes));
  if (raw.note) parts.push(String(raw.note));
  if (raw.gap) parts.push(`Gap: ${raw.gap}`);
  if (raw.xp_rate_note) parts.push(String(raw.xp_rate_note));
  if (raw.planner_coverage) parts.push(`Planner coverage: ${raw.planner_coverage}`);
  const multi = list(raw.multi_region_combo).map(normalizeRegionId).filter(Boolean);
  if (multi.length > 1) parts.push(`Region options: ${multi.join(" / ")}`);
  return parts.filter(Boolean).join(" · ");
}

function methodId(skill, method) {
  return `${slug(skill)}:${slug(method)}`;
}

function toCatalogMethod(raw, verifiedAt) {
  const skill = text(raw.skill, "Unknown");
  const method = text(raw.method, "Unnamed method");
  if (!skill || skill === "Unknown" || !method || method === "Unnamed method") return null;

  const url = text(raw.source) || list(raw.source_urls)[0] || "";
  const source = sourceReference(url, method, verifiedAt);
  // Require a real URL — same policy as normalize-scraped-data training import.
  if (!source?.url) return null;

  const regionHints = collectRegionHints(raw);
  const xpRate = text(raw.xp_rate) || text(raw.base_xp_per_hour) || "not normalized yet";

  return {
    id: raw.id && typeof raw.id === "string" && raw.id.includes(":")
      ? raw.id
      : methodId(skill, method),
    skill,
    method,
    levelRange: text(raw.level_range || raw.level || ""),
    xpRate,
    intensity: text(raw.intensity || ""),
    location: locationFrom(raw),
    requirements: requirementsFrom(raw),
    requiredUnlock: text(raw.required_unlock || ""),
    resourceSource: text(raw.resource_source || raw.ore || raw.tree || ""),
    hardRegionRequirement: Boolean(raw.hard_region_requirement),
    regionHints,
    note: notesFrom(raw),
    warning: text(raw.warning || raw.region_warning || ""),
    freshness: text(raw.freshness || "2026_gap_fill"),
    confidence: text(raw.confidence || "confirmed_wiki"),
    source,
  };
}

const gapFiles = readdirSync(join(ROOT, "scraped-data"))
  .filter((name) => GAP_PATTERN.test(name))
  .sort();

if (gapFiles.length === 0) {
  console.error("No training-gap-*.json files in scraped-data/");
  process.exit(1);
}

const catalog = read(CATALOG_PATH);
const verifiedAt = [
  catalog.snapshotDate,
  ...gapFiles.map((name) => read(`scraped-data/${name}`).snapshot_date),
]
  .filter(Boolean)
  .sort()
  .at(-1);

const incoming = new Map();
let rawCount = 0;
let skippedNoSource = 0;

for (const name of gapFiles) {
  const data = read(`scraped-data/${name}`);
  for (const raw of list(data.methods)) {
    rawCount += 1;
    const method = toCatalogMethod(raw, verifiedAt);
    if (!method) {
      skippedNoSource += 1;
      continue;
    }
    incoming.set(`${method.skill.toLowerCase()}|${method.method.toLowerCase()}`, method);
  }
}

// Index existing methods by skill|method and by id.
const byKey = new Map();
const byId = new Map();
for (const skill of catalog.skills || []) {
  for (const method of skill.methods || []) {
    byKey.set(`${method.skill.toLowerCase()}|${method.method.toLowerCase()}`, method);
    byId.set(method.id, method);
  }
}

let added = 0;
let updated = 0;

for (const [key, method] of incoming) {
  if (byKey.has(key) || byId.has(method.id)) {
    // Prefer richer gap row only when existing has empty location / placeholder rate.
    const existing = byKey.get(key) || byId.get(method.id);
    const preferGap =
      !existing.location ||
      existing.xpRate === "not normalized yet" ||
      (method.regionHints.length > (existing.regionHints?.length || 0));
    if (preferGap) {
      Object.assign(existing, {
        ...method,
        // Keep original id if already referenced from regions.
        id: existing.id,
      });
      updated += 1;
    }
    continue;
  }

  let skillEntry = (catalog.skills || []).find(
    (s) => s.id === slug(method.skill) || s.name.toLowerCase() === method.skill.toLowerCase(),
  );
  if (!skillEntry) {
    skillEntry = {
      id: slug(method.skill),
      name: method.skill,
      regions: method.regionHints,
      methods: [],
    };
    catalog.skills.push(skillEntry);
  }
  skillEntry.methods.push(method);
  skillEntry.regions = [...new Set([...(skillEntry.regions || []), ...method.regionHints])];
  byKey.set(key, method);
  byId.set(method.id, method);
  added += 1;

  for (const regionId of method.regionHints) {
    const region = (catalog.regions || []).find((r) => r.id === regionId);
    if (!region) continue;
    region.trainingMethodIds ||= [];
    if (!region.trainingMethodIds.includes(method.id)) {
      region.trainingMethodIds.push(method.id);
    }
    region.skills = [...new Set([...(region.skills || []), method.skill])];
  }
}

// Stable sort methods per skill.
for (const skill of catalog.skills || []) {
  skill.methods = [...(skill.methods || [])].sort((a, b) =>
    a.method.localeCompare(b.method) || a.id.localeCompare(b.id),
  );
}

const methodCount = (catalog.skills || []).reduce((n, s) => n + (s.methods?.length || 0), 0);
catalog.datasets ||= {};
catalog.datasets.skills = (catalog.skills || []).length;
catalog.datasets.trainingMethods = methodCount;
catalog.datasets.regions = (catalog.regions || []).length;
catalog.snapshotDate = verifiedAt || catalog.snapshotDate;

const coverageNote =
  "gap-fill scrapes (training-gap-*.json, 2026-07-26) merged for Mining/Fishing/Farming/Woodcutting/artisan/production/Archaeology/Thieving/Fletching routes without inventing XP/h";
if (catalog.coverage && typeof catalog.coverage.training === "string") {
  if (!catalog.coverage.training.includes("gap-fill scrapes")) {
    catalog.coverage.training = `${catalog.coverage.training}; ${coverageNote}`;
  }
}

write(CATALOG_PATH, catalog);

console.log(
  [
    "TRAINING GAP SYNC",
    `Files: ${gapFiles.length}`,
    `Raw methods: ${rawCount}`,
    `Skipped (no source URL): ${skippedNoSource}`,
    `Added: ${added}`,
    `Updated: ${updated}`,
    `Catalog training methods: ${methodCount}`,
  ].join("\n"),
);
