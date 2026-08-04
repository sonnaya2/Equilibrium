/**
 * Combat architecture gate.
 *
 * Fails (exit 1) when production combat code crosses layer boundaries:
 *   - src/combat/** (non-test) → components
 *   - src/combat/shared/** → engine
 *   - src/combat/solver/** → react | react-dom | components
 *   - src/combat/engine/** → components
 *   - src/components/** | app/** (production) → engine cast|resolution|runtime|schedulers
 *     (engine/simulation is allowed)
 *
 * Extended checks:
 *   - Public barrel star-export ban list (style catalogues / engine internals)
 *   - Import-cycle detection within src/combat (SCC heuristic)
 *   - Hard-fail only packRequest + resolvedCombatModel cycles; other cycles info
 *
 *   node scripts/architecture/check.mjs [--verbose] [--strict-cycles]
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  checkFile,
  extractImportSpecs,
  fwd,
  isTestFile,
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
 * Paths are repo-relative posix.
 */
const KNOWN_LEGACY_EXCEPTIONS = new Set([]);

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
  });
  violations.push(...hits);
}

// --- Public barrel ban list ---
const barrelPath = join(ROOT, "src", "combat", "index.ts");
try {
  const barrelSrc = await readFile(barrelPath, "utf8");
  for (const line of barrelSrc.split("\n")) {
    const m = line.match(/export \* from ["']\.\/([^"']+)["']/);
    if (!m) continue;
    const mod = `src/combat/${m[1]}`;
    if (isBannedBarrelStarExport(mod)) {
      violations.push({
        rule: "barrel-leakage",
        file: "src/combat/index.ts",
        spec: m[0],
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
  const from = fwd(relative(ROOT, abs)).replace(/\.tsx?$/, "");
  const source = await readFile(abs, "utf8");
  const deps = [];
  for (const spec of extractImportSpecs(source)) {
    let resolved = resolveSpecToRepoPath(abs, spec, ROOT);
    if (!resolved || !resolved.startsWith("src/combat/")) continue;
    if (isTestFile(resolved)) continue;
    resolved = resolved.replace(/\.tsx?$/, "").replace(/\/index$/, "");
    deps.push(resolved.replace(/\.tsx?$/, ""));
  }
  graph.set(from, deps);
}

/** Tarjan-lite: report simple cycles via DFS. */
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
      const key = [...g.keys()].find((k) => k === next || k.endsWith("/" + next.split("/").pop()));
      if (key) dfs(key);
      else if (g.has(next)) dfs(next);
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
    return c.length <= 8;
  });
}

const cycles = findCycles(graph).filter((c) => {
  // Ignore trivial self-loops from imperfect path normalization.
  if (c.length <= 2 && c[0] === c[c.length - 1] && new Set(c).size === 1) return false;
  if (c.length === 2 && c[0] === c[1]) return false;
  return true;
});

// Cycles are reported as warnings by default (many type-only edges in the engine).
// Fail only with --strict-cycles, or when a cycle involves packRequest + resolvedCombatModel.
const STRICT_CYCLES = process.argv.includes("--strict-cycles");
const hardCycles = cycles.filter((c) => {
  const joined = c.join(" ");
  return joined.includes("resolvedCombatModel") && joined.includes("packRequest");
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
    detail: "hard dependency cycle (solver pack/model must stay acyclic)",
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
