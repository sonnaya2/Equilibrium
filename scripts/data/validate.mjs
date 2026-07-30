import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CHANGED, REPORTS, SCHEMA_VERSION, TRANSFORM_BY_NAME } from "./config.mjs";
import { recordTransform } from "./database.mjs";
import { atomicWrite, hash, stableJson } from "./utilities.mjs";

const FACTUAL_TYPES = "'equipment','ability','prayer','spell','invention-perk','quest','task','training-method','unlock'";

// Cycles would make a requirement chain unresolvable; the recursive walk stops
// as soon as a path revisits its own root.
const REQUIRES_CYCLES = `WITH RECURSIVE path(root, node, seen, cycle) AS (
   SELECT subject_id, object_id, '|' || subject_id || '|' || object_id || '|', subject_id = object_id
   FROM relationships WHERE predicate = 'requires'
   UNION ALL
   SELECT path.root, relationships.object_id, path.seen || relationships.object_id || '|', relationships.object_id = path.root
   FROM path JOIN relationships ON relationships.subject_id = path.node
   WHERE relationships.predicate = 'requires'
     AND path.cycle = 0
     AND (relationships.object_id = path.root OR instr(path.seen, '|' || relationships.object_id || '|') = 0)
 )
 SELECT DISTINCT root FROM path WHERE cycle = 1 LIMIT 20`;

const UNMAPPED_STABLE_RECORDS = `SELECT source_records.source_file, source_records.record_path, source_records.stable_id
   FROM source_records
   WHERE source_records.stable_id IS NOT NULL
     AND source_records.entity_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM quarantine
       WHERE quarantine.source_file = source_records.source_file
         AND quarantine.record_path = source_records.record_path
     )
   ORDER BY source_records.source_file, source_records.record_path`;

export function validate(db, changedOnly = false) {
  const changed = changedOnly && existsSync(CHANGED) ? JSON.parse(readFileSync(CHANGED, "utf8")).entities : [];
  const changedIds = new Set(changed.map(({ id }) => id));
  const failures = [];
  const warnings = [];
  const rows = (sql) => db.prepare(sql).all();
  const addFailure = (name, found) =>
    found.length && failures.push({ name, count: found.length, samples: found.slice(0, 20) });
  const addWarning = (name, found) =>
    found.length && warnings.push({ name, count: found.length, samples: found.slice(0, 20) });

  addFailure("foreign keys", rows("PRAGMA foreign_key_check"));
  addFailure(
    "forbidden Troll Country taxonomy",
    rows("SELECT id, name FROM regions WHERE lower(id) LIKE '%troll%' OR lower(name) LIKE '%troll country%'"),
  );
  addFailure(
    "invalid source URLs",
    rows("SELECT id, url FROM sources WHERE url NOT GLOB 'https://*' AND url NOT GLOB 'http://*'"),
  );
  addFailure("orphan search rows", rows("SELECT id FROM entity_search EXCEPT SELECT id FROM entities"));
  addFailure("missing search rows", rows("SELECT id FROM entities EXCEPT SELECT id FROM entity_search"));
  addFailure("requires cycles", rows(REQUIRES_CYCLES));
  addFailure(
    "schema version mismatch",
    rows(`SELECT max(version) AS version FROM schema_migrations HAVING version != ${SCHEMA_VERSION}`),
  );
  addFailure("unmapped stable seed records without quarantine", rows(UNMAPPED_STABLE_RECORDS));

  const missingSources = rows(
    `SELECT id, entity_type FROM entities
     WHERE status = 'active'
       AND entity_type IN (${FACTUAL_TYPES})
       AND NOT EXISTS (SELECT 1 FROM entity_sources WHERE entity_id = entities.id)
     ORDER BY id`,
  );
  addWarning(
    "active factual entities without a normalized source",
    changedOnly ? missingSources.filter(({ id }) => changedIds.has(id)) : missingSources,
  );
  const quarantined = rows(
    "SELECT source_file, record_path, stable_id, error FROM quarantine ORDER BY source_file, record_path",
  );
  addWarning(
    "quarantined seed records",
    changedOnly ? quarantined.filter(({ stable_id }) => changedIds.has(stable_id)) : quarantined,
  );

  const counts = Object.fromEntries(
    rows("SELECT entity_type, count(*) AS count FROM entities GROUP BY entity_type ORDER BY entity_type").map(
      ({ entity_type, count }) => [entity_type, Number(count)],
    ),
  );
  const report = {
    schemaVersion: SCHEMA_VERSION,
    scope: changedOnly ? "changed" : "full",
    changed,
    valid: failures.length === 0,
    failures,
    warnings,
    counts,
    foreignKeysEnabled: Number(db.prepare("PRAGMA foreign_keys").get().foreign_keys) === 1,
  };
  mkdirSync(REPORTS, { recursive: true });
  atomicWrite(join(REPORTS, "data-validation.json"), `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(
    join(REPORTS, "data-quarantine.json"),
    `${JSON.stringify(
      rows(
        "SELECT source_file, record_path, stable_id, error, conflicting_record, suggested_resolution FROM quarantine ORDER BY source_file, record_path",
      ),
      null,
      2,
    )}\n`,
  );
  if (failures.length) {
    throw new Error(`Data validation failed: ${failures.map(({ name, count }) => `${name} (${count})`).join(", ")}`);
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  recordTransform(db, TRANSFORM_BY_NAME.get("relational-validation"), hash(stableJson(counts)), total);
  return report;
}
