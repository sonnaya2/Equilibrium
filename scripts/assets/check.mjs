/**
 * The asset pipeline gate. Exits non-zero on any failure.
 *
 * Replaces scripts/audit-public-game-provenance.mjs, which swallowed its own
 * errors and always exited 0, so it could never protect anything.
 *
 *   node scripts/assets/check.mjs [--verbose]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { planPublish } from "./plan.mjs";
import { SHARDS, loadCatalog, shardFor } from "./catalog.mjs";

const ROOT = process.cwd();
const VERBOSE = process.argv.includes("--verbose");
const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;
const KNOWN_EXT = [".webp", ".png", ".jpg", ".jpeg", ".gif"];
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

// --- catalog ---------------------------------------------------------------
const catalog = await loadCatalog();
const seenIds = new Map();
for (const row of catalog.assets) {
  for (const field of ["id", "label", "category", "path"]) {
    if (!row[field]) fail("catalog-schema", `${row.id ?? "(no id)"} missing ${field}`);
  }
  if (row.path && !row.path.startsWith("assets/")) {
    fail("catalog-schema", `${row.id} path escapes assets/: ${row.path}`);
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
}

if (existsSync(join(ROOT, "assets/source-manifest.json"))) {
  fail("catalog-monolith", "assets/source-manifest.json still exists; the catalog is assets/catalog/");
}

// --- catalogued files exist ------------------------------------------------
for (const row of catalog.assets) {
  if (!row.path) continue;
  if (!KNOWN_EXT.some((ext) => existsSync(join(ROOT, row.path + ext)))) {
    fail("catalog-missing-file", `${row.id}: no file at ${row.path}.{${KNOWN_EXT.join(",")}}`);
  }
}

// --- publish plan ----------------------------------------------------------
const { targets, collisions, sourceFiles } = await planPublish(ROOT);
for (const c of collisions) {
  fail(c.reason === "case collision" ? "publish-case-collision" : "publish-collision", `${c.target} <- ${c.sources.join(" AND ")}`);
}
const publishedSources = new Set([...targets.values()].map((t) => t.sourcePath));

// --- uncatalogued source art ----------------------------------------------
const catalogued = new Set(catalog.assets.map((row) => row.path?.toLowerCase()));
const uncatalogued = sourceFiles.filter(
  (f) => IMAGE_RE.test(f.rel) && !catalogued.has(f.path.replace(IMAGE_RE, "").toLowerCase()),
);
if (uncatalogued.length) {
  warn("catalog-coverage", `${uncatalogued.length} source images have no catalog row`);
  if (VERBOSE) for (const f of uncatalogued.slice(0, 40)) warn("catalog-coverage", `  ${f.path}`);
}

// --- duplicates ------------------------------------------------------------
// Only served art must be unique. Duplication inside raw/ and variants/ is the
// record of which version won, so it is reported but never a failure.
const byHash = new Map();
for (const file of sourceFiles) {
  if (!IMAGE_RE.test(file.rel)) continue;
  const hash = createHash("sha256").update(readFileSync(file.abs)).digest("hex");
  if (!byHash.has(hash)) byHash.set(hash, []);
  byHash.get(hash).push(file.path);
}
const duplicates = [...byHash.values()].filter((group) => group.length > 1);
const servedDuplicates = duplicates.filter(
  (group) => group.filter((path) => publishedSources.has(path)).length > 1,
);
const archivalDuplicates = duplicates.length - servedDuplicates.length;

if (servedDuplicates.length) {
  fail(
    "duplicate-source",
    `${servedDuplicates.length} published group(s), ${servedDuplicates.reduce((n, g) => n + g.length - 1, 0)} redundant files`,
  );
  for (const group of servedDuplicates.slice(0, VERBOSE ? 200 : 5)) {
    fail("duplicate-source", `  ${group.join("  ==  ")}`);
  }
}
if (archivalDuplicates) {
  warn("duplicate-archival", `${archivalDuplicates} group(s) inside unpublished/archival trees`);
}

// --- generated trees are not tracked ---------------------------------------
try {
  const tracked = execFileSync("git", ["ls-files", "public/game", "public/brand"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  if (tracked.length) {
    fail("public-tracked", `${tracked.length} generated file(s) are tracked; public/ is build output`);
  }
} catch {
  warn("public-tracked", "git unavailable; skipped");
}

// --- delegated checks ------------------------------------------------------
for (const [name, script] of [
  ["icon-index", "scripts/assets/build-icon-index.mjs --check"],
  ["publish-mirror", "scripts/publish-assets.mjs --check"],
  ["aliases", "scripts/assets/check-aliases.mjs"],
]) {
  try {
    const out = execFileSync("node", script.split(" "), { cwd: ROOT, encoding: "utf8" });
    if (VERBOSE) console.log(out.trim());
  } catch (err) {
    fail(name, (err.stdout || err.message || "").trim().split("\n").slice(0, 12).join("\n  "));
  }
}

// --- report ----------------------------------------------------------------
console.log("ASSET CHECK");
console.log(
  `  catalog ${catalog.assets.length} rows across ${SHARDS.length} shard prefixes, ` +
    `${sourceFiles.length} source files, ${targets.size} published paths`,
);
for (const { check, detail } of warnings) console.log(`  WARN  ${check}: ${detail}`);
for (const { check, detail } of failures) console.log(`  FAIL  ${check}: ${detail}`);
console.log(failures.length ? `\n${failures.length} failure(s)` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
