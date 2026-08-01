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
}>("ingest.mjs");

const reader = await load<{
  readCollectionRecords: (name: string, root?: string) => Array<Record<string, unknown>>;
}>("canonical/read.mjs");

const patches = await load<{
  applyPatch: (db: DatabaseSync, path: string, allowApplied: boolean) => Set<string>;
}>("patching/apply.mjs");

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
    const files = reader.readCollectionRecords("source-files");
    expect(files).toHaveLength(56);
    // Defaults are filled in, so an omitted field is not undefined.
    expect(files.every((file) => typeof file.metadata === "object")).toBe(true);
  });

  // Two imports of the same files produce the same database, and the input hash
  // is a function of the dataset rather than of when it ran.
  it("imports deterministically", () => {
    const root = fixture();
    const digest = (db: DatabaseSync) =>
      JSON.stringify(
        db
          .prepare(
            "SELECT id, slug, entity_type, name, sort_key, extra_json FROM entities ORDER BY id",
          )
          .all(),
      );
    const first = migrated();
    const second = migrated();
    try {
      const a = importer.importCanonical(first, root);
      const b = importer.importCanonical(second, root);
      expect(a.inputHash).toBe(b.inputHash);
      expect(digest(first)).toBe(digest(second));
    } finally {
      first.close();
      second.close();
    }
  });

  // A stable ID is carried, never derived: the slug follows the ID and the ID
  // follows the file, so a renamed entity keeps its identity.
  it("keeps stable IDs and derives the slug from them", () => {
    const db = migrated();
    try {
      importer.importCanonical(db, fixture());
      expect(
        db.prepare("SELECT slug FROM entities WHERE id = 'training-method:mining'").get(),
      ).toEqual({ slug: "training-method-mining" });
      const path = join(scratch, "2026-01-02-rename.jsonl");
      writeFileSync(path, '{"op":"upsert","entity":"task:alpha","set":{"name":"Renamed"}}\n');
      patches.applyPatch(db, path, false);
      expect(
        db.prepare("SELECT id, slug, name FROM entities WHERE id = 'task:alpha'").get(),
      ).toEqual({
        id: "task:alpha",
        slug: "task-alpha",
        name: "Renamed",
      });
    } finally {
      db.close();
    }
  });
});

describe("patch identity and change tracking", () => {
  const patched = (): DatabaseSync => {
    const db = migrated();
    importer.importCanonical(db, fixture());
    return db;
  };

  it("records every changed entity against the patch that changed it", () => {
    const db = patched();
    try {
      const path = join(scratch, "2026-01-03-changes.jsonl");
      writeFileSync(
        path,
        [
          '{"op":"upsert","entity":"task:alpha","set":{"name":"Renamed"}}',
          '{"op":"link-region","entity":"training-method:mining","region":"karamja"}',
        ].join("\n"),
      );
      expect([...patches.applyPatch(db, path, false)].sort()).toEqual([
        "task:alpha",
        "training-method:mining",
      ]);
      expect(
        db.prepare("SELECT entity_id, operation, line FROM patch_changes ORDER BY entity_id").all(),
      ).toEqual([
        { entity_id: "task:alpha", operation: "upsert", line: 1 },
        { entity_id: "training-method:mining", operation: "link-region", line: 2 },
      ]);
    } finally {
      db.close();
    }
  });

  // The patch's identity is the hash of its bytes. Re-applying the same file is
  // a no-op; the same name over different bytes is an error, never a silent
  // second run.
  it("treats an applied patch as immutable", () => {
    const db = patched();
    try {
      const path = join(scratch, "2026-01-04-immutable.jsonl");
      writeFileSync(path, '{"op":"upsert","entity":"task:alpha","set":{"name":"First"}}\n');
      patches.applyPatch(db, path, false);
      expect(patches.applyPatch(db, path, true)).toEqual(new Set());
      expect(() => patches.applyPatch(db, path, false)).toThrow(/already applied/);
      writeFileSync(path, '{"op":"upsert","entity":"task:alpha","set":{"name":"Second"}}\n');
      expect(() => patches.applyPatch(db, path, true)).toThrow(/different content hash/);
      expect(db.prepare("SELECT name FROM entities WHERE id = 'task:alpha'").get()).toEqual({
        name: "First",
      });
    } finally {
      db.close();
    }
  });

  // A patch writes database columns. The record it came from is provenance and
  // stays exactly as the source document wrote it.
  it("leaves the provenance record untouched", () => {
    const db = patched();
    try {
      db.prepare(
        `INSERT INTO source_files(path, classification, content_hash, bytes, metadata_json)
         VALUES ('data/fixture.json', 'seed-content', 'hash', 1, '{}')`,
      ).run();
      db.prepare(
        `INSERT INTO source_records(source_file, record_path, stable_id, entity_id, record_hash, raw_json)
         VALUES ('data/fixture.json', '$.records[0]', 'task:alpha', 'task:alpha', 'hash', '{"name":"Alpha"}')`,
      ).run();
      const path = join(scratch, "2026-01-05-provenance.jsonl");
      writeFileSync(
        path,
        [
          '{"op":"upsert","entity":"task:alpha","set":{"name":"Renamed"}}',
          '{"op":"remove","entity":"training-method:mining","reason":"superseded"}',
        ].join("\n"),
      );
      patches.applyPatch(db, path, false);
      expect(
        db.prepare("SELECT raw_json FROM source_records WHERE entity_id = 'task:alpha'").get(),
      ).toEqual({ raw_json: '{"name":"Alpha"}' });
      expect(
        db.prepare("SELECT status FROM entities WHERE id = 'training-method:mining'").get(),
      ).toEqual({ status: "removed" });
    } finally {
      db.close();
    }
  });

  // Adjudicating an overlap means moving one record's facts onto another and
  // then retiring it. That is only expressible because requirements, effects and
  // tags have operations of their own; without them the facts would be lost.
  it("carries facts onto the survivor before retiring the duplicate", () => {
    const db = patched();
    try {
      const path = join(scratch, "2026-01-07-adjudicate.jsonl");
      writeFileSync(
        path,
        [
          '{"op":"add-requirement","entity":"task:alpha","description":"92 Attack to wield","skill":"Attack","level":92}',
          '{"op":"add-requirement","entity":"task:alpha","description":"Ancient Magicks spellbook"}',
          '{"op":"add-effect","entity":"task:alpha","description":"Bleed synergy with the spear DoT"}',
          '{"op":"add-tag","entity":"task:alpha","tag":"Ability Upgrade","label":"ability upgrade"}',
          '{"op":"remove","entity":"training-method:mining","reason":"Superseded by task:alpha."}',
        ].join("\n"),
      );
      expect([...patches.applyPatch(db, path, false)].sort()).toEqual([
        "task:alpha",
        "training-method:mining",
      ]);
      expect(
        db
          .prepare(
            "SELECT description, skill, level, ordinal FROM requirements WHERE entity_id = 'task:alpha' ORDER BY ordinal",
          )
          .all(),
      ).toEqual([
        { description: "92 Attack to wield", skill: "Attack", level: 92, ordinal: 0 },
        { description: "Ancient Magicks spellbook", skill: null, level: null, ordinal: 1 },
      ]);
      expect(
        db
          .prepare(
            "SELECT effect_key, description, ordinal FROM effects WHERE entity_id = 'task:alpha'",
          )
          .get(),
      ).toEqual({
        effect_key: "effect",
        description: "Bleed synergy with the spear DoT",
        ordinal: 0,
      });
      expect(
        db
          .prepare("SELECT tag_id FROM entity_tags WHERE entity_id = 'task:alpha' ORDER BY tag_id")
          .all(),
      ).toEqual([{ tag_id: "ability-upgrade" }, { tag_id: "combat" }]);
      expect(
        db.prepare("SELECT status FROM entities WHERE id = 'training-method:mining'").get(),
      ).toEqual({
        status: "removed",
      });
    } finally {
      db.close();
    }
  });

  // Replaying an adjudication must not stack duplicate rows, so the ordinal the
  // handler picks has to be idempotent against what is already there.
  it("does not duplicate a requirement, effect or tag it already carried", () => {
    const db = patched();
    try {
      const body = [
        '{"op":"add-requirement","entity":"task:alpha","description":"92 Attack to wield"}',
        '{"op":"add-effect","entity":"task:alpha","description":"Bleeds"}',
        '{"op":"add-tag","entity":"task:alpha","tag":"ability-upgrade"}',
      ].join("\n");
      for (const name of ["2026-01-08-first.jsonl", "2026-01-09-again.jsonl"]) {
        const path = join(scratch, name);
        writeFileSync(path, `${body}\n`);
        patches.applyPatch(db, path, false);
      }
      const count = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
      expect(count("SELECT count(*) c FROM requirements WHERE entity_id = 'task:alpha'")).toBe(1);
      expect(count("SELECT count(*) c FROM effects WHERE entity_id = 'task:alpha'")).toBe(1);
      expect(count("SELECT count(*) c FROM entity_tags WHERE entity_id = 'task:alpha'")).toBe(2);
    } finally {
      db.close();
    }
  });

  it("removes a requirement, effect and tag it was told to", () => {
    const db = patched();
    try {
      const path = join(scratch, "2026-01-10-strip.jsonl");
      writeFileSync(
        path,
        [
          '{"op":"add-requirement","entity":"task:alpha","description":"Wrong"}',
          '{"op":"remove-requirement","entity":"task:alpha","description":"Wrong"}',
          '{"op":"remove-tag","entity":"task:alpha","tag":"combat"}',
        ].join("\n"),
      );
      patches.applyPatch(db, path, false);
      expect(
        db.prepare("SELECT count(*) AS c FROM requirements WHERE entity_id = 'task:alpha'").get(),
      ).toEqual({ c: 0 });
      expect(
        db.prepare("SELECT count(*) AS c FROM entity_tags WHERE entity_id = 'task:alpha'").get(),
      ).toEqual({ c: 0 });
    } finally {
      db.close();
    }
  });

  it("refuses an invalid operation before it reaches the database", () => {
    const db = patched();
    try {
      for (const [body, message] of [
        ['{"op":"link-region","entity":"task:alpha","region":"Zeah"}', /unknown region/],
        ['{"op":"upsert","entity":"task:alpha","set":{"title":"A"}}', /unsupported set fields/],
        ['{"op":"remove","entity":"task:alpha"}', /requires reason/],
        [
          '{"op":"upsert-source","source":"source:x","set":{"url":"javascript:alert(1)","source_family":"x"}}',
          /HTTP or HTTPS/,
        ],
      ] as Array<[string, RegExp]>) {
        const path = join(scratch, `2026-01-06-${(fixtures += 1)}.jsonl`);
        writeFileSync(path, `${body}\n`);
        expect(() => patches.applyPatch(db, path, false), body).toThrow(message);
        expect(db.prepare("SELECT count(*) AS count FROM patch_ledger").get()).toEqual({
          count: 0,
        });
      }
      expect(db.prepare("SELECT name FROM entities WHERE id = 'task:alpha'").get()).toEqual({
        name: "Alpha",
      });
    } finally {
      db.close();
    }
  });
});

// A checkout with no build cache still has to produce the
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

  // Every patch in data/patches/ replays on a clean build, so the ledger is the
  // record of the whole tracked patch set rather than of one session.
  it("replays every tracked patch", () => {
    const db = new DatabaseSync(join(checkout, ".cache/equilibrium.sqlite"), { readOnly: true });
    try {
      expect(
        Number(
          (db.prepare("SELECT count(*) AS count FROM patch_ledger").get() as { count: number })
            .count,
        ),
      ).toBe(
        readdirSync(join(root, "data/patches")).filter((name) => name.endsWith(".jsonl")).length,
      );
      expect(
        Number(
          (db.prepare("SELECT count(*) AS count FROM patch_changes").get() as { count: number })
            .count,
        ),
      ).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });
});
