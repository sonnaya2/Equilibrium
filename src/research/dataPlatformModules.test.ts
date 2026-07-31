import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

// The data platform is plain ESM under scripts/ and has no type declarations,
// so it is loaded through a computed URL rather than a checked import.
const load = async <T>(module: string): Promise<T> =>
  (await import(
    /* @vite-ignore */ new URL(`../../scripts/data/${module}`, import.meta.url).href
  )) as T;

const utilities = await load<{
  stableJson: (value: unknown) => string;
  slugify: (value: unknown) => string;
  scalar: (value: unknown, fallback?: string) => string;
}>("utilities.mjs");

const normalize = await load<{
  normalizeRegion: (value: unknown) => string | null;
  regionLinks: (row: Record<string, unknown>) => Array<{ region: string; relation: string }>;
  entityCandidate: (
    file: string,
    record: { row: Record<string, unknown>; path: string; key: string },
  ) => { id: string; type: string; name: string } | null;
}>("normalize.mjs");

const research = await load<{
  rowMatchesRegion: (
    row: Record<string, unknown>,
    region: { id: string; name: string; aliases?: string[] },
  ) => boolean;
}>("research.mjs");

const patches = await load<{
  parsePatch: (path: string) => { operations: Array<{ line: number; operation: unknown }> };
}>("patches.mjs");

const queries = await load<{
  runReadOnlyQuery: (db: DatabaseSync, options: { sql: string; limit: number }) => unknown[];
}>("queries.mjs");

const legacy = await load<{
  entityOverlaps: (db: DatabaseSync) => {
    overlaps: Array<{ logicalRecord: string; files: string[]; entityIds: string[] }>;
    filePairs: Array<{ files: string; records: number }>;
  };
}>("legacy-inventory.mjs");

const scratch = mkdtempSync(join(tmpdir(), "equilibrium-patch-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const writePatch = (name: string, body: string) => {
  const path = join(scratch, name);
  writeFileSync(path, body);
  return path;
};

describe("deterministic serialisation", () => {
  it("orders keys so two equal values hash the same", () => {
    expect(utilities.stableJson({ b: 1, a: [3, { d: 4, c: 5 }] })).toBe(
      utilities.stableJson({ a: [3, { c: 5, d: 4 }], b: 1 }),
    );
    expect(utilities.stableJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("keeps slugs stable across punctuation and accents", () => {
    expect(utilities.slugify("Vorkath's Head")).toBe("vorkaths-head");
    expect(utilities.slugify("  ")).toBe("unnamed");
  });

  it("treats only scalars as scalar", () => {
    expect(utilities.scalar(12)).toBe("12");
    expect(utilities.scalar({ a: 1 }, "fallback")).toBe("fallback");
  });
});

describe("region taxonomy", () => {
  it("folds retired area names into the canonical region", () => {
    expect(normalize.normalizeRegion("Troll Country")).toBe("asgarnia");
    expect(normalize.normalizeRegion("The Wilderness")).toBe("forinthry");
    expect(normalize.normalizeRegion("Misthalin")).toBe("misthalin");
  });

  it("rejects anything outside the taxonomy instead of guessing", () => {
    expect(normalize.normalizeRegion("Zeah")).toBeNull();
    expect(normalize.normalizeRegion("")).toBeNull();
  });

  it("keeps one link per region and relation", () => {
    const links = normalize.regionLinks({
      primary_region: "karamja",
      requiredRegions: ["karamja", "Troll Country"],
      regions: ["karamja"],
    });
    expect(links).toEqual([
      { region: "karamja", relation: "primary", ordinal: 0 },
      { region: "karamja", relation: "required", ordinal: 0 },
      { region: "asgarnia", relation: "required", ordinal: 1 },
    ]);
  });
});

describe("stable entity identity", () => {
  it("derives an ID from scope and name when a record has none", () => {
    expect(
      normalize.entityCandidate("data/research/regional-skilling-unlocks.json", {
        row: { name: "Herby Werby", recordType: "activity", regionId: "kandarin" },
        path: "$.records[0]",
        key: "records",
      }),
    ).toEqual({ id: "activity:kandarin:herby-werby", type: "activity", name: "Herby Werby" });
  });

  it("keeps an authored ID untouched when it is already namespaced", () => {
    expect(
      normalize.entityCandidate("data/combat/equipment.json", {
        row: { id: "item:seismic-wand", name: "Seismic wand" },
        path: "$.records[0]",
        key: "records",
      })?.id,
    ).toBe("item:seismic-wand");
  });
});

describe("research region matching", () => {
  const kandarin = { id: "kandarin", name: "Kandarin", aliases: ["Ardougne"] };

  it("lets a hard requirement override the host region", () => {
    expect(
      research.rowMatchesRegion({ requiredRegions: ["kandarin"], region: "morytania" }, kandarin),
    ).toBe(true);
    expect(
      research.rowMatchesRegion({ requiredRegions: ["morytania"], region: "kandarin" }, kandarin),
    ).toBe(false);
  });

  it("does not read a domain prefix as a region", () => {
    expect(research.rowMatchesRegion({ id: "item:seismic-wand" }, kandarin)).toBe(false);
    expect(research.rowMatchesRegion({ id: "kandarin:seers-village" }, kandarin)).toBe(true);
  });

  it("shows unscoped and global records in every region", () => {
    expect(
      research.rowMatchesRegion({ region_requirement_type: "no_region_requirement" }, kandarin),
    ).toBe(true);
    expect(research.rowMatchesRegion({ region: "global" }, kandarin)).toBe(true);
  });
});

describe("patch parsing limits", () => {
  it("skips blank lines and comments", () => {
    const path = writePatch(
      "2026-01-01-comments.jsonl",
      ["# a note", "", '{"op":"remove","entity":"item:x","reason":"merged"}', ""].join("\n"),
    );
    const { operations } = patches.parsePatch(path);
    expect(operations).toHaveLength(1);
    expect(operations[0].line).toBe(3);
  });

  it("reports the failing line number on malformed JSON", () => {
    const path = writePatch("2026-01-01-broken.jsonl", '{"op":"remove"}\n{not json}\n');
    expect(() => patches.parsePatch(path)).toThrow(/2026-01-01-broken\.jsonl:2:/);
  });

  it("refuses a patch above the operation-count limit", () => {
    const line = '{"op":"remove","entity":"item:x","reason":"merged"}';
    const path = writePatch(
      "2026-01-01-huge.jsonl",
      `${Array.from({ length: 1001 }, () => line).join("\n")}\n`,
    );
    expect(() => patches.parsePatch(path)).toThrow(/1,000-operation safety limit/);
  });
});

describe("overlapping domains", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    `CREATE TABLE entities(id TEXT PRIMARY KEY, entity_type TEXT, name TEXT, created_source TEXT, status TEXT);
     INSERT INTO entities VALUES
       ('prayer:protect-item', 'prayer', 'Protect Item', 'data/combat/prayers.json', 'active'),
       ('prayer:standard-prayers:protect-item', 'prayer', 'Protect Item', 'data/reference/prayers.json', 'active'),
       ('prayer:piety', 'prayer', 'Piety', 'data/combat/prayers.json', 'active'),
       ('ability:protect-item', 'ability', 'Protect Item', 'data/combat/abilities.json', 'active'),
       ('equipment:bandos', 'equipment', 'Bandos', 'data/combat/equipment.json', 'active'),
       ('equipment:bandos-dup', 'equipment', 'bandos', 'data/reference/progression-unlocks.json', 'active'),
       ('spell:wind-rush', 'spell', 'Wind Rush', 'data/reference/spellbooks.json', 'active'),
       ('spell:wind-rush-dup', 'spell', 'Wind Rush', 'data/combat/abilities.json', 'removed');`,
  );
  afterAll(() => db.close());

  it("groups two files describing one record under different ids", () => {
    const { overlaps } = legacy.entityOverlaps(db);
    const prayer = overlaps.find(({ logicalRecord }) => logicalRecord === "prayer|protect item");
    expect(prayer?.files).toEqual(["data/combat/prayers.json", "data/reference/prayers.json"]);
    expect(prayer?.entityIds).toEqual([
      "prayer:protect-item",
      "prayer:standard-prayers:protect-item",
    ]);
  });

  it("matches on name case-insensitively but never across entity types", () => {
    const { overlaps } = legacy.entityOverlaps(db);
    expect(overlaps.map(({ logicalRecord }) => logicalRecord)).toEqual([
      "equipment|bandos",
      "prayer|protect item",
    ]);
  });

  it("ignores a name that appears once and counts each file pair", () => {
    const { filePairs } = legacy.entityOverlaps(db);
    expect(filePairs).toEqual([
      { files: "data/combat/equipment.json + data/reference/progression-unlocks.json", records: 1 },
      { files: "data/combat/prayers.json + data/reference/prayers.json", records: 1 },
    ]);
  });

  // Resolving an overlap means removing the superseded side, so a removed entity
  // has to stop counting or the gate could never ratchet down.
  it("stops counting an overlap once the superseded side is removed", () => {
    const { overlaps } = legacy.entityOverlaps(db);
    expect(overlaps.map(({ logicalRecord }) => logicalRecord)).not.toContain("spell|wind rush");
  });
});

describe("read-only query guard", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE probe(id TEXT PRIMARY KEY); INSERT INTO probe VALUES ('a'), ('b');");
  afterAll(() => db.close());

  it("runs a bounded SELECT", () => {
    expect(
      queries.runReadOnlyQuery(db, { sql: "SELECT id FROM probe ORDER BY id", limit: 1 }),
    ).toEqual([{ id: "a" }]);
  });

  it("blocks writes, DDL, PRAGMA and statement stacking", () => {
    for (const sql of [
      "DELETE FROM probe",
      "SELECT 1; DROP TABLE probe",
      "WITH x AS (SELECT 1) INSERT INTO probe VALUES ('c')",
      "PRAGMA table_info(probe)",
    ]) {
      expect(() => queries.runReadOnlyQuery(db, { sql, limit: 10 }), sql).toThrow();
    }
    expect(db.prepare("SELECT count(*) AS n FROM probe").get()).toEqual({ n: 2 });
  });
});
