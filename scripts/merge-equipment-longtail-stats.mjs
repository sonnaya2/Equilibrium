/**
 * Merge scraped-data/equipment-stats-longtail-*.json into equipment.json.
 * Only fills records with no non-zero bonuses. Never overwrites existing stats.
 * Skips known bad redirects (see SKIP_IDS).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eqPath = path.join(root, "data/combat/equipment.json");
const scrapePath = path.join(
  root,
  "scraped-data/equipment-stats-longtail-2026-07-26.json",
);

/** Scrape mapped these to wrong pages / must stay empty. */
const SKIP_IDS = new Set([
  // empty-ID fix: renamed Glacyte boots; scrape redirected to Glaiven boots
  "item:glacier-boots",
]);

function hasNonZeroBonus(bonuses) {
  if (!bonuses || typeof bonuses !== "object") return false;
  return Object.values(bonuses).some((v) => typeof v === "number" && v !== 0);
}

function mergeSources(existing, incoming) {
  const out = Array.isArray(existing) ? [...existing] : [];
  const urls = new Set(out.map((s) => s?.url).filter(Boolean));
  for (const s of incoming ?? []) {
    if (!s?.url || urls.has(s.url)) continue;
    urls.add(s.url);
    out.push({
      source: s.source || "runescape-wiki",
      url: s.url,
      verifiedAt: s.verifiedAt || "2026-07-26",
      ...(s.title ? { title: s.title } : {}),
    });
  }
  return out;
}

const eq = JSON.parse(fs.readFileSync(eqPath, "utf8"));
const scrape = JSON.parse(fs.readFileSync(scrapePath, "utf8"));
const byId = new Map(eq.records.map((r) => [r.id, r]));

let filled = 0;
let skippedNonEmpty = 0;
let skippedNoBonus = 0;
let skippedMissing = 0;
let skippedBad = 0;
let tierSet = 0;
const filledIds = [];

for (const rec of scrape.records ?? []) {
  if (SKIP_IDS.has(rec.id)) {
    skippedBad++;
    continue;
  }
  if (!hasNonZeroBonus(rec.bonuses)) {
    skippedNoBonus++;
    continue;
  }
  const existing = byId.get(rec.id);
  if (!existing) {
    skippedMissing++;
    continue;
  }
  if (hasNonZeroBonus(existing.bonuses)) {
    skippedNonEmpty++;
    continue;
  }

  existing.bonuses = { ...rec.bonuses };
  if (rec.tier != null && existing.tier == null) {
    existing.tier = rec.tier;
    tierSet++;
  }
  if (rec.setId && !existing.setId) {
    existing.setId = rec.setId;
  }
  existing.sources = mergeSources(existing.sources, rec.sources);
  filled++;
  filledIds.push(rec.id);
}

eq.lastSynced = "2026-07-26";
fs.writeFileSync(eqPath, `${JSON.stringify(eq, null, 2)}\n`);

const wear = eq.records.filter((r) => r.slot);
const empty = wear.filter((r) => !hasNonZeroBonus(r.bonuses));

console.log(
  JSON.stringify(
    {
      filled,
      skippedNonEmpty,
      skippedNoBonus,
      skippedMissing,
      skippedBad,
      tierSet,
      wearables: wear.length,
      stillEmpty: empty.length,
      filledSample: filledIds.slice(0, 12),
      emptySample: empty.slice(0, 20).map((r) => r.id),
    },
    null,
    2,
  ),
);
