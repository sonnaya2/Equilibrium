// Temporary dual-build check: the same database, built once from the legacy
// compressed seed and once from data/canonical/, has to say exactly the same
// thing. Raw SQLite files are not compared — page layout follows insert order —
// but every logical row and every generated artifact must match byte for byte.
//
// Stage 3 deletes this together with the legacy ingestion path it exists to
// retire.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CACHE, REPORTS, ROOT, SCHEMA_VERSION } from "./config.mjs";
import { findEntities } from "./queries.mjs";
import { atomicWrite, hash, slash, stableJson, walkFiles } from "./utilities.mjs";

const PARITY_ROOT = join(CACHE, "parity");
const BUILDS = [
  { name: "legacy", command: "rebuild-legacy-seed", root: join(PARITY_ROOT, "legacy") },
  { name: "canonical", command: "rebuild", root: join(PARITY_ROOT, "canonical") },
];

// requirements, effects and quarantine are keyed by an INTEGER PRIMARY KEY the
// database hands out in insert order. Two ingestion paths reach the same rows
// in a different order, so the surrogate is not part of a logical row.
const SURROGATE_KEYS = new Map([
  ["requirements", "id"],
  ["effects", "id"],
  ["quarantine", "id"],
]);

// FTS5 shadow tables hold the index's own b-tree pages, whose bytes depend on
// insertion order. The index is compared through its columns and through real
// searches instead.
const isShadowTable = (name) => /^entity_search_/.test(name);

const SEARCH_PROBES = ["seismic wand", "protect item", "kandarin", "biting", "clockwork"];

const MAX_SAMPLES = 5;
const clip = (value, limit = 300) => (value.length > limit ? `${value.slice(0, limit)}…` : value);

function build({ name, command, root }) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const started = process.hrtime.bigint();
  execFileSync(process.execPath, ["scripts/data/platform.mjs", command], {
    cwd: ROOT,
    env: { ...process.env, EQUILIBRIUM_BUILD_ROOT: root },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return {
    build: name,
    command: `node scripts/data/platform.mjs ${command}`,
    root: slash(relative(ROOT, root)),
    elapsedMs: Number((Number(process.hrtime.bigint() - started) / 1e6).toFixed(1)),
  };
}

function realTables(db) {
  return db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .filter(({ name, sql }) => !name.startsWith("sqlite_") && !isShadowTable(name) && !/VIRTUAL TABLE/i.test(sql ?? ""))
    .map(({ name }) => name);
}

function columnsOf(db, table) {
  const surrogate = SURROGATE_KEYS.get(table);
  return db
    .prepare(`SELECT name FROM pragma_table_info(?) ORDER BY cid`)
    .all(table)
    .map(({ name }) => name)
    .filter((name) => name !== surrogate);
}

// Sorted logical rows, so two builds that reached the same set in a different
// order still compare equal.
const logicalRows = (db, table, columns) =>
  db
    .prepare(`SELECT ${columns.map((column) => `"${column}"`).join(", ")} FROM "${table}"`)
    .all()
    .map((row) => stableJson(row))
    .sort();

function difference(left, right) {
  const counts = new Map();
  for (const row of left) counts.set(row, (counts.get(row) ?? 0) + 1);
  for (const row of right) counts.set(row, (counts.get(row) ?? 0) - 1);
  const onlyLegacy = [];
  const onlyCanonical = [];
  for (const [row, count] of counts) {
    if (count > 0) onlyLegacy.push(row);
    else if (count < 0) onlyCanonical.push(row);
  }
  return { onlyLegacy, onlyCanonical };
}

function compareTables(databases) {
  const [legacy, canonical] = databases;
  const tables = [...new Set([...realTables(legacy), ...realTables(canonical)])].sort();
  return tables.map((table) => {
    const columns = columnsOf(canonical, table);
    const missing = columnsOf(legacy, table).filter((column) => !columns.includes(column));
    if (missing.length) {
      return { table, equal: false, reason: `columns only in the legacy build: ${missing.join(", ")}` };
    }
    const left = logicalRows(legacy, table, columns);
    const right = logicalRows(canonical, table, columns);
    const { onlyLegacy, onlyCanonical } = difference(left, right);
    const equal = onlyLegacy.length === 0 && onlyCanonical.length === 0;
    return {
      table,
      legacyRows: left.length,
      canonicalRows: right.length,
      surrogateKey: SURROGATE_KEYS.get(table) ?? null,
      equal,
      ...(equal
        ? {}
        : {
            onlyLegacy: onlyLegacy.length,
            onlyCanonical: onlyCanonical.length,
            samples: {
              legacy: onlyLegacy.slice(0, MAX_SAMPLES).map((row) => clip(row)),
              canonical: onlyCanonical.slice(0, MAX_SAMPLES).map((row) => clip(row)),
            },
          }),
    };
  });
}

// The FTS index is rebuilt from entities and aliases, so its columns and the
// results it returns are what has to match, not its shadow pages.
function compareSearch([legacy, canonical]) {
  const columns = "SELECT id, name, short_description, detailed_description, aliases FROM entity_search";
  const rows = (db) =>
    db
      .prepare(columns)
      .all()
      .map((row) => stableJson(row))
      .sort();
  const index = difference(rows(legacy), rows(canonical));
  const results = SEARCH_PROBES.map((query) => {
    const run = (db) => stableJson(findEntities(db, { query, limit: 20 }));
    return { query, equal: run(legacy) === run(canonical) };
  });
  return {
    rows: {
      equal: index.onlyLegacy.length === 0 && index.onlyCanonical.length === 0,
      onlyLegacy: index.onlyLegacy.slice(0, MAX_SAMPLES).map((row) => clip(row)),
      onlyCanonical: index.onlyCanonical.slice(0, MAX_SAMPLES).map((row) => clip(row)),
    },
    results,
    equal: index.onlyLegacy.length === 0 && index.onlyCanonical.length === 0 && results.every(({ equal }) => equal),
  };
}

function artifactSet(root) {
  if (!existsSync(root)) return new Map();
  return new Map(
    walkFiles(root, () => true).map((path) => {
      const body = readFileSync(path);
      return [slash(relative(root, path)), { sha256: hash(body), bytes: body.length }];
    }),
  );
}

function compareArtifacts(name, legacyRoot, canonicalRoot) {
  const legacy = artifactSet(legacyRoot);
  const canonical = artifactSet(canonicalRoot);
  const paths = [...new Set([...legacy.keys(), ...canonical.keys()])].sort();
  const differing = paths.filter((path) => stableJson(legacy.get(path)) !== stableJson(canonical.get(path)));
  return {
    name,
    files: paths.length,
    equal: differing.length === 0,
    ...(differing.length
      ? {
          differing: differing.length,
          samples: differing.slice(0, MAX_SAMPLES).map((path) => ({
            path,
            legacy: legacy.get(path) ?? null,
            canonical: canonical.get(path) ?? null,
          })),
        }
      : {}),
  };
}

const fileEquality = (name, legacyPath, canonicalPath) => ({
  name,
  equal:
    existsSync(legacyPath) &&
    existsSync(canonicalPath) &&
    readFileSync(legacyPath, "utf8") === readFileSync(canonicalPath, "utf8"),
});

export function legacyCanonicalParity() {
  const builds = BUILDS.map(build);
  const databases = BUILDS.map(({ root }) => new DatabaseSync(join(root, "cache/equilibrium.sqlite")));
  let report;
  try {
    const tables = compareTables(databases);
    const search = compareSearch(databases);
    const artifacts = [
      compareArtifacts("frontend exports", join(BUILDS[0].root, "data/v2"), join(BUILDS[1].root, "data/v2")),
      compareArtifacts("data reports", join(BUILDS[0].root, "reports"), join(BUILDS[1].root, "reports")),
    ];
    const files = [
      fileEquality("docs/data-catalog.md", join(BUILDS[0].root, "data-catalog.md"), join(BUILDS[1].root, "data-catalog.md")),
      fileEquality(
        "public/data/v2/manifest.json",
        join(BUILDS[0].root, "data/v2/manifest.json"),
        join(BUILDS[1].root, "data/v2/manifest.json"),
      ),
    ];
    report = {
      schemaVersion: SCHEMA_VERSION,
      match:
        tables.every(({ equal }) => equal) &&
        search.equal &&
        artifacts.every(({ equal }) => equal) &&
        files.every(({ equal }) => equal),
      builds,
      tables,
      search,
      artifacts,
      files,
      surrogateKeys: Object.fromEntries(SURROGATE_KEYS),
    };
  } finally {
    for (const db of databases) db.close();
  }
  mkdirSync(REPORTS, { recursive: true });
  atomicWrite(join(REPORTS, "data-parity-legacy-canonical.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (!report.match) {
    const broken = [
      ...report.tables.filter(({ equal }) => !equal).map(({ table, reason }) => reason ?? `${table} rows differ`),
      ...(report.search.equal ? [] : ["search results differ"]),
      ...report.artifacts.filter(({ equal }) => !equal).map(({ name }) => `${name} differ`),
      ...report.files.filter(({ equal }) => !equal).map(({ name }) => `${name} differs`),
    ];
    throw new Error(`Legacy/canonical parity failed: ${broken.join("; ")}`);
  }
  return report;
}
