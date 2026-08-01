import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { DATABASE, PATCHES, ROOT } from "./config.mjs";
import { prepared } from "./database.mjs";
import { buildOutputs, compareOutputs } from "./export.mjs";
import { readCollectionRecords } from "./canonical/read.mjs";
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
  // Drift between the tracked input and the built database. That input is
  // data/canonical/ now, so this reads the file hashes canonical carries rather
  // than reopening any original document.
  const currentHashes = new Map(
    readCollectionRecords("source-files").map(({ path, contentHash }) => [path, contentHash]),
  );
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

// One record described twice. Grouping on entity type + name is what makes that
// visible, because the two copies share no ID - `prayer:protect-item` and
// `prayer:standard-prayers:protect-item` are the same prayer, and nothing keyed
// on IDs notices.
//
// Two shapes count. Across documents, two sources claim one domain. Within one
// document, two records of the same name land on the same region page, which is
// a visible duplicate on the site even though only one document produced it -
// `misthalin:explorers-ring` and `misthalin:area-tasks-explorers-ring` both come
// from progression-unlocks.json. A removed entity is no longer a claim on
// either, or the audit gate could never come down.
export function entityOverlaps(db) {
  const groups = new Map();
  for (const row of db
    .prepare(
      `SELECT id, entity_type, name, created_source FROM entities
       WHERE name IS NOT NULL AND name <> '' AND status <> 'removed'`,
    )
    .all()) {
    const key = `${row.entity_type}|${row.name.trim().toLocaleLowerCase("en")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const regionsOf = prepared(db, "SELECT DISTINCT region_id FROM entity_regions WHERE entity_id = ?");
  // Same name, deliberately kept apart. One training method trains several
  // skills and is listed once under each; one prayer name exists in two books.
  // Those are not duplicates - merging them would empty a skill's method list or
  // lose a whole prayer - so a group whose members are told apart by a domain
  // scope is excluded rather than reported.
  const skillsOf = prepared(db, "SELECT skill_entity_id FROM research_skill_methods WHERE method_entity_id = ?");
  const bookOf = prepared(db, "SELECT book FROM prayers WHERE entity_id = ?");
  const scopedApart = (rows) => {
    // A League task's identity is Jagex's `wiki:N`, not its label, and two tasks
    // can legitimately read the same - "Defeat the empowered Barrows Brothers."
    // is wiki:740 and wiki:741. Distinct official ids are distinct tasks.
    if (rows.every(({ entity_type, id }) => entity_type === "task" && /^wiki:\d+$/.test(id))) return true;
    for (const scope of [
      (id) => skillsOf.all(id).map(({ skill_entity_id }) => skill_entity_id).sort().join(","),
      (id) => bookOf.get(id)?.book ?? "",
    ]) {
      const values = rows.map(({ id }) => scope(id));
      if (values.every(Boolean) && new Set(values).size === rows.length) return true;
    }
    return false;
  };
  const overlaps = [];
  const pairs = new Map();
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;
    if (scopedApart(rows)) continue;
    const files = [...new Set(rows.map(({ created_source }) => created_source))].sort();
    // Regions holding more than one of this group: the pages a reader would see
    // the same record on twice.
    const byRegion = new Map();
    for (const row of rows) {
      for (const { region_id } of regionsOf.all(row.id)) {
        if (!byRegion.has(region_id)) byRegion.set(region_id, []);
        byRegion.get(region_id).push(row.id);
      }
    }
    const sharedRegions = [...byRegion]
      .filter(([, ids]) => ids.length > 1)
      .map(([region]) => region)
      .sort();
    if (files.length < 2 && !sharedRegions.length) continue;
    if (files.length > 1) {
      const pair = files.join(" + ");
      pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
    }
    overlaps.push({
      logicalRecord: key,
      entityType: rows[0].entity_type,
      name: rows[0].name,
      files,
      sharedRegions,
      entityIds: rows.map(({ id }) => id).sort(),
    });
  }
  return {
    overlaps: overlaps.sort((a, b) => (a.logicalRecord < b.logicalRecord ? -1 : 1)),
    filePairs: [...pairs]
      .map(([files, records]) => ({ files, records }))
      .sort((a, b) => b.records - a.records || a.files.localeCompare(b.files)),
  };
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
