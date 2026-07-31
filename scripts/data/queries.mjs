import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { DATABASE, PATCHES, ROOT } from "./config.mjs";
import { prepared } from "./database.mjs";
import { buildOutputs, compareOutputs } from "./export.mjs";
import { seedDocuments } from "./ingest.mjs";
import { hash, slash } from "./utilities.mjs";

export function entityContext(db, id, maxRelated = 30) {
  const entity = prepared(db, "SELECT * FROM entities WHERE id = ?").get(id);
  if (!entity) throw new Error(`Entity not found: ${id}`);
  const select = (sql, ...params) => prepared(db, sql).all(...params);
  return {
    entity: { ...entity, extra_json: JSON.parse(entity.extra_json) },
    regions: select(
      "SELECT region_id, relation, ordinal, requirement_group FROM entity_regions WHERE entity_id = ? ORDER BY relation, ordinal, region_id",
      id,
    ),
    requirements: select(
      "SELECT kind, skill, level, target_entity_id, description, ordinal FROM requirements WHERE entity_id = ? ORDER BY ordinal",
      id,
    ),
    effects: select(
      "SELECT effect_key, description, value_text, ordinal FROM effects WHERE entity_id = ? ORDER BY ordinal",
      id,
    ),
    related: select(
      `SELECT 'outgoing' AS direction, predicate, object_id AS id FROM relationships WHERE subject_id = ?
       UNION ALL
       SELECT 'incoming', predicate, subject_id FROM relationships WHERE object_id = ?
       ORDER BY direction, predicate, id LIMIT ?`,
      id,
      id,
      maxRelated,
    ),
    sources: select(
      `SELECT sources.*, entity_sources.role, entity_sources.ordinal
       FROM entity_sources JOIN sources ON sources.id = entity_sources.source_id
       WHERE entity_sources.entity_id = ? ORDER BY entity_sources.ordinal, sources.id`,
      id,
    ),
    responsibility: select(
      "SELECT source_file, record_path, record_hash FROM source_records WHERE entity_id = ? ORDER BY source_file, record_path",
      id,
    ),
    patches: select(
      `SELECT patch_ledger.filename, patch_ledger.content_hash, patch_changes.operation, patch_changes.line
       FROM patch_changes JOIN patch_ledger ON patch_ledger.patch_id = patch_changes.patch_id
       WHERE patch_changes.entity_id = ? ORDER BY patch_ledger.filename, patch_changes.line`,
      id,
    ),
  };
}

export function formatContextMarkdown(context) {
  return [
    `# ${context.entity.name}`,
    "",
    `- ID: \`${context.entity.id}\``,
    `- Type: ${context.entity.entity_type}`,
    `- Status: ${context.entity.status}`,
    `- Regions: ${context.regions.map(({ region_id, relation }) => `${region_id} (${relation})`).join(", ") || "none"}`,
    "",
    context.entity.detailed_description || context.entity.short_description || "No description.",
    "",
    "## Sources",
    "",
    ...context.sources.map((source) => `- ${source.id}: ${source.url} (${source.role})`),
    "",
    "## Requirements and effects",
    "",
    ...context.requirements.map((row) => `- Requires: ${row.description}`),
    ...context.effects.map((row) => `- Effect: ${row.description}`),
    "",
    "## Responsibility",
    "",
    ...context.responsibility.map((row) => `- ${row.source_file} ${row.record_path}`),
    ...context.patches.map((row) => `- ${row.filename}:${row.line} (${row.operation})`),
    "",
  ].join("\n");
}

export function findEntities(db, { query, limit }) {
  // FTS5 prefix search over sanitised terms; punctuation would be parsed as
  // query syntax rather than matched.
  const terms = query
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean)
    .map((part) => `"${part}"*`)
    .join(" AND ");
  if (!terms) throw new Error("Query has no searchable characters");
  return prepared(
    db,
    `SELECT entities.id, entities.entity_type AS type, entities.name, entities.status,
            (SELECT group_concat(region_id)
             FROM (SELECT DISTINCT region_id FROM entity_regions WHERE entity_id = entities.id ORDER BY region_id)) AS regions,
            (SELECT sources.url
             FROM entity_sources JOIN sources ON sources.id = entity_sources.source_id
             WHERE entity_sources.entity_id = entities.id
             ORDER BY entity_sources.ordinal, sources.id LIMIT 1) AS bestSource
     FROM entity_search JOIN entities ON entities.id = entity_search.id
     WHERE entity_search MATCH ?
     ORDER BY bm25(entity_search), entities.name
     LIMIT ?`,
  ).all(terms, limit);
}

// Read-only escape hatch for ad-hoc questions. Writes, schema changes and
// multi-statement input are rejected: corrections go through content patches.
export function runReadOnlyQuery(db, { sql, limit }) {
  const statement = sql.replace(/;\s*$/, "");
  if (statement.includes(";")) throw new Error("Multiple SQL statements are not allowed");
  if (!/^\s*(select|with)\b/i.test(statement)) throw new Error("Only SELECT and read-only WITH queries are allowed");
  if (/\b(insert|update|delete|drop|alter|attach|detach|vacuum|reindex|replace|create|pragma)\b/i.test(statement)) {
    throw new Error("Write-capable SQL and PRAGMA are blocked; use a validated content patch");
  }
  db.exec("PRAGMA query_only = ON");
  return db.prepare(`SELECT * FROM (${statement}) AS bounded_query LIMIT ${limit}`).all();
}

export function doctor(db) {
  const fts5 = Number(db.prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS enabled").get().enabled);
  const currentHashes = new Map(seedDocuments().map(({ file, text }) => [file, hash(text)]));
  const stale = db
    .prepare("SELECT path, content_hash FROM source_files ORDER BY path")
    .all()
    .filter(({ path, content_hash }) => currentHashes.get(path) !== content_hash)
    .map(({ path }) => path);
  const diff = compareOutputs(buildOutputs(db).outputs);
  const patchDrift = db
    .prepare("SELECT filename, content_hash FROM patch_ledger ORDER BY filename")
    .all()
    .filter(({ filename, content_hash }) => {
      const path = join(PATCHES, filename);
      return !existsSync(path) || hash(readFileSync(path)) !== content_hash;
    })
    .map(({ filename }) => filename);
  const result = {
    node: process.version,
    sqlite: db.prepare("SELECT sqlite_version() AS version").get().version,
    foreignKeys: Number(db.prepare("PRAGMA foreign_keys").get().foreign_keys) === 1,
    fts5: Boolean(fts5),
    schemaVersion: Number(db.prepare("SELECT max(version) AS version FROM schema_migrations").get().version),
    staleInputs: stale,
    staleExports: [...diff.changed, ...diff.stale],
    patchDrift,
    ok: !stale.length && !diff.changed.length && !diff.stale.length && !patchDrift.length && Boolean(fts5),
  };
  if (!result.ok) process.exitCode = 1;
  return result;
}

export function stats(db) {
  const count = (sql) => Number(db.prepare(sql).get().count);
  return {
    database: slash(relative(ROOT, DATABASE)),
    bytes: statSync(DATABASE).size,
    entities: Object.fromEntries(
      db
        .prepare("SELECT entity_type, count(*) AS count FROM entities GROUP BY entity_type ORDER BY entity_type")
        .all()
        .map(({ entity_type, count: value }) => [entity_type, Number(value)]),
    ),
    sources: count("SELECT count(*) AS count FROM sources"),
    relationships: count("SELECT count(*) AS count FROM relationships"),
    regionLinks: count("SELECT count(*) AS count FROM entity_regions"),
    mapPoints: count("SELECT count(*) AS count FROM map_points"),
    patches: count("SELECT count(*) AS count FROM patch_ledger"),
    quarantine: count("SELECT count(*) AS count FROM quarantine"),
  };
}
