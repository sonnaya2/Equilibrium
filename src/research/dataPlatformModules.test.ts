import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";
import { researchRowMatchesRegion } from "@/research/regionMatch";

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
  normalizeRegion: (value: unknown) => string | null;
}>("utilities.mjs");

// The matcher is TypeScript now: the server builds the panels with it, so it is
// imported directly rather than through the scripts/ loader.
const research = { rowMatchesRegion: researchRowMatchesRegion };

const parse = await load<{
  parsePatch: (path: string) => {
    body: string;
    operations: Array<{ line: number; operation: Record<string, unknown> }>;
  };
}>("patching/parse.mjs");

const validation = await load<{
  validateOperation: (operation: unknown, context: string) => Record<string, unknown>;
}>("patching/validate.mjs");

const dataValidation = await load<{
  futureVerificationRecords: (
    records: Array<{ source_file: string; record_path: string; raw_json: string }>,
    currentDate: string,
  ) => Array<Record<string, unknown>>;
}>("validate.mjs");

const queries = await load<{
  runReadOnlyQuery: (db: DatabaseSync, options: { sql: string; limit: number }) => unknown[];
  entityOverlaps: (db: DatabaseSync) => {
    overlaps: Array<{
      logicalRecord: string;
      files: string[];
      sharedRegions: string[];
      entityIds: string[];
    }>;
    filePairs: Array<{ files: string; records: number }>;
  };
}>("queries.mjs");

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
    expect(utilities.normalizeRegion("Troll Country")).toBe("asgarnia");
    expect(utilities.normalizeRegion("The Wilderness")).toBe("forinthry");
    expect(utilities.normalizeRegion("Misthalin")).toBe("misthalin");
  });

  it("rejects anything outside the taxonomy instead of guessing", () => {
    expect(utilities.normalizeRegion("Zeah")).toBeNull();
    expect(utilities.normalizeRegion("")).toBeNull();
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
    const { operations } = parse.parsePatch(path);
    expect(operations).toHaveLength(1);
    expect(operations[0].line).toBe(3);
  });

  it("reports the failing line number on malformed JSON", () => {
    const path = writePatch("2026-01-01-broken.jsonl", '{"op":"remove"}\n{not json}\n');
    expect(() => parse.parsePatch(path)).toThrow(/2026-01-01-broken\.jsonl:2:/);
  });

  it("refuses a patch above the operation-count limit", () => {
    const line = '{"op":"remove","entity":"item:x","reason":"merged"}';
    const path = writePatch(
      "2026-01-01-huge.jsonl",
      `${Array.from({ length: 1001 }, () => line).join("\n")}\n`,
    );
    expect(() => parse.parsePatch(path)).toThrow(/1,000-operation safety limit/);
  });

  // The content hash is the patch's identity, so parsing may not touch what it
  // read: a normalised URL written back onto the operation would mean the file
  // and the applied operation no longer say the same thing.
  it("returns the operations exactly as written", () => {
    const line =
      '{"op":"upsert-source","source":"source:x","set":{"url":"https://runescape.wiki/w/A"}}';
    const path = writePatch("2026-01-01-verbatim.jsonl", `${line}\n`);
    const { body, operations } = parse.parsePatch(path);
    expect(body).toBe(`${line}\n`);
    expect(operations[0].operation).toEqual(JSON.parse(line));
  });
});

describe("patch validation", () => {
  const validate = (operation: unknown) => validation.validateOperation(operation, "patch:1");

  it("returns a validated copy and never mutates the parsed operation", () => {
    const operation = {
      op: "upsert-source",
      source: "source:x",
      set: { url: "https://runescape.wiki/w/Seismic_wand" },
    };
    const snapshot = utilities.stableJson(operation);
    const validated = validate(operation);
    expect(utilities.stableJson(operation)).toBe(snapshot);
    expect(validated).not.toBe(operation);
    expect(Object.isFrozen(validated)).toBe(true);
  });

  it("applies declared defaults", () => {
    expect(validate({ op: "link-source", entity: "item:x", source: "source:y" })).toMatchObject({
      role: "verification",
      order: 0,
    });
    expect(validate({ op: "link-region", entity: "item:x", region: "karamja" })).toMatchObject({
      relation: "required",
      group: "",
    });
  });

  it("rejects an unknown operation and an unknown field", () => {
    expect(() => validate({ op: "merge", entity: "item:x" })).toThrow(/unsupported operation/);
    expect(() => validate({ op: "remove", entity: "item:x", reason: "r", extra: 1 })).toThrow(
      /unsupported fields for remove: extra/,
    );
  });

  it("names the missing required field", () => {
    expect(() => validate({ op: "remove", entity: "item:x" })).toThrow(/remove requires reason/);
    expect(() => validate({ op: "relate", entity: "item:x", target: "item:y" })).toThrow(
      /relate requires relation/,
    );
  });

  it("allows only canonical column names in a set", () => {
    expect(
      validate({ op: "upsert", entity: "item:x", set: { created_source: "patch:source.jsonl" } }),
    ).toMatchObject({ set: { created_source: "patch:source.jsonl" } });
    expect(() => validate({ op: "upsert", entity: "item:x", set: { title: "A" } })).toThrow(
      /unsupported set fields: title/,
    );
    expect(() => validate({ op: "upsert", entity: "item:x", set: { name: ["A"] } })).toThrow(
      /set.name must be a scalar/,
    );
    expect(() => validate({ op: "upsert", entity: "item:x", set: {} })).toThrow(
      /set cannot be empty/,
    );
  });

  it("normalizes a region and rejects one outside the taxonomy", () => {
    expect(
      validate({ op: "link-region", entity: "item:x", region: "Troll Country" }),
    ).toMatchObject({
      region: "asgarnia",
    });
    expect(() => validate({ op: "link-region", entity: "item:x", region: "Zeah" })).toThrow(
      /unknown region: Zeah/,
    );
    expect(() =>
      validate({ op: "link-region", entity: "item:x", region: "karamja", relation: "adjacent" }),
    ).toThrow(/invalid region relation/);
  });

  // A global link is global whatever relation the patch named.
  it("forces the global relation for the global region", () => {
    expect(
      validate({ op: "link-region", entity: "item:x", region: "global", relation: "primary" }),
    ).toMatchObject({ region: "global", relation: "global" });
  });

  // Requirements, effects and tags are the operations that let one record's
  // facts move onto another before the first is retired.
  it("shapes a requirement and bounds its level", () => {
    expect(
      validate({ op: "add-requirement", entity: "item:x", description: "92 Attack to wield" }),
    ).toMatchObject({ description: "92 Attack to wield", kind: "text", skill: null, level: null });
    expect(
      validate({
        op: "add-requirement",
        entity: "item:x",
        description: "92 Attack",
        skill: "Attack",
        level: 92,
      }),
    ).toMatchObject({ skill: "Attack", level: 92 });
    for (const level of [-1, 201, 1.5, "92"]) {
      expect(
        () => validate({ op: "add-requirement", entity: "item:x", description: "d", level }),
        String(level),
      ).toThrow(/level must be an integer between 0 and 200/);
    }
  });

  it("defaults an effect key and slugifies a tag", () => {
    expect(validate({ op: "add-effect", entity: "item:x", description: "Bleeds" })).toMatchObject({
      key: "effect",
      value: "",
    });
    expect(validate({ op: "add-tag", entity: "item:x", tag: "Ability Upgrade" })).toMatchObject({
      tag: "ability-upgrade",
      label: "ability-upgrade",
    });
    expect(
      validate({
        op: "add-tag",
        entity: "item:x",
        tag: "ability-upgrade",
        label: "ability upgrade",
      }),
    ).toMatchObject({ tag: "ability-upgrade", label: "ability upgrade" });
  });

  it("requires a description on a requirement and an effect", () => {
    expect(() => validate({ op: "add-requirement", entity: "item:x" })).toThrow(
      /add-requirement requires description/,
    );
    expect(() => validate({ op: "add-effect", entity: "item:x" })).toThrow(
      /add-effect requires description/,
    );
    expect(() => validate({ op: "add-tag", entity: "item:x" })).toThrow(/add-tag requires tag/);
  });

  it("requires a source URL to be HTTP or HTTPS", () => {
    expect(
      validate({
        op: "upsert-source",
        source: "source:x",
        set: { url: "https://runescape.wiki/w/A" },
      }),
    ).toMatchObject({ set: { url: "https://runescape.wiki/w/A" } });
    for (const url of ["javascript:alert(1)", "ftp://example.com/a", "not a url"]) {
      expect(
        () => validate({ op: "upsert-source", source: "source:x", set: { url } }),
        url,
      ).toThrow();
    }
  });

  it("rejects a negative or fractional order", () => {
    for (const order of [-1, 1.5, "2"]) {
      expect(() =>
        validate({ op: "link-source", entity: "item:x", source: "source:y", order }),
      ).toThrow(/non-negative integer/);
    }
  });
});

describe("verification dates", () => {
  it("rejects dates after the injected build date deterministically", () => {
    const records = [
      {
        surface: "entities",
        source_file: "data/combat/equipment.json",
        record_path: "$.records[1]",
        raw_json: JSON.stringify({
          verified_at: "2026-08-06",
          sources: [{ verifiedAt: "2026-08-05" }],
        }),
      },
      {
        surface: "sources",
        source_file: "source:wiki:item",
        record_path: "source:wiki:item",
        raw_json: JSON.stringify({ verified_at: "2026-08-06" }),
      },
      {
        surface: "provenance",
        source_file: "data/combat/equipment.json",
        record_path: "$.records[1]",
        raw_json: JSON.stringify({ source: { verifiedAt: "2026-08-06" } }),
      },
    ];
    expect(dataValidation.futureVerificationRecords(records, "2026-08-05")).toEqual([
      {
        surface: "entities",
        source_file: "data/combat/equipment.json",
        record_path: "$.records[1]",
        field: "$.verified_at",
        verifiedAt: "2026-08-06",
        currentDate: "2026-08-05",
      },
      {
        surface: "sources",
        source_file: "source:wiki:item",
        record_path: "source:wiki:item",
        field: "$.verified_at",
        verifiedAt: "2026-08-06",
        currentDate: "2026-08-05",
      },
      {
        surface: "provenance",
        source_file: "data/combat/equipment.json",
        record_path: "$.records[1]",
        field: "$.source.verifiedAt",
        verifiedAt: "2026-08-06",
        currentDate: "2026-08-05",
      },
    ]);
  });
});

describe("overlapping domains", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    `CREATE TABLE entities(id TEXT PRIMARY KEY, entity_type TEXT, name TEXT, created_source TEXT, status TEXT);
     CREATE TABLE entity_regions(entity_id TEXT, region_id TEXT, relation TEXT);
     CREATE TABLE research_skill_methods(skill_entity_id TEXT, method_entity_id TEXT, ordinal INTEGER);
     CREATE TABLE prayers(entity_id TEXT, book TEXT, level INTEGER);
     INSERT INTO entities VALUES
       ('prayer:protect-item', 'prayer', 'Protect Item', 'data/combat/prayers.json', 'active'),
       ('prayer:standard-prayers:protect-item', 'prayer', 'Protect Item', 'data/reference/prayers.json', 'active'),
       ('prayer:piety', 'prayer', 'Piety', 'data/combat/prayers.json', 'active'),
       ('ability:protect-item', 'ability', 'Protect Item', 'data/combat/abilities.json', 'active'),
       ('equipment:bandos', 'equipment', 'Bandos', 'data/combat/equipment.json', 'active'),
       ('equipment:bandos-dup', 'equipment', 'bandos', 'data/reference/progression-unlocks.json', 'active'),
       ('spell:wind-rush', 'spell', 'Wind Rush', 'data/reference/spellbooks.json', 'active'),
       ('spell:wind-rush-dup', 'spell', 'Wind Rush', 'data/combat/abilities.json', 'removed'),
       -- One document, one name, both landing on Misthalin: a visible duplicate.
       ('misthalin:explorers-ring', 'equipment', 'Explorer''s ring', 'data/reference/progression-unlocks.json', 'active'),
       ('misthalin:area-tasks-explorers-ring', 'equipment', 'Explorer''s ring', 'data/reference/progression-unlocks.json', 'active'),
       -- Same name in two prayer books: two prayers, not a duplicate.
       ('curse:dark-form', 'prayer', 'Dark Form', 'data/combat/prayers.json', 'active'),
       ('seren:dark-form', 'prayer', 'Dark Form', 'data/combat/prayers.json', 'active'),
       -- One method listed under each skill it trains: not a duplicate either.
       ('firemaking:curly-roots', 'training-method', 'Curly roots', 'data/research/catalog.json', 'active'),
       ('woodcutting:curly-roots', 'training-method', 'Curly roots', 'data/research/catalog.json', 'active');
     INSERT INTO entity_regions VALUES
       ('misthalin:explorers-ring', 'misthalin', 'hint'),
       ('misthalin:area-tasks-explorers-ring', 'misthalin', 'hint'),
       ('curse:dark-form', 'asgarnia', 'hint'),
       ('seren:dark-form', 'asgarnia', 'hint'),
       ('firemaking:curly-roots', 'karamja', 'hint'),
       ('woodcutting:curly-roots', 'karamja', 'hint');
     INSERT INTO prayers VALUES ('curse:dark-form', 'Ancient Curses', 95), ('seren:dark-form', 'Seren prayers', 95);
     INSERT INTO research_skill_methods VALUES
       ('skill:firemaking', 'firemaking:curly-roots', 0),
       ('skill:woodcutting', 'woodcutting:curly-roots', 0);`,
  );
  afterAll(() => db.close());

  it("groups two files describing one record under different ids", () => {
    const { overlaps } = queries.entityOverlaps(db);
    const prayer = overlaps.find(({ logicalRecord }) => logicalRecord === "prayer|protect item");
    expect(prayer?.files).toEqual(["data/combat/prayers.json", "data/reference/prayers.json"]);
    expect(prayer?.entityIds).toEqual([
      "prayer:protect-item",
      "prayer:standard-prayers:protect-item",
    ]);
  });

  it("matches on name case-insensitively but never across entity types", () => {
    const { overlaps } = queries.entityOverlaps(db);
    expect(overlaps.map(({ logicalRecord }) => logicalRecord)).toEqual([
      "equipment|bandos",
      "equipment|explorer's ring",
      "prayer|protect item",
    ]);
  });

  it("ignores a name that appears once and counts each file pair", () => {
    const { filePairs } = queries.entityOverlaps(db);
    expect(filePairs).toEqual([
      { files: "data/combat/equipment.json + data/reference/progression-unlocks.json", records: 1 },
      { files: "data/combat/prayers.json + data/reference/prayers.json", records: 1 },
    ]);
  });

  // One document can duplicate a record on its own. Nothing keyed on source files
  // sees it, so the region the two land on is what makes it visible.
  it("catches two records from one document sharing a region", () => {
    const { overlaps } = queries.entityOverlaps(db);
    const ring = overlaps.find(
      ({ logicalRecord }) => logicalRecord === "equipment|explorer's ring",
    );
    expect(ring?.files).toEqual(["data/reference/progression-unlocks.json"]);
    expect(ring?.sharedRegions).toEqual(["misthalin"]);
    expect(ring?.entityIds).toEqual([
      "misthalin:area-tasks-explorers-ring",
      "misthalin:explorers-ring",
    ]);
  });

  // Same name, deliberately kept apart. Merging either of these would lose data:
  // a whole prayer, or a skill's method listing.
  it("leaves records that a domain scope tells apart", () => {
    const { overlaps } = queries.entityOverlaps(db);
    const records = overlaps.map(({ logicalRecord }) => logicalRecord);
    expect(records).not.toContain("prayer|dark form");
    expect(records).not.toContain("training-method|curly roots");
  });

  // Resolving an overlap means removing the superseded side, so a removed entity
  // has to stop counting or the gate could never ratchet down.
  it("stops counting an overlap once the superseded side is removed", () => {
    const { overlaps } = queries.entityOverlaps(db);
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
