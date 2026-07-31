// Structural validation of data/canonical/, plus the machine-readable parity
// report that proves the files still say exactly what the database says.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { REGION_IDS, REGION_SET, REPORTS, SCHEMA_VERSION } from "../config.mjs";
import { readResearchCatalog } from "../research.mjs";
import { asArray, atomicWrite, hash, slash, slugify, stableJson } from "../utilities.mjs";
import { buildCanonical, compact, compareKeys, fieldType, isOptional, keyOf } from "./export.mjs";
import {
  CANONICAL_ROOT,
  CANONICAL_VERSION,
  COLLECTIONS,
  CONSUMED_RECORD_KEYS,
  EXCLUDED_COLUMNS,
  EXCLUDED_TABLES,
  REFERENCE_KEY,
  collectionDefaults,
  recordRef,
} from "./schema.mjs";

const REGION_RELATIONS = new Set(["primary", "required", "optional", "hint", "excluded", "global"]);
const RESEARCH_SECTIONS = new Set(["content", "upgrades"]);

function typeError(declaration, value) {
  const type = fieldType(declaration);
  const nullable = type.endsWith("?");
  const base = nullable ? type.slice(0, -1) : type;
  if (value === null) return nullable ? null : "must not be null";
  switch (base) {
    case "string":
      return typeof value === "string" ? null : "must be a string";
    case "integer":
      return Number.isInteger(value) ? null : "must be an integer";
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? null : "must be a finite number";
    case "boolean":
      return typeof value === "boolean" ? null : "must be a boolean";
    case "json":
      return null;
    default:
      return `has an unknown declared type: ${base}`;
  }
}

// Parses one canonical directory without touching the database, so the checks
// below are exactly what a future importer could rely on.
export function readCanonical(root = CANONICAL_ROOT) {
  const files = new Map();
  for (const collection of COLLECTIONS) {
    const path = join(root, collection.file);
    if (!existsSync(path)) continue;
    files.set(collection.name, readFileSync(path, "utf8"));
  }
  return files;
}

export function validateCanonical(root = CANONICAL_ROOT) {
  const failures = [];
  const counts = {};
  const parsed = new Map();
  const fail = (collection, detail, sample) =>
    failures.push({ collection, detail, ...(sample === undefined ? {} : { sample }) });

  for (const collection of COLLECTIONS) {
    const path = join(root, collection.file);
    if (!existsSync(path)) {
      counts[collection.name] = 0;
      parsed.set(collection.name, []);
      continue;
    }
    const body = readFileSync(path, "utf8");
    if (body && !body.endsWith("\n")) fail(collection.name, "file does not end with a newline");
    // JSON.parse tolerates a trailing \r, so a CRLF checkout would otherwise
    // sail through validation and fail parity as an unexplained byte mismatch.
    if (body.includes("\r")) fail(collection.name, "file uses CRLF endings; see .gitattributes");
    const lines = body.split("\n");
    if (lines.at(-1) === "") lines.pop();
    const records = [];
    lines.forEach((line, index) => {
      const at = `${collection.file}:${index + 1}`;
      if (!line.trim()) {
        fail(collection.name, "blank line", at);
        return;
      }
      let record;
      try {
        record = JSON.parse(line);
      } catch (error) {
        fail(collection.name, `invalid JSON: ${error.message}`, at);
        return;
      }
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        fail(collection.name, "line is not a JSON object", at);
        return;
      }
      for (const key of Object.keys(record)) {
        if (!Object.hasOwn(collection.fields, key)) fail(collection.name, `undocumented field: ${key}`, at);
      }
      for (const [field, declaration] of Object.entries(collection.fields)) {
        if (!Object.hasOwn(record, field)) {
          if (!isOptional(declaration)) fail(collection.name, `missing required field: ${field}`, at);
          continue;
        }
        const problem = typeError(declaration, record[field]);
        if (problem) fail(collection.name, `${field} ${problem}`, at);
        if (isOptional(declaration) && stableJson(record[field]) === stableJson(declaration[1])) {
          fail(collection.name, `${field} equals its default and must be omitted`, at);
        }
      }
      records.push(record);
    });
    // Compacting first means a line that spells out a default cannot slip past
    // the ordering check by carrying a different key set.
    const normalized = records.map((record) => compact(collection, { ...collectionDefaults(collection), ...record }));
    counts[collection.name] = normalized.length;
    parsed.set(collection.name, normalized);

    const keys = new Set();
    for (const record of normalized) {
      const key = stableJson(keyOf(collection, record));
      if (keys.has(key)) fail(collection.name, `duplicate primary key: ${key}`);
      keys.add(key);
    }
    for (let index = 1; index < normalized.length; index += 1) {
      if (compareKeys(keyOf(collection, normalized[index - 1]), keyOf(collection, normalized[index])) >= 0) {
        fail(collection.name, "records are not sorted by primary key", `${collection.file}:${index + 1}`);
        break;
      }
    }
  }

  // References resolve against the collections that own each key.
  const referenced = new Map(
    [...REFERENCE_KEY].map(([name, key]) => [name, new Set((parsed.get(name) ?? []).map((record) => record[key]))]),
  );
  for (const collection of COLLECTIONS) {
    for (const [field, target] of Object.entries(collection.refs ?? {})) {
      if (!Object.hasOwn(collection.fields, field)) continue;
      const known = referenced.get(target) ?? new Set();
      for (const record of parsed.get(collection.name) ?? []) {
        const value = record[field];
        if (value == null) continue;
        if (!known.has(value)) fail(collection.name, `${field} references a missing ${target} record`, value);
      }
    }
  }

  for (const record of parsed.get("regions") ?? []) {
    if (!REGION_SET.has(record.id)) fail("regions", "region is outside the canonical taxonomy", record.id);
  }
  const regionIds = new Set(REGION_IDS);
  for (const record of parsed.get("research-regions") ?? []) {
    if (!regionIds.has(record.regionId)) fail("research-regions", "research region is not a league region", record.regionId);
  }
  for (const record of parsed.get("entity-regions") ?? []) {
    if (!REGION_RELATIONS.has(record.relation)) {
      fail("entity-regions", "unknown region relation", `${record.entityId} ${record.relation}`);
    }
  }
  for (const record of parsed.get("research-region-entries") ?? []) {
    if (!RESEARCH_SECTIONS.has(record.section)) {
      fail("research-region-entries", "unknown research section", record.section);
    }
  }
  for (const record of parsed.get("entities") ?? []) {
    if (record.recordRef != null && record.record != null) {
      fail("entities", "recordRef and record are mutually exclusive", record.id);
    }
  }
  const provenance = new Set(
    (parsed.get("source-records") ?? []).map((record) => recordRef(record.sourceFile, record.recordPath)),
  );
  for (const record of parsed.get("entities") ?? []) {
    if (record.recordRef != null && !provenance.has(record.recordRef)) {
      fail("entities", "recordRef points at a missing provenance record", record.recordRef);
    }
  }

  return { valid: failures.length === 0, counts, failures, records: parsed };
}

// --- parity ----------------------------------------------------------------

const entityBodies = (records) => {
  const provenance = new Map(
    (records.get("source-records") ?? []).map((record) => [
      recordRef(record.sourceFile, record.recordPath),
      record.record,
    ]),
  );
  return new Map(
    (records.get("entities") ?? []).map((entity) => [
      entity.id,
      entity.recordRef != null ? provenance.get(entity.recordRef) : (entity.record ?? {}),
    ]),
  );
};

const groupBy = (rows, field) => {
  const grouped = new Map();
  for (const row of rows) {
    const values = grouped.get(row[field]) ?? [];
    values.push(row);
    grouped.set(row[field], values);
  }
  return grouped;
};

const byOrdinal = (rows) => [...rows].sort((a, b) => a.ordinal - b.ordinal);

// Rebuilds research.mjs:readResearchCatalog from canonical files alone. The
// eleven region payloads are the export the site actually ships, so this is the
// check that proves entity bodies survived the round trip in order.
function researchCatalogFromCanonical(records) {
  const bodies = entityBodies(records);
  const names = new Map((records.get("entities") ?? []).map((entity) => [entity.id, entity.name]));
  const regionRows = new Map((records.get("regions") ?? []).map((region) => [region.id, region]));
  const research = new Map((records.get("research-regions") ?? []).map((region) => [region.regionId, region]));
  const entries = groupBy(records.get("research-region-entries") ?? [], "regionId");
  const skillLinks = groupBy(records.get("research-region-skills") ?? [], "regionId");
  const training = groupBy(records.get("research-region-training") ?? [], "regionId");
  const methods = groupBy(records.get("research-skill-methods") ?? [], "skillEntityId");
  const catalog = (records.get("research-catalog") ?? [])[0] ?? {};

  const regions = REGION_IDS.map((regionId) => {
    const region = research.get(regionId) ?? {};
    const base = bodies.get(`region:${regionId}`) ?? {};
    const section = (name) =>
      byOrdinal((entries.get(regionId) ?? []).filter((entry) => entry.section === name)).map((entry) =>
        bodies.get(entry.entityId),
      );
    return {
      id: regionId,
      name: names.get(`region:${regionId}`),
      availability: regionRows.get(regionId)?.availability ?? "unknown",
      aliases: asArray(base.aliases),
      areas: region.areas,
      skills: byOrdinal(skillLinks.get(regionId) ?? []).map((link) => names.get(link.skillEntityId)),
      content: section("content"),
      upgrades: section("upgrades"),
      trainingMethodIds: byOrdinal(training.get(regionId) ?? []).map((link) => link.methodEntityId),
      hardRules: region.hardRules,
      warnings: region.warnings,
      source: region.source ?? null,
      verified: regionRows.get(regionId)?.verified ?? false,
    };
  });

  const skills = (records.get("entities") ?? [])
    .filter((entity) => entity.type === "skill" && methods.has(entity.id))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((entity) => ({
      ...bodies.get(entity.id),
      methods: byOrdinal(methods.get(entity.id) ?? []).map((link) => bodies.get(link.methodEntityId)),
    }));

  return {
    snapshotDate: catalog.snapshotDate,
    sourcePolicy: catalog.sourcePolicy,
    coverage: catalog.coverage,
    hardRules: catalog.hardRules,
    datasets: catalog.datasets,
    regions,
    skills,
  };
}

// Each excluded column is only excluded if it can be recomputed. These rebuild
// them from canonical data and compare against the database row for row.
function excludedColumnChecks(db, records) {
  const bodies = entityBodies(records);
  const checks = [];
  const compare = (column, rows, expected) => {
    const mismatches = rows.filter((row) => !expected(row));
    checks.push({ column, rows: rows.length, mismatches: mismatches.length, equal: mismatches.length === 0 });
  };
  compare("entities.slug", db.prepare("SELECT id, slug FROM entities").all(), (row) => row.slug === slugify(row.id));
  compare("entities.extra_json", db.prepare("SELECT id, extra_json FROM entities").all(), (row) => {
    const body = bodies.get(row.id);
    return body !== undefined && stableJson(body) === row.extra_json;
  });
  compare(
    "regions.entity_id + regions.name",
    db.prepare("SELECT regions.id, regions.entity_id, regions.name FROM regions").all(),
    (row) => {
      const entity = (records.get("entities") ?? []).find((candidate) => candidate.id === `region:${row.id}`);
      return row.entity_id === `region:${row.id}` && entity?.name === row.name;
    },
  );
  const provenance = new Map(
    (records.get("source-records") ?? []).map((record) => [
      recordRef(record.sourceFile, record.recordPath),
      record.record,
    ]),
  );
  compare(
    "source_records.record_hash",
    db.prepare("SELECT source_file, record_path, record_hash FROM source_records").all(),
    (row) => {
      const record = provenance.get(recordRef(row.source_file, row.record_path));
      return record !== undefined && hash(stableJson(record)) === row.record_hash;
    },
  );
  compare(
    "effects.metadata_json (effect_key = 'record')",
    db.prepare("SELECT entity_id, metadata_json FROM effects WHERE effect_key = 'record'").all(),
    (row) => stableJson(bodies.get(row.entity_id)) === row.metadata_json,
  );
  return checks;
}

// Every legacy record key survives inside provenance/source-records.jsonl, but
// only some of them feed a canonical column. This names the rest rather than
// letting them disappear quietly into a blob, and is the list Stage 2 works
// from when deciding what to promote next.
export function unmodelledFields(records) {
  const counts = new Map();
  const example = new Map();
  for (const row of records.get("source-records") ?? []) {
    const record = row.record;
    if (!record || typeof record !== "object" || Array.isArray(record)) continue;
    for (const key of Object.keys(record)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!example.has(key)) example.set(key, recordRef(row.sourceFile, row.recordPath));
    }
  }
  const fields = [...counts]
    .filter(([key]) => !CONSUMED_RECORD_KEYS.has(key))
    .map(([key, records_]) => ({ key, records: records_, example: example.get(key) }))
    .sort((a, b) => b.records - a.records || (a.key < b.key ? -1 : 1));
  return {
    distinctKeys: counts.size,
    modelledKeys: counts.size - fields.length,
    provenanceOnlyKeys: fields.length,
    // A key on one record is usually a one-off note; a key on thousands is a
    // column the schema is missing.
    singletonKeys: fields.filter(({ records: seen }) => seen === 1).length,
    fields,
  };
}

export function canonicalParity(db, root = CANONICAL_ROOT) {
  const validation = validateCanonical(root);
  const generated = buildCanonical(db);
  const onDisk = readCanonical(root);

  const collections = COLLECTIONS.map((collection) => {
    const expected = generated.outputs.get(collection.file) ?? "";
    const actual = onDisk.get(collection.name) ?? "";
    return {
      name: collection.name,
      file: collection.file,
      databaseRows: generated.counts[collection.name],
      canonicalRecords: validation.counts[collection.name] ?? 0,
      equal: expected === actual,
    };
  });

  const canonicalEntities = validation.records.get("entities") ?? [];
  const countsByType = (rows) =>
    Object.fromEntries(
      [...rows.reduce((map, type) => map.set(type, (map.get(type) ?? 0) + 1), new Map())].sort(([a], [b]) =>
        a < b ? -1 : 1,
      ),
    );
  const databaseTypes = db
    .prepare("SELECT entity_type FROM entities ORDER BY entity_type")
    .all()
    .map(({ entity_type }) => entity_type);
  const databaseIds = db
    .prepare("SELECT id FROM entities ORDER BY id")
    .all()
    .map(({ id }) => id);

  const equality = [];
  const check = (name, expected, actual) =>
    equality.push({ name, expected, actual, equal: stableJson(expected) === stableJson(actual) });

  check("entityCountsByType", countsByType(databaseTypes), countsByType(canonicalEntities.map(({ type }) => type)));
  check(
    "entityIdDigest",
    hash(stableJson(databaseIds)),
    hash(stableJson([...canonicalEntities].map(({ id }) => id).sort((a, b) => (a < b ? -1 : 1)))),
  );
  check(
    "researchCatalog",
    hash(stableJson(readResearchCatalog(db))),
    hash(stableJson(researchCatalogFromCanonical(validation.records))),
  );
  check(
    "quarantine",
    {
      records: Number(db.prepare("SELECT count(*) AS count FROM quarantine").get().count),
      distinctErrors: Number(db.prepare("SELECT count(DISTINCT error) AS count FROM quarantine").get().count),
    },
    {
      records: (validation.records.get("quarantine") ?? []).length,
      distinctErrors: new Set((validation.records.get("quarantine") ?? []).map(({ error }) => error)).size,
    },
  );

  const excludedColumns = excludedColumnChecks(db, validation.records);
  const { fields, ...unmodelled } = unmodelledFields(validation.records);
  mkdirSync(REPORTS, { recursive: true });
  atomicWrite(
    join(REPORTS, "canonical-unmodelled-fields.json"),
    `${JSON.stringify({ canonicalVersion: CANONICAL_VERSION, ...unmodelled, fields }, null, 2)}\n`,
  );
  const match =
    validation.valid &&
    collections.every(({ equal }) => equal) &&
    equality.every(({ equal }) => equal) &&
    excludedColumns.every(({ equal }) => equal);

  const report = {
    canonicalVersion: CANONICAL_VERSION,
    schemaVersion: SCHEMA_VERSION,
    root: slash(relative(process.cwd(), root)),
    match,
    validation: { valid: validation.valid, failures: validation.failures.slice(0, 50) },
    collections,
    checks: equality,
    // Not a gate: an unmodelled key is retained, just not promoted to a column.
    // The full table is reports/canonical-unmodelled-fields.json.
    unmodelledFields: unmodelled,
    excludedColumns: excludedColumns.map((check) => ({
      ...check,
      ...EXCLUDED_COLUMNS.find(({ column }) => column === check.column),
    })),
    excludedTables: EXCLUDED_TABLES,
  };
  mkdirSync(REPORTS, { recursive: true });
  atomicWrite(join(REPORTS, "canonical-parity.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (!match) {
    const broken = [
      ...validation.failures.slice(0, 5).map(({ collection, detail }) => `${collection}: ${detail}`),
      ...collections.filter(({ equal }) => !equal).map(({ name }) => `${name} differs from the database`),
      ...equality.filter(({ equal }) => !equal).map(({ name }) => `${name} mismatch`),
      ...excludedColumns.filter(({ equal }) => !equal).map(({ column }) => `${column} is not reconstructible`),
    ];
    throw new Error(`Canonical parity failed: ${broken.join("; ")}`);
  }
  return report;
}
