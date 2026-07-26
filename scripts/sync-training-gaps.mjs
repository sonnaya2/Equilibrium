/**
 * Merge scraped-data/training-gap-*.json into data/research/catalog.json.
 * Sole post-step for gap fill (normalize-scraped-data no longer double-merges gaps).
 *
 * Handles methods, supply_routes (human method/name only), unlock_notes/unlocks with skill,
 * multi_region_combo, region_options, source/source_urls/sources.
 * Does not invent XP/h. Skips slug-only titles. Idempotent by skill|method key.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  GAP_PATTERN,
  expandGapFile,
  isSlugCatalogMethod,
  list,
  mergeNote,
  pickMethodName,
  slug,
  toCatalogMethod,
  dedupeNote,
} from "./lib/training-gaps.mjs";

const ROOT = process.cwd();
const CATALOG_PATH = "data/research/catalog.json";

const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const write = (path, value) => {
  const target = join(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

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
let skippedNoHumanName = 0;

for (const name of gapFiles) {
  const data = read(`scraped-data/${name}`);
  const expanded = expandGapFile({ name, data });
  rawCount +=
    list(data.methods).length +
    list(data.supply_routes).length +
    list(data.unlock_notes || data.unlocks).length;

  for (const raw of list(data.supply_routes)) {
    if (!pickMethodName(raw)) skippedNoHumanName += 1;
  }
  for (const raw of list(data.unlock_notes || data.unlocks)) {
    if ((raw?.skill || raw?.skills) && !pickMethodName(raw)) skippedNoHumanName += 1;
  }

  for (const raw of expanded) {
    const method = toCatalogMethod(raw, verifiedAt);
    if (!method) {
      skippedNoSource += 1;
      continue;
    }
    method.note = dedupeNote(method.note);
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

// Prune legacy slug / id-titled methods left by older normalize gap merge.
let pruned = 0;
for (const skill of catalog.skills || []) {
  const before = skill.methods?.length || 0;
  skill.methods = (skill.methods || []).filter((method) => {
    if (!isSlugCatalogMethod(method)) return true;
    byKey.delete(`${method.skill.toLowerCase()}|${method.method.toLowerCase()}`);
    byId.delete(method.id);
    for (const region of catalog.regions || []) {
      if (!region.trainingMethodIds) continue;
      region.trainingMethodIds = region.trainingMethodIds.filter((id) => id !== method.id);
    }
    pruned += 1;
    return false;
  });
  if ((skill.methods?.length || 0) !== before) {
    skill.regions = [...new Set((skill.methods || []).flatMap((m) => m.regionHints || []))];
  }
}

let added = 0;
let updated = 0;

for (const [key, method] of incoming) {
  if (byKey.has(key) || byId.has(method.id)) {
    const existing = byKey.get(key) || byId.get(method.id);
    const preferGap =
      !existing.location ||
      existing.xpRate === "not normalized yet" ||
      (method.regionHints.length > (existing.regionHints?.length || 0)) ||
      (!(existing.note || "").includes("gap_file:") && (method.note || "").includes("gap_file:"));

    if (preferGap) {
      Object.assign(existing, {
        ...method,
        id: existing.id,
        location: method.location || existing.location,
        levelRange: method.levelRange || existing.levelRange,
        intensity: method.intensity || existing.intensity,
        xpRate:
          method.xpRate && method.xpRate !== "not normalized yet"
            ? method.xpRate
            : existing.xpRate || method.xpRate,
        requirements:
          method.requirements?.length > 0 ? method.requirements : existing.requirements || [],
        regionHints: [
          ...new Set([...(existing.regionHints || []), ...(method.regionHints || [])]),
        ],
        note: mergeNote(existing.note, method.note),
      });
      updated += 1;
    } else {
      // Fold gap provenance / missing fragments; always dedupe.
      existing.note = mergeNote(existing.note, method.note);
      existing.regionHints = [
        ...new Set([...(existing.regionHints || []), ...(method.regionHints || [])]),
      ];
      if (!existing.location && method.location) existing.location = method.location;
    }
    existing.note = dedupeNote(existing.note);
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

// Global note dedupe (cleans legacy dual-merge residue).
let notesDeduped = 0;
for (const skill of catalog.skills || []) {
  for (const method of skill.methods || []) {
    const prev = method.note || "";
    const next = dedupeNote(prev);
    method.note = next;
    if (next !== prev) notesDeduped += 1;
  }
}

// Stable sort methods per skill.
for (const skill of catalog.skills || []) {
  skill.methods = [...(skill.methods || [])].sort(
    (a, b) => a.method.localeCompare(b.method) || a.id.localeCompare(b.id),
  );
}

const methodCount = (catalog.skills || []).reduce((n, s) => n + (s.methods?.length || 0), 0);
const herblore = (catalog.skills || []).find(
  (s) => s.id === "herblore" || s.name?.toLowerCase() === "herblore",
);
const herbloreCount = herblore?.methods?.length || 0;

catalog.datasets ||= {};
catalog.datasets.skills = (catalog.skills || []).length;
catalog.datasets.trainingMethods = methodCount;
catalog.datasets.regions = (catalog.regions || []).length;
catalog.snapshotDate = verifiedAt || catalog.snapshotDate;

const coverageNote =
  "gap-fill scrapes (training-gap-*.json, 2026-07-26) merged for Mining/Fishing/Farming/Woodcutting/artisan/production/Archaeology/Thieving/Fletching/Herblore routes without inventing XP/h";
if (catalog.coverage && typeof catalog.coverage.training === "string") {
  if (!catalog.coverage.training.includes("gap-fill scrapes")) {
    catalog.coverage.training = `${catalog.coverage.training}; ${coverageNote}`;
  } else if (!catalog.coverage.training.includes("Herblore")) {
    catalog.coverage.training = catalog.coverage.training.replace(
      "Fletching routes",
      "Fletching/Herblore routes",
    );
  }
}

write(CATALOG_PATH, catalog);

console.log(
  [
    "TRAINING GAP SYNC",
    `Files: ${gapFiles.length}`,
    `Raw surface rows: ${rawCount}`,
    `Expanded unique methods: ${incoming.size}`,
    `Skipped (no human method name): ${skippedNoHumanName}`,
    `Skipped (no source URL / coerce fail): ${skippedNoSource}`,
    `Pruned slug/id titles: ${pruned}`,
    `Added: ${added}`,
    `Updated: ${updated}`,
    `Notes de-duplicated: ${notesDeduped}`,
    `Herblore methods: ${herbloreCount}`,
    `Catalog training methods: ${methodCount}`,
  ].join("\n"),
);
