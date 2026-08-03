// Ingestion: data/canonical/*.jsonl -> a freshly migrated SQLite database.
//
// Validate, read, insert, check foreign keys, record the run - all inside one
// transaction, so a rejected record leaves no half-built database behind and
// the error names the file, line, record key and reason.
import { TRANSFORM_BY_NAME } from "./config.mjs";
import { recordTransform, transaction } from "./database.mjs";
import { hash } from "./utilities.mjs";
import { CANONICAL_ROOT } from "./canonical/schema.mjs";
import { readCanonical } from "./canonical/read.mjs";
import { insertCanonical } from "./canonical/insert.mjs";
import { validateCanonical } from "./canonical/validate.mjs";

function assertValid(root) {
  const validation = validateCanonical(root);
  if (validation.valid) return;
  const detail = validation.failures
    .slice(0, 10)
    .map(({ collection, detail: reason, sample }) => `${sample ?? collection}: ${reason}`)
    .join("; ");
  throw new Error(
    `Canonical data is invalid (${validation.failures.length} failures): ${detail}` +
      (validation.failures.length > 10 ? "; ..." : ""),
  );
}

export function importCanonical(db, root = CANONICAL_ROOT) {
  assertValid(root);
  const records = readCanonical(root);
  // Hashed from the provenance file hashes the dataset carries, so
  // manifest.databaseInputHash changes exactly when a source document does.
  const files = records.get("source-files") ?? [];
  const inputHash = hash(files.map(({ path, contentHash }) => `${path}:${contentHash}`).join("\n"));

  transaction(db, () => {
    insertCanonical(db, records);
    const violations = db.prepare("PRAGMA foreign_key_check").all();
    if (violations.length) {
      throw new Error(
        `Canonical import left ${violations.length} foreign-key violations: ${violations
          .slice(0, 5)
          .map(({ table, parent }) => `${table} -> ${parent}`)
          .join(", ")}`,
      );
    }
    recordTransform(db, TRANSFORM_BY_NAME.get("canonical-ingest"), inputHash, files.length);
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

// The FTS5 index is derived, never authored: it is dropped and rebuilt from
// entities and aliases after ingestion and after every patch.
export function rebuildSearch(db) {
  transaction(db, () => {
    db.exec("DELETE FROM entity_search");
    const aliases = db.prepare("SELECT alias FROM aliases WHERE entity_id = ? ORDER BY alias");
    const insert = db.prepare(
      "INSERT INTO entity_search(id, name, short_description, detailed_description, aliases) VALUES (?, ?, ?, ?, ?)",
    );
    const entities = db
      .prepare("SELECT id, name, short_description, detailed_description FROM entities ORDER BY id")
      .all();
    for (const entity of entities) {
      insert.run(
        entity.id,
        entity.name,
        entity.short_description,
        entity.detailed_description,
        aliases
          .all(entity.id)
          .map(({ alias }) => alias)
          .join(" "),
      );
    }
    recordTransform(db, TRANSFORM_BY_NAME.get("search-index"), hash(String(entities.length)), entities.length);
  });
}
