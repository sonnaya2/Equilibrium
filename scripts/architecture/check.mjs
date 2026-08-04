/**
 * Combat architecture gate.
 *
 * Fails (exit 1) when production combat code crosses layer boundaries:
 *   - src/combat/** (non-test) → components
 *   - src/combat/shared/** → engine
 *   - src/combat/solver/** → react | react-dom | components | useLoadout | UI stats
 *   - src/combat/engine/** → components
 *   - src/components/** | app/** (production) → engine cast|resolution|runtime|schedulers
 *     (engine/simulation is allowed)
 *   - UI → style ability catalogues (ui-no-style-catalogues)
 *   - production combat+UI → linear catalogue id .find (no-linear-id-lookup)
 *   - PASSIVE_DEFINITIONS / passive BY_ID only under passives/**
 *   - RECORD_TO_ENGINE only in abilities/engineMap.ts
 *   - app/** → node:sqlite | scripts/data (runtime-no-data-build)
 *
 * Extended checks:
 *   - Public barrel star-export ban list (style catalogues / engine internals)
 *   - Import-cycle detection within src/combat (hard-fail model ↔ packRequest)
 *
 *   node scripts/architecture/check.mjs [--verbose] [--strict-cycles]
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  checkFile,
  extractImportSpecs,
  fwd,
  isModelPackCycleNode,
  isTestFile,
  moduleKey,
  resolveSpecToRepoPath,
} from "./detect.mjs";
import { isBannedBarrelStarExport } from "./public-api.mjs";

const ROOT = process.cwd();
const SCAN_ROOTS = [
  join(ROOT, "src", "combat"),
  join(ROOT, "src", "components"),
  join(ROOT, "app"),
];
const VERBOSE = process.argv.includes("--verbose");

/**
 * Legacy allowlist - must stay empty. New boundary crossings fail the gate.
 * Paths are repo-relative posix. Exempts the file from ALL rules.
 */
const KNOWN_LEGACY_EXCEPTIONS = new Set([]);

/**
 * Pass7: empty after UI migration to engineSpecsForStyle / registry.
 * Exempts only `ui-no-style-catalogues` if ever needed.
 */
const UI_STYLE_CATALOGUE_ALLOWLIST = new Set([]);

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

/** @type {string[]} */
const files = [];
for (const root of SCAN_ROOTS) {
  await walk(root, files);
}

/** @type {import('./detect.mjs').Violation[]} */
const violations = [];
let scanned = 0;

for (const abs of files) {
  const repoRel = fwd(relative(ROOT, abs));
  const source = await readFile(abs, "utf8");
  scanned += 1;
  const hits = checkFile({
    root: ROOT,
    filePath: abs,
    repoRel,
    source,
    allowlist: KNOWN_LEGACY_EXCEPTIONS,
    uiStyleCatalogueAllowlist: UI_STYLE_CATALOGUE_ALLOWLIST,
  });
  violations.push(...hits);
}

// --- Public barrel ban list (barrel-leakage) ---
const barrelPath = join(ROOT, "src", "combat", "index.ts");
try {
  const barrelSrc = await readFile(barrelPath, "utf8");
  // Star-exports only (named re-exports of public facades are intentional).
  const starRe = /export\s+\*\s+from\s+["']([^"']+)["']/g;
  let sm;
  while ((sm = starRe.exec(barrelSrc)) !== null) {
    const spec = sm[1];
    let mod;
    if (spec.startsWith("./") || spec.startsWith("../")) {
      // Relative from src/combat/index.ts
      const abs = join(ROOT, "src", "combat", spec);
      mod = moduleKey(fwd(relative(ROOT, abs)));
    } else if (spec.startsWith("@/combat/") || spec.startsWith("src/combat/")) {
      mod = moduleKey(
        spec.startsWith("@/") ? `src/${spec.slice(2)}` : spec,
      );
    } else {
      continue;
    }
    if (isBannedBarrelStarExport(mod)) {
      violations.push({
        rule: "barrel-leakage",
        file: "src/combat/index.ts",
        spec: sm[0],
        detail: `public barrel must not star-export ${mod} (use deep imports or narrow facade)`,
      });
    }
  }
} catch {
  /* index missing - other rules still run */
}

// --- Cycle detection within src/combat production files ---
const combatFiles = files.filter((abs) => {
  const rel = fwd(relative(ROOT, abs));
  return rel.startsWith("src/combat/") && !isTestFile(rel);
});

/** @type {Map<string, string[]>} */
const graph = new Map();
for (const abs of combatFiles) {
  const from = moduleKey(fwd(relative(ROOT, abs)));
  const source = await readFile(abs, "utf8");
  /** @type {string[]} */
  const deps = [];
  for (const spec of extractImportSpecs(source)) {
    let resolved = resolveSpecToRepoPath(abs, spec, ROOT);
    if (!resolved || !resolved.startsWith("src/combat/")) continue;
    if (isTestFile(resolved)) continue;
    const key = moduleKey(resolved);
    if (key !== from) deps.push(key);
  }
  // Merge multi-file edges (e.g. if both .ts and directory index exist)
  const prev = graph.get(from) ?? [];
  graph.set(from, [...new Set([...prev, ...deps])]);
}

/** Tarjan-lite: report simple cycles via DFS (exact graph keys only). */
function findCycles(g) {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function dfs(node) {
    if (visiting.has(node)) {
      const i = stack.indexOf(node);
      if (i >= 0) cycles.push(stack.slice(i).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of g.get(node) ?? []) {
      // Exact key only — no endsWith heuristics (false multi-matches).
      if (g.has(next)) dfs(next);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const n of g.keys()) dfs(n);
  const seen = new Set();
  return cycles.filter((c) => {
    const key = c.join(">");
    if (seen.has(key)) return false;
    seen.add(key);
    return c.length <= 12;
  });
}

const cycles = findCycles(graph).filter((c) => {
  // Ignore trivial self-loops from imperfect path normalization.
  if (c.length <= 2 && c[0] === c[c.length - 1] && new Set(c).size === 1) return false;
  if (c.length === 2 && c[0] === c[1]) return false;
  return true;
});

// Cycles involving model/** and packRequest are hard-fail (acyclic pack seam).
// Other cycles remain info unless --strict-cycles.
const STRICT_CYCLES = process.argv.includes("--strict-cycles");
const hardCycles = cycles.filter((c) => {
  let hasModel = false;
  let hasPack = false;
  for (const node of c) {
    const role = isModelPackCycleNode(node);
    if (role === "model") hasModel = true;
    if (role === "pack") hasPack = true;
  }
  return hasModel && hasPack;
});

if (VERBOSE || cycles.length > 0) {
  console.log(
    `[architecture] dependency cycles (info): ${cycles.length}; hard: ${hardCycles.length}`,
  );
  if (VERBOSE) {
    for (const c of cycles.slice(0, 15)) console.log(`  cycle: ${c.join(" -> ")}`);
  }
}

for (const c of hardCycles) {
  violations.push({
    rule: "import-cycle",
    file: c[0] ?? "src/combat",
    spec: c.join(" -> "),
    detail: "hard dependency cycle (model ↔ packRequest must stay acyclic)",
  });
}
if (STRICT_CYCLES) {
  for (const c of cycles.slice(0, 30)) {
    violations.push({
      rule: "import-cycle",
      file: c[0] ?? "src/combat",
      spec: c.join(" -> "),
      detail: "dependency cycle in production combat modules (--strict-cycles)",
    });
  }
}

if (VERBOSE) {
  console.log(
    `[architecture] scanned ${scanned} files under src/combat + src/components + app`,
  );
  console.log(`[architecture] allowlist ${KNOWN_LEGACY_EXCEPTIONS.size} legacy paths`);
  console.log(
    `[architecture] ui-style-catalogue allowlist ${UI_STYLE_CATALOGUE_ALLOWLIST.size} paths (Pass7)`,
  );
  console.log(`[architecture] combat production modules in graph: ${graph.size}`);
}

if (violations.length === 0) {
  console.log(
    `[OK] architecture: ${scanned} files (combat + UI), no boundary violations`,
  );
  process.exit(0);
}

console.error(`[FAIL] architecture: ${violations.length} boundary violation(s)`);
for (const v of violations) {
  console.error(`  [${v.rule}] ${v.file}: import '${v.spec}' - ${v.detail}`);
}
process.exit(1);
