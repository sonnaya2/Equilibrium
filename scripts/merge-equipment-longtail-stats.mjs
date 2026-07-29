/**
 * Merge scraped-data/equipment-stats-*-2026-07-26.json into equipment.json.
 * Only fills records with no non-zero bonuses. Never overwrites existing stats.
 * Never touches unlock.regions. Skips known bad redirects (see SKIP_IDS).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eqPath = path.join(root, "data/combat/equipment.json");
const scrapedDir = path.join(root, "scraped-data");
const TODAY = "2026-07-26";

/** Scrape mapped these to wrong pages / must stay empty. */
const SKIP_IDS = new Set([
  // empty-ID fix: renamed Glacyte boots; scrape redirected to Glaiven boots
  "item:glacier-boots",
  // ancient-rebounder longtail scrape now carries real accuracy+armour — do not skip
]);

const ALLOWED_BONUS_KEYS = new Set(["damage", "accuracy", "armour", "prayer", "life"]);

function hasNonZeroBonus(bonuses) {
  if (!bonuses || typeof bonuses !== "object") return false;
  return Object.values(bonuses).some((v) => typeof v === "number" && v !== 0);
}

/** Keeps known combat stat keys with non-zero sourced values. */
function pickBonuses(bonuses) {
  if (!bonuses || typeof bonuses !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(bonuses)) {
    if (!ALLOWED_BONUS_KEYS.has(k)) continue;
    if (typeof v === "number" && Number.isFinite(v) && v !== 0) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
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
      verifiedAt: s.verifiedAt || TODAY,
      ...(s.title ? { title: s.title } : {}),
    });
  }
  return out;
}

function sourcesFromRec(rec) {
  if (Array.isArray(rec.sources) && rec.sources.length) return rec.sources;
  if (rec.wiki?.url) {
    return [
      {
        source: "runescape-wiki",
        url: rec.wiki.url,
        verifiedAt: rec.wiki.verifiedAt || TODAY,
        ...(rec.wiki.title ? { title: rec.wiki.title } : {}),
      },
    ];
  }
  return [];
}

function loadScrapeFiles() {
  const names = fs
    .readdirSync(scrapedDir)
    .filter((f) => f.startsWith("equipment-stats-") && f.endsWith(`-${TODAY}.json`))
    .sort();
  /** @type {Map<string, {id:string,bonuses:object,tier?:number|null,setId?:string|null,sources:any[],_from:string}>} */
  const byId = new Map();
  const fileStats = {};
  for (const name of names) {
    const full = path.join(scrapedDir, name);
    const j = JSON.parse(fs.readFileSync(full, "utf8"));
    let withBonus = 0;
    for (const rec of j.records ?? []) {
      const bonuses = pickBonuses(rec.bonuses);
      if (!bonuses) continue;
      withBonus++;
      const prev = byId.get(rec.id);
      // Prefer the scrape with more bonus keys; on tie, first file wins (stable sort).
      if (prev && Object.keys(prev.bonuses).length >= Object.keys(bonuses).length) continue;
      byId.set(rec.id, {
        id: rec.id,
        bonuses,
        tier: rec.tier ?? null,
        setId: rec.setId || null,
        sources: sourcesFromRec(rec),
        _from: name,
      });
    }
    fileStats[name] = { records: (j.records ?? []).length, withBonus };
  }
  return { byId, fileStats, names };
}

const eq = JSON.parse(fs.readFileSync(eqPath, "utf8"));
const regionBefore = new Map(
  eq.records.map((r) => [r.id, JSON.stringify(r.unlock?.regions ?? null)]),
);

const { byId: scrapeById, fileStats, names } = loadScrapeFiles();
const byId = new Map(eq.records.map((r) => [r.id, r]));

let filled = 0;
let skippedNonEmpty = 0;
let skippedNoBonus = 0;
let skippedMissing = 0;
let skippedBad = 0;
let tierSet = 0;
const filledIds = [];
const filledDetail = [];

for (const rec of scrapeById.values()) {
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

  // Only assign bonuses — never touch unlock / regions / style / slot / name
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
  filledDetail.push({
    id: rec.id,
    name: existing.name,
    tier: existing.tier,
    slot: existing.slot,
    style: existing.style,
    bonuses: { ...rec.bonuses },
    from: rec._from,
  });
}

// region integrity check
let regionMutations = 0;
for (const r of eq.records) {
  const before = regionBefore.get(r.id);
  const after = JSON.stringify(r.unlock?.regions ?? null);
  if (before !== after) regionMutations++;
}
if (regionMutations > 0) {
  throw new Error(`Region wipe detected on ${regionMutations} records — aborting write`);
}

eq.lastSynced = TODAY;
fs.writeFileSync(eqPath, `${JSON.stringify(eq, null, 2)}\n`);

const wear = eq.records.filter((r) => r.slot);
const empty = wear.filter((r) => !hasNonZeroBonus(r.bonuses));
const emptyDetail = empty.map((r) => ({
  id: r.id,
  name: r.name,
  tier: r.tier ?? null,
  slot: r.slot,
  style: r.style ?? null,
  bonuses: r.bonuses && typeof r.bonuses === "object" ? r.bonuses : {},
  unlockRegions: r.unlock?.regions ?? [],
}));

const summary = {
  filled,
  skippedNonEmpty,
  skippedNoBonus,
  skippedMissing,
  skippedBad,
  tierSet,
  regionMutations,
  scrapeFiles: names,
  fileStats,
  scrapeWithBonus: scrapeById.size,
  wearables: wear.length,
  stillEmpty: empty.length,
  filledIds,
  filledDetail,
  emptyDetail,
  emptySample: empty.slice(0, 20).map((r) => r.id),
};

console.log(JSON.stringify(summary, null, 2));
