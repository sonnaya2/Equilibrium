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

// Equipment stat metadata is only half-declared: an exact bonus in the record
// wins, and anything absent is derived from tier, slot and armour class. These
// checks cover the gap between the two, where a record looks complete but the
// stat core can only answer "unknown".
const EQUIPMENT_RECORDS = `FROM source_records
   WHERE source_file = 'data/combat/equipment.json' AND record_path NOT LIKE '%].%'`;
const CLASS_GATED = "('helmet','body','legs','gloves','boots')";

const DERIVED_WITHOUT_CLASS = `SELECT stable_id, record_path ${EQUIPMENT_RECORDS}
     AND json_extract(raw_json, '$.slot') IN ${CLASS_GATED}
     AND json_extract(raw_json, '$.armourClass') IS NULL
     AND (json_extract(raw_json, '$.bonuses.armour') IS NULL
       OR json_extract(raw_json, '$.bonuses.life') IS NULL
       OR json_extract(raw_json, '$.bonuses.damage') IS NULL)
   ORDER BY stable_id`;

const DERIVED_WITHOUT_TIER = `SELECT stable_id, record_path ${EQUIPMENT_RECORDS}
     AND json_extract(raw_json, '$.tier') IS NULL
     AND (json_extract(raw_json, '$.armourClass') IS NOT NULL
       OR json_extract(raw_json, '$.shield') IS NOT NULL
       OR json_extract(raw_json, '$.defender') IS NOT NULL)
   ORDER BY stable_id`;

const INVALID_CLASS_COMBINATION = `SELECT stable_id, record_path ${EQUIPMENT_RECORDS}
     AND (
       (json_extract(raw_json, '$.armourClass') IS NOT NULL
         AND json_extract(raw_json, '$.armourClass') NOT IN ('tank','power','hybrid','pvp'))
       OR (json_extract(raw_json, '$.armourClass') IS NOT NULL
         AND json_extract(raw_json, '$.slot') NOT IN ${CLASS_GATED})
       OR (json_extract(raw_json, '$.shield') IS NOT NULL AND json_extract(raw_json, '$.defender') IS NOT NULL)
       OR ((json_extract(raw_json, '$.shield') IS NOT NULL OR json_extract(raw_json, '$.defender') IS NOT NULL)
         AND json_extract(raw_json, '$.slot') <> 'offhand')
     )
   ORDER BY stable_id`;

// Every stat the formulas read has to be a usable positive number; a negative or
// non-numeric tier silently produces a nonsense bonus rather than an error.
const UNUSABLE_STAT_VALUES = `SELECT stable_id, record_path ${EQUIPMENT_RECORDS}
     AND EXISTS (
       SELECT 1 FROM json_each(raw_json, '$.bonuses')
       WHERE json_each.type NOT IN ('integer','real') OR json_each.value < 0
     )
   ORDER BY stable_id`;

const UNUSABLE_TIER_OVERRIDES = `SELECT stable_id, record_path ${EQUIPMENT_RECORDS}
     AND EXISTS (
       SELECT 1 FROM json_each(raw_json)
       WHERE json_each.key IN ('tier','armourTier','damageTier','lifeTier','requirementTier')
         AND (json_each.type NOT IN ('integer','real') OR json_each.value < 1)
     )
   ORDER BY stable_id`;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function currentDataDate(value = process.env.EQUILIBRIUM_DATA_DATE) {
  const date = value ?? new Date().toISOString().slice(0, 10);
  if (!ISO_DATE.test(date)) throw new Error(`invalid data current date: ${date}`);
  return date;
}

export function futureVerificationRecords(records, currentDate) {
  const date = currentDataDate(currentDate);
  const failures = [];
  const visit = (value, path, row) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, row));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if ((key === "verified_at" || key === "verifiedAt") && typeof child === "string" && ISO_DATE.test(child) && child > date) {
        failures.push({
          source_file: row.source_file,
          record_path: row.record_path,
          field: `${path}.${key}`,
          verifiedAt: child,
          currentDate: date,
        });
      }
      visit(child, `${path}.${key}`, row);
    }
  };
  for (const row of records) {
    const value = typeof row.raw_json === "string" ? JSON.parse(row.raw_json) : row.value;
    visit(value, "$", row);
  }
  return failures;
}

export function validate(db, changedOnly = false, currentDate = currentDataDate()) {
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
  addFailure("unmapped stable source records without quarantine", rows(UNMAPPED_STABLE_RECORDS));
  addFailure("equipment deriving stats without an armour class", rows(DERIVED_WITHOUT_CLASS));
  addFailure("equipment carrying stat metadata without a tier", rows(DERIVED_WITHOUT_TIER));
  addFailure("equipment with an impossible slot and class combination", rows(INVALID_CLASS_COMBINATION));
  addFailure("equipment bonuses that are not usable numbers", rows(UNUSABLE_STAT_VALUES));
  addFailure("equipment stat tiers that are not usable numbers", rows(UNUSABLE_TIER_OVERRIDES));
  const verificationRows = [
    ...rows("SELECT id AS record_path, id AS source_file, json_object('verified_at', verified_at) AS raw_json FROM entities WHERE verified_at IS NOT NULL"),
    ...rows("SELECT id AS record_path, id AS source_file, json_object('verified_at', verified_at) AS raw_json FROM sources WHERE verified_at IS NOT NULL"),
    ...rows("SELECT source_file, record_path, raw_json FROM source_records"),
  ];
  addFailure(
    "source verification dates after current data date",
    futureVerificationRecords(verificationRows, currentDate),
  );

  const missingSources = rows(
    `SELECT id, entity_type FROM entities
     WHERE status = 'active'
       AND entity_type IN (${FACTUAL_TYPES})
       AND NOT EXISTS (SELECT 1 FROM entity_sources WHERE entity_id = entities.id)
     ORDER BY id`,
  );
  addWarning(
    "active factual entities without a source",
    changedOnly ? missingSources.filter(({ id }) => changedIds.has(id)) : missingSources,
  );
  // Several source records can point at one entity, contributing their regions,
  // requirements, effects, tags and sources to it while only one of them supplied
  // its scalar fields and body. Where those records disagree, the entity matches
  // no single source. That used to happen without a word; this is the word.
  const blended = rows(
    `SELECT entity_id, count(DISTINCT raw_json) AS variants
     FROM source_records WHERE entity_id IS NOT NULL
     GROUP BY entity_id HAVING variants > 1
     ORDER BY variants DESC, entity_id`,
  );
  addWarning(
    "entities blended from disagreeing source records",
    changedOnly ? blended.filter(({ entity_id }) => changedIds.has(entity_id)) : blended,
  );
  const quarantined = rows(
    "SELECT source_file, record_path, stable_id, error FROM quarantine ORDER BY source_file, record_path",
  );
  addWarning(
    "quarantined source records",
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
