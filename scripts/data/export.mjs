import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import {
  DATA_CATALOG,
  DOCUMENTS_PREFIX,
  DOCUMENT_EXTRA_CONSUMERS,
  DOCUMENT_SKIP,
  DOMAIN_TABLES,
  DOCUMENTS_ROOT,
  EXPORT_ROOT,
  EXPORT_VERSION,
  REPORTS,
  ROOT,
  SCHEMA_VERSION,
  SHARD_LIMIT_BYTES,
  TRANSFORM_BY_NAME,
} from "./config.mjs";
import { prepared, recordTransform } from "./database.mjs";
import { researchRegionIndex } from "./research.mjs";
import { atomicWrite, hash, slash, stableJson, walkFiles } from "./utilities.mjs";

function setRecordAtPath(document, recordPath, value) {
  const tokens = [...recordPath.matchAll(/\.([^.[\]]+)|\[(\d+)\]/g)].map((match) =>
    match[1] === undefined ? Number(match[2]) : match[1],
  );
  let target = document;
  for (const token of tokens.slice(0, -1)) target = target[token];
  target[tokens.at(-1)] = value;
}

// A document is only worth writing if something loads it. Everything else is
// reachable through the database or the bounded shards, so emitting it would
// just park a second copy of the dataset in the deploy.
function documentConsumers() {
  const wanted = new Set(DOCUMENT_EXTRA_CONSUMERS);
  for (const path of walkFiles(join(ROOT, "app"), (file) => /\.tsx?$/.test(file)).concat(
    walkFiles(join(ROOT, "src"), (file) => /\.tsx?$/.test(file)),
  )) {
    for (const match of readFileSync(path, "utf8").matchAll(/#shard\/([a-zA-Z0-9/_.-]+\.json)/g)) {
      wanted.add(match[1]);
    }
  }
  return wanted;
}

// Rebuilds the whole-document artifacts for the modules that import one at build
// time: each source document's skeleton with its records written back over their
// own record paths. Record paths sort parent-before-child, so a nested record
// lands inside the parent body that was just restored. The research catalog is
// excluded — it is served from relational tables instead.
export function documentOutputs(db) {
  const wanted = documentConsumers();
  const skeletons = new Map(
    prepared(db, "SELECT path, skeleton_json FROM source_documents ORDER BY path")
      .all()
      .map(({ path, skeleton_json }) => [path, skeleton_json]),
  );
  const missing = [...wanted].filter((name) => !skeletons.has(`data/${name}`));
  if (missing.length) {
    throw new Error(`#shard imports name documents the database does not contain: ${missing.join(", ")}`);
  }
  const documents = new Map(
    [...wanted]
      // combat/equipment.json -> data/combat/equipment.json
      .map((name) => `data/${name}`)
      .filter((file) => !DOCUMENT_SKIP.has(file))
      .sort()
      .map((file) => [file, JSON.parse(skeletons.get(file))]),
  );
  // Removal is a status change: keep provenance in SQLite, drop the body from
  // every #shard document so the app stops listing retired equipment / abilities.
  const removed = new Set(
    prepared(db, "SELECT id FROM entities WHERE status = 'removed'")
      .all()
      .map((row) => row.id),
  );
  // Nested source rows (e.g. $.records[12].sources[0]) have no entity_id; skip
  // any path that sits under a top-level record whose entity is removed.
  const skippedPrefixes = new Set();
  for (const row of prepared(
    db,
    "SELECT source_file, record_path, entity_id, raw_json FROM source_records ORDER BY source_file, record_path",
  ).all()) {
    const document = documents.get(row.source_file);
    if (!document) continue;
    if ([...skippedPrefixes].some((prefix) => row.record_path.startsWith(prefix))) continue;
    if (row.entity_id && removed.has(row.entity_id)) {
      skippedPrefixes.add(`${row.record_path}.`);
      skippedPrefixes.add(`${row.record_path}[`);
      continue;
    }
    setRecordAtPath(document, row.record_path, JSON.parse(row.raw_json));
  }
  // Indexed writes leave holes when middle records are skipped; compact every
  // top-level record list (not only `records` — e.g. active_perks).
  for (const data of documents.values()) {
    for (const [key, value] of Object.entries(data)) {
      if (
        Array.isArray(value) &&
        value.some((entry) => entry == null) &&
        value.every((entry) => entry == null || (typeof entry === "object" && !Array.isArray(entry)))
      ) {
        data[key] = value.filter(Boolean);
      }
    }
    if (typeof data.active_perk_count === "number" && Array.isArray(data.active_perks)) {
      data.active_perk_count = data.active_perks.length;
    }
  }
  return new Map(
    [...documents].map(([file, data]) => [
      `${DOCUMENTS_PREFIX}/${file.slice("data/".length)}`,
      `${stableJson(data)}\n`,
    ]),
  );
}

export function buildOutputs(db) {
  const outputs = new Map();
  // A retired record leaves the site but not the database: `remove` is a status
  // change, so its provenance, sources and relationships stay queryable through
  // data:context while the browser stops being told about it. Without this the
  // whole point of retiring a duplicate is lost - both records keep shipping.
  const recordCount = Number(
    db.prepare("SELECT count(*) AS count FROM entities WHERE status <> 'removed'").get().count,
  );
  // Build inputs, generated outside the web root: the `#shard/*` alias resolves
  // into .generated/documents, and no request ever asks for one.
  const documentOutputMap = new Map();
  const documents = {};
  for (const [path, body] of documentOutputs(db)) {
    const file = path.slice(DOCUMENTS_PREFIX.length + 1);
    documentOutputMap.set(file, body);
    documents[`data/${file}`] = { sha256: hash(body), bytes: Buffer.byteLength(body) };
  }
  // Bookkeeping, not a payload: `data:doctor` and `data:diff` read it to spot a
  // stale export. It is written under reports/ rather than shipped, because the
  // browser never asked for it.
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    exportVersion: EXPORT_VERSION,
    databaseInputHash: db.prepare("SELECT input_hash FROM transform_runs WHERE name = 'canonical-ingest'").get()
      .input_hash,
    recordCount,
    documents,
    regions: Object.fromEntries(researchRegionIndex(db).map((region) => [region.id, region])),
  };
  return { outputs, documentOutputs: documentOutputMap, manifest };
}

// Both generated trees get the same treatment: write what changed, delete what
// no longer belongs, and leave no empty directory behind.
function syncTree(root, outputs) {
  // Nothing to write means the tree should not exist. Creating it first and
  // deleting it after would leave the empty parent behind, which is how
  // public/data survived having nothing in it.
  if (!outputs.size) {
    rmSync(root, { recursive: true, force: true });
    return 0;
  }
  const stale = walkFiles(root, () => true)
    .map((path) => slash(relative(root, path)))
    .filter((path) => !outputs.has(path));
  mkdirSync(root, { recursive: true });
  for (const path of stale) rmSync(join(root, path), { force: true });
  let written = 0;
  for (const [path, body] of outputs) {
    const destination = join(root, path);
    if (existsSync(destination) && readFileSync(destination, "utf8") === body) continue;
    atomicWrite(destination, body);
    written += 1;
  }
  pruneEmptyDirectories(root);
  // Nothing belongs here any more, so the tree itself goes. public/data/v2 is
  // empty now that the panels render from SQLite, and an empty directory in the
  // deploy is just a question someone has to answer later.
  if (!readdirSync(root).length) rmSync(root, { recursive: true, force: true });
  return written;
}

// Removing every file in a directory leaves the directory. An empty `domains/`
// under the deploy reads as "something failed to write" rather than "nothing
// belongs here any more".
function pruneEmptyDirectories(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(root, entry.name);
    pruneEmptyDirectories(path);
    if (!readdirSync(path).length) rmSync(path, { recursive: true, force: true });
  }
}

export function compareOutputs(outputs) {
  const stale = walkFiles(EXPORT_ROOT, () => true)
    .map((path) => slash(relative(EXPORT_ROOT, path)))
    .filter((path) => !outputs.has(path));
  const changed = [];
  for (const [path, body] of outputs) {
    const destination = join(EXPORT_ROOT, path);
    if (!existsSync(destination) || readFileSync(destination, "utf8") !== body) changed.push(path);
  }
  return { changed, stale };
}

export function gitDataStatus() {
  try {
    return execFileSync("git", ["status", "--short", "--", "public/data/v2", "reports", "docs/data-catalog.md"], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return ["Git status unavailable"];
  }
}

function writeCatalog(db) {
  const counts = db
    .prepare("SELECT entity_type, count(*) AS count FROM entities GROUP BY entity_type ORDER BY entity_type")
    .all();
  const lines = [
    "# Data catalog",
    "",
    "Generated by `npm run data:export`. Edit records through `data/patches/`, never through this file or generated exports.",
    "",
    "## Domains",
    "",
    "| Domain | Records |",
    "| --- | ---: |",
    ...counts.map(({ entity_type, count }) => `| ${entity_type} | ${count} |`),
    "",
    "## Normal workflow",
    "",
    '1. `npm run data:find -- --query "name"`',
    "2. `npm run data:context -- --id stable:id`",
    "3. `npm run data:impact -- --id stable:id`",
    "4. Add one JSONL operation under `data/patches/`.",
    "5. `npm run data:apply -- data/patches/file.jsonl`",
    "6. `npm run data:validate:changed && npm run data:export:changed`",
    "",
    "Schema: [`data/migrations/001-data-core.sql`](../data/migrations/001-data-core.sql). Architecture: [`docs/data-platform.md`](data-platform.md).",
    "",
  ];
  atomicWrite(DATA_CATALOG, lines.join("\n"));
}

const countOf = (db, sql, ...params) => Number(prepared(db, sql).get(...params).count);

function parityReport(db) {
  return {
    schemaVersion: SCHEMA_VERSION,
    entityCounts: Object.fromEntries(
      db
        .prepare("SELECT entity_type, count(*) AS count FROM entities GROUP BY entity_type ORDER BY entity_type")
        .all()
        .map(({ entity_type, count }) => [entity_type, Number(count)]),
    ),
    explicitSeedIds: countOf(
      db,
      "SELECT count(DISTINCT stable_id) AS count FROM source_records WHERE stable_id IS NOT NULL",
    ),
    mappedSeedRecords: countOf(db, "SELECT count(*) AS count FROM source_records WHERE entity_id IS NOT NULL"),
    quarantinedRecords: countOf(db, "SELECT count(*) AS count FROM quarantine"),
    unmappedStableRecordsWithoutQuarantine: countOf(
      db,
      `SELECT count(*) AS count FROM source_records
       WHERE stable_id IS NOT NULL AND entity_id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM quarantine
           WHERE quarantine.source_file = source_records.source_file
             AND quarantine.record_path = source_records.record_path
         )`,
    ),
    sourceUrls: countOf(db, "SELECT count(*) AS count FROM sources"),
    relationships: countOf(db, "SELECT count(*) AS count FROM relationships"),
    crossRegionEntities: countOf(
      db,
      `SELECT count(*) AS count FROM (
         SELECT entity_id FROM entity_regions WHERE relation = 'required'
         GROUP BY entity_id HAVING count(DISTINCT region_id) > 1
       )`,
    ),
    recordsByRegion: Object.fromEntries(
      db
        .prepare(
          `SELECT region_id, count(DISTINCT entity_id) AS count
           FROM entity_regions GROUP BY region_id ORDER BY region_id`,
        )
        .all()
        .map(({ region_id, count }) => [region_id, Number(count)]),
    ),
    domainTables: Object.fromEntries(
      [...DOMAIN_TABLES].map(([domain, table]) => [domain, countOf(db, `SELECT count(*) AS count FROM ${table}`)]),
    ),
    // Spot checks across the domains most likely to break on an ID change.
    representativeIds: Object.fromEntries(
      ["item:seismic-wand", "magic:sonic-wave", "prayer:clarity-of-thought", "perk:biting", "wiki:462"].map((id) => [
        id,
        Boolean(prepared(db, "SELECT 1 FROM entities WHERE id = ?").get(id)),
      ]),
    ),
  };
}

export function exportData(db, checkOnly = false) {
  const { outputs, documentOutputs: documents, manifest } = buildOutputs(db);
  const comparison = compareOutputs(outputs);
  // Everything under EXPORT_ROOT is fetched by a browser, so all of it is
  // budgeted. Documents are not shipped and have no such limit.
  const oversized = [...outputs].filter(([, body]) => Buffer.byteLength(body) > SHARD_LIMIT_BYTES);
  if (oversized.length) {
    throw new Error(`Frontend shards exceed 500 KiB: ${oversized.map(([path]) => path).join(", ")}`);
  }
  mkdirSync(REPORTS, { recursive: true });
  atomicWrite(join(REPORTS, "data-migration-parity.json"), `${JSON.stringify(parityReport(db), null, 2)}\n`);
  if (checkOnly) return { ...comparison, written: [] };
  syncTree(EXPORT_ROOT, outputs);
  syncTree(DOCUMENTS_ROOT, documents);
  writeCatalog(db);
  atomicWrite(join(REPORTS, "data-export-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  recordTransform(db, TRANSFORM_BY_NAME.get("frontend-shards"), hash(stableJson(manifest)), manifest.recordCount);
  return { ...comparison, written: comparison.changed };
}
