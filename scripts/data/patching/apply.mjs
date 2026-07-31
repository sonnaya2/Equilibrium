// Applying patches: identity, transaction, dispatch, and the ledger.
//
// A patch is immutable. Its ID is its filename and its identity is the hash of
// its bytes, so re-applying an unchanged file is a no-op and applying a changed
// one under an old name is an error. Each file applies in a single transaction,
// so a rejected operation leaves neither a changed row nor a ledger entry.
import { extname, basename } from "node:path";
import { CHANGED, PATCHES, SCHEMA_VERSION } from "../config.mjs";
import { migrationTime, prepared, transaction } from "../database.mjs";
import { atomicWrite, hash, jsonLine, walkFiles } from "../utilities.mjs";
import { parsePatch } from "./parse.mjs";
import { validateOperation } from "./validate.mjs";
import { HANDLERS } from "./operations.mjs";

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
  const source = `patch:${filename}`;
  const changed = new Set();
  transaction(db, () => {
    for (const { line, operation } of operations) {
      try {
        const validated = validateOperation(operation, `${filename}:${line}`);
        for (const entityId of HANDLERS.get(validated.op)(db, validated, source)) {
          if (changed.has(entityId)) continue;
          changed.add(entityId);
          prepared(db, "INSERT INTO patch_changes(patch_id, entity_id, operation, line) VALUES (?, ?, ?, ?)").run(
            patchId,
            entityId,
            validated.op,
            line,
          );
        }
      } catch (error) {
        throw new Error(`${filename}:${line}:${operation?.entity ?? "unknown"}: ${error.message}`);
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

// The affected-entity manifest the incremental export commands read.
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
