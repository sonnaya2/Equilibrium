// data/canonical/*.jsonl -> the generated SQLite database.
//
// Every record already says what it is, so nothing here infers a type from a
// filename, derives an ID from a name, searches arbitrary key paths, or accepts
// a second spelling of a field. A record that does not fit its declared shape
// stops the import and names the file, line, record and reason.
//
// The whole import runs in one transaction: a rejected record leaves no
// half-built database behind.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TRANSFORM_BY_NAME } from "../config.mjs";
import { prepared, recordTransform, transaction } from "../database.mjs";
import { hash, slugify, stableJson } from "../utilities.mjs";
import {
  CANONICAL_ROOT,
  COLLECTIONS,
  COLLECTION_BY_NAME,
  collectionDefaults,
  recordRef,
} from "./schema.mjs";
import { validateCanonical } from "./validate.mjs";

const bit = (value) => (value ? 1 : 0);
const nullableBit = (value) => (value == null ? null : bit(value));

// --- reading ---------------------------------------------------------------

// One collection, parsed line by line with its declared defaults filled in.
// Line numbers survive because a canonical file is exactly one record per line.
export function readCollectionRecords(name, root = CANONICAL_ROOT) {
  const collection = COLLECTION_BY_NAME.get(name);
  if (!collection) throw new Error(`Unknown canonical collection: ${name}`);
  const path = join(root, collection.file);
  if (!existsSync(path)) return [];
  const defaults = collectionDefaults(collection);
  const lines = readFileSync(path, "utf8").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line, index) => {
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`${collection.file}:${index + 1}: invalid JSON: ${error.message}`);
    }
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`${collection.file}:${index + 1}: line is not a JSON object`);
    }
    return { ...defaults, ...record };
  });
}

export const readCanonical = (root = CANONICAL_ROOT) =>
  new Map(COLLECTIONS.map((collection) => [collection.name, readCollectionRecords(collection.name, root)]));

// --- writing ---------------------------------------------------------------

// Insert one collection, reporting the exact line and record key on failure so
// a constraint violation reads as a data problem rather than a SQL trace.
function insert(db, records, name, sql, values) {
  const collection = COLLECTION_BY_NAME.get(name);
  const statement = prepared(db, sql);
  (records.get(name) ?? []).forEach((record, index) => {
    try {
      statement.run(...values(record));
    } catch (error) {
      const key = collection.key.map((field) => record[field]).join(" ");
      throw new Error(`${collection.file}:${index + 1}: ${key}: ${error.message}`);
    }
  });
}

// Each entity body is stored once, in provenance/source-records.jsonl, and
// referenced by entities.recordRef. entities.extra_json and the `record`
// effects are rebuilt from it.
function entityBodies(records) {
  const provenance = new Map(
    (records.get("source-records") ?? []).map((record) => [
      recordRef(record.sourceFile, record.recordPath),
      record.record,
    ]),
  );
  const bodies = new Map();
  for (const entity of records.get("entities") ?? []) {
    if (entity.recordRef == null) {
      bodies.set(entity.id, entity.record ?? {});
      continue;
    }
    if (!provenance.has(entity.recordRef)) {
      throw new Error(`entities.jsonl: ${entity.id}: recordRef names no provenance record: ${entity.recordRef}`);
    }
    bodies.set(entity.id, provenance.get(entity.recordRef));
  }
  return bodies;
}

const DOMAIN_INSERTS = [
  [
    "equipment",
    "INSERT INTO equipment(entity_id, style, slot, tier, category) VALUES (?, ?, ?, ?, ?)",
    (row) => [row.entityId, row.style, row.slot, row.tier, row.category],
  ],
  // equipment_stats keys off equipment, not entities, so it follows it.
  [
    "equipment-stats",
    "INSERT INTO equipment_stats(entity_id, stat, value, unit) VALUES (?, ?, ?, ?)",
    (row) => [row.entityId, row.stat, row.value, row.unit],
  ],
  [
    "abilities",
    "INSERT INTO abilities(entity_id, style, category, level, cooldown_ticks) VALUES (?, ?, ?, ?, ?)",
    (row) => [row.entityId, row.style, row.category, row.level, row.cooldownTicks],
  ],
  [
    "prayers",
    "INSERT INTO prayers(entity_id, book, level) VALUES (?, ?, ?)",
    (row) => [row.entityId, row.book, row.level],
  ],
  [
    "spells",
    "INSERT INTO spells(entity_id, spellbook, level) VALUES (?, ?, ?)",
    (row) => [row.entityId, row.spellbook, row.level],
  ],
  [
    "invention-perks",
    "INSERT INTO invention_perks(entity_id, max_rank, category) VALUES (?, ?, ?)",
    (row) => [row.entityId, row.maxRank, row.category],
  ],
  [
    "activities",
    "INSERT INTO activities(entity_id, category, location) VALUES (?, ?, ?)",
    (row) => [row.entityId, row.category, row.location],
  ],
  [
    "unlocks",
    "INSERT INTO unlocks(entity_id, category, unlock_type) VALUES (?, ?, ?)",
    (row) => [row.entityId, row.category, row.unlockType],
  ],
  [
    "tasks",
    "INSERT INTO tasks(entity_id, tier, points, region_id, source_league) VALUES (?, ?, ?, ?, ?)",
    (row) => [row.entityId, row.tier, row.points, row.regionId, row.sourceLeague],
  ],
  [
    "quests",
    `INSERT INTO quests(entity_id, quest_type, series, primary_region_id, members, release_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    (row) => [row.entityId, row.questType, row.series, row.primaryRegionId, nullableBit(row.members), row.releaseDate],
  ],
  [
    "training-methods",
    `INSERT INTO training_methods(entity_id, skill, level_range, xp_rate, intensity, location, hard_region_requirement)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    (row) => [
      row.entityId,
      row.skill,
      row.levelRange,
      row.xpRate,
      row.intensity,
      row.location,
      bit(row.hardRegionRequirement),
    ],
  ],
];

// Explicit dependency order. Foreign keys are on for the whole import, so a
// step that ran too early fails on the row that needed the missing parent
// rather than leaving a dangling reference to be found later.
//
// regions sits between tags and the domain tables because regions references
// entities and tasks/quests reference regions; the four provenance and research
// steps follow the relational core for the same reason.
function writeRecords(db, records) {
  const bodies = entityBodies(records);
  const names = new Map((records.get("entities") ?? []).map((entity) => [entity.id, entity.name]));

  // 1. entities
  insert(
    db,
    records,
    "entities",
    `INSERT INTO entities
     (id, slug, entity_type, name, short_description, detailed_description, verified_at,
      status, sort_key, created_source, updated_source, extra_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (row) => [
      row.id,
      slugify(row.id),
      row.type,
      row.name,
      row.shortDescription,
      row.detailedDescription,
      row.verifiedAt,
      row.status,
      row.sortKey,
      row.createdSource,
      row.updatedSource,
      stableJson(bodies.get(row.id)),
    ],
  );

  // 2. sources
  insert(
    db,
    records,
    "sources",
    `INSERT INTO sources
     (id, url, page_title, publisher, source_family, verified_at, retrieved_at, source_role, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (row) => [
      row.id,
      row.url,
      row.pageTitle,
      row.publisher,
      row.family,
      row.verifiedAt,
      row.retrievedAt,
      row.role,
      row.contentHash,
    ],
  );

  // 3. tags
  insert(db, records, "tags", "INSERT INTO tags(id, name) VALUES (?, ?)", (row) => [row.id, row.name]);

  // 4. regions. entity_id and name are the region entity's, which is why this
  //    cannot run before entities.
  insert(
    db,
    records,
    "regions",
    "INSERT INTO regions(id, entity_id, name, availability, verified, taxonomy_order) VALUES (?, ?, ?, ?, ?, ?)",
    (row) => {
      const entityId = `region:${row.id}`;
      if (!names.has(entityId)) throw new Error(`no region entity ${entityId}`);
      return [row.id, entityId, names.get(entityId), row.availability, bit(row.verified), row.taxonomyOrder];
    },
  );

  // 5. domain tables
  for (const [name, sql, values] of DOMAIN_INSERTS) insert(db, records, name, sql, values);

  // 6. entity-source links
  insert(
    db,
    records,
    "entity-sources",
    "INSERT INTO entity_sources(entity_id, source_id, role, ordinal) VALUES (?, ?, ?, ?)",
    (row) => [row.entityId, row.sourceId, row.role, row.ordinal],
  );

  // 7. entity-region links
  insert(
    db,
    records,
    "entity-regions",
    "INSERT INTO entity_regions(entity_id, region_id, relation, ordinal, requirement_group) VALUES (?, ?, ?, ?, ?)",
    (row) => [row.entityId, row.regionId, row.relation, row.ordinal, row.requirementGroup],
  );

  // 8. requirements and effects
  insert(
    db,
    records,
    "requirements",
    `INSERT INTO requirements(entity_id, kind, skill, level, target_entity_id, description, ordinal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    (row) => [row.entityId, row.kind, row.skill, row.level, row.targetEntityId, row.description, row.ordinal],
  );
  insert(
    db,
    records,
    "effects",
    `INSERT INTO effects(entity_id, effect_key, description, value_text, ordinal, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    (row) => [
      row.entityId,
      row.key,
      row.description,
      row.valueText,
      row.ordinal,
      // A `record` effect is the domain row of an `effect` entity; its metadata
      // is that entity's own body rather than a second stored copy.
      stableJson(row.key === "record" ? bodies.get(row.entityId) : row.metadata),
    ],
  );

  // 9. relationships
  insert(
    db,
    records,
    "relationships",
    "INSERT INTO relationships(subject_id, predicate, object_id, ordinal, metadata_json) VALUES (?, ?, ?, ?, ?)",
    (row) => [row.subjectId, row.predicate, row.objectId, row.ordinal, stableJson(row.metadata)],
  );

  // 10. entity-tag links
  insert(db, records, "entity-tags", "INSERT INTO entity_tags(entity_id, tag_id) VALUES (?, ?)", (row) => [
    row.entityId,
    row.tagId,
  ]);

  // 11. aliases and map points
  insert(db, records, "entity-aliases", "INSERT INTO aliases(entity_id, alias, kind) VALUES (?, ?, ?)", (row) => [
    row.entityId,
    row.alias,
    row.kind,
  ]);
  insert(
    db,
    records,
    "map-points",
    "INSERT INTO map_points(id, entity_id, region_id, label, x, y, z, point_type, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    (row) => [
      row.id,
      row.entityId,
      row.regionId,
      row.label,
      row.x,
      row.y,
      row.z,
      row.pointType,
      stableJson(row.metadata),
    ],
  );

  // 12. provenance
  insert(
    db,
    records,
    "source-files",
    "INSERT INTO source_files(path, classification, content_hash, bytes, metadata_json) VALUES (?, ?, ?, ?, ?)",
    (row) => [row.path, row.classification, row.contentHash, row.bytes, stableJson(row.metadata)],
  );
  insert(db, records, "source-documents", "INSERT INTO source_documents(path, skeleton_json) VALUES (?, ?)", (row) => [
    row.path,
    stableJson(row.skeleton),
  ]);
  insert(
    db,
    records,
    "source-records",
    `INSERT INTO source_records(source_file, record_path, stable_id, entity_id, record_hash, raw_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    (row) => {
      const raw = stableJson(row.record);
      return [row.sourceFile, row.recordPath, row.stableId, row.entityId, hash(raw), raw];
    },
  );

  // 13. research catalog and its orderings
  insert(
    db,
    records,
    "research-catalog",
    `INSERT INTO research_catalog(id, snapshot_date, source_policy_json, coverage_json, hard_rules_json, datasets_json)
     VALUES (1, ?, ?, ?, ?, ?)`,
    (row) => [
      row.snapshotDate,
      stableJson(row.sourcePolicy),
      stableJson(row.coverage),
      stableJson(row.hardRules),
      stableJson(row.datasets),
    ],
  );
  insert(
    db,
    records,
    "research-regions",
    `INSERT INTO research_regions(region_id, ordinal, areas_json, hard_rules_json, warnings_json, source_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    (row) => [
      row.regionId,
      row.ordinal,
      stableJson(row.areas),
      stableJson(row.hardRules),
      stableJson(row.warnings),
      stableJson(row.source),
    ],
  );
  insert(
    db,
    records,
    "research-region-entries",
    "INSERT INTO research_region_entries(region_id, entity_id, section, ordinal) VALUES (?, ?, ?, ?)",
    (row) => [row.regionId, row.entityId, row.section, row.ordinal],
  );
  insert(
    db,
    records,
    "research-region-skills",
    "INSERT INTO research_region_skills(region_id, skill_entity_id, ordinal) VALUES (?, ?, ?)",
    (row) => [row.regionId, row.skillEntityId, row.ordinal],
  );
  insert(
    db,
    records,
    "research-region-training",
    "INSERT INTO research_region_training(region_id, method_entity_id, ordinal) VALUES (?, ?, ?)",
    (row) => [row.regionId, row.methodEntityId, row.ordinal],
  );
  insert(
    db,
    records,
    "research-skill-methods",
    "INSERT INTO research_skill_methods(skill_entity_id, method_entity_id, ordinal) VALUES (?, ?, ?)",
    (row) => [row.skillEntityId, row.methodEntityId, row.ordinal],
  );

  // 14. quarantine, which references nothing and is kept so the collisions it
  //     records stay auditable.
  insert(
    db,
    records,
    "quarantine",
    `INSERT INTO quarantine(source_file, record_path, stable_id, error, conflicting_record, suggested_resolution, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    (row) => [
      row.sourceFile,
      row.recordPath,
      row.stableId,
      row.error,
      row.conflictingRecord == null ? null : stableJson(row.conflictingRecord),
      row.suggestedResolution,
      stableJson(row.record),
    ],
  );
}

// --- import ----------------------------------------------------------------

export function importCanonical(db, root = CANONICAL_ROOT) {
  const validation = validateCanonical(root);
  if (!validation.valid) {
    const detail = validation.failures
      .slice(0, 10)
      .map(({ collection, detail: reason, sample }) => `${sample ?? collection}: ${reason}`)
      .join("; ");
    throw new Error(
      `Canonical data is invalid (${validation.failures.length} failures): ${detail}` +
        (validation.failures.length > 10 ? "; ..." : ""),
    );
  }

  const records = readCanonical(root);
  // The seed's own input hash, rebuilt from the file hashes canonical carries,
  // so manifest.databaseInputHash means the same thing on both paths.
  const files = records.get("source-files") ?? [];
  const inputHash = hash(files.map(({ path, contentHash }) => `${path}:${contentHash}`).join("\n"));

  transaction(db, () => {
    writeRecords(db, records);
    const violations = db.prepare("PRAGMA foreign_key_check").all();
    if (violations.length) {
      throw new Error(
        `Canonical import left ${violations.length} foreign-key violations: ${violations
          .slice(0, 5)
          .map(({ table, parent }) => `${table} -> ${parent}`)
          .join(", ")}`,
      );
    }
    recordTransform(db, TRANSFORM_BY_NAME.get("seed-ingest"), inputHash, files.length);
    recordTransform(
      db,
      TRANSFORM_BY_NAME.get("relational-core"),
      inputHash,
      Number(db.prepare("SELECT count(*) AS count FROM entities").get().count),
    );
  });

  return {
    inputHash,
    files: files.length,
    bytes: files.reduce((sum, { bytes }) => sum + bytes, 0),
  };
}
