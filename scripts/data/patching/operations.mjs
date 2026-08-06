// One handler per operation, each writing canonical database fields directly.
//
// Handlers own no transaction and no ledger - apply.mjs does. Every operation
// they receive has already been validated, so what is left here is the part that
// needs the database: whether a row exists, and what to write. Each returns the
// entity IDs it changed.
import { requireEntity } from "../database.mjs";
import { hash, scalar, slugify, stableJson } from "../utilities.mjs";

// Safe to interpolate: validate.mjs copies assignment keys out of a fixed
// allowlist of column names, so nothing caller-chosen reaches the SQL.
const assign = (keys) => keys.map((key) => `${key} = ?`).join(", ");

function ensureDomainRow(db, entityId, entityType) {
  if (entityType === "activity") {
    db.prepare(
      "INSERT INTO activities(entity_id, category, location) VALUES (?, '', '') ON CONFLICT(entity_id) DO NOTHING",
    ).run(entityId);
  } else if (entityType === "unlock") {
    db.prepare(
      "INSERT INTO unlocks(entity_id, category, unlock_type) VALUES (?, '', '') ON CONFLICT(entity_id) DO NOTHING",
    ).run(entityId);
  }
}

function upsertEntity(db, operation, source) {
  const { entity: id, set } = operation;
  const existing = db.prepare("SELECT entity_type FROM entities WHERE id = ?").get(id);
  if (!existing) {
    if (!set.name || !set.entity_type) throw new Error("new entity requires name and entity_type in set");
    const name = scalar(set.name);
    db.prepare(
      `INSERT INTO entities
       (id, slug, entity_type, name, short_description, detailed_description, verified_at,
        status, sort_key, created_source, updated_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      slugify(id),
      set.entity_type,
      name,
      scalar(set.short_description),
      scalar(set.detailed_description),
      set.verified_at,
      scalar(set.status, "active"),
      scalar(set.sort_key, name.toLocaleLowerCase("en")),
      scalar(set.created_source, source),
      source,
    );
    ensureDomainRow(db, id, set.entity_type);
    return [id];
  }
  // A different type means a different record; reusing the ID would silently
  // repoint every source link and region row already attached to it.
  if (set.entity_type && set.entity_type !== existing.entity_type) {
    throw new Error("changing entity_type requires a new stable ID");
  }
  const keys = Object.keys(set);
  db.prepare(`UPDATE entities SET ${assign(keys)}, updated_source = ? WHERE id = ?`).run(
    ...keys.map((key) => set[key]),
    source,
    id,
  );
  ensureDomainRow(db, id, existing.entity_type);
  return [id];
}

function upsertSource(db, operation) {
  const { source: sourceId, set } = operation;
  const existing = db.prepare("SELECT id FROM sources WHERE id = ?").get(sourceId);
  if (existing) {
    const keys = Object.keys(set);
    db.prepare(`UPDATE sources SET ${assign(keys)} WHERE id = ?`).run(...keys.map((key) => set[key]), sourceId);
  } else {
    if (!set.url || !set.source_family) throw new Error("new source requires url and source_family in set");
    db.prepare(
      `INSERT INTO sources
       (id, url, page_title, publisher, source_family, verified_at, retrieved_at, source_role, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sourceId,
      set.url,
      scalar(set.page_title),
      scalar(set.publisher),
      set.source_family,
      set.verified_at,
      set.retrieved_at,
      scalar(set.source_role, "reference"),
      set.content_hash,
    );
  }
  // Every entity citing this source re-exports with the corrected metadata.
  return db
    .prepare("SELECT entity_id FROM entity_sources WHERE source_id = ?")
    .all(sourceId)
    .map(({ entity_id }) => entity_id);
}

function regionLink(db, operation) {
  const { op, entity, region, relation, order, group } = operation;
  requireEntity(db, entity);
  if (op === "link-region") {
    db.prepare(
      `INSERT INTO entity_regions(entity_id, region_id, relation, ordinal, requirement_group)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(entity_id, region_id, relation) DO UPDATE SET
         ordinal = excluded.ordinal, requirement_group = excluded.requirement_group`,
    ).run(entity, region, relation, order, group);
  } else {
    db.prepare("DELETE FROM entity_regions WHERE entity_id = ? AND region_id = ? AND relation = ?").run(
      entity,
      region,
      relation,
    );
  }
  return [entity];
}

function sourceLink(db, operation) {
  const { op, entity, source, role, order } = operation;
  requireEntity(db, entity);
  if (!db.prepare("SELECT 1 FROM sources WHERE id = ?").get(source)) {
    throw new Error(`source not found: ${source}`);
  }
  if (op === "link-source") {
    db.prepare("INSERT OR REPLACE INTO entity_sources(entity_id, source_id, role, ordinal) VALUES (?, ?, ?, ?)").run(
      entity,
      source,
      role,
      order,
    );
  } else {
    db.prepare("DELETE FROM entity_sources WHERE entity_id = ? AND source_id = ? AND role = ?").run(
      entity,
      source,
      role,
    );
  }
  return [entity];
}

function relationship(db, operation) {
  const { op, entity, target, predicate, order } = operation;
  requireEntity(db, entity);
  requireEntity(db, target);
  if (op === "relate") {
    db.prepare(
      "INSERT OR REPLACE INTO relationships(subject_id, predicate, object_id, ordinal) VALUES (?, ?, ?, ?)",
    ).run(entity, predicate, target, order);
  } else {
    db.prepare("DELETE FROM relationships WHERE subject_id = ? AND predicate = ? AND object_id = ?").run(
      entity,
      predicate,
      target,
    );
  }
  return [entity];
}

// Removal is a status change: exports drop the record while its provenance and
// relationships stay auditable.
function removeEntity(db, operation, source) {
  const { entity } = operation;
  requireEntity(db, entity);
  db.prepare("UPDATE entities SET status = 'removed', updated_source = ? WHERE id = ?").run(source, entity);
  return [entity];
}

// Drop a catalog content/upgrades membership without retiring the entity.
// remove alone leaves research_region_entries so dual-claim survivors still list.
function researchEntry(db, operation) {
  const { entity, region, section } = operation;
  requireEntity(db, entity);
  if (!db.prepare("SELECT 1 FROM research_regions WHERE region_id = ?").get(region)) {
    throw new Error(`research region not found: ${region}`);
  }
  db.prepare(
    "DELETE FROM research_region_entries WHERE entity_id = ? AND region_id = ? AND section = ?",
  ).run(entity, region, section);
  return [entity];
}

// Ordinals are the database's business, not the patch author's: a requirement or
// effect appends at the end of what the entity already has. That keeps a patch
// line about the fact it carries, and keeps the (entity, key, ordinal) unique
// constraint satisfiable without the author tracking it.
const nextOrdinal = (db, sql, ...params) => Number(db.prepare(sql).get(...params).next ?? 0);

function requirement(db, operation) {
  const { op, entity, description, kind, skill, level, target } = operation;
  requireEntity(db, entity);
  if (op === "remove-requirement") {
    db.prepare("DELETE FROM requirements WHERE entity_id = ? AND kind = ? AND description = ?").run(
      entity,
      kind,
      description,
    );
    return [entity];
  }
  if (target) requireEntity(db, target);
  const ordinal = nextOrdinal(
    db,
    "SELECT coalesce(max(ordinal) + 1, 0) AS next FROM requirements WHERE entity_id = ?",
    entity,
  );
  db.prepare(
    `INSERT INTO requirements(entity_id, kind, skill, level, target_entity_id, description, ordinal)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(entity_id, kind, description) DO UPDATE SET
       skill = excluded.skill, level = excluded.level, target_entity_id = excluded.target_entity_id`,
  ).run(entity, kind, skill, level, target, description, ordinal);
  return [entity];
}

function effect(db, operation) {
  const { op, entity, description, key, value } = operation;
  requireEntity(db, entity);
  if (op === "remove-effect") {
    db.prepare("DELETE FROM effects WHERE entity_id = ? AND effect_key = ? AND description = ?").run(
      entity,
      key,
      description,
    );
    return [entity];
  }
  if (db.prepare("SELECT 1 FROM effects WHERE entity_id = ? AND effect_key = ? AND description = ?").get(entity, key, description)) {
    return [entity];
  }
  const ordinal = nextOrdinal(
    db,
    "SELECT coalesce(max(ordinal) + 1, 0) AS next FROM effects WHERE entity_id = ? AND effect_key = ?",
    entity,
    key,
  );
  db.prepare(
    "INSERT INTO effects(entity_id, effect_key, description, value_text, ordinal) VALUES (?, ?, ?, ?, ?)",
  ).run(entity, key, description, value, ordinal);
  return [entity];
}

function tag(db, operation) {
  const { op, entity, tag: tagId, label } = operation;
  requireEntity(db, entity);
  if (op === "remove-tag") {
    db.prepare("DELETE FROM entity_tags WHERE entity_id = ? AND tag_id = ?").run(entity, tagId);
    return [entity];
  }
  // tags.name is UNIQUE COLLATE NOCASE, so an existing tag keeps the name it has.
  db.prepare("INSERT OR IGNORE INTO tags(id, name) VALUES (?, ?)").run(tagId, label);
  db.prepare("INSERT OR IGNORE INTO entity_tags(entity_id, tag_id) VALUES (?, ?)").run(entity, tagId);
  return [entity];
}

/**
 * Writes one source record, the unit documents are rebuilt from.

 * Every other handler edits an entity, and no document is assembled from those
 * - export.mjs replays source records over a skeleton. So a reveal that adds a
 * record, rather than amending one, has no other way in.
 */
function setRecord(db, operation, source) {
  const { file, path, body, entity: entityOverride } = operation;
  const known = db.prepare("SELECT path FROM source_files WHERE path = ?").get(file);
  if (!known) throw new Error(`unknown source file: ${file}`);
  if (entityOverride && !db.prepare("SELECT id FROM entities WHERE id = ?").get(entityOverride)) {
    throw new Error(`set-record entity not found: ${entityOverride}`);
  }
  const previous = db
    .prepare("SELECT stable_id, entity_id FROM source_records WHERE source_file = ? AND record_path = ?")
    .get(file, path);
  const bodyId = typeof body.id === "string" ? body.id : null;
  const matchedEntity = bodyId
    ? db.prepare("SELECT id FROM entities WHERE id = ?").get(bodyId)?.id
    : null;
  const entityId = entityOverride ?? matchedEntity ?? previous?.entity_id ?? null;
  const stableId = entityId ?? previous?.stable_id ?? null;
  // canonical-validate reconstructs the hash as hash(stableJson(record)), so it
  // has to be written the same way or every rebuild fails parity.
  const raw = stableJson(body);
  db.prepare(
    `INSERT INTO source_records (source_file, record_path, stable_id, entity_id, record_hash, raw_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (source_file, record_path)
     DO UPDATE SET stable_id = excluded.stable_id, entity_id = excluded.entity_id,
                   record_hash = excluded.record_hash, raw_json = excluded.raw_json`,
  ).run(file, path, stableId, entityId, hash(raw), raw);
  if (!entityId) return [];
  // Catalog content/upgrades faces own entities.extra_json (getResearchCatalog reads it).
  // A later set-record on progression-unlocks / regional-skilling / etc. must not stomp
  // that face body after re-home, or reconstruct-vs-live equality breaks.
  const isCatalogFace =
    file === "data/research/catalog.json" && /\.(content|upgrades)\[\d+\]$/.test(path);
  const hasCatalogHome = db
    .prepare(
      `SELECT 1 AS ok FROM research_region_entries
       WHERE entity_id = ? AND section IN ('content', 'upgrades') LIMIT 1`,
    )
    .get(entityId);
  const writeExtra = isCatalogFace || !hasCatalogHome;
  const name = typeof body.name === "string" ? body.name : null;
  if (writeExtra) {
    if (name) {
      db.prepare(
        "UPDATE entities SET name = ?, sort_key = ?, extra_json = ?, updated_source = ? WHERE id = ?",
      ).run(name, name.toLocaleLowerCase("en"), raw, source, entityId);
    } else {
      db.prepare("UPDATE entities SET extra_json = ?, updated_source = ? WHERE id = ?").run(
        raw,
        source,
        entityId,
      );
    }
  } else if (name) {
    db.prepare("UPDATE entities SET name = ?, sort_key = ?, updated_source = ? WHERE id = ?").run(
      name,
      name.toLocaleLowerCase("en"),
      source,
      entityId,
    );
  } else {
    db.prepare("UPDATE entities SET updated_source = ? WHERE id = ?").run(source, entityId);
  }
  if (file === "data/combat/equipment.json") {
    db.prepare(
      `INSERT INTO equipment(entity_id, style, slot, tier, category) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(entity_id) DO UPDATE SET style = excluded.style, slot = excluded.slot,
         tier = excluded.tier, category = excluded.category`,
    ).run(
      entityId,
      scalar(body.style),
      scalar(body.slot),
      Number.isFinite(body.tier) ? body.tier : null,
      scalar(body.category),
    );
    db.prepare("DELETE FROM equipment_stats WHERE entity_id = ?").run(entityId);
    const insertStat = db.prepare(
      "INSERT INTO equipment_stats(entity_id, stat, value, unit) VALUES (?, ?, ?, '')",
    );
    for (const [stat, value] of Object.entries(body.bonuses ?? {})) {
      if (Number.isFinite(value)) insertStat.run(entityId, stat, value);
    }
  }
  // Catalog content/upgrades paths own research_region_entries (ordinal = array index).
  if (file === "data/research/catalog.json") {
    const match = path.match(/^\$\.regions\[(\d+)\]\.(content|upgrades)\[(\d+)\]$/);
    if (match) {
      const regionOrdinal = Number(match[1]);
      const section = match[2];
      const entryOrdinal = Number(match[3]);
      const region = db
        .prepare("SELECT region_id FROM research_regions WHERE ordinal = ?")
        .get(regionOrdinal);
      if (!region) throw new Error(`set-record catalog path regions[${regionOrdinal}] has no research_regions row`);
      const category = typeof body.category === "string" ? body.category : typeof body.kind === "string" ? body.kind : "";
      const entityType = db.prepare("SELECT entity_type FROM entities WHERE id = ?").get(entityId)?.entity_type;
      if (entityType === "activity") {
        db.prepare(
          `INSERT INTO activities(entity_id, category, location) VALUES (?, ?, '')
           ON CONFLICT(entity_id) DO UPDATE SET category = CASE
             WHEN excluded.category = '' THEN activities.category ELSE excluded.category END`,
        ).run(entityId, category);
      } else if (entityType === "unlock") {
        db.prepare(
          `INSERT INTO unlocks(entity_id, category, unlock_type) VALUES (?, ?, '')
           ON CONFLICT(entity_id) DO UPDATE SET category = CASE
             WHEN excluded.category = '' THEN unlocks.category ELSE excluded.category END`,
        ).run(entityId, category);
      }
      // Catalog entries are single-home per section. Drop prior region rows for this
      // entity and clear the target ordinal so set-record can re-home across regions.
      db.prepare(
        "DELETE FROM research_region_entries WHERE section = ? AND entity_id = ?",
      ).run(section, entityId);
      db.prepare(
        "DELETE FROM research_region_entries WHERE region_id = ? AND section = ? AND ordinal = ?",
      ).run(region.region_id, section, entryOrdinal);
      db.prepare(
        "INSERT INTO research_region_entries(region_id, entity_id, section, ordinal) VALUES (?, ?, ?, ?)",
      ).run(region.region_id, entityId, section, entryOrdinal);
      // Drop stale content/upgrades provenance paths for this entity. Re-homes leave
      // the old $.regions[N].(content|upgrades)[i] row behind; path-sorted reconstruct
      // would then re-apply the pre-rehome body over the live face.
      db.prepare(
        `DELETE FROM source_records
         WHERE source_file = ?
           AND entity_id = ?
           AND record_path != ?
           AND (record_path LIKE '$.regions[%].content[%' OR record_path LIKE '$.regions[%].upgrades[%')`,
      ).run(file, entityId, path);
    }
  }
  return [entityId];
}

export const HANDLERS = new Map([
  ["upsert", upsertEntity],
  ["set-record", setRecord],
  ["upsert-source", upsertSource],
  ["link-region", regionLink],
  ["unlink-region", regionLink],
  ["link-source", sourceLink],
  ["unlink-source", sourceLink],
  ["relate", relationship],
  ["unrelate", relationship],
  ["remove", removeEntity],
  ["unlink-research-entry", researchEntry],
  ["add-requirement", requirement],
  ["remove-requirement", requirement],
  ["add-effect", effect],
  ["remove-effect", effect],
  ["add-tag", tag],
  ["remove-tag", tag],
]);
