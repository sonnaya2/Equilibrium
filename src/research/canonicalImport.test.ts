import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

// The data platform is plain ESM under scripts/ and has no type declarations,
// so it is loaded through a computed URL rather than a checked import.
const load = async <T>(module: string): Promise<T> =>
  (await import(
    /* @vite-ignore */ new URL(`../../scripts/data/${module}`, import.meta.url).href
  )) as T;

const database = await load<{
  migrate: (db: DatabaseSync) => number;
  openDatabase: (path: string, mustExist: boolean) => DatabaseSync;
}>("database.mjs");

const importer = await load<{
  importCanonical: (
    db: DatabaseSync,
    root: string,
  ) => { files: number; bytes: number; inputHash: string };
  readCollectionRecords: (name: string, root?: string) => Array<Record<string, unknown>>;
}>("canonical/import.mjs");

const patches = await load<{
  applyPatch: (db: DatabaseSync, path: string, allowApplied: boolean) => Set<string>;
}>("patches.mjs");

const parity = await load<{
  legacyCanonicalParity: () => {
    match: boolean;
    tables: Array<{ table: string; equal: boolean; legacyRows?: number }>;
    search: { equal: boolean; results: Array<{ query: string; equal: boolean }> };
    artifacts: Array<{ name: string; files: number; equal: boolean }>;
    files: Array<{ name: string; equal: boolean }>;
  };
}>("parity.mjs");

const root = process.cwd();
const scratch = mkdtempSync(join(tmpdir(), "equilibrium-import-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

// A minimal but structurally valid dataset, so each rejection test changes
// exactly one thing and the failure it produces is unambiguous.
const VALID: Record<string, string[]> = {
  "entities.jsonl": [
    '{"createdSource":"fixture","id":"region:karamja","name":"Karamja","sortKey":"00","type":"region","updatedSource":"fixture"}',
    '{"createdSource":"fixture","id":"task:alpha","name":"Alpha","sortKey":"alpha","type":"task","updatedSource":"fixture"}',
    '{"createdSource":"fixture","id":"training-method:mining","name":"Mining","sortKey":"mining","type":"training-method","updatedSource":"fixture"}',
  ],
  "regions.jsonl": ['{"id":"karamja","taxonomyOrder":0}'],
  "tags.jsonl": ['{"id":"combat","name":"Combat"}'],
  "entity-tags.jsonl": ['{"entityId":"task:alpha","tagId":"combat"}'],
  "domains/tasks.jsonl": ['{"entityId":"task:alpha","regionId":"karamja","tier":"easy"}'],
  "domains/training-methods.jsonl": ['{"entityId":"training-method:mining","skill":"Mining"}'],
};

let fixtures = 0;
function fixture(overrides: Record<string, string[]> = {}): string {
  const directory = join(scratch, `canonical-${(fixtures += 1)}`);
  for (const [file, lines] of Object.entries({ ...VALID, ...overrides })) {
    const path = join(directory, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, lines.length ? `${lines.join("\n")}\n` : "");
  }
  return directory;
}

let databases = 0;
function migrated(): DatabaseSync {
  const path = join(scratch, `database-${(databases += 1)}.sqlite`);
  const db = database.openDatabase(path, false);
  database.migrate(db);
  return db;
}

function reject(overrides: Record<string, string[]>): { message: string; entities: number } {
  const db = migrated();
  try {
    let message = "";
    try {
      importer.importCanonical(db, fixture(overrides));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message, "the import was expected to fail").not.toBe("");
    return {
      message,
      entities: Number(
        (db.prepare("SELECT count(*) AS count FROM entities").get() as { count: number }).count,
      ),
    };
  } finally {
    db.close();
  }
}

describe("canonical importer", () => {
  it("imports a valid dataset in dependency order", () => {
    const db = migrated();
    try {
      importer.importCanonical(db, fixture());
      expect(db.prepare("SELECT count(*) AS count FROM entities").get()).toEqual({ count: 3 });
      // regions carries the region entity's own id and name, which is why it
      // cannot be written before entities.
      expect(db.prepare("SELECT id, entity_id, name FROM regions").get()).toEqual({
        id: "karamja",
        entity_id: "region:karamja",
        name: "Karamja",
      });
      expect(db.prepare("SELECT entity_id, region_id FROM tasks").get()).toEqual({
        entity_id: "task:alpha",
        region_id: "karamja",
      });
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("names the file, line and reason for a malformed record", () => {
    const { message } = reject({ "tags.jsonl": ["{not json"] });
    expect(message).toMatch(/tags\.jsonl:1/);
    expect(message).toMatch(/invalid JSON/);
  });

  it("refuses a duplicate primary key and names the record", () => {
    const { message } = reject({
      "entities.jsonl": [VALID["entities.jsonl"][1], VALID["entities.jsonl"][1]],
    });
    expect(message).toMatch(/duplicate primary key/);
    expect(message).toMatch(/task:alpha/);
  });

  it("refuses a broken foreign key", () => {
    const { message } = reject({
      "entity-tags.jsonl": ['{"entityId":"task:missing","tagId":"combat"}'],
    });
    expect(message).toMatch(/entityId references a missing entities record/);
  });

  // The database enforces references the canonical schema does not model:
  // research_region_training points at training_methods, not at any entity.
  it("refuses a domain reference the canonical schema cannot see", () => {
    const { message } = reject({
      "research/regions.jsonl": [
        '{"areas":[],"hardRules":[],"ordinal":0,"regionId":"karamja","warnings":[]}',
      ],
      "research/region-training.jsonl": [
        '{"methodEntityId":"task:alpha","ordinal":0,"regionId":"karamja"}',
      ],
    });
    expect(message).toMatch(/research\/region-training\.jsonl:1/);
    expect(message).toMatch(/karamja 0/);
    expect(message).toMatch(/FOREIGN KEY/i);
  });

  // Nothing reorders the steps at run time, so what is testable is that the
  // order is load-bearing: a step that needs an earlier one fails without it.
  it("depends on the order it declares", () => {
    const { message } = reject({
      "entities.jsonl": [VALID["entities.jsonl"][1], VALID["entities.jsonl"][2]],
      "domains/tasks.jsonl": ['{"entityId":"task:alpha","tier":"easy"}'],
    });
    expect(message).toMatch(/regions\.jsonl:1/);
    expect(message).toMatch(/no region entity region:karamja/);
  });

  it("rolls the whole import back when one record fails", () => {
    // The entities are valid and are written first; the failure arrives several
    // steps later, and has to take them with it.
    const { entities } = reject({
      "entity-tags.jsonl": ['{"entityId":"task:alpha","tagId":"missing"}'],
    });
    expect(entities).toBe(0);
  });

  // Patches run against the canonically built database exactly as before: one
  // transaction per file, so a rejected operation leaves neither a changed row
  // nor a ledger entry behind.
  it("still applies content patches transactionally", () => {
    const db = migrated();
    try {
      importer.importCanonical(db, fixture());
      const path = join(scratch, "2026-01-01-rollback.jsonl");
      writeFileSync(
        path,
        [
          '{"op":"upsert","entity":"task:alpha","set":{"name":"Renamed"}}',
          '{"op":"remove","entity":"task:missing","reason":"not here"}',
        ].join("\n"),
      );
      expect(() => patches.applyPatch(db, path, false)).toThrow(/task:missing/);
      expect(db.prepare("SELECT name FROM entities WHERE id = 'task:alpha'").get()).toEqual({
        name: "Alpha",
      });
      expect(db.prepare("SELECT count(*) AS count FROM patch_ledger").get()).toEqual({ count: 0 });
      expect(db.prepare("SELECT count(*) AS count FROM patch_changes").get()).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });

  it("reads the shipped provenance without a database", () => {
    const files = importer.readCollectionRecords("source-files");
    expect(files).toHaveLength(56);
    // Defaults are filled in, so an omitted field is not undefined.
    expect(files.every((file) => typeof file.metadata === "object")).toBe(true);
  });
});

// A checkout with no build cache and no legacy seed still has to produce the
// shipped database and the shipped frontend artifacts.
describe("clean-checkout rebuild from canonical files only", () => {
  const checkout = join(scratch, "checkout");
  mkdirSync(checkout, { recursive: true });
  for (const path of ["data/canonical", "data/migrations", "data/patches", "app", "src"]) {
    cpSync(join(root, path), join(checkout, path), { recursive: true });
  }

  it("has no seed, no cache and no exports to start from", () => {
    expect(readdirSync(join(checkout, "data")).sort()).toEqual([
      "canonical",
      "migrations",
      "patches",
    ]);
    expect(readdirSync(checkout).includes("public")).toBe(false);
  });

  // A whole rebuild, so it gets a real timeout rather than the 5s default.
  it("rebuilds the database and every frontend artifact", { timeout: 120_000 }, () => {
    execFileSync(process.execPath, [join(root, "scripts/data/platform.mjs"), "rebuild"], {
      cwd: checkout,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const rebuilt = join(checkout, "public/data/v2");
    const walk = (directory: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path, out);
        else out.push(path);
      }
      return out;
    };
    const shipped = walk(join(root, "public/data/v2")).map((path) =>
      relative(join(root, "public/data/v2"), path).replaceAll("\\", "/"),
    );
    const produced = walk(rebuilt).map((path) => relative(rebuilt, path).replaceAll("\\", "/"));
    expect(produced.sort()).toEqual(shipped.sort());
    expect(produced.length).toBeGreaterThan(100);
    for (const path of produced) {
      expect(statSync(join(rebuilt, path)).size, path).toBe(
        statSync(join(root, "public/data/v2", path)).size,
      );
      expect(readFileSync(join(rebuilt, path), "utf8"), path).toBe(
        readFileSync(join(root, "public/data/v2", path), "utf8"),
      );
    }
  });
});

// The whole point of the stage: the two ingestion paths are interchangeable.
describe("legacy and canonical builds are the same database", () => {
  const report = parity.legacyCanonicalParity();

  it("matches every table logically", () => {
    expect(report.tables.filter(({ equal }) => !equal)).toEqual([]);
    expect(report.tables.length).toBeGreaterThan(30);
    for (const table of [
      "entities",
      "sources",
      "regions",
      "requirements",
      "effects",
      "tags",
      "relationships",
    ]) {
      expect(report.tables.find((row) => row.table === table)?.legacyRows, table).toBeGreaterThan(
        0,
      );
    }
    // The patch ledger and its change log survive canonical ingestion unchanged.
    expect(report.tables.find(({ table }) => table === "patch_ledger")?.legacyRows).toBe(
      readdirSync(join(root, "data/patches")).filter((name) => name.endsWith(".jsonl")).length,
    );
    expect(
      report.tables.find(({ table }) => table === "patch_changes")?.legacyRows,
    ).toBeGreaterThan(0);
  });

  it("returns the same search results", () => {
    expect(report.search.results.filter(({ equal }) => !equal)).toEqual([]);
    expect(report.search.equal).toBe(true);
  });

  it("produces byte-identical frontend artifacts", () => {
    const exports = report.artifacts.find(({ name }) => name === "frontend exports");
    expect(exports?.files).toBeGreaterThan(100);
    expect(report.artifacts.filter(({ equal }) => !equal)).toEqual([]);
    expect(report.files.filter(({ equal }) => !equal)).toEqual([]);
    expect(report.match).toBe(true);
  });
});
