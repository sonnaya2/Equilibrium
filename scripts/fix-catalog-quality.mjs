/**
 * High-confidence catalog quality fixes for data/research/catalog.json.
 *
 * 1. regionHints — only the 11 RegionIds; map aliases; drop multi/global/unresolved/junk
 * 2. Slug-like method titles (kebab/snake, no spaces) — retitle from note first line or delete
 * 3. Drop orphan region.trainingMethodIds (must resolve to a skill method id)
 * 4. Deduplicate methods with identical skill+method (keep richer location/source)
 * 5. Recompute datasets.trainingMethods / skills / regions
 *
 * When git HEAD is available, regionHints are rebased from HEAD before normalize so
 * earlier invent/infer passes do not stick. Idempotent. No combat packs. No git commit.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PATH = join(ROOT, "data/research/catalog.json");

const VALID = new Set([
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

/** User-specified aliases only (display-case handled via toLowerCase). */
const ALIAS = {
  wilderness: "forinthry",
  wildy: "forinthry",
  "kharidian desert": "desert",
  "fremennik province": "fremennik",
};

function normalizeHint(raw) {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!key) return null;
  if (VALID.has(key)) return key;
  if (ALIAS[key]) return ALIAS[key];
  // multi-region, multi_region, multi_region_dependency, multi_region_altar_access, …
  if (/^multi[-_]?region/.test(key)) return null;
  if (key.startsWith("global") || key.includes("global_")) return null;
  if (key.includes("unresolved")) return null;
  return null;
}

function normalizeHints(list) {
  const out = [];
  const seen = new Set();
  for (const h of list || []) {
    const id = normalizeHint(h);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** kebab-case / snake_case / id-equal titles only (no spaces). */
function isSlugTitle(method) {
  const t = String(method?.method ?? "").trim();
  if (!t) return true;
  if (/\s/.test(t)) return false;
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(t)) return true;
  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(t)) return true;
  const id = String(method.id ?? "");
  const slug = id.includes(":") ? id.split(":").slice(1).join(":") : id;
  if (t === id || t === slug) return true;
  return false;
}

function humanizeFromNote(note) {
  if (!note) return "";
  const first = String(note)
    .split(/\n| · |\. /)[0]
    .trim()
    .replace(/\s+/g, " ");
  if (!first || isSlugTitle({ method: first, id: "" })) return "";
  if (first.length < 3 || first.length > 120) return "";
  if (/^(gap_file|supply|combo|note):/i.test(first)) return "";
  return first;
}

function richness(m) {
  const src = m.source;
  const srcBits = src
    ? [src.url, src.title, src.source, src.verifiedAt].filter(Boolean).join("\0")
    : "";
  return [
    m.location,
    m.note,
    m.xpRate,
    m.levelRange,
    m.resourceSource,
    m.warning,
    m.requiredUnlock,
    m.intensity,
    (m.requirements || []).join("\0"),
    srcBits,
    (m.regionHints || []).join("\0"),
  ]
    .filter(Boolean)
    .join("\0").length;
}

function mergeMethod(a, b) {
  const [keep, drop] = richness(a) >= richness(b) ? [a, b] : [b, a];
  const out = { ...keep };
  for (const key of [
    "location",
    "note",
    "xpRate",
    "levelRange",
    "resourceSource",
    "warning",
    "requiredUnlock",
    "intensity",
    "freshness",
    "confidence",
  ]) {
    if (!out[key] && drop[key]) out[key] = drop[key];
  }
  if (!(out.requirements || []).length && (drop.requirements || []).length) {
    out.requirements = [...drop.requirements];
  }
  if (!out.source && drop.source) out.source = drop.source;
  out.regionHints = normalizeHints([...(out.regionHints || []), ...(drop.regionHints || [])]);
  out.hardRegionRequirement = Boolean(out.hardRegionRequirement || drop.hardRegionRequirement);
  return out;
}

function loadHeadCatalog() {
  try {
    const raw = execSync("git show HEAD:data/research/catalog.json", {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function countMethods(catalog) {
  return (catalog.skills || []).reduce((n, s) => n + (s.methods || []).length, 0);
}

function snapshotStats(catalog) {
  const methods = (catalog.skills || []).flatMap((s) => s.methods || []);
  const methodIds = new Set(methods.map((m) => m.id));
  let invalidHints = 0;
  const invalidHintValues = new Map();
  for (const m of methods) {
    for (const h of m.regionHints || []) {
      const key = String(h).trim().toLowerCase();
      if (!VALID.has(key) && !ALIAS[key]) {
        invalidHints += 1;
        invalidHintValues.set(String(h), (invalidHintValues.get(String(h)) || 0) + 1);
      }
    }
  }
  let casedHints = 0;
  for (const m of methods) {
    for (const h of m.regionHints || []) {
      const s = String(h);
      if (VALID.has(s.toLowerCase()) && s !== s.toLowerCase()) casedHints += 1;
    }
  }
  const slugs = methods.filter(isSlugTitle).length;
  const dupMap = new Map();
  for (const m of methods) {
    const k = `${String(m.skill).toLowerCase()}||${String(m.method).trim().toLowerCase()}`;
    dupMap.set(k, (dupMap.get(k) || 0) + 1);
  }
  const dups = [...dupMap.values()].filter((n) => n > 1).length;
  let orphans = 0;
  for (const r of catalog.regions || []) {
    for (const id of r.trainingMethodIds || []) {
      if (!methodIds.has(id)) orphans += 1;
    }
  }
  return {
    methods: methods.length,
    skills: (catalog.skills || []).length,
    regions: (catalog.regions || []).length,
    datasetsTrainingMethods: catalog.datasets?.trainingMethods,
    datasetsSkills: catalog.datasets?.skills,
    datasetsRegions: catalog.datasets?.regions,
    invalidHints,
    invalidHintValues: Object.fromEntries(invalidHintValues),
    casedHints,
    slugs,
    dups,
    orphans,
  };
}

// ── load ────────────────────────────────────────────────────────────
const catalog = JSON.parse(readFileSync(PATH, "utf8"));
const before = snapshotStats(catalog);

const head = loadHeadCatalog();
const headHints = new Map();
if (head) {
  for (const skill of head.skills || []) {
    for (const m of skill.methods || []) {
      headHints.set(m.id, Array.isArray(m.regionHints) ? m.regionHints : []);
    }
  }
}

const stats = {
  hintsNormalized: 0,
  hintsRebasedFromHead: 0,
  slugsRetitled: 0,
  slugsDeleted: 0,
  deduped: 0,
  orphansDropped: 0,
  skillRegionsRebuilt: 0,
  accessClassStripped: 0,
};

const deletedIds = new Set();
const idRemap = new Map();

// ── 1 + 2: methods pass ─────────────────────────────────────────────
for (const skill of catalog.skills || []) {
  const byName = new Map();

  for (const m of skill.methods || []) {
    const beforeHints = JSON.stringify(m.regionHints || []);
    // Rebase hints from HEAD when present (undo invent/infer); else normalize WC.
    if (headHints.has(m.id)) {
      m.regionHints = normalizeHints(headHints.get(m.id));
      if (beforeHints !== JSON.stringify(m.regionHints)) stats.hintsRebasedFromHead += 1;
    } else {
      m.regionHints = normalizeHints(m.regionHints);
    }
    if (beforeHints !== JSON.stringify(m.regionHints)) stats.hintsNormalized += 1;

    if ("accessClass" in m) {
      delete m.accessClass;
      stats.accessClassStripped += 1;
    }

    if (isSlugTitle(m)) {
      const human = humanizeFromNote(m.note);
      if (human) {
        m.method = human;
        stats.slugsRetitled += 1;
      } else {
        deletedIds.add(m.id);
        stats.slugsDeleted += 1;
        continue;
      }
    }

    const key = `${String(m.skill || skill.name).toLowerCase()}||${String(m.method).trim().toLowerCase()}`;
    if (byName.has(key)) {
      const prev = byName.get(key);
      const keepId = richness(prev) >= richness(m) ? prev.id : m.id;
      const dropId = keepId === prev.id ? m.id : prev.id;
      const merged = mergeMethod(prev, m);
      merged.id = keepId;
      byName.set(key, merged);
      idRemap.set(dropId, keepId);
      deletedIds.add(dropId);
      stats.deduped += 1;
      continue;
    }
    byName.set(key, m);
  }

  skill.methods = [...byName.values()].sort((a, b) =>
    String(a.method).localeCompare(String(b.method)),
  );

  const regionSet = new Set();
  for (const m of skill.methods) {
    for (const h of m.regionHints || []) regionSet.add(h);
  }
  const nextRegions = [...regionSet].sort();
  if (JSON.stringify(skill.regions || []) !== JSON.stringify(nextRegions)) {
    stats.skillRegionsRebuilt += 1;
  }
  skill.regions = nextRegions;
}

const methodIds = new Set();
for (const skill of catalog.skills || []) {
  for (const m of skill.methods || []) methodIds.add(m.id);
}

// ── 3: drop orphan trainingMethodIds; remap deduped ids ─────────────
for (const region of catalog.regions || []) {
  const next = [];
  const seen = new Set();
  for (const id of region.trainingMethodIds || []) {
    const mapped = idRemap.get(id) || id;
    if (!methodIds.has(mapped)) {
      stats.orphansDropped += 1;
      continue;
    }
    if (seen.has(mapped)) continue;
    seen.add(mapped);
    next.push(mapped);
  }
  region.trainingMethodIds = next;
}

// ── 5: recompute dataset counts ─────────────────────────────────────
const afterCount = countMethods(catalog);
catalog.datasets = catalog.datasets || {};
catalog.datasets.regions = (catalog.regions || []).length;
catalog.datasets.skills = (catalog.skills || []).length;
catalog.datasets.trainingMethods = afterCount;

writeFileSync(PATH, `${JSON.stringify(catalog, null, 2)}\n`);

const after = snapshotStats(catalog);

console.log("CATALOG QUALITY FIX");
console.log("── before ──");
console.log(JSON.stringify(before, null, 2));
console.log("── after ──");
console.log(JSON.stringify(after, null, 2));
console.log("── actions ──");
console.log(JSON.stringify(stats, null, 2));
console.log(
  [
    `methods: ${before.methods} → ${after.methods}`,
    `skills:  ${before.skills} → ${after.skills}`,
    `regions: ${before.regions} → ${after.regions}`,
    `datasets.trainingMethods: ${before.datasetsTrainingMethods} → ${catalog.datasets.trainingMethods}`,
    `invalidHints: ${before.invalidHints} → ${after.invalidHints}`,
    `slugs: ${before.slugs} → ${after.slugs}`,
    `dups: ${before.dups} → ${after.dups}`,
    `orphans: ${before.orphans} → ${after.orphans}`,
  ].join("\n"),
);
