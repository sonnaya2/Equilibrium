import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CACHE, DATABASE, FIXED_TIME, MIGRATIONS } from "./config.mjs";
import { hash, walkFiles } from "./utilities.mjs";

export function openDatabase(path = DATABASE, mustExist = true) {
  if (mustExist && !existsSync(path)) throw new Error("Data database is missing; run npm run data:rebuild");
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = DELETE;");
  return db;
}

const statementCache = new WeakMap();

// Ingest replays the same few dozen INSERTs across thousands of records, and
// node:sqlite recompiles the SQL on every prepare(). Statements are cached per
// database handle; SQLite recompiles them itself if a migration changes schema.
export function prepared(db, sql) {
  let cache = statementCache.get(db);
  if (!cache) {
    cache = new Map();
    statementCache.set(db, cache);
  }
  let statement = cache.get(sql);
  if (!statement) {
    statement = db.prepare(sql);
    cache.set(sql, statement);
  }
  return statement;
}

export function transaction(db, work) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// Migrations and patches are stamped with the date in their filename so applying
// them in a different order or on a different day does not change the database.
export function migrationTime(filename) {
  const date = filename.match(/(20\d{2})[-_](\d{2})[-_](\d{2})/);
  return date ? `${date[1]}-${date[2]}-${date[3]}T00:00:00.000Z` : FIXED_TIME;
}

export function migrate(db) {
  const files = walkFiles(MIGRATIONS, (path) => extname(path) === ".sql");
  for (const path of files) {
    const filename = basename(path);
    const version = Number.parseInt(filename, 10);
    if (!Number.isInteger(version)) throw new Error(`Migration filename needs a numeric prefix: ${filename}`);
    const sql = readFileSync(path, "utf8");
    const contentHash = hash(sql);
    let applied = null;
    try {
      applied = db.prepare("SELECT content_hash FROM schema_migrations WHERE version = ?").get(version);
    } catch {
      // The very first migration creates schema_migrations itself.
      applied = null;
    }
    if (applied?.content_hash === contentHash) continue;
    if (applied) throw new Error(`Migration ${version} changed after application: ${filename}`);
    transaction(db, () => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations(version, filename, content_hash, applied_at) VALUES (?, ?, ?, ?)",
      ).run(version, filename, contentHash, migrationTime(filename));
    });
  }
  return files.length;
}

// Callers add the file and line; the message stays about the data.
export function requireEntity(db, id) {
  const entity = prepared(db, "SELECT id, entity_type FROM entities WHERE id = ?").get(id);
  if (!entity) throw new Error(`entity not found: ${id}`);
  return entity;
}

export function recordTransform(db, transform, inputHash, outputCount) {
  prepared(
    db,
    `INSERT OR REPLACE INTO transform_runs(name, version, stage, input_hash, output_count, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(transform.name, transform.version, transform.stage, inputHash, outputCount, FIXED_TIME);
}

export function cleanDatabase() {
  mkdirSync(CACHE, { recursive: true });
  const resolved = resolve(DATABASE);
  if (dirname(resolved) !== resolve(CACHE) || basename(resolved) !== "equilibrium.sqlite") {
    throw new Error(`Refusing to remove unexpected database path: ${resolved}`);
  }
  rmSync(resolved, { force: true });
  rmSync(`${resolved}-shm`, { force: true });
  rmSync(`${resolved}-wal`, { force: true });
}
