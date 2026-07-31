// One handler per operation, each writing canonical database fields directly.
//
// Handlers own no transaction and no ledger — apply.mjs does. Every operation
// they receive has already been validated, so what is left here is the part that
// needs the database: whether a row exists, and what to write. Each returns the
// entity IDs it changed.
import { requireEntity } from "../database.mjs";
import { scalar, slugify } from "../utilities.mjs";

// Safe to interpolate: validate.mjs copies assignment keys out of a fixed
// allowlist of column names, so nothing caller-chosen reaches the SQL.
const assign = (keys) => keys.map((key) => `${key} = ?`).join(", ");

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
      source,
      source,
    );
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

export const HANDLERS = new Map([
  ["upsert", upsertEntity],
  ["upsert-source", upsertSource],
  ["link-region", regionLink],
  ["unlink-region", regionLink],
  ["link-source", sourceLink],
  ["unlink-source", sourceLink],
  ["relate", relationship],
  ["unrelate", relationship],
  ["remove", removeEntity],
]);
