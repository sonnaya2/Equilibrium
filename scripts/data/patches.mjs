import { extname, basename } from "node:path";
import { readFileSync } from "node:fs";
import {
  CHANGED,
  PATCHES,
  PATCH_LIMIT_BYTES,
  PATCH_LIMIT_OPERATIONS,
  SCHEMA_VERSION,
} from "./config.mjs";
import { migrationTime, prepared, requireEntity, transaction } from "./database.mjs";
import { normalizeRegion } from "./normalize.mjs";
import { atomicWrite, hash, jsonLine, scalar, slugify, stableJson, walkFiles } from "./utilities.mjs";

const ENTITY_FIELDS = new Set([
  "name",
  "entity_type",
  "short_description",
  "detailed_description",
  "confidence",
  "verified_at",
  "status",
  "sort_key",
]);
const SOURCE_FIELDS = new Set([
  "url",
  "page_title",
  "publisher",
  "source_family",
  "verified_at",
  "retrieved_at",
  "confidence",
  "source_role",
  "content_hash",
]);
const REGION_RELATIONS = ["primary", "required", "optional", "hint", "excluded", "global"];

export function parsePatch(path) {
  const body = readFileSync(path, "utf8");
  if (Buffer.byteLength(body) > PATCH_LIMIT_BYTES) throw new Error(`${path}: patch exceeds the 1 MiB safety limit`);
  const operations = body
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(({ text }) => text && !text.startsWith("#"))
    .map(({ line, text }) => {
      try {
        return { line, operation: JSON.parse(text) };
      } catch (error) {
        throw new Error(`${path}:${line}: ${error.message}`);
      }
    });
  if (operations.length > PATCH_LIMIT_OPERATIONS) {
    throw new Error(`${path}: patch exceeds the 1,000-operation safety limit`);
  }
  return { body, operations };
}

const patchSource = (context) => `patch:${context.split(":")[0]}`;

function assertScalarSet(operation, allowed, context, message, scalarMessage) {
  if (!operation.set || typeof operation.set !== "object" || Array.isArray(operation.set)) {
    throw new Error(`${context}: ${message}`);
  }
  const unknown = Object.keys(operation.set).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${context}: ${scalarMessage}: ${unknown.join(", ")}`);
}

// Compatibility documents are rebuilt from source_records, so a patched entity
// field has to reach the raw row it came from or the two views drift apart.
function syncSourceEntityFields(db, id, fields) {
  const keyChoices = {
    name: ["name", "title", "label", "item", "ability", "quest", "activity", "method", "perk"],
    short_description: ["shortDescription", "summary", "description"],
    detailed_description: ["detailedDescription", "detail", "description"],
    verified_at: ["verifiedAt", "verified_at"],
    sort_key: ["sortKey", "sort_key"],
  };
  const select = db.prepare("SELECT source_file, record_path, raw_json FROM source_records WHERE entity_id = ?");
  const update = db.prepare(
    "UPDATE source_records SET raw_json = ?, record_hash = ? WHERE source_file = ? AND record_path = ?",
  );
  for (const record of select.all(id)) {
    const row = JSON.parse(record.raw_json);
    for (const [field, value] of Object.entries(fields)) {
      if (field === "entity_type") continue;
      const candidates = keyChoices[field] ?? [field];
      const key = candidates.find((candidate) => Object.hasOwn(row, candidate)) ?? candidates[0];
      row[key] = value;
    }
    const raw = stableJson(row);
    update.run(raw, hash(raw), record.source_file, record.record_path);
  }
}

function upsertEntity(db, { operation, id, context }) {
  if (!id) throw new Error(`${context}: upsert requires entity and scalar set fields`);
  assertScalarSet(
    operation,
    ENTITY_FIELDS,
    context,
    "upsert requires entity and scalar set fields",
    "unsupported upsert fields",
  );
  if (Object.values(operation.set).some((value) => value != null && typeof value === "object")) {
    throw new Error(`${context}: upsert cannot replace arrays or objects; use a narrow operation`);
  }
  const existing = db.prepare("SELECT * FROM entities WHERE id = ?").get(id);
  if (!existing) {
    if (!operation.set.name || !operation.set.entity_type) {
      throw new Error(`${context}: new entity requires name and entity_type`);
    }
    const name = scalar(operation.set.name);
    db.prepare(
      `INSERT INTO entities
       (id, slug, entity_type, name, short_description, detailed_description, confidence, verified_at,
        status, sort_key, created_source, updated_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      slugify(id),
      operation.set.entity_type,
      name,
      scalar(operation.set.short_description),
      scalar(operation.set.detailed_description),
      scalar(operation.set.confidence, "unspecified"),
      operation.set.verified_at ?? null,
      scalar(operation.set.status, "active"),
      scalar(operation.set.sort_key, name.toLocaleLowerCase("en")),
      patchSource(context),
      patchSource(context),
    );
    return;
  }
  // A different type means a different record; reusing the ID would silently
  // repoint every source link and region row already attached to it.
  if (operation.set.entity_type && operation.set.entity_type !== existing.entity_type) {
    throw new Error(`${context}: changing entity_type requires a new stable ID`);
  }
  const assignments = Object.keys(operation.set);
  if (!assignments.length) throw new Error(`${context}: upsert set cannot be empty`);
  db.prepare(
    `UPDATE entities SET ${assignments.map((key) => `${key} = ?`).join(", ")}, updated_source = ? WHERE id = ?`,
  ).run(...assignments.map((key) => operation.set[key]), patchSource(context), id);
  syncSourceEntityFields(db, id, operation.set);
}

function upsertSource(db, { operation, context, changed }) {
  const sourceId = scalar(operation.source);
  if (!sourceId) throw new Error(`${context}: upsert-source requires source and scalar set fields`);
  assertScalarSet(
    operation,
    SOURCE_FIELDS,
    context,
    "upsert-source requires source and scalar set fields",
    "unsupported source fields",
  );
  if (Object.values(operation.set).some((value) => value != null && typeof value === "object")) {
    throw new Error(`${context}: source fields must be scalar`);
  }
  const existing = db.prepare("SELECT * FROM sources WHERE id = ?").get(sourceId);
  if (!existing && (!operation.set.url || !operation.set.source_family)) {
    throw new Error(`${context}: new source requires url and source_family`);
  }
  if (operation.set.url) {
    const url = new URL(operation.set.url);
    if (!/^https?:$/.test(url.protocol)) throw new Error(`${context}: source URL must use HTTP or HTTPS`);
    operation.set.url = url.href;
  }
  if (existing) {
    const assignments = Object.keys(operation.set);
    if (!assignments.length) throw new Error(`${context}: source set cannot be empty`);
    db.prepare(`UPDATE sources SET ${assignments.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`).run(
      ...assignments.map((key) => operation.set[key]),
      sourceId,
    );
  } else {
    db.prepare(
      `INSERT INTO sources
       (id, url, page_title, publisher, source_family, verified_at, retrieved_at, confidence, source_role, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sourceId,
      operation.set.url,
      scalar(operation.set.page_title),
      scalar(operation.set.publisher),
      operation.set.source_family,
      operation.set.verified_at ?? null,
      operation.set.retrieved_at ?? null,
      scalar(operation.set.confidence, "unspecified"),
      scalar(operation.set.source_role, "reference"),
      operation.set.content_hash ?? null,
    );
  }
  // Every entity citing this source re-exports with the corrected metadata.
  db.prepare("SELECT entity_id FROM entity_sources WHERE source_id = ?")
    .all(sourceId)
    .forEach(({ entity_id }) => changed.add(entity_id));
}

function regionLink(db, { operation, id, context }) {
  requireEntity(db, id, context);
  const region = normalizeRegion(operation.region);
  if (!region) throw new Error(`${context}: unknown region: ${operation.region}`);
  const relation = scalar(operation.relation, "required");
  if (!REGION_RELATIONS.includes(relation)) {
    throw new Error(`${context}: invalid region relation: ${relation}`);
  }
  if (operation.op === "link-region") {
    db.prepare(
      `INSERT INTO entity_regions(entity_id, region_id, relation, ordinal, requirement_group)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(entity_id, region_id, relation) DO UPDATE SET
         ordinal = excluded.ordinal, requirement_group = excluded.requirement_group`,
    ).run(id, region, region === "global" ? "global" : relation, operation.order ?? 0, scalar(operation.group));
  } else {
    db.prepare("DELETE FROM entity_regions WHERE entity_id = ? AND region_id = ? AND relation = ?").run(
      id,
      region,
      relation,
    );
  }
}

function sourceLink(db, { operation, id, context }) {
  requireEntity(db, id, context);
  const sourceId = scalar(operation.source);
  if (!db.prepare("SELECT 1 FROM sources WHERE id = ?").get(sourceId)) {
    throw new Error(`${context}: source not found: ${sourceId}`);
  }
  const role = scalar(operation.role, "verification");
  if (operation.op === "link-source") {
    db.prepare("INSERT OR REPLACE INTO entity_sources(entity_id, source_id, role, ordinal) VALUES (?, ?, ?, ?)").run(
      id,
      sourceId,
      role,
      operation.order ?? 0,
    );
  } else {
    db.prepare("DELETE FROM entity_sources WHERE entity_id = ? AND source_id = ? AND role = ?").run(id, sourceId, role);
  }
}

function relationship(db, { operation, id, context }) {
  requireEntity(db, id, context);
  const target = scalar(operation.target);
  requireEntity(db, target, context);
  const predicate = scalar(operation.relation);
  if (!predicate) throw new Error(`${context}: relationship predicate is required`);
  if (operation.op === "relate") {
    db.prepare("INSERT OR REPLACE INTO relationships(subject_id, predicate, object_id, ordinal) VALUES (?, ?, ?, ?)").run(
      id,
      predicate,
      target,
      operation.order ?? 0,
    );
  } else {
    db.prepare("DELETE FROM relationships WHERE subject_id = ? AND predicate = ? AND object_id = ?").run(
      id,
      predicate,
      target,
    );
  }
}

// Removal is a status change: exports drop the record while its provenance and
// relationships stay auditable.
function removeEntity(db, { operation, id, context }) {
  requireEntity(db, id, context);
  if (!scalar(operation.reason)) throw new Error(`${context}: remove requires a reason`);
  db.prepare("UPDATE entities SET status = 'removed', updated_source = ? WHERE id = ?").run(patchSource(context), id);
  syncSourceEntityFields(db, id, { status: "removed" });
}

const OPERATIONS = new Map([
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

export function applyOperation(db, operation, context, changed) {
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
    throw new Error(`${context}: operation must be an object`);
  }
  const id = scalar(operation.entity);
  const handler = OPERATIONS.get(operation.op);
  if (!handler) throw new Error(`${context}: unsupported operation: ${operation.op}`);
  handler(db, { operation, id, context, changed });
  if (id) changed.add(id);
}

export function applyPatch(db, path, allowApplied = true) {
  const filename = basename(path);
  const patchId = filename.replace(/\.jsonl$/i, "");
  const { body, operations } = parsePatch(path);
  const contentHash = hash(body);
  const ledger = db.prepare("SELECT content_hash FROM patch_ledger WHERE patch_id = ?").get(patchId);
  if (ledger) {
    if (ledger.content_hash !== contentHash) {
      throw new Error(`${filename}: patch identity was already applied with a different content hash`);
    }
    if (allowApplied) return new Set();
    throw new Error(`${filename}: patch is already applied`);
  }
  const changed = new Set();
  // One transaction for the whole file: a rejected operation leaves nothing behind.
  transaction(db, () => {
    for (const { line, operation } of operations) {
      try {
        const before = new Set(changed);
        applyOperation(db, operation, `${filename}:${line}`, changed);
        for (const entityId of [...changed].filter((entityId) => !before.has(entityId))) {
          prepared(db, "INSERT INTO patch_changes(patch_id, entity_id, operation, line) VALUES (?, ?, ?, ?)").run(
            patchId,
            entityId,
            operation.op,
            line,
          );
        }
      } catch (error) {
        throw new Error(`${filename}:${line}:${operation.entity ?? "unknown"}: ${error.message}`);
      }
    }
    const count = Number(db.prepare("SELECT count(*) AS count FROM entities").get().count);
    db.prepare(
      `INSERT INTO patch_ledger
       (patch_id, filename, content_hash, applied_at, schema_version, resulting_entity_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(patchId, filename, contentHash, migrationTime(filename), SCHEMA_VERSION, count);
  });
  return changed;
}

export function applyAllPatches(db) {
  const changed = new Set();
  for (const path of walkFiles(PATCHES, (file) => extname(file) === ".jsonl")) {
    for (const id of applyPatch(db, path)) changed.add(id);
  }
  return changed;
}

export function writeChanged(db, changed) {
  const entities = [...changed].sort().map((id) => {
    const entity = prepared(db, "SELECT entity_type FROM entities WHERE id = ?").get(id);
    const regions = [
      ...new Set(
        prepared(db, "SELECT region_id FROM entity_regions WHERE entity_id = ? ORDER BY region_id")
          .all(id)
          .map(({ region_id }) => region_id),
      ),
    ];
    return { id, type: entity?.entity_type ?? "removed", regions };
  });
  atomicWrite(CHANGED, jsonLine({ schemaVersion: SCHEMA_VERSION, entities }));
}
