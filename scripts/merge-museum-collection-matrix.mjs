/**
 * Merge Part A + Part B Archaeology / museum collection region matrices.
 * Inputs (optional; missing parts skipped):
 *   scraped-data/planner-expansions-archaeology-museum-collections-matrix-part-a-2026-07-26.json
 *   scraped-data/planner-expansions-archaeology-museum-collections-matrix-part-b-2026-07-26.json
 * Outputs:
 *   data/research/planner-expansions-archaeology-museum-collections-matrix.json
 *   scraped-data/planner-expansions-archaeology-museum-collections-matrix.json (durable mirror for sync-planner-supplements)
 *   scraped-data/museum-collections-region-combo-table-2026-07-26.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stampCatalogMuseumDatasets } from "./stamp-catalog-museum-datasets.mjs";

const ROOT = process.cwd();
const PART_A = "scraped-data/planner-expansions-archaeology-museum-collections-matrix-part-a-2026-07-26.json";
const PART_B = "scraped-data/planner-expansions-archaeology-museum-collections-matrix-part-b-2026-07-26.json";
const OUT_MATRIX = "data/research/planner-expansions-archaeology-museum-collections-matrix.json";
const OUT_MATRIX_SCRAPED = "scraped-data/planner-expansions-archaeology-museum-collections-matrix.json";
const OUT_TABLE = "scraped-data/museum-collections-region-combo-table-2026-07-26.json";
const SCRAPED_COLLECTIONS = "scraped-data/planner-expansions-archaeology-collections.json";

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

/** Canonical dig → Equilibrium region (invalid/unresolved stay unresolved_*). */
const DEFAULT_DIG_MAP = {
  "Kharid-et": "desert",
  "Infernal Source": "forinthry",
  Everlight: "morytania",
  "Stormguard Citadel": "kandarin",
  Stormguard: "kandarin",
  Warforge: "kandarin",
  "Warforge!": "kandarin",
  Orthen: "anachronia",
  Daemonheim: "forinthry",
  "Daemonheim Dig": "forinthry",
  "Daemonheim Dig Site": "forinthry",
  Senntisten: "misthalin",
  Moonrise: "havenhythe",
  "Archaeology Campus": "misthalin",
  "Archaeology Guild": "misthalin",
  "Varrock Dig Site": "misthalin",
  // Harvest Hollow / seasonal digs intentionally excluded (not Equilibrium permanent content)
  Zanaris: "unresolved_zanaris",
};

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const write = (rel, value) => {
  const target = join(ROOT, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

function list(v) {
  return Array.isArray(v) ? v : [];
}

function unique(arr) {
  return [...new Set(arr.filter((x) => x != null && x !== ""))];
}

function slug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDigName(raw) {
  if (!raw) return "";
  let s = String(raw)
    .replace(/ Dig Site$/i, "")
    .replace(/\s*[-–].*$/, "")
    .replace(/!+$/, "")
    .trim();
  if (/^stormguard/i.test(s)) return "Stormguard Citadel";
  if (/^warforge/i.test(s)) return "Warforge";
  if (/^kharid/i.test(s)) return "Kharid-et";
  if (/^infernal/i.test(s)) return "Infernal Source";
  if (/^everlight/i.test(s)) return "Everlight";
  if (/^orthen/i.test(s)) return "Orthen";
  if (/^daemonheim/i.test(s)) return "Daemonheim";
  if (/^senntisten/i.test(s)) return "Senntisten";
  if (/^moonrise/i.test(s)) return "Moonrise";
  if (/harvest hollow/i.test(s)) return ""; // seasonal — drop
  if (/zanaris/i.test(s)) return "Zanaris";
  if (/archaeology campus|archaeology guild/i.test(s)) return "Archaeology Campus";
  return s;
}

/** Drop seasonal / non-permanent collections (Harvest Hollow Eep, etc.). */
function isSeasonalCollection(row) {
  const blob = JSON.stringify(row).toLowerCase();
  if (blob.includes("harvest hollow")) return true;
  if (blob.includes("bounty of bones")) return true;
  if (blob.includes("horrible hollow")) return true;
  if (String(row.collector || "").toLowerCase() === "eep") return true;
  if (Array.isArray(row.dig_sites) && row.dig_sites.some((d) => /harvest hollow/i.test(String(d)))) return true;
  return false;
}

function digToRegion(dig, digMap) {
  const n = normalizeDigName(dig);
  if (!n) return null;
  if (digMap[n]) return digMap[n];
  if (digMap[dig]) return digMap[dig];
  if (/harvest hollow/i.test(n)) return null; // seasonal — excluded
  if (/zanaris/i.test(n)) return "unresolved_zanaris";
  return `unresolved_${n.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

function isValidRegion(token) {
  return VALID_REGIONS.has(String(token || "").trim().toLowerCase());
}

function normalizeRegionToken(raw) {
  const token = String(raw || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
  if (!token) return { valid: null, invalid: null };
  if (token === "wilderness" || token === "wildy") return { valid: "forinthry", invalid: null };
  if (isValidRegion(token)) return { valid: token, invalid: null };
  return { valid: null, invalid: token };
}

function comboLabelFor(required) {
  const r = unique(required);
  if (r.length <= 1) return "";
  return `Region combo (all required): ${r.join(" + ")}`;
}

function collectionName(row) {
  return String(row?.name || row?.collection || row?.title || "").trim();
}

function collectionId(row, name) {
  if (typeof row?.id === "string" && row.id) return row.id;
  const kind = row?.kind === "culture_expert_title" ? "title" : row?.kind === "seasonal" ? "seasonal" : "collector";
  return `${kind}:${slug(name)}`;
}

function loadPart(rel, label) {
  if (!existsSync(join(ROOT, rel))) {
    console.log(`[--] skip missing ${label}: ${rel}`);
    return null;
  }
  const data = read(rel);
  console.log(`[OK] loaded ${label}: ${rel}`);
  return data;
}

function mergeDigMaps(...sources) {
  const map = { ...DEFAULT_DIG_MAP };
  for (const src of sources) {
    if (!src) continue;
    const policyMap = src.policy?.dig_site_region_map || src.dig_site_region_map || {};
    for (const [dig, region] of Object.entries(policyMap)) {
      const key = normalizeDigName(dig) || dig;
      const reg = String(region || "").trim().toLowerCase();
      if (!reg) continue;
      if (isValidRegion(reg)) {
        map[key] = reg;
        continue;
      }
      const unresolved = reg.startsWith("unresolved")
        ? reg === "unresolved_invalid"
          ? "unresolved_invalid"
          : reg
        : `unresolved_${reg.replace(/[^a-z0-9]+/g, "_")}`;
      // Do not clobber a valid mapping; prefer specific unresolved_* over unresolved_invalid
      if (isValidRegion(map[key])) continue;
      if (!map[key] || map[key] === "unresolved_invalid") map[key] = unresolved;
    }
  }
  // Known dig defaults always win
  Object.assign(map, DEFAULT_DIG_MAP);
  return map;
}

function rowsFromPart(data, partLabel) {
  const rows = list(data?.collections).filter((row) => !isSeasonalCollection(row));
  return rows.map((row) => ({ ...row, _part: partLabel }));
}

/**
 * Prefer Part B on name collision (richer artefact maps for leftovers),
 * but keep Part A fields when B is thinner. Status re-normalized later.
 */
function dedupeByName(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const name = collectionName(row);
    if (!name) continue;
    const key = name.toLowerCase();
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    // Merge: later part wins scalars; union digs/regions; keep best unobtainable reason
    byKey.set(key, {
      ...prev,
      ...row,
      dig_sites: unique([...list(prev.dig_sites), ...list(row.dig_sites)]),
      artifact_regions: unique([...list(prev.artifact_regions), ...list(row.artifact_regions)]),
      collector_regions: unique([...list(prev.collector_regions), ...list(row.collector_regions)]),
      required_regions: unique([...list(prev.required_regions), ...list(row.required_regions)]),
      source_urls: unique([...list(prev.source_urls), ...list(row.source_urls)]),
      first_reward: row.first_reward ?? prev.first_reward ?? null,
      archaeology_level: row.archaeology_level ?? prev.archaeology_level ?? null,
      collector: row.collector || prev.collector || null,
      // Prefer explicit unobtainable from either side before re-normalize
      status: prev.status === "unobtainable" || row.status === "unobtainable" ? "unobtainable" : row.status || prev.status,
      unobtainable_reason: row.unobtainable_reason || prev.unobtainable_reason || "",
      _parts: unique([prev._part, row._part, ...(list(prev._parts)), ...(list(row._parts))]),
    });
  }
  return [...byKey.values()];
}

function digOutsideValid(digs, digMap) {
  if (!digs.length) return { outside: true, reasons: ["no dig_sites"] };
  const reasons = [];
  for (const dig of digs) {
    const region = digToRegion(dig, digMap);
    if (!region || !isValidRegion(region)) {
      reasons.push(`${dig}→${region || "unmapped"}`);
    }
  }
  return { outside: reasons.length > 0, reasons };
}

function normalizeRow(row, digMap) {
  const name = collectionName(row);
  const dig_sites = unique(list(row.dig_sites).map(normalizeDigName).filter(Boolean));
  const collector = row.collector ?? null;

  // Split required into valid vs unresolved/invalid
  const unresolved_regions = [];
  const required_regions = [];
  for (const raw of list(row.required_regions)) {
    const { valid, invalid } = normalizeRegionToken(raw);
    if (valid) required_regions.push(valid);
    if (invalid) unresolved_regions.push(invalid);
  }
  // Invalid artifact/collector tokens that were the only geography (empty required after strip)
  for (const raw of [...list(row.artifact_regions), ...list(row.collector_regions)]) {
    const { invalid } = normalizeRegionToken(raw);
    if (invalid) unresolved_regions.push(invalid);
  }

  let artifact_regions = unique(
    list(row.artifact_regions)
      .map((r) => normalizeRegionToken(r).valid)
      .filter(Boolean),
  );
  const digRegions = [];
  for (const dig of dig_sites) {
    const reg = digToRegion(dig, digMap);
    if (isValidRegion(reg)) digRegions.push(reg);
    else if (reg) unresolved_regions.push(reg);
  }
  if (!artifact_regions.length) artifact_regions = unique(digRegions);

  const collector_regions = unique(
    list(row.collector_regions)
      .map((r) => normalizeRegionToken(r).valid)
      .filter(Boolean),
  );

  const uniqRequired = unique(required_regions);
  const uniqUnresolved = unique(unresolved_regions);
  const digCheck = digOutsideValid(dig_sites, digMap);

  const reasons = [];
  let status = "obtainable";

  if (uniqUnresolved.length) {
    status = "unobtainable";
    reasons.push(`Invalid/unresolved region tokens: ${uniqUnresolved.join(", ")}`);
  }

  // Empty required + dig outside valid map → unobtainable
  if (!uniqRequired.length && digCheck.outside) {
    status = "unobtainable";
    reasons.push(`required_regions empty and dig outside valid regions (${digCheck.reasons.join("; ")})`);
  }

  // Empty required with only invalid tokens already handled via unresolved
  // Explicit prior unobtainable reason if still unobtainable
  if (status === "unobtainable" && !reasons.length && row.unobtainable_reason) {
    reasons.push(String(row.unobtainable_reason));
  }

  // Preserve prior unobtainable if row already marked and we didn't clear cause
  if (row.status === "unobtainable" && status === "obtainable" && (uniqUnresolved.length || (!uniqRequired.length && digCheck.outside))) {
    status = "unobtainable";
  }
  if (row.status === "unobtainable" && status === "obtainable" && String(row.unobtainable_reason || "").trim()) {
    // Keep intentional unobtainable flags only when dig/required still justify, else re-evaluate clean
    if (!uniqRequired.length || digCheck.outside || uniqUnresolved.length) {
      status = "unobtainable";
      if (!reasons.length) reasons.push(String(row.unobtainable_reason));
    }
  }

  const comboLabel = comboLabelFor(uniqRequired);
  const chronotes = row.chronotes ?? row.chronotes_first ?? null;

  return {
    id: collectionId(row, name),
    name,
    kind: row.kind || (String(name).startsWith("Museum - ") ? "museum_collection" : "collector_collection"),
    archaeology_level: row.archaeology_level ?? null,
    dig_sites,
    artifact_regions: unique(artifact_regions),
    collector,
    collector_regions,
    required_regions: uniqRequired,
    unresolved_regions: uniqUnresolved,
    region_requirement_type: uniqRequired.length > 1 ? "all_required" : uniqRequired.length === 1 ? "single" : "none",
    comboLabel,
    status,
    unobtainable_reason: status === "unobtainable" ? reasons.join(" · ") || String(row.unobtainable_reason || "unobtainable") : "",
    first_reward: row.first_reward ?? null,
    recurring_reward: row.recurring_reward ?? null,
    chronotes,
    source_urls: list(row.source_urls),
    confidence: row.confidence || "merged_parts",
    parts: unique([row._part, ...list(row._parts)].filter(Boolean)),
    // Pass-through optional research fields
    ...(row.artefacts ? { artefacts: row.artefacts } : {}),
    ...(row.artefact_dig_map ? { artefact_dig_map: row.artefact_dig_map } : {}),
    ...(row.handoff_regions ? { handoff_regions: row.handoff_regions } : {}),
    ...(row.additional_item_regions ? { additional_item_regions: row.additional_item_regions } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.culture ? { culture: row.culture } : {}),
  };
}

function compactTableRow(row) {
  return {
    name: row.name,
    dig_sites: row.dig_sites,
    artifact_regions: row.artifact_regions,
    collector: row.collector,
    required_regions: row.required_regions,
    comboLabel: row.comboLabel || "",
    status: row.status,
    unobtainable_reason: row.unobtainable_reason || "",
  };
}

// ── main ──────────────────────────────────────────────────────────────────
const partA = loadPart(PART_A, "part-a");
const partB = loadPart(PART_B, "part-b");

if (!partA && !partB) {
  console.error("No part files found — wrote nothing. Expected:");
  console.error(`  ${PART_A}`);
  console.error(`  ${PART_B}`);
  process.exit(1);
}

const digMap = mergeDigMaps(partA, partB);
const rawRows = [
  ...rowsFromPart(partA, "A"),
  ...rowsFromPart(partB, "B"),
];
const deduped = dedupeByName(rawRows);
const collections = deduped
  .map((row) => normalizeRow(row, digMap))
  .sort((a, b) => a.name.localeCompare(b.name));

const obtainable = collections.filter((c) => c.status === "obtainable");
const unobtainable = collections.filter((c) => c.status === "unobtainable");
const multi = collections.filter((c) => c.required_regions.length > 1);
const withUnresolved = collections.filter((c) => c.unresolved_regions.length > 0);
const fromA = collections.filter((c) => c.parts.includes("A")).length;
const fromB = collections.filter((c) => c.parts.includes("B")).length;
const fromBoth = collections.filter((c) => c.parts.includes("A") && c.parts.includes("B")).length;

const matrix = {
  snapshot_date: "2026-07-26",
  purpose:
    "Merged Archaeology / museum collection region matrix (Part A A–M + Part B N–Z leftovers). required_regions hold only valid Equilibrium region ids; invalid tokens stripped to unresolved_regions and mark status=unobtainable.",
  policy: {
    valid_regions: [...VALID_REGIONS],
    combo_label: "Region combo (all required): a + b",
    unobtainable_rule:
      "status=unobtainable when unresolved_regions.length > 0, or required_regions empty with dig_sites outside the valid dig→region map, or invalid region tokens were present on required_regions",
    dig_site_region_map: digMap,
    parts: {
      a: partA ? PART_A : null,
      b: partB ? PART_B : null,
    },
  },
  counts: {
    parts_loaded: [partA && "A", partB && "B"].filter(Boolean),
    raw_rows: rawRows.length,
    after_dedupe: deduped.length,
    total: collections.length,
    obtainable: obtainable.length,
    unobtainable: unobtainable.length,
    multi_region: multi.length,
    with_unresolved_regions: withUnresolved.length,
    from_part_a: fromA,
    from_part_b: fromB,
    from_both_parts: fromBoth,
  },
  unobtainable_list: unobtainable.map((c) => ({
    name: c.name,
    reason: c.unobtainable_reason,
    required_regions: c.required_regions,
    unresolved_regions: c.unresolved_regions,
    dig_sites: c.dig_sites,
  })),
  multi_region_list: multi.map((c) => ({
    name: c.name,
    required_regions: c.required_regions,
    comboLabel: c.comboLabel,
    status: c.status,
  })),
  collections,
  sources: unique([
    ...list(partA?.sources),
    ...list(partB?.sources),
    "https://runescape.wiki/w/Collections",
    "https://runescape.wiki/w/Collectors",
    "https://runescape.wiki/w/It_Belongs_in_a_Museum!",
  ]),
  confidence: "merged_part_a_part_b_normalized",
};

write(OUT_MATRIX, matrix);
// Durable scraped-data mirror so sync-planner-supplements / normalize:data re-emit research copy.
write(OUT_MATRIX_SCRAPED, matrix);

const table = {
  snapshot_date: "2026-07-26",
  purpose: "Compact museum/collector collection × region combo table for Equilibrium planning.",
  source_matrix: OUT_MATRIX,
  counts: {
    total: collections.length,
    obtainable: obtainable.length,
    unobtainable: unobtainable.length,
    multi_region: multi.length,
  },
  rows: collections.map(compactTableRow),
};
write(OUT_TABLE, table);

// Pointer only on scraped-data collections copy — do not touch data/research planner types.
if (existsSync(join(ROOT, SCRAPED_COLLECTIONS))) {
  try {
    const scraped = read(SCRAPED_COLLECTIONS);
    scraped.museum_collection_matrix_path = OUT_MATRIX;
    scraped.museum_collection_combo_table_path = OUT_TABLE;
    write(SCRAPED_COLLECTIONS, scraped);
    console.log(`[OK] pointer fields on ${SCRAPED_COLLECTIONS}`);
  } catch (err) {
    console.warn(`[--] could not update scraped collections pointer: ${err.message}`);
  }
}

console.log("");
console.log("MUSEUM COLLECTION MATRIX MERGE");
console.log(`  parts:           ${matrix.counts.parts_loaded.join("+") || "(none)"}`);
console.log(`  raw rows:        ${matrix.counts.raw_rows}`);
console.log(`  after dedupe:    ${matrix.counts.after_dedupe}`);
console.log(`  total:           ${matrix.counts.total}`);
console.log(`  obtainable:      ${matrix.counts.obtainable}`);
console.log(`  unobtainable:    ${matrix.counts.unobtainable}`);
console.log(`  multi-region:    ${matrix.counts.multi_region}`);
console.log(`  unresolved:      ${matrix.counts.with_unresolved_regions}`);
console.log(`  from A / B / both: ${fromA} / ${fromB} / ${fromBoth}`);
console.log(`  wrote ${OUT_MATRIX}`);
console.log(`  wrote ${OUT_MATRIX_SCRAPED}`);
console.log(`  wrote ${OUT_TABLE}`);
if (unobtainable.length) {
  console.log("UNOBTAINABLE:");
  for (const u of unobtainable) {
    console.log(` - ${u.name}: ${u.unobtainable_reason}`);
  }
}

// Stamp catalog.datasets museum counts immediately (also re-run by sync-planner-supplements).
try {
  stampCatalogMuseumDatasets();
} catch (err) {
  console.warn(`[--] catalog museum stamp skipped: ${err instanceof Error ? err.message : err}`);
}
