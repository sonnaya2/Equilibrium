// Canonical records -> SQLite rows. Direct inserts only: nothing here infers a
// type, derives an ID from a name, searches key paths, or accepts a second
// spelling of a field. Every value comes from a declared canonical field.
import { prepared } from "../database.mjs";
import { hash, slugify, stableJson } from "../utilities.mjs";
import { COLLECTION_BY_NAME, recordRef } from "./schema.mjs";

const bit = (value) => (value ? 1 : 0);
const nullableBit = (value) => (value == null ? null : bit(value));

// An entity body is stored once, in provenance/source-records.jsonl, and
// referenced by entities.recordRef. entities.extra_json and the `record` effects
// are rebuilt from it rather than stored a second time.
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

// The whole import in one ordered list, so the dependency order is a single
// readable thing rather than a sequence buried in a function body. Foreign keys
// are on throughout, so a step that ran too early fails on the row that needed
// the missing parent instead of leaving a dangling reference to find later.
//
// regions sits between tags and the domain tables because regions references
// entities and tasks/quests reference regions; provenance and research follow
// the relational core for the same reason. quarantine is last and references
// nothing - it is kept so the ID collisions it records stay auditable.
const INSERTS = [
  [
    "entities",
    `INSERT INTO entities
     (id, slug, entity_type, name, short_description, detailed_description, verified_at,
      status, sort_key, created_source, updated_source, extra_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (row, { bodies }) => [
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
  ],
  [
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
  ],
  ["tags", "INSERT INTO tags(id, name) VALUES (?, ?)", (row) => [row.id, row.name]],
  [
    // entity_id and name are the region entity's, which is why this cannot run
    // before entities.
    "regions",
    "INSERT INTO regions(id, entity_id, name, availability, verified, taxonomy_order) VALUES (?, ?, ?, ?, ?, ?)",
    (row, { names }) => {
      const entityId = `region:${row.id}`;
      if (!names.has(entityId)) throw new Error(`no region entity ${entityId}`);
      return [row.id, entityId, names.get(entityId), row.availability, bit(row.verified), row.taxonomyOrder];
    },
  ],

  [
    "equipment",
    "INSERT INTO equipment(entity_id, style, slot, tier, category) VALUES (?, ?, ?, ?, ?)",
    (row) => [row.entityId, row.style, row.slot, row.tier, row.category],
  ],
  [
    // equipment_stats keys off equipment, not entities, so it follows it.
    "equipment-stats",
    "INSERT INTO equipment_stats(entity_id, stat, value, unit) VALUES (?, ?, ?, ?)",
    (row) => [row.entityId, row.stat, row.value, row.unit],
  ],
  [
    "abilities",
    "INSERT INTO abilities(entity_id, style, category, level, cooldown_ticks) VALUES (?, ?, ?, ?, ?)",
    (row) => [row.entityId, row.style, row.category, row.level, row.cooldownTicks],
  ],
  ["prayers", "INSERT INTO prayers(entity_id, book, level) VALUES (?, ?, ?)", (row) => [row.entityId, row.book, row.level]],
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

  [
    "entity-sources",
    "INSERT INTO entity_sources(entity_id, source_id, role, ordinal) VALUES (?, ?, ?, ?)",
    (row) => [row.entityId, row.sourceId, row.role, row.ordinal],
  ],
  [
    "entity-regions",
    "INSERT INTO entity_regions(entity_id, region_id, relation, ordinal, requirement_group) VALUES (?, ?, ?, ?, ?)",
    (row) => [row.entityId, row.regionId, row.relation, row.ordinal, row.requirementGroup],
  ],
  [
    "requirements",
    `INSERT INTO requirements(entity_id, kind, skill, level, target_entity_id, description, ordinal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    (row) => [row.entityId, row.kind, row.skill, row.level, row.targetEntityId, row.description, row.ordinal],
  ],
  [
    "effects",
    `INSERT INTO effects(entity_id, effect_key, description, value_text, ordinal, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    (row, { bodies }) => [
      row.entityId,
      row.key,
      row.description,
      row.valueText,
      row.ordinal,
      // A `record` effect is the domain row of an `effect` entity; its metadata
      // is that entity's own body rather than a second stored copy.
      stableJson(row.key === "record" ? bodies.get(row.entityId) : row.metadata),
    ],
  ],
  [
    "relationships",
    "INSERT INTO relationships(subject_id, predicate, object_id, ordinal, metadata_json) VALUES (?, ?, ?, ?, ?)",
    (row) => [row.subjectId, row.predicate, row.objectId, row.ordinal, stableJson(row.metadata)],
  ],
  ["entity-tags", "INSERT INTO entity_tags(entity_id, tag_id) VALUES (?, ?)", (row) => [row.entityId, row.tagId]],
  [
    "entity-aliases",
    "INSERT INTO aliases(entity_id, alias, kind) VALUES (?, ?, ?)",
    (row) => [row.entityId, row.alias, row.kind],
  ],
  [
    "map-points",
    `INSERT INTO map_points(id, entity_id, region_id, label, x, y, z, point_type, extra_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (row) => [row.id, row.entityId, row.regionId, row.label, row.x, row.y, row.z, row.pointType, stableJson(row.metadata)],
  ],

  [
    "source-files",
    "INSERT INTO source_files(path, classification, content_hash, bytes, metadata_json) VALUES (?, ?, ?, ?, ?)",
    (row) => [row.path, row.classification, row.contentHash, row.bytes, stableJson(row.metadata)],
  ],
  [
    "source-documents",
    "INSERT INTO source_documents(path, skeleton_json) VALUES (?, ?)",
    (row) => [row.path, stableJson(row.skeleton)],
  ],
  [
    "source-records",
    `INSERT INTO source_records(source_file, record_path, stable_id, entity_id, record_hash, raw_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    (row) => {
      const raw = stableJson(row.record);
      return [row.sourceFile, row.recordPath, row.stableId, row.entityId, hash(raw), raw];
    },
  ],

  [
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
  ],
  [
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
  ],
  [
    "research-region-entries",
    "INSERT INTO research_region_entries(region_id, entity_id, section, ordinal) VALUES (?, ?, ?, ?)",
    (row) => [row.regionId, row.entityId, row.section, row.ordinal],
  ],
  [
    "research-region-skills",
    "INSERT INTO research_region_skills(region_id, skill_entity_id, ordinal) VALUES (?, ?, ?)",
    (row) => [row.regionId, row.skillEntityId, row.ordinal],
  ],
  [
    "research-region-training",
    "INSERT INTO research_region_training(region_id, method_entity_id, ordinal) VALUES (?, ?, ?)",
    (row) => [row.regionId, row.methodEntityId, row.ordinal],
  ],
  [
    "research-skill-methods",
    "INSERT INTO research_skill_methods(skill_entity_id, method_entity_id, ordinal) VALUES (?, ?, ?)",
    (row) => [row.skillEntityId, row.methodEntityId, row.ordinal],
  ],

  [
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
  ],
];

// Reports the exact file, line and record key on failure, so a constraint
// violation reads as a data problem rather than a SQL trace.
export function insertCanonical(db, records) {
  const context = {
    bodies: entityBodies(records),
    names: new Map((records.get("entities") ?? []).map((entity) => [entity.id, entity.name])),
  };
  for (const [name, sql, values] of INSERTS) {
    const collection = COLLECTION_BY_NAME.get(name);
    const statement = prepared(db, sql);
    (records.get(name) ?? []).forEach((record, index) => {
      try {
        statement.run(...values(record, context));
      } catch (error) {
        const key = collection.key.map((field) => record[field]).join(" ");
        throw new Error(`${collection.file}:${index + 1}: ${key}: ${error.message}`);
      }
    });
  }
}
