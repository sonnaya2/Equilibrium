/**
 * The art gate. Exits non-zero on any failure.

 * Replaces scripts/audit-public-game-provenance.mjs, which swallowed its own
 * errors and always exited 0, so it could never protect anything.

 *   node scripts/assets/check.mjs [--verbose]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { SHARDS, loadCatalog, shardFor } from "./catalog.mjs";

const ROOT = process.cwd();
const VERBOSE = process.argv.includes("--verbose");
const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;
const KNOWN_EXT = [".webp", ".png", ".jpg", ".jpeg", ".gif"];
const TREES = ["public/game", "public/brand"];
const fwd = (p) => p.split(sep).join("/");

const failures = [];
const warnings = [];
const fail = (check, detail) => failures.push({ check, detail });
const warn = (check, detail) => warnings.push({ check, detail });

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
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
}

const catalog = await loadCatalog();
const seenIds = new Map();
const seenPaths = new Map();
for (const row of catalog.assets) {
  for (const field of ["id", "label", "category", "path"]) {
    if (!row[field]) fail("catalog-schema", `${row.id ?? "(no id)"} missing ${field}`);
  }
  if (row.path && !row.path.startsWith("public/")) {
    fail("catalog-schema", `${row.id} path is not under public/: ${row.path}`);
  }
  if (row.path && IMAGE_RE.test(row.path)) {
    fail("catalog-schema", `${row.id} path carries an extension: ${row.path}`);
  }
  if (row.category && shardFor(row.category) !== row.shard) {
    fail("catalog-shard", `${row.id} is in ${row.shard}, category says ${shardFor(row.category)}`);
  }
  const prior = seenIds.get(row.id);
  if (prior) fail("catalog-duplicate-id", `${row.id} in ${prior} and ${row.shard}`);
  seenIds.set(row.id, row.shard);

  const owner = seenPaths.get(row.path);
  if (owner) fail("catalog-duplicate-path", `${row.path} claimed by ${owner} and ${row.id}`);
  seenPaths.set(row.path, row.id);

  if (row.provenance === "unverified-local" && (row.canonicalPage || row.sourcePage)) {
    fail("catalog-provenance", `${row.id} is marked unverified but carries a source`);
  }
}

if (existsSync(join(ROOT, "assets"))) {
  fail("stray-assets-tree", "assets/ is back; art lives in public/, provenance in asset-catalog/");
}

for (const row of catalog.assets) {
  if (!row.path) continue;
  if (!KNOWN_EXT.some((ext) => existsSync(join(ROOT, row.path + ext)))) {
    fail("catalog-missing-file", `${row.id}: no file at ${row.path}.{${KNOWN_EXT.join(",")}}`);
  }
  for (const also of row.alsoAt ?? []) {
    if (!existsSync(join(ROOT, also))) {
      fail("catalog-missing-file", `${row.id}: alsoAt points at nothing: ${also}`);
    }
  }
}

const files = [];
for (const tree of TREES) {
  for (const abs of await walk(join(ROOT, tree))) {
    files.push({ path: `${tree}/${fwd(relative(join(ROOT, tree), abs))}`, abs });
  }
}

const lowered = new Map();
for (const file of files) {
  const key = file.path.toLowerCase();
  const prior = lowered.get(key);
  if (prior && prior !== file.path) fail("case-collision", `${prior} vs ${file.path}`);
  lowered.set(key, file.path);
}

const catalogued = new Set(catalog.assets.map((row) => row.path?.toLowerCase()));
for (const row of catalog.assets) {
  for (const also of row.alsoAt ?? []) catalogued.add(also.replace(IMAGE_RE, "").toLowerCase());
}
const uncatalogued = files.filter(
  (f) => IMAGE_RE.test(f.path) && !catalogued.has(f.path.replace(IMAGE_RE, "").toLowerCase()),
);
if (uncatalogued.length) {
  warn("catalog-coverage", `${uncatalogued.length} images have no provenance row`);
  if (VERBOSE) for (const f of uncatalogued.slice(0, 40)) warn("catalog-coverage", `  ${f.path}`);
}

// One picture can legitimately sit at two URLs when two resolvers want it in
// different places; the catalog's `alsoAt` records those. Anything else is
// unaccounted-for duplication.
const declared = new Set();
for (const row of catalog.assets) {
  for (const also of row.alsoAt ?? []) declared.add(also.toLowerCase());
}

const byHash = new Map();
for (const file of files) {
  if (!IMAGE_RE.test(file.path)) continue;
  const hash = createHash("sha256").update(readFileSync(file.abs)).digest("hex");
  if (!byHash.has(hash)) byHash.set(hash, []);
  byHash.get(hash).push(file.path);
}

const undeclared = [];
for (const group of byHash.values()) {
  if (group.length < 2) continue;
  const unaccounted = group.filter((p) => !declared.has(p.toLowerCase()));
  if (unaccounted.length > 1) undeclared.push(group);
}
if (undeclared.length) {
  fail(
    "duplicate-undeclared",
    `${undeclared.length} byte-identical group(s) with no alsoAt row explaining them`,
  );
  for (const group of undeclared.slice(0, VERBOSE ? 200 : 5)) {
    fail("duplicate-undeclared", `  ${group.join("  ==  ")}`);
  }
}
if (declared.size) warn("duplicate-declared", `${declared.size} copies declared via alsoAt`);

for (const [name, script] of [
  ["icon-index", "scripts/assets/build-icon-index.mjs --check"],
  ["aliases", "scripts/assets/check-aliases.mjs"],
]) {
  try {
    const out = execFileSync("node", script.split(" "), { cwd: ROOT, encoding: "utf8" });
    if (VERBOSE) console.log(out.trim());
  } catch (err) {
    fail(name, (err.stdout || err.message || "").trim().split("\n").slice(0, 12).join("\n  "));
  }
}

console.log("ART CHECK");
console.log(
  `  ${catalog.assets.length} provenance rows across ${SHARDS.length} shard prefixes, ${files.length} files in public/`,
);
for (const { check, detail } of warnings) console.log(`  WARN  ${check}: ${detail}`);
for (const { check, detail } of failures) console.log(`  FAIL  ${check}: ${detail}`);
console.log(failures.length ? `\n${failures.length} failure(s)` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
