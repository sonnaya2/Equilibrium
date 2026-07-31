// Declarative description of data/canonical/. One collection per line-oriented
// JSONL file; the exporter, the validator and the parity report all read this
// file so a field can only exist in one place.
//
// A field is written as `"type"` when it is required, or `["type", default]`
// when it is optional. Optional fields are omitted from a line whenever they
// equal their default, which is what keeps two exports of the same database
// byte-identical. Types: string, integer, number, boolean, json; a trailing `?`
// allows null.
//
// Prose for humans lives in docs/canonical-data.md.

import { join } from "node:path";
import { ROOT } from "../config.mjs";

export const CANONICAL_ROOT = join(ROOT, "data/canonical");
export const CANONICAL_VERSION = 1;

// `data/league/tasks.json` + `$.records[0]` -> one addressable provenance record.
export const recordRef = (file, path) => `${file}#${path}`;
export const splitRecordRef = (ref) => {
  const at = ref.indexOf("#");
  return at < 0 ? null : { sourceFile: ref.slice(0, at), recordPath: ref.slice(at + 1) };
};

const bool = (value) => Boolean(value);
const json = (value) => JSON.parse(value);
const nullable = (value) => (value === "" ? null : (value ?? null));

export const COLLECTIONS = [
  {
    name: "entities",
    file: "entities.jsonl",
    key: ["id"],
    fields: {
      id: "string",
      type: "string",
      name: "string",
      sortKey: "string",
      status: ["string", "active"],
      shortDescription: ["string", ""],
      detailedDescription: ["string", ""],
      verifiedAt: ["string?", null],
      createdSource: "string",
      updatedSource: "string",
      // Exactly one of these, or neither for the synthetic global region: the
      // entity body is a provenance record, referenced rather than copied.
      recordRef: ["string?", null],
      record: ["json?", null],
    },
    sql: `SELECT id, entity_type, name, sort_key, status, short_description, detailed_description,
                 verified_at, created_source, updated_source, extra_json
          FROM entities`,
    map: (row, context) => {
      const ref = context.entityRecordRef.get(row.id) ?? null;
      return {
        id: row.id,
        type: row.entity_type,
        name: row.name,
        sortKey: row.sort_key,
        status: row.status,
        shortDescription: row.short_description,
        detailedDescription: row.detailed_description,
        verifiedAt: row.verified_at ?? null,
        createdSource: row.created_source,
        updatedSource: row.updated_source,
        recordRef: ref,
        // Skill entities drop their `methods` key during normalization and a
        // patched entity can outrun the record it came from, so 30 of 4,790
        // bodies match no provenance record and are carried inline.
        record: ref || row.extra_json === "{}" ? null : json(row.extra_json),
      };
    },
  },
  {
    name: "entity-aliases",
    file: "entity-aliases.jsonl",
    key: ["entityId", "alias"],
    refs: { entityId: "entities" },
    fields: { entityId: "string", alias: "string", kind: ["string", "name"] },
    sql: "SELECT entity_id, alias, kind FROM aliases",
    map: (row) => ({ entityId: row.entity_id, alias: row.alias, kind: row.kind }),
  },
  {
    name: "sources",
    file: "sources.jsonl",
    key: ["id"],
    fields: {
      id: "string",
      url: "string",
      family: "string",
      role: ["string", "verification"],
      pageTitle: ["string", ""],
      publisher: ["string", ""],
      verifiedAt: ["string?", null],
      retrievedAt: ["string?", null],
      contentHash: ["string?", null],
    },
    sql: `SELECT id, url, source_family, source_role, page_title, publisher,
                 verified_at, retrieved_at, content_hash
          FROM sources`,
    map: (row) => ({
      id: row.id,
      url: row.url,
      family: row.source_family,
      role: row.source_role,
      pageTitle: row.page_title,
      publisher: row.publisher,
      verifiedAt: nullable(row.verified_at),
      retrievedAt: nullable(row.retrieved_at),
      contentHash: nullable(row.content_hash),
    }),
  },
  {
    name: "entity-sources",
    file: "entity-sources.jsonl",
    key: ["entityId", "sourceId", "role"],
    refs: { entityId: "entities", sourceId: "sources" },
    fields: {
      entityId: "string",
      sourceId: "string",
      role: ["string", "verification"],
      ordinal: ["integer", 0],
    },
    sql: "SELECT entity_id, source_id, role, ordinal FROM entity_sources",
    map: (row) => ({
      entityId: row.entity_id,
      sourceId: row.source_id,
      role: row.role,
      ordinal: row.ordinal,
    }),
  },
  {
    name: "regions",
    file: "regions.jsonl",
    key: ["id"],
    fields: {
      id: "string",
      taxonomyOrder: "integer",
      availability: ["string", "unknown"],
      verified: ["boolean", false],
    },
    sql: "SELECT id, taxonomy_order, availability, verified FROM regions",
    map: (row) => ({
      id: row.id,
      taxonomyOrder: row.taxonomy_order,
      availability: row.availability,
      verified: bool(row.verified),
    }),
  },
  {
    name: "entity-regions",
    file: "entity-regions.jsonl",
    key: ["entityId", "regionId", "relation"],
    refs: { entityId: "entities", regionId: "regions" },
    fields: {
      entityId: "string",
      regionId: "string",
      relation: "string",
      ordinal: ["integer", 0],
      requirementGroup: ["string", ""],
    },
    sql: "SELECT entity_id, region_id, relation, ordinal, requirement_group FROM entity_regions",
    map: (row) => ({
      entityId: row.entity_id,
      regionId: row.region_id,
      relation: row.relation,
      ordinal: row.ordinal,
      requirementGroup: row.requirement_group,
    }),
  },
  {
    name: "requirements",
    file: "requirements.jsonl",
    // Ordinal is not unique per entity: two records can contribute the same
    // position, so the database's own uniqueness constraint is the key.
    key: ["entityId", "kind", "description"],
    refs: { entityId: "entities", targetEntityId: "entities" },
    fields: {
      entityId: "string",
      description: "string",
      ordinal: "integer",
      kind: ["string", "text"],
      skill: ["string?", null],
      level: ["integer?", null],
      targetEntityId: ["string?", null],
    },
    sql: `SELECT entity_id, description, ordinal, kind, skill, level, target_entity_id FROM requirements`,
    map: (row) => ({
      entityId: row.entity_id,
      description: row.description,
      ordinal: row.ordinal,
      kind: row.kind,
      skill: nullable(row.skill),
      level: row.level ?? null,
      targetEntityId: nullable(row.target_entity_id),
    }),
  },
  {
    name: "effects",
    file: "effects.jsonl",
    key: ["entityId", "key", "ordinal"],
    refs: { entityId: "entities" },
    fields: {
      entityId: "string",
      key: "string",
      ordinal: "integer",
      description: "string",
      valueText: ["string", ""],
      metadata: ["json", {}],
    },
    sql: "SELECT entity_id, effect_key, ordinal, description, value_text, metadata_json FROM effects",
    map: (row) => ({
      entityId: row.entity_id,
      key: row.effect_key,
      ordinal: row.ordinal,
      description: row.description,
      valueText: row.value_text,
      // `record` effects are the domain row of an `effect` entity; their
      // metadata was a byte-identical copy of that entity's own body.
      metadata: row.effect_key === "record" ? {} : json(row.metadata_json),
    }),
  },
  {
    name: "relationships",
    file: "relationships.jsonl",
    key: ["subjectId", "predicate", "objectId"],
    refs: { subjectId: "entities", objectId: "entities" },
    fields: {
      subjectId: "string",
      predicate: "string",
      objectId: "string",
      ordinal: ["integer", 0],
      metadata: ["json", {}],
    },
    sql: "SELECT subject_id, predicate, object_id, ordinal, metadata_json FROM relationships",
    map: (row) => ({
      subjectId: row.subject_id,
      predicate: row.predicate,
      objectId: row.object_id,
      ordinal: row.ordinal,
      metadata: json(row.metadata_json),
    }),
  },
  {
    name: "tags",
    file: "tags.jsonl",
    key: ["id"],
    fields: { id: "string", name: "string" },
    sql: "SELECT id, name FROM tags",
    map: (row) => ({ id: row.id, name: row.name }),
  },
  {
    name: "entity-tags",
    file: "entity-tags.jsonl",
    key: ["entityId", "tagId"],
    refs: { entityId: "entities", tagId: "tags" },
    fields: { entityId: "string", tagId: "string" },
    sql: "SELECT entity_id, tag_id FROM entity_tags",
    map: (row) => ({ entityId: row.entity_id, tagId: row.tag_id }),
  },
  {
    name: "map-points",
    file: "map-points.jsonl",
    key: ["id"],
    refs: { entityId: "entities", regionId: "regions" },
    fields: {
      id: "string",
      label: "string",
      x: "number",
      y: "number",
      z: ["number?", null],
      pointType: ["string", "place"],
      regionId: ["string?", null],
      entityId: ["string?", null],
      metadata: ["json", {}],
    },
    sql: "SELECT id, label, x, y, z, point_type, region_id, entity_id, extra_json FROM map_points",
    map: (row) => ({
      id: row.id,
      label: row.label,
      x: row.x,
      y: row.y,
      z: row.z ?? null,
      pointType: row.point_type,
      regionId: nullable(row.region_id),
      entityId: nullable(row.entity_id),
      metadata: json(row.extra_json),
    }),
  },
  {
    name: "quarantine",
    file: "quarantine.jsonl",
    key: ["sourceFile", "recordPath", "error"],
    fields: {
      sourceFile: "string",
      recordPath: "string",
      error: "string",
      suggestedResolution: "string",
      stableId: ["string?", null],
      conflictingRecord: ["json?", null],
      record: "json",
    },
    sql: `SELECT source_file, record_path, error, suggested_resolution, stable_id,
                 conflicting_record, raw_json
          FROM quarantine`,
    map: (row) => ({
      sourceFile: row.source_file,
      recordPath: row.record_path,
      error: row.error,
      suggestedResolution: row.suggested_resolution,
      stableId: nullable(row.stable_id),
      conflictingRecord: row.conflicting_record == null ? null : json(row.conflicting_record),
      record: json(row.raw_json),
    }),
  },

  // --- domains -------------------------------------------------------------
  {
    name: "equipment",
    file: "domains/equipment.jsonl",
    key: ["entityId"],
    refs: { entityId: "entities" },
    fields: {
      entityId: "string",
      style: ["string", ""],
      slot: ["string", ""],
      tier: ["integer?", null],
      category: ["string", ""],
    },
    sql: "SELECT entity_id, style, slot, tier, category FROM equipment",
    map: (row) => ({
      entityId: row.entity_id,
      style: row.style,
      slot: row.slot,
      tier: row.tier ?? null,
      category: row.category,
    }),
  },
  {
    name: "equipment-stats",
    file: "domains/equipment-stats.jsonl",
    key: ["entityId", "stat"],
    refs: { entityId: "entities" },
    fields: { entityId: "string", stat: "string", value: "number", unit: ["string", ""] },
    sql: "SELECT entity_id, stat, value, unit FROM equipment_stats",
    map: (row) => ({ entityId: row.entity_id, stat: row.stat, value: row.value, unit: row.unit }),
  },
  {
    name: "abilities",
    file: "domains/abilities.jsonl",
    key: ["entityId"],
    refs: { entityId: "entities" },
    fields: {
      entityId: "string",
      style: ["string", ""],
      category: ["string", ""],
      level: ["integer?", null],
      cooldownTicks: ["integer?", null],
    },
    sql: "SELECT entity_id, style, category, level, cooldown_ticks FROM abilities",
    map: (row) => ({
      entityId: row.entity_id,
      style: row.style,
      category: row.category,
      level: row.level ?? null,
      cooldownTicks: row.cooldown_ticks ?? null,
    }),
  },
  {
    name: "prayers",
    file: "domains/prayers.jsonl",
    key: ["entityId"],
    refs: { entityId: "entities" },
    fields: { entityId: "string", book: ["string", ""], level: ["integer?", null] },
    sql: "SELECT entity_id, book, level FROM prayers",
    map: (row) => ({ entityId: row.entity_id, book: row.book, level: row.level ?? null }),
  },
  {
    name: "spells",
    file: "domains/spells.jsonl",
    key: ["entityId"],
    refs: { entityId: "entities" },
    fields: { entityId: "string", spellbook: ["string", ""], level: ["integer?", null] },
    sql: "SELECT entity_id, spellbook, level FROM spells",
    map: (row) => ({ entityId: row.entity_id, spellbook: row.spellbook, level: row.level ?? null }),
  },
  {
    name: "invention-perks",
    file: "domains/invention-perks.jsonl",
    key: ["entityId"],
    refs: { entityId: "entities" },
    fields: { entityId: "string", maxRank: ["integer?", null], category: ["string", ""] },
    sql: "SELECT entity_id, max_rank, category FROM invention_perks",
    map: (row) => ({ entityId: row.entity_id, maxRank: row.max_rank ?? null, category: row.category }),
  },
  {
    name: "activities",
    file: "domains/activities.jsonl",
    key: ["entityId"],
    refs: { entityId: "entities" },
    fields: { entityId: "string", category: ["string", ""], location: ["string", ""] },
    sql: "SELECT entity_id, category, location FROM activities",
    map: (row) => ({ entityId: row.entity_id, category: row.category, location: row.location }),
  },
  {
    name: "unlocks",
    file: "domains/unlocks.jsonl",
    key: ["entityId"],
    refs: { entityId: "entities" },
    fields: { entityId: "string", category: ["string", ""], unlockType: ["string", ""] },
    sql: "SELECT entity_id, category, unlock_type FROM unlocks",
    map: (row) => ({ entityId: row.entity_id, category: row.category, unlockType: row.unlock_type }),
  },
  {
    name: "tasks",
    file: "domains/tasks.jsonl",
    key: ["entityId"],
    refs: { entityId: "entities", regionId: "regions" },
    fields: {
      entityId: "string",
      tier: ["string", ""],
      points: ["integer?", null],
      regionId: ["string?", null],
      sourceLeague: ["string", ""],
    },
    sql: "SELECT entity_id, tier, points, region_id, source_league FROM tasks",
    map: (row) => ({
      entityId: row.entity_id,
      tier: row.tier,
      points: row.points ?? null,
      regionId: nullable(row.region_id),
      sourceLeague: row.source_league,
    }),
  },
  {
    name: "quests",
    file: "domains/quests.jsonl",
    key: ["entityId"],
    refs: { entityId: "entities", primaryRegionId: "regions" },
    fields: {
      entityId: "string",
      questType: ["string", ""],
      series: ["string", ""],
      primaryRegionId: ["string?", null],
      members: ["boolean?", null],
      releaseDate: ["string", ""],
    },
    sql: "SELECT entity_id, quest_type, series, primary_region_id, members, release_date FROM quests",
    map: (row) => ({
      entityId: row.entity_id,
      questType: row.quest_type,
      series: row.series,
      primaryRegionId: nullable(row.primary_region_id),
      members: row.members == null ? null : bool(row.members),
      releaseDate: row.release_date,
    }),
  },
  {
    name: "training-methods",
    file: "domains/training-methods.jsonl",
    key: ["entityId"],
    refs: { entityId: "entities" },
    fields: {
      entityId: "string",
      skill: ["string", ""],
      levelRange: ["string", ""],
      xpRate: ["string", ""],
      intensity: ["string", ""],
      location: ["string", ""],
      hardRegionRequirement: ["boolean", false],
    },
    sql: `SELECT entity_id, skill, level_range, xp_rate, intensity, location, hard_region_requirement
          FROM training_methods`,
    map: (row) => ({
      entityId: row.entity_id,
      skill: row.skill,
      levelRange: row.level_range,
      xpRate: row.xp_rate,
      intensity: row.intensity,
      location: row.location,
      hardRegionRequirement: bool(row.hard_region_requirement),
    }),
  },

  // --- research ------------------------------------------------------------
  {
    name: "research-catalog",
    file: "research/catalog.jsonl",
    key: ["id"],
    fields: {
      id: "string",
      snapshotDate: "string",
      sourcePolicy: "json",
      coverage: "json",
      hardRules: "json",
      datasets: "json",
    },
    sql: `SELECT snapshot_date, source_policy_json, coverage_json, hard_rules_json, datasets_json
          FROM research_catalog WHERE id = 1`,
    map: (row) => ({
      id: "catalog",
      snapshotDate: row.snapshot_date,
      sourcePolicy: json(row.source_policy_json),
      coverage: json(row.coverage_json),
      hardRules: json(row.hard_rules_json),
      datasets: json(row.datasets_json),
    }),
  },
  {
    name: "research-regions",
    file: "research/regions.jsonl",
    key: ["regionId"],
    refs: { regionId: "regions" },
    fields: {
      regionId: "string",
      ordinal: "integer",
      areas: "json",
      hardRules: "json",
      warnings: "json",
      source: ["json?", null],
    },
    sql: `SELECT region_id, ordinal, areas_json, hard_rules_json, warnings_json, source_json
          FROM research_regions`,
    map: (row) => ({
      regionId: row.region_id,
      ordinal: row.ordinal,
      areas: json(row.areas_json),
      hardRules: json(row.hard_rules_json),
      warnings: json(row.warnings_json),
      source: json(row.source_json),
    }),
  },
  {
    name: "research-region-entries",
    file: "research/region-entries.jsonl",
    key: ["regionId", "section", "ordinal"],
    refs: { regionId: "regions", entityId: "entities" },
    fields: { regionId: "string", section: "string", ordinal: "integer", entityId: "string" },
    sql: "SELECT region_id, section, ordinal, entity_id FROM research_region_entries",
    map: (row) => ({
      regionId: row.region_id,
      section: row.section,
      ordinal: row.ordinal,
      entityId: row.entity_id,
    }),
  },
  {
    name: "research-region-skills",
    file: "research/region-skills.jsonl",
    key: ["regionId", "ordinal"],
    refs: { regionId: "regions", skillEntityId: "entities" },
    fields: { regionId: "string", ordinal: "integer", skillEntityId: "string" },
    sql: "SELECT region_id, ordinal, skill_entity_id FROM research_region_skills",
    map: (row) => ({ regionId: row.region_id, ordinal: row.ordinal, skillEntityId: row.skill_entity_id }),
  },
  {
    name: "research-region-training",
    file: "research/region-training.jsonl",
    key: ["regionId", "ordinal"],
    refs: { regionId: "regions", methodEntityId: "entities" },
    fields: { regionId: "string", ordinal: "integer", methodEntityId: "string" },
    sql: "SELECT region_id, ordinal, method_entity_id FROM research_region_training",
    map: (row) => ({ regionId: row.region_id, ordinal: row.ordinal, methodEntityId: row.method_entity_id }),
  },
  {
    name: "research-skill-methods",
    file: "research/skill-methods.jsonl",
    key: ["skillEntityId", "ordinal"],
    refs: { skillEntityId: "entities", methodEntityId: "entities" },
    fields: { skillEntityId: "string", ordinal: "integer", methodEntityId: "string" },
    sql: "SELECT skill_entity_id, ordinal, method_entity_id FROM research_skill_methods",
    map: (row) => ({
      skillEntityId: row.skill_entity_id,
      ordinal: row.ordinal,
      methodEntityId: row.method_entity_id,
    }),
  },

  // --- provenance ----------------------------------------------------------
  {
    name: "source-files",
    file: "provenance/source-files.jsonl",
    key: ["path"],
    fields: {
      path: "string",
      classification: "string",
      contentHash: "string",
      bytes: "integer",
      metadata: ["json", {}],
    },
    sql: "SELECT path, classification, content_hash, bytes, metadata_json FROM source_files",
    map: (row) => ({
      path: row.path,
      classification: row.classification,
      contentHash: row.content_hash,
      bytes: row.bytes,
      metadata: json(row.metadata_json),
    }),
  },
  {
    // The shape each document keeps once its records are lifted out. Export
    // replays source-records over this to rebuild public/data/v2/documents/**,
    // which is what lets the frontend artifacts be built without the seed.
    name: "source-documents",
    file: "provenance/source-documents.jsonl",
    key: ["path"],
    refs: { path: "source-files" },
    fields: { path: "string", skeleton: "json" },
    sql: "SELECT path, skeleton_json FROM source_documents",
    map: (row) => ({ path: row.path, skeleton: json(row.skeleton_json) }),
  },
  {
    name: "source-records",
    file: "provenance/source-records.jsonl",
    key: ["sourceFile", "recordPath"],
    refs: { sourceFile: "source-files", entityId: "entities" },
    fields: {
      sourceFile: "string",
      recordPath: "string",
      record: "json",
      stableId: ["string?", null],
      entityId: ["string?", null],
    },
    sql: "SELECT source_file, record_path, raw_json, stable_id, entity_id FROM source_records",
    map: (row) => ({
      sourceFile: row.source_file,
      recordPath: row.record_path,
      record: json(row.raw_json),
      stableId: nullable(row.stable_id),
      entityId: nullable(row.entity_id),
    }),
  },
];

export const COLLECTION_BY_NAME = new Map(COLLECTIONS.map((collection) => [collection.name, collection]));

export const isOptionalField = (declaration) => Array.isArray(declaration);

// The value every omitted field carries. A reader that skips this sees `status`
// as undefined on most entities rather than "active".
export function collectionDefaults(collection) {
  const out = {};
  for (const [field, declaration] of Object.entries(collection.fields)) {
    if (isOptionalField(declaration)) out[field] = declaration[1];
  }
  return out;
}

// Sets a reference can point into, keyed by collection name.
export const REFERENCE_KEY = new Map([
  ["entities", "id"],
  ["regions", "id"],
  ["sources", "id"],
  ["tags", "id"],
  ["source-files", "path"],
]);

// Tables the export deliberately leaves behind, with the evidence that nothing
// downstream of the canonical files needs them. Rendered into the parity report.
export const EXCLUDED_TABLES = [
  {
    table: "schema_migrations",
    reason: "Applied-migration ledger for the legacy SQLite build; regenerated by data:migrate.",
    evidence: "Read only by database.mjs:migrate and the schema-version check in validate.mjs.",
  },
  {
    table: "transform_runs",
    reason: "Per-run transform bookkeeping (input hash, output count, timestamp).",
    evidence: "Written by recordTransform; read only for manifest.databaseInputHash, which is recomputed.",
  },
  {
    table: "patch_ledger",
    reason: "Records which data/patches/*.jsonl files were applied to this build.",
    evidence: "Read only by patches.mjs to refuse a re-application; canonical data is post-patch.",
  },
  {
    table: "patch_changes",
    reason: "Per-patch changed-entity log for the same ledger.",
    evidence: "Written by applyPatch, never read back.",
  },
  {
    table: "entity_search",
    reason: "FTS5 index over entity name, descriptions and aliases, plus its shadow tables.",
    evidence: "Fully rebuilt from entities + aliases by ingest.mjs:rebuildSearch on every run.",
  },
];

// Every top-level key the normalizer reads out of a legacy record to build a
// canonical column, grouped by where normalize.mjs reads it. Keys outside this
// set are not lost - they stay in provenance/source-records.jsonl `record` - but
// no canonical field carries them, which is what
// reports/canonical-unmodelled-fields.json reports.
//
// Keep this in step with normalize.mjs. It is the map Stage 2 needs to decide
// what to promote into a column next, so an entry that drifts out of date is
// worse than no entry.
export const CONSUMED_RECORD_KEYS = new Set([
  // recordName + entityCandidate
  "name", "title", "method", "quest", "tool", "perk", "component", "collection", "summary",
  "id", "recordType",
  // entityFields
  "displayDescription", "note", "warning", "detail", "description", "league_treatment", "purpose",
  "verifiedAt", "verified_at", "snapshotDate", "snapshot_date", "status", "sortKey", "sort_key",
  // regionLinks + addRegions
  "primary_region", "primaryRegion", "regionId", "region_id", "region", "regions",
  "requiredRegions", "required_regions", "regionHints", "region_hints", "region_hint",
  "optionalRegions", "optional_regions", "region_options", "excludedRegions", "excluded_regions",
  "regionRequirementType", "region_requirement_type", "unlock",
  // sourceObjects
  "sources", "source", "source_url", "sourceUrl", "source_urls", "official_source_urls",
  "primary_source_url", "primarySourceUrl", "secondary_source_urls", "secondarySourceUrls",
  "secondary_source_url",
  // linkSource reads these off a source object, which collectArrayRecords also
  // files as a provenance record in its own right.
  "url", "page_title", "publisher", "retrievedAt", "retrieved_at", "role", "content_hash",
  // requirements, effects, tags, aliases, relationships
  "requirements", "access_requirements", "effects", "facts", "style", "category", "skill",
  "target_tags", "tags", "aliases", "direct_prerequisites",
  // domain writers
  "slot", "tier", "bonuses", "level", "cooldownTicks", "book", "book_type", "prayer_requirement",
  "spellbook", "maxRank", "location", "type", "points", "sourceLeague", "quest_type", "series",
  "members", "release", "levelRange", "level_range", "xpRate", "xp_rate", "intensity",
  "hardRegionRequirement", "hard_region_requirement",
  // research catalog
  "methods",
]);

export const EXCLUDED_COLUMNS = [
  {
    column: "entities.slug",
    reason: "Always slugify(entities.id).",
    evidence: "4,790 of 4,790 rows match; the only writers (normalize.mjs, patches.mjs) call slugify(id).",
  },
  {
    column: "entities.extra_json",
    reason: "The entity body, carried once as entities.recordRef -> provenance/source-records.jsonl.",
    evidence: "4,760 of 4,790 bodies are byte-identical to a provenance record; the other 30 use `record`.",
  },
  {
    column: "regions.entity_id",
    reason: "Always 'region:' || regions.id.",
    evidence: "12 of 12 rows match.",
  },
  {
    column: "regions.name",
    reason: "Duplicate of the region entity's name.",
    evidence: "12 of 12 rows equal entities.name for regions.entity_id.",
  },
  {
    column: "source_records.record_hash",
    reason: "Always sha256 of the key-sorted record body.",
    evidence: "7,920 of 7,920 rows match hash(stableJson(record)).",
  },
  {
    column: "effects.metadata_json (effect_key = 'record')",
    reason: "A second copy of the effect entity's own body.",
    evidence: "All 31 'record' rows are byte-identical to entities.extra_json for the same entity.",
  },
];
