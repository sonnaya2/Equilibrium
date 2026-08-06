/**
 * Combat inventory / reachability audit (PROMPT 5 reports).
 *
 *   node scripts/combat/inventory.mjs
 *   npm run audit:combat-reachability
 *
 * Writes under reports/:
 *   combat-symbol-reachability.json
 *   combat-ability-registry.json
 *   combat-record-fallbacks.json
 *   combat-duplicate-definitions.json
 *   combat-public-api.json
 *   combat-reachability.md
 *
 * Always exits 0 (report-only). ASCII only.
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PUBLIC_BARREL_MODULES,
  BARREL_BANNED_STAR_PREFIXES,
  isBannedBarrelStarExport,
  WORKER_KEEP_PATHS,
} from "./public-api.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMBAT = join(ROOT, "src", "combat");
const REPORTS = join(ROOT, "reports");
const GENERATED_AT = new Date().toISOString();

function fwd(p) {
  return p.split(sep).join("/");
}

function repoRel(abs) {
  return fwd(relative(ROOT, abs));
}

function isTestPath(path) {
  return (
    /\.test\.(ts|tsx)$/.test(path) ||
    path.includes("/test/") ||
    path.includes("/testing/") ||
    path.endsWith(".spec.ts") ||
    path.endsWith(".spec.tsx")
  );
}

async function walk(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === "ENOENT") return acc;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, acc);
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Collect relative import/export-from specs (no node builtins / packages). */
function collectRelativeSpecs(source) {
  const text = stripComments(source);
  const specs = [];
  const re =
    /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)|new\s+URL\s*\(\s*['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text))) {
    const spec = m[1] || m[2] || m[3];
    if (spec) specs.push(spec);
  }
  return specs;
}

function resolveSpec(fromPath, spec) {
  // fromPath is repo-relative posix without extension.
  const baseDir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  const abs = join(ROOT, ...baseDir.split("/").filter(Boolean), ...spec.split("/"));
  const rel = relative(ROOT, abs);
  return fwd(rel);
}

function candidatesFor(resolvedNoExt) {
  const out = [];
  if (resolvedNoExt.endsWith(".ts") || resolvedNoExt.endsWith(".tsx")) {
    out.push(resolvedNoExt);
    return out;
  }
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    out.push(resolvedNoExt + ext);
  }
  return out;
}

function parseExports(source, path) {
  const text = stripComments(source);
  const names = [];
  // export * from "..."
  for (const m of text.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)) {
    names.push(`* from ${m[1]}`);
  }
  // export { a, b as c } from "..."
  for (const m of text.matchAll(/export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    for (const part of m[1].split(",")) {
      const cleaned = part.trim();
      if (!cleaned) continue;
      const asMatch = cleaned.match(/^type\s+(\w+)|(?:type\s+)?(\w+)(?:\s+as\s+(\w+))?/);
      if (!asMatch) continue;
      const name = asMatch[3] || asMatch[1] || asMatch[2];
      if (name) names.push(name);
    }
  }
  // export { a, b as c }
  for (const m of text.matchAll(/export\s+\{([^}]+)\}(?!\s*from)/g)) {
    for (const part of m[1].split(",")) {
      const cleaned = part.trim();
      if (!cleaned) continue;
      const asMatch = cleaned.match(/^type\s+(\w+)|(?:type\s+)?(\w+)(?:\s+as\s+(\w+))?/);
      if (!asMatch) continue;
      const name = asMatch[3] || asMatch[1] || asMatch[2];
      if (name) names.push(name);
    }
  }
  // export function/const/class/type/interface/enum
  for (const m of text.matchAll(
    /export\s+(?:async\s+)?(?:declare\s+)?(?:function|const|let|var|class|type|interface|enum)\s+(\w+)/g,
  )) {
    names.push(m[1]);
  }
  // export default
  if (/\bexport\s+default\b/.test(text)) names.push("default");
  return [...new Set(names)];
}

function parseBarrelModules(indexSource) {
  const modules = [];
  const seen = new Set();
  // Multiline-friendly: export * from "x" | export { ... } from "x" | export type { ... } from "x"
  for (const m of indexSource.matchAll(
    /export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"](\.[^'"]+)['"]/g,
  )) {
    const rel = m[1];
    const resolved = resolveSpec("src/combat/index", rel);
    const noExt = resolved.replace(/\.(ts|tsx)$/, "");
    if (seen.has(noExt)) continue;
    seen.add(noExt);
    modules.push(noExt);
  }
  return modules;
}

function extractConstObjectBody(source, name) {
  const startRe = new RegExp(
    "(?:export\\s+)?const\\s+" + name + "\\s*(?::\\s*[^=]+)?=\\s*\\{",
  );
  const start = source.match(startRe);
  if (!start || start.index == null) return null;
  let i = start.index + start[0].length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  if (depth !== 0) return null;
  return source.slice(start.index + start[0].length, i - 1);
}

function parseRecordToEngine(source) {
  // Accept RECORD_TO_ENGINE or ENGINE_ID_BY_RECORD_ID map literals.
  const pairs = [];
  const body =
    extractConstObjectBody(source, "RECORD_TO_ENGINE") ||
    extractConstObjectBody(source, "ENGINE_ID_BY_RECORD_ID");
  if (!body) return pairs;
  for (const m of body.matchAll(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/g)) {
    pairs.push({ recordId: m[1], engineId: m[2] });
  }
  return pairs;
}

function parseLinkOverrides(source) {
  const keys = [];
  const body =
    extractConstObjectBody(source, "ENGINE_LINK_OVERRIDES") ||
    extractConstObjectBody(source, "LINK_OVERRIDES");
  if (!body) return keys;
  for (const m of body.matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)) {
    keys.push(m[1]);
  }
  return keys;
}

function policyFromSpecsSource(specsSource) {
  const rejectsMultiHit = /hitCount\s*!==\s*1|hits\s*>\s*1/.test(specsSource) ||
    /if\s*\(\s*hitCount\s*!==\s*1\s*\)\s*return\s*null/.test(specsSource);
  const requiresAdren = /if\s*\(\s*!record\.adrenaline\s*\)\s*return\s*null/.test(specsSource);
  const rejectsChannel =
    /channelTicks/.test(specsSource) && /return\s*null/.test(specsSource);
  const notes = [];
  notes.push(
    "specFromRecord (src/combat/data/specs.ts): single-hit + damagePercent + adrenaline only.",
  );
  if (rejectsMultiHit) {
    notes.push("Multi-hit records return null (no band-repetition). Use engine registry.");
  }
  if (requiresAdren) {
    notes.push("Missing adrenaline returns null.");
  }
  if (rejectsChannel) {
    notes.push("channelTicks > 1 returns null.");
  }
  notes.push(
    "Prefer engineSpecs / resolveBarSlot over raw specFromRecord for multi-hit, channels, and state windows.",
  );
  return {
    rejectsMultiHit,
    requiresAdrenaline: requiresAdren,
    rejectsChannel,
    notes,
  };
}

const combatFilesAbs = await walk(COMBAT);
const combatFiles = combatFilesAbs.map(repoRel).sort();

/** @type {Map<string, string>} */
const sources = new Map();
for (const abs of combatFilesAbs) {
  sources.set(repoRel(abs), await readFile(abs, "utf8"));
}

// Also scan UI/app for production importers of combat modules.
const externalRoots = [join(ROOT, "src", "components"), join(ROOT, "app")];
/** @type {string[]} */
const externalFiles = [];
for (const root of externalRoots) {
  await walk(root, externalFiles);
}
/** @type {Map<string, string[]>} path -> imported combat paths */
const externalCombatImports = new Map();
for (const abs of externalFiles) {
  const path = repoRel(abs);
  if (isTestPath(path)) continue;
  const source = await readFile(abs, "utf8");
  const hits = [];
  // @/combat/... or relative into combat
  for (const m of source.matchAll(/from\s+['"](@\/combat\/[^'"]+|\.\.?\/[^'"]*combat\/[^'"]+)['"]/g)) {
    let spec = m[1];
    if (spec.startsWith("@/combat/")) {
      spec = "src/combat/" + spec.slice("@/combat/".length);
    } else {
      const base = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      const abs = join(ROOT, ...base.split("/").filter(Boolean), ...spec.split("/"));
      const norm = fwd(relative(ROOT, abs));
      if (!norm.startsWith("src/combat/")) continue;
      spec = norm;
    }
    const noExt = spec.replace(/\.(ts|tsx)$/, "");
    for (const c of candidatesFor(noExt)) {
      if (sources.has(c)) {
        hits.push(c);
        break;
      }
    }
  }
  // Also match @/combat barrel
  if (/from\s+['"]@\/combat['"]/.test(source) || /from\s+['"]@\/combat\/index['"]/.test(source)) {
    hits.push("src/combat/index.ts");
  }
  if (hits.length) externalCombatImports.set(path, [...new Set(hits)]);
}

// Build reverse import graph within combat + edges from external production.
/** @type {Map<string, Set<string>>} target -> importers */
const importersOf = new Map();
/** @type {Map<string, Set<string>>} source -> targets */
const importsOf = new Map();

function addEdge(from, to) {
  if (!importsOf.has(from)) importsOf.set(from, new Set());
  importsOf.get(from).add(to);
  if (!importersOf.has(to)) importersOf.set(to, new Set());
  importersOf.get(to).add(from);
}

for (const [path, source] of sources) {
  const specs = collectRelativeSpecs(source);
  for (const spec of specs) {
    const resolved = resolveSpec(path.replace(/\.(ts|tsx)$/, ""), spec);
    for (const c of candidatesFor(resolved)) {
      if (sources.has(c)) {
        addEdge(path, c);
        break;
      }
    }
  }
}

for (const [extPath, targets] of externalCombatImports) {
  for (const t of targets) addEdge(extPath, t);
}

// Dynamic worker: workerCreate -> revolutionSolver.worker
const WORKER_ENTRY = "src/combat/solver/worker/revolutionSolver.worker.ts";
const WORKER_CREATE = "src/combat/solver/worker/workerCreate.ts";
if (sources.has(WORKER_CREATE) && sources.has(WORKER_ENTRY)) {
  addEdge(WORKER_CREATE, WORKER_ENTRY);
}

// Entry seeds: barrel + anything imported from app/components + worker entry keep list.
const seeds = new Set(["src/combat/index.ts", ...WORKER_KEEP_PATHS]);
for (const [, targets] of externalCombatImports) {
  for (const t of targets) seeds.add(t);
}

// BFS production-reachable (non-test importers or seed).
const productionReachable = new Set();
const queue = [...seeds];
while (queue.length) {
  const cur = queue.pop();
  if (!cur || productionReachable.has(cur)) continue;
  if (!sources.has(cur)) continue;
  if (isTestPath(cur)) continue;
  productionReachable.add(cur);
  for (const dep of importsOf.get(cur) ?? []) {
    if (!isTestPath(dep)) queue.push(dep);
  }
}

// Force worker keep paths into production-reachable.
for (const w of WORKER_KEEP_PATHS) {
  if (sources.has(w)) productionReachable.add(w);
}

// Test-only: has only test importers (or is a test file).
function productionImporters(path) {
  const imps = [...(importersOf.get(path) ?? [])];
  return imps.filter((p) => !isTestPath(p) && (sources.has(p) || externalCombatImports.has(p)));
}
function testImporters(path) {
  const imps = [...(importersOf.get(path) ?? [])];
  return imps.filter((p) => isTestPath(p));
}

const fileRows = [];
const classificationCounts = {
  "production-reachable": 0,
  "test-only": 0,
  orphaned: 0,
  "public-api": 0,
  "data-driven": 0,
  "manual-review-keep": 0,
};

const orphanCandidates = [];
const deletionsRecommended = [];
const manualReview = [];

for (const path of combatFiles) {
  const source = sources.get(path) ?? "";
  const exports = parseExports(source, path);
  const isTest = isTestPath(path);
  const prodImps = productionImporters(path);
  const testImps = testImporters(path);
  const isWorkerKeep = WORKER_KEEP_PATHS.includes(path);
  let classification;
  let reason = "";
  let uncertain = false;

  if (isTest) {
    classification = "test-only";
  } else if (isWorkerKeep || productionReachable.has(path)) {
    classification = isWorkerKeep && prodImps.length === 0
      ? "manual-review-keep"
      : "production-reachable";
    if (isWorkerKeep && prodImps.length === 0) {
      reason = "dynamic worker entry (new URL) - production keep, never delete";
    }
  } else if (prodImps.length === 0 && testImps.length > 0) {
    classification = "test-only";
    reason = "reachable only from tests";
    uncertain = true;
    orphanCandidates.push({ path, classification, reason, testImporters: testImps.length, uncertain });
    manualReview.push(path);
  } else if (prodImps.length === 0 && testImps.length === 0) {
    classification = "orphaned";
    reason = "no production importers found (may be dynamic/data - manual review)";
    orphanCandidates.push({ path, classification, reason, testImporters: 0, uncertain: false });
    // Never recommend deleting worker entries.
    if (!isWorkerKeep) deletionsRecommended.push(path);
    else {
      classification = "manual-review-keep";
      reason = "worker entry keep";
      manualReview.push(path);
    }
  } else {
    classification = "production-reachable";
  }

  classificationCounts[classification] = (classificationCounts[classification] ?? 0) + 1;

  const importersSample = [...(importersOf.get(path) ?? [])].sort().slice(0, 12);
  fileRows.push({
    path,
    classification,
    isTest,
    exportCount: exports.length,
    exports,
    productionImporters: prodImps.length,
    testImporters: testImps.length,
    importersSample,
    reason: reason || undefined,
  });
}

// Duplicate export names across production modules.
const nameToPaths = new Map();
for (const row of fileRows) {
  if (row.isTest) continue;
  if (row.classification === "orphaned" && row.exportCount === 0) continue;
  for (const name of row.exports) {
    if (name.startsWith("* from ")) continue;
    if (name === "default") continue;
    if (!nameToPaths.has(name)) nameToPaths.set(name, new Set());
    nameToPaths.get(name).add(row.path);
  }
}
const duplicateExportNames = [];
for (const [name, paths] of [...nameToPaths.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (paths.size < 2) continue;
  duplicateExportNames.push({
    name,
    paths: [...paths].sort(),
    classification: "duplicate-authority",
    note: "Same export name in multiple production modules - review if dual authority",
  });
}

// Ability registry map (best-effort from source).
const engineMapPath = sources.has("src/combat/abilities/engineMap.ts")
  ? "src/combat/abilities/engineMap.ts"
  : null;
const specsPath = "src/combat/data/specs.ts";
const registryPath = "src/combat/abilities/registry.ts";
const mapSource =
  (engineMapPath && sources.get(engineMapPath)) ||
  sources.get(specsPath) ||
  "";
const recordEnginePairs = parseRecordToEngine(mapSource);
const overrideSource = sources.get(engineMapPath || registryPath) || sources.get(registryPath) || "";
const linkOverrideKeys = parseLinkOverrides(overrideSource);

// Multi-record engines (aliases).
const engineToRecords = new Map();
for (const { recordId, engineId } of recordEnginePairs) {
  if (!engineToRecords.has(engineId)) engineToRecords.set(engineId, []);
  engineToRecords.get(engineId).push(recordId);
}
const multiRecordEngines = [...engineToRecords.entries()]
  .filter(([, ids]) => ids.length > 1)
  .map(([engineId, recordIds]) => ({ engineId, recordIds }))
  .sort((a, b) => a.engineId.localeCompare(b.engineId));

// Record fallbacks from generated abilities JSON.
const abilitiesJsonPath = join(ROOT, ".generated", "documents", "combat", "abilities.json");
let abilityRecords = [];
try {
  const raw = JSON.parse(await readFile(abilitiesJsonPath, "utf8"));
  abilityRecords = raw.records ?? raw ?? [];
} catch {
  abilityRecords = [];
}

const fallbackCandidates = [];
for (const rec of abilityRecords) {
  if (!rec || typeof rec !== "object") continue;
  const hits = rec.hits ?? 1;
  const multiHit = typeof hits === "number" && hits > 1;
  const missingAdren = rec.adrenaline == null;
  const channel = rec.channelTicks != null;
  const noDamage = rec.damagePercent == null;
  // Flags that make a naive/safe adapter unsuitable without engine registry.
  const channelBlocks = channel && (rec.channelTicks ?? 0) > 1;
  // Matches current specs.ts safe adapter gates.
  const wouldFailSafeAdapter = multiHit || missingAdren || channelBlocks || noDamage;
  if (wouldFailSafeAdapter) {
    fallbackCandidates.push({
      id: rec.id,
      name: rec.name,
      multiHit,
      hits: hits ?? null,
      missingAdrenaline: missingAdren,
      channelTicks: rec.channelTicks ?? null,
      missingDamagePercent: noDamage,
      wouldFailSafeAdapter: true,
      note: multiHit
        ? "multi-hit: specFromRecord returns null; use engine registry"
        : missingAdren
          ? "missing adrenaline: specFromRecord returns null"
          : channelBlocks
            ? "channelTicks>1: specFromRecord returns null"
            : "no damagePercent (utility / state)",
    });
  }
}

const specsSource = sources.get(specsPath) ?? "";
const adapterPolicy = policyFromSpecsSource(specsSource);

// Public API report.
const indexSource = sources.get("src/combat/index.ts") ?? "";
const barrelModules = parseBarrelModules(indexSource);
const bannedLeakage = [];
for (const mod of barrelModules) {
  if (isBannedBarrelStarExport(mod)) {
    bannedLeakage.push({ module: mod, ban: "BARREL_BANNED_STAR_PREFIXES" });
  }
}
const notOnAllowlist = barrelModules.filter((m) => !PUBLIC_BARREL_MODULES.includes(m));
const allowlistMissingFromBarrel = PUBLIC_BARREL_MODULES.filter(
  (m) => !barrelModules.includes(m),
);

await mkdir(REPORTS, { recursive: true });

const symbolReachability = {
  generatedAt: GENERATED_AT,
  method: "static-import-graph + relative/export parse (no typescript compiler)",
  stats: {
    combatFiles: combatFiles.length,
    productionFiles: combatFiles.filter((p) => !isTestPath(p)).length,
    testFiles: combatFiles.filter((p) => isTestPath(p)).length,
    orphanCandidates: orphanCandidates.length,
    duplicateExportNames: duplicateExportNames.length,
    productionReachable: productionReachable.size,
  },
  seeds: [...seeds].sort(),
  workerKeep: WORKER_KEEP_PATHS,
  files: fileRows,
  orphans: orphanCandidates,
  deletionsRecommended: deletionsRecommended.filter((p) => !WORKER_KEEP_PATHS.includes(p)),
  manualReview: [...new Set(manualReview)].sort(),
  classifications: classificationCounts,
};

const abilityRegistry = {
  generatedAt: GENERATED_AT,
  note:
    "Best-effort static parse of record->engine pairs. Full AbilityRegistryEntry dump needs TS runtime (registry.ts). Prefer engineMap.ts when present; else ENGINE_ID_BY_RECORD_ID in data/specs.ts + LINK_OVERRIDES in abilities/registry.ts.",
  sources: {
    engineMap: engineMapPath,
    specs: specsPath,
    registry: registryPath,
  },
  pairCount: recordEnginePairs.length,
  pairs: recordEnginePairs,
  multiRecordEngines,
  linkOverrideKeys,
  registryPath,
};

const recordFallbacks = {
  generatedAt: GENERATED_AT,
  abilitiesJson: abilityRecords.length
    ? ".generated/documents/combat/abilities.json"
    : null,
  recordCount: abilityRecords.length,
  adapterPolicy,
  candidates: fallbackCandidates,
  stats: {
    multiHit: fallbackCandidates.filter((c) => c.multiHit).length,
    missingAdrenaline: fallbackCandidates.filter((c) => c.missingAdrenaline).length,
    channelled: fallbackCandidates.filter((c) => c.channelTicks != null).length,
    wouldFailSafeAdapter: fallbackCandidates.filter((c) => c.wouldFailSafeAdapter).length,
  },
};

const duplicateDefinitions = {
  generatedAt: GENERATED_AT,
  duplicateExportNames,
  multiRecordEngines,
  stats: {
    duplicateExportNameCount: duplicateExportNames.length,
    multiRecordEngineCount: multiRecordEngines.length,
  },
};

const publicApi = {
  generatedAt: GENERATED_AT,
  barrelPath: "src/combat/index.ts",
  allowlistSource: "scripts/architecture/public-api.mjs",
  modules: barrelModules,
  allowlist: PUBLIC_BARREL_MODULES,
  banList: BARREL_BANNED_STAR_PREFIXES,
  bannedLeakage,
  notOnAllowlist,
  allowlistMissingFromBarrel,
  indexExportLines: indexSource.split(/\r?\n/).filter((l) => /^\s*export\s/.test(l)).length,
};

const md = [
  `# Combat reachability summary`,
  ``,
  `Generated: ${GENERATED_AT}`,
  ``,
  `## Stats`,
  `- Combat files: ${symbolReachability.stats.combatFiles}`,
  `- Production: ${symbolReachability.stats.productionFiles}`,
  `- Tests: ${symbolReachability.stats.testFiles}`,
  `- Orphan candidates: ${orphanCandidates.length}`,
  `- Duplicate export names: ${duplicateExportNames.length}`,
  `- Production-reachable (graph): ${productionReachable.size}`,
  ``,
  `## Public barrel`,
  `- Star/named re-export modules: ${barrelModules.length}`,
  `- Banned leakage hits: ${bannedLeakage.length}${bannedLeakage.length ? "" : " (none)"}`,
  `- Not on allowlist: ${notOnAllowlist.length}`,
  ``,
  `## Record->engine map`,
  `- Pairs parsed: ${recordEnginePairs.length} (from ${engineMapPath || specsPath})`,
  `- Multi-record engines (aliases): ${multiRecordEngines.length}`,
  `- Link overrides: ${linkOverrideKeys.length}`,
  ``,
  `## Worker keep (never deletionsRecommended)`,
  ...WORKER_KEEP_PATHS.map((p) => `- \`${p}\``),
  ``,
  `## Orphans / manual review`,
  ...(orphanCandidates.length
    ? orphanCandidates.map(
        (o) =>
          `- \`${o.path}\` - ${o.reason}${o.uncertain ? " **[uncertain]**" : ""}`,
      )
    : ["- (none)"]),
  ``,
  `## Deletions recommended (static graph only; confirm dynamic imports)`,
  ...(deletionsRecommended.length
    ? deletionsRecommended
        .filter((p) => !WORKER_KEEP_PATHS.includes(p))
        .map((p) => `- ${p}`)
    : ["- (none)"]),
  ``,
  `## Reports`,
  `- reports/combat-symbol-reachability.json`,
  `- reports/combat-ability-registry.json`,
  `- reports/combat-record-fallbacks.json`,
  `- reports/combat-duplicate-definitions.json`,
  `- reports/combat-public-api.json`,
  ``,
].join("\n");

const writes = [
  ["combat-symbol-reachability.json", symbolReachability],
  ["combat-ability-registry.json", abilityRegistry],
  ["combat-record-fallbacks.json", recordFallbacks],
  ["combat-duplicate-definitions.json", duplicateDefinitions],
  ["combat-public-api.json", publicApi],
];

for (const [name, data] of writes) {
  await writeFile(join(REPORTS, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
await writeFile(join(REPORTS, "combat-reachability.md"), md, "utf8");

console.log(`[OK] combat inventory ${GENERATED_AT}`);
console.log(
  `  files=${combatFiles.length} orphans=${orphanCandidates.length} dupExports=${duplicateExportNames.length} pairs=${recordEnginePairs.length}`,
);
console.log(`  wrote ${writes.map(([n]) => n).join(", ")}, combat-reachability.md`);
process.exit(0);
