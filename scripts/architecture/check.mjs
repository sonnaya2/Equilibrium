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
 *   node scripts/architecture/check.mjs [--verbose]
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { checkFile, fwd } from "./detect.mjs";

const ROOT = process.cwd();
const SCAN_ROOTS = [
  join(ROOT, "src", "combat"),
  join(ROOT, "src", "components"),
  join(ROOT, "app"),
];
const VERBOSE = process.argv.includes("--verbose");

/**
 * Pre-existing boundary debt; do not grow this list (new crossings must fail the gate).
 * Paths are repo-relative posix.
 */
const KNOWN_LEGACY_EXCEPTIONS = new Set([
  // Solver packs UI loadout / CalcStats until those live in shared domain.
  "src/combat/solver/packRequest.ts",
  // Shared reuses engine cast-requirement helpers (equipment passives / ability gates).
  "src/combat/shared/abilityAvailability.ts",
  "src/combat/shared/equipment.ts",
]);

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

if (VERBOSE) {
  console.log(
    `[architecture] scanned ${scanned} files under src/combat + src/components + app`,
  );
  console.log(`[architecture] allowlist ${KNOWN_LEGACY_EXCEPTIONS.size} legacy paths`);
}

if (violations.length === 0) {
  console.log(
    `[OK] architecture: ${scanned} files (combat + UI), no boundary violations`,
  );
  process.exit(0);
}

console.error(`[FAIL] architecture: ${violations.length} boundary violation(s)`);
for (const v of violations) {
  console.error(`  [${v.rule}] ${v.file}: import '${v.spec}' — ${v.detail}`);
}
process.exit(1);
