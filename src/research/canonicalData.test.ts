import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

// The data platform is plain ESM under scripts/ and has no type declarations,
// so it is loaded through a computed URL rather than a checked import.
const load = async <T>(module: string): Promise<T> =>
  (await import(
    /* @vite-ignore */ new URL(`../../scripts/data/${module}`, import.meta.url).href
  )) as T;

type Row = Record<string, unknown>;

interface Collection {
  name: string;
  file: string;
  key: string[];
  fields: Record<string, string | [string, unknown]>;
  refs?: Record<string, string>;
  map: (row: Row, context: { entityRecordRef: Map<string, string> }) => Row;
}

const schema = await load<{
  COLLECTIONS: Collection[];
  COLLECTION_BY_NAME: Map<string, Collection>;
  recordRef: (file: string, path: string) => string;
}>("canonical/schema.mjs");

const canonicalExport = await load<{
  buildCanonical: (db: DatabaseSync) => {
    outputs: Map<string, string>;
    counts: Record<string, number>;
  };
  compact: (collection: Collection, record: Row) => Row;
  compareKeys: (a: unknown[], b: unknown[]) => number;
  keyOf: (collection: Collection, record: Row) => unknown[];
}>("canonical/export.mjs");

const canonicalValidate = await load<{
  validateCanonical: (root?: string) => {
    valid: boolean;
    counts: Record<string, number>;
    failures: Array<{ collection: string; detail: string; sample?: string }>;
    records: Map<string, Row[]>;
  };
  unmodelledFields: (records: Map<string, Row[]>) => {
    distinctKeys: number;
    modelledKeys: number;
    provenanceOnlyKeys: number;
    singletonKeys: number;
    fields: Array<{ key: string; records: number; example: string }>;
  };
}>("canonical/validate.mjs");

const { stableJson } = await load<{ stableJson: (value: unknown) => string }>("utilities.mjs");

const root = process.cwd();
const database = new DatabaseSync(join(root, ".cache/equilibrium.sqlite"), { readOnly: true });
afterAll(() => database.close());

const scratch = mkdtempSync(join(tmpdir(), "equilibrium-canonical-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

// Stage 1 will decide whether data/canonical/ becomes tracked. Until then the
// export is materialized into a temporary directory, so these tests exercise the
// real files without depending on a checked-in copy of them.
const canonicalRoot = join(scratch, "canonical");
for (const [file, body] of canonicalExport.buildCanonical(database).outputs) {
  const path = join(canonicalRoot, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

const shipped = canonicalValidate.validateCanonical(canonicalRoot);
const rows = (name: string): Row[] => shipped.records.get(name) ?? [];
const count = (sql: string) => Number((database.prepare(sql).get() as { count: number }).count);

// A minimal but structurally valid directory, so each rejection test changes
// exactly one thing and the failure it produces is unambiguous.
const VALID_FIXTURE: Record<string, string[]> = {
  "entities.jsonl": [
    '{"createdSource":"fixture","id":"task:alpha","name":"Alpha","sortKey":"alpha","type":"task","updatedSource":"fixture"}',
    '{"createdSource":"fixture","id":"task:beta","name":"Beta","sortKey":"beta","type":"task","updatedSource":"fixture"}',
  ],
  "tags.jsonl": ['{"id":"combat","name":"Combat"}'],
  "entity-tags.jsonl": ['{"entityId":"task:alpha","tagId":"combat"}'],
};

function fixture(name: string, overrides: Record<string, string[]> = {}): string {
  const directory = join(scratch, name);
  for (const [file, lines] of Object.entries({ ...VALID_FIXTURE, ...overrides })) {
    const path = join(directory, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, lines.length ? `${lines.join("\n")}\n` : "");
  }
  return directory;
}

const failuresOf = (directory: string) =>
  canonicalValidate.validateCanonical(directory).failures.map(({ detail }) => detail);

describe("canonical export", () => {
  it("writes a file for every declared collection", () => {
    const { outputs } = canonicalExport.buildCanonical(database);
    for (const collection of schema.COLLECTIONS) {
      const body = outputs.get(collection.file);
      expect(body, `${collection.file} was not generated`).toBeTruthy();
      expect(readFileSync(join(canonicalRoot, collection.file), "utf8")).toBe(body);
    }
  });

  it("is deterministic across runs", () => {
    const first = canonicalExport.buildCanonical(database).outputs;
    const second = canonicalExport.buildCanonical(database).outputs;
    expect([...second.keys()]).toEqual([...first.keys()]);
    for (const [path, body] of first) expect(second.get(path)).toBe(body);
  });

  it("sorts every collection by its primary key with no duplicates", () => {
    for (const collection of schema.COLLECTIONS) {
      const keys = rows(collection.name).map((record) => canonicalExport.keyOf(collection, record));
      expect(keys.length, `${collection.file} is empty`).toBeGreaterThan(0);
      for (let index = 1; index < keys.length; index += 1) {
        expect(
          canonicalExport.compareKeys(keys[index - 1], keys[index]),
          `${collection.file} is out of order at line ${index + 1}`,
        ).toBeLessThan(0);
      }
      expect(new Set(keys.map((key) => stableJson(key))).size).toBe(keys.length);
    }
  });

  it("validates the shipped files", () => {
    expect(shipped.failures).toEqual([]);
    expect(shipped.valid).toBe(true);
  });
});

describe("canonical validation", () => {
  it("accepts the fixture it is given", () => {
    expect(failuresOf(fixture("valid"))).toEqual([]);
  });

  it("rejects duplicate primary keys", () => {
    const directory = fixture("duplicate-key", {
      "entities.jsonl": [VALID_FIXTURE["entities.jsonl"][0], VALID_FIXTURE["entities.jsonl"][0]],
    });
    expect(failuresOf(directory)).toContain('duplicate primary key: ["task:alpha"]');
  });

  it("rejects broken references", () => {
    const directory = fixture("broken-reference", {
      "entity-tags.jsonl": ['{"entityId":"task:missing","tagId":"combat"}'],
    });
    expect(failuresOf(directory)).toContain("entityId references a missing entities record");
  });

  it("rejects undocumented fields", () => {
    const directory = fixture("unknown-field", {
      "tags.jsonl": ['{"colour":"red","id":"combat","name":"Combat"}'],
    });
    expect(failuresOf(directory)).toContain("undocumented field: colour");
  });

  it("rejects missing required fields, wrong types and spelled-out defaults", () => {
    expect(failuresOf(fixture("missing-field", { "tags.jsonl": ['{"id":"combat"}'] }))).toContain(
      "missing required field: name",
    );
    expect(
      failuresOf(fixture("wrong-type", { "tags.jsonl": ['{"id":"combat","name":7}'] })),
    ).toContain("name must be a string");
    expect(
      failuresOf(
        fixture("written-default", {
          "entity-tags.jsonl": [],
          "entities.jsonl": [
            '{"createdSource":"fixture","id":"task:alpha","name":"Alpha","sortKey":"alpha","status":"active","type":"task","updatedSource":"fixture"}',
          ],
        }),
      ),
    ).toContain("status equals its default and must be omitted");
  });

  it("rejects unsorted records and invalid JSON", () => {
    expect(
      failuresOf(
        fixture("unsorted", {
          "entities.jsonl": [...VALID_FIXTURE["entities.jsonl"]].reverse(),
          "entity-tags.jsonl": [],
        }),
      ),
    ).toContain("records are not sorted by primary key");
    expect(failuresOf(fixture("broken-json", { "tags.jsonl": ["{not json"] })).join(" ")).toMatch(
      /invalid JSON/,
    );
  });

  it("rejects region relations and IDs outside the taxonomy", () => {
    expect(
      failuresOf(
        fixture("bad-relation", {
          "regions.jsonl": ['{"id":"karamja","taxonomyOrder":2}'],
          "entity-regions.jsonl": [
            '{"entityId":"task:alpha","regionId":"karamja","relation":"nearby"}',
          ],
        }),
      ),
    ).toContain("unknown region relation");
    expect(
      failuresOf(
        fixture("bad-region", { "regions.jsonl": ['{"id":"atlantis","taxonomyOrder":0}'] }),
      ),
    ).toContain("region is outside the canonical taxonomy");
  });
});

describe("canonical round trip", () => {
  const domainTables: Array<[string, string]> = [
    ["equipment", "equipment"],
    ["equipment-stats", "equipment_stats"],
    ["abilities", "abilities"],
    ["prayers", "prayers"],
    ["spells", "spells"],
    ["invention-perks", "invention_perks"],
    ["activities", "activities"],
    ["unlocks", "unlocks"],
    ["tasks", "tasks"],
    ["quests", "quests"],
    ["training-methods", "training_methods"],
  ];

  it.each(domainTables)("preserves every %s row", (name, table) => {
    const collection = schema.COLLECTION_BY_NAME.get(name)!;
    const canonical = rows(name);
    expect(canonical.length).toBe(count(`SELECT count(*) AS count FROM ${table}`));
    const context = { entityRecordRef: new Map<string, string>() };
    const fromDatabase = (database.prepare(`SELECT * FROM ${table}`).all() as unknown as Row[])
      .map((row) => canonicalExport.compact(collection, collection.map(row, context)))
      .map((record) => stableJson(record))
      .sort();
    expect(canonical.map((record) => stableJson(record)).sort()).toEqual(fromDatabase);
  });

  it("resolves every entity body back to the database", () => {
    const provenance = new Map(
      rows("source-records").map((record) => [
        schema.recordRef(record.sourceFile as string, record.recordPath as string),
        record.record,
      ]),
    );
    const bodies = new Map(
      rows("entities").map((entity) => [
        entity.id as string,
        entity.recordRef != null
          ? provenance.get(entity.recordRef as string)
          : (entity.record ?? {}),
      ]),
    );
    const stored = database
      .prepare("SELECT id, extra_json FROM entities")
      .all() as unknown as Array<{
      id: string;
      extra_json: string;
    }>;
    expect(
      stored.filter((row) => stableJson(bodies.get(row.id)) !== row.extra_json).map(({ id }) => id),
    ).toEqual([]);
  });

  it("preserves names, statuses, descriptions and sort keys for every entity", () => {
    const canonical = new Map(rows("entities").map((entity) => [entity.id as string, entity]));
    const stored = database
      .prepare(
        "SELECT id, entity_type, name, status, short_description, detailed_description, sort_key, verified_at FROM entities",
      )
      .all() as unknown as Array<Record<string, string | null>>;
    const mismatched = stored.filter((row) => {
      const entity = canonical.get(row.id as string);
      return (
        !entity ||
        entity.type !== row.entity_type ||
        entity.name !== row.name ||
        (entity.status ?? "active") !== row.status ||
        (entity.shortDescription ?? "") !== row.short_description ||
        (entity.detailedDescription ?? "") !== row.detailed_description ||
        entity.sortKey !== row.sort_key ||
        (entity.verifiedAt ?? null) !== row.verified_at
      );
    });
    expect(mismatched.map(({ id }) => id)).toEqual([]);
  });

  it("keeps null distinct from the empty string", () => {
    const entities = rows("entities");
    // Both are omitted on disk, so the distinction lives in the schema's
    // declared defaults rather than in the bytes: null for verifiedAt, "" for
    // the descriptions. Neither may ever be written as the other.
    expect(entities.some((entity) => entity.verifiedAt === undefined)).toBe(true);
    expect(entities.every((entity) => entity.verifiedAt !== "")).toBe(true);
    expect(entities.every((entity) => entity.shortDescription !== null)).toBe(true);
    expect(
      count(
        "SELECT count(*) AS count FROM entities WHERE verified_at IS NULL AND short_description = ''",
      ),
    ).toBe(
      entities.filter(
        (entity) => entity.verifiedAt === undefined && entity.shortDescription === undefined,
      ).length,
    );
    expect(
      rows("sources").every((source) => source.pageTitle !== null && source.verifiedAt !== ""),
    ).toBe(true);
  });

  it("preserves Unicode and punctuation exactly", () => {
    const outsideAscii = (value: string) =>
      [...value].some((character) => character.codePointAt(0)! > 127);
    const nonAscii = rows("entities").filter((entity) =>
      outsideAscii(`${entity.name as string}${(entity.detailedDescription as string) ?? ""}`),
    );
    expect(nonAscii.length).toBeGreaterThan(0);
    const lookup = database.prepare("SELECT name, detailed_description FROM entities WHERE id = ?");
    for (const entity of nonAscii.slice(0, 100)) {
      const row = lookup.get(entity.id as string) as { name: string; detailed_description: string };
      expect(row.name).toBe(entity.name);
      expect(row.detailed_description).toBe((entity.detailedDescription as string) ?? "");
    }
    // Apostrophes, quotes and slashes survive the JSONL round trip too.
    expect(rows("entities").some((entity) => /['"\\/]/.test(entity.name as string))).toBe(true);
  });

  it("keeps ordered relationships contiguous and in order", () => {
    const ordered: Array<[string, string[]]> = [
      ["research-region-entries", ["regionId", "section"]],
      ["research-region-skills", ["regionId"]],
      ["research-region-training", ["regionId"]],
      ["research-skill-methods", ["skillEntityId"]],
    ];
    for (const [name, groupBy] of ordered) {
      const groups = new Map<string, number[]>();
      for (const record of rows(name)) {
        const key = groupBy.map((field) => record[field] as string).join("|");
        groups.set(key, [...(groups.get(key) ?? []), record.ordinal as number]);
      }
      expect(groups.size).toBeGreaterThan(0);
      for (const [key, ordinals] of groups) {
        expect(ordinals, `${name} ${key} is not 0..n-1 in order`).toEqual(
          ordinals.map((_, index) => index),
        );
      }
    }
  });

  it("reports unmodelled record keys instead of discarding them", () => {
    const report = canonicalValidate.unmodelledFields(shipped.records);
    expect(report.modelledKeys + report.provenanceOnlyKeys).toBe(report.distinctKeys);
    expect(report.fields.length).toBe(report.provenanceOnlyKeys);
    // Sorted by frequency so the columns worth promoting sit at the top.
    for (let index = 1; index < report.fields.length; index += 1) {
      expect(report.fields[index - 1].records).toBeGreaterThanOrEqual(report.fields[index].records);
    }
    // A reported key has to be findable: the example must resolve to a record
    // that really carries it.
    const provenance = new Map(
      rows("source-records").map((record) => [
        schema.recordRef(record.sourceFile as string, record.recordPath as string),
        record.record as Record<string, unknown>,
      ]),
    );
    for (const field of report.fields.slice(0, 25)) {
      expect(
        Object.hasOwn(provenance.get(field.example)!, field.key),
        `${field.key} is not on ${field.example}`,
      ).toBe(true);
    }
    // Nothing the normalizer consumes may be listed as unmodelled.
    const listed = new Set(report.fields.map(({ key }) => key));
    for (const key of ["name", "id", "requirements", "tier", "points", "url"])
      expect(listed.has(key)).toBe(false);
  });

  it("preserves the quarantine and its meaning", () => {
    const quarantine = rows("quarantine");
    const stored = database
      .prepare("SELECT source_file, record_path, error FROM quarantine")
      .all() as unknown as Array<Record<string, string>>;
    expect(quarantine.length).toBe(stored.length);
    const keyed = new Set(
      quarantine.map(
        (record) =>
          `${record.sourceFile as string}|${record.recordPath as string}|${record.error as string}`,
      ),
    );
    for (const row of stored)
      expect(keyed.has(`${row.source_file}|${row.record_path}|${row.error}`)).toBe(true);
    expect(quarantine.every((record) => typeof record.suggestedResolution === "string")).toBe(true);
  });
});
