// Deterministic export from the validated SQLite database to data/canonical/.
// Reads nothing but the database and scripts/data/canonical/schema.mjs, and
// writes only the files whose bytes changed, so a second run is a no-op.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { CANONICAL_ROOT, COLLECTIONS, recordRef } from "./schema.mjs";
import { atomicWrite, slash, stableJson, walkFiles } from "../utilities.mjs";

// Key parts are compared as numbers when both sides are numeric and by UTF-16
// code unit otherwise. Never localeCompare: sort order has to be identical on
// every machine that regenerates these files.
export function compareKeys(a, b) {
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (left === right) continue;
    if (typeof left === "number" && typeof right === "number") return left - right;
    return String(left) < String(right) ? -1 : 1;
  }
  return 0;
}

export const keyOf = (collection, record) => collection.key.map((field) => record[field]);

const fieldDefault = (declaration) => (Array.isArray(declaration) ? declaration[1] : undefined);
export const fieldType = (declaration) => (Array.isArray(declaration) ? declaration[0] : declaration);
export const isOptional = (declaration) => Array.isArray(declaration);

// A field that equals its documented default is omitted; that is what keeps the
// files compact and two exports of one database byte-identical.
export function compact(collection, record) {
  const out = {};
  for (const [field, declaration] of Object.entries(collection.fields)) {
    const value = record[field];
    if (isOptional(declaration) && stableJson(value) === stableJson(fieldDefault(declaration))) continue;
    out[field] = value;
  }
  return out;
}

// Entity bodies live once, in provenance/source-records.jsonl. This resolves the
// provenance record each entity body is byte-identical to, preferring the first
// by (file, path) so the choice does not depend on ingest order.
function entityRecordRefs(db) {
  const refs = new Map();
  const rows = db
    .prepare(
      `SELECT records.entity_id, records.source_file, records.record_path
       FROM source_records AS records
       JOIN entities ON entities.id = records.entity_id
       WHERE records.raw_json = entities.extra_json
       ORDER BY records.source_file, records.record_path`,
    )
    .all();
  for (const row of rows) {
    if (!refs.has(row.entity_id)) refs.set(row.entity_id, recordRef(row.source_file, row.record_path));
  }
  return refs;
}

export function buildCanonical(db) {
  const context = { entityRecordRef: entityRecordRefs(db) };
  const outputs = new Map();
  const counts = {};
  for (const collection of COLLECTIONS) {
    const records = db
      .prepare(collection.sql)
      .all()
      .map((row) => collection.map(row, context));
    records.sort((a, b) => compareKeys(keyOf(collection, a), keyOf(collection, b)));
    counts[collection.name] = records.length;
    // An empty collection is not written: a zero-byte file would only invite a
    // future importer to guess what belongs in it.
    if (!records.length) continue;
    outputs.set(collection.file, records.map((record) => `${stableJson(compact(collection, record))}\n`).join(""));
  }
  return { outputs, counts };
}

export function exportCanonical(db) {
  const { outputs, counts } = buildCanonical(db);
  const stale = walkFiles(CANONICAL_ROOT, (path) => path.endsWith(".jsonl"))
    .map((path) => slash(relative(CANONICAL_ROOT, path)))
    .filter((path) => !outputs.has(path));
  const written = [];
  for (const [path, body] of outputs) {
    const destination = join(CANONICAL_ROOT, path);
    if (existsSync(destination) && readFileSync(destination, "utf8") === body) continue;
    atomicWrite(destination, body);
    written.push(path);
  }
  for (const path of stale) rmSync(join(CANONICAL_ROOT, path), { force: true });
  return {
    root: slash(relative(process.cwd(), CANONICAL_ROOT)),
    files: outputs.size,
    records: Object.values(counts).reduce((sum, count) => sum + count, 0),
    counts,
    written,
    stale,
  };
}
