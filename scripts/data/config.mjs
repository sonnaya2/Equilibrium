import { join } from "node:path";

export const ROOT = process.cwd();
export const CACHE = join(ROOT, ".cache");
export const DATABASE = join(CACHE, "equilibrium.sqlite");
export const CHANGED = join(CACHE, "data-changed.json");
export const SEED = join(ROOT, "data/seed-v1.json.gz");
export const MIGRATIONS = join(ROOT, "data/migrations");
export const PATCHES = join(ROOT, "data/patches");
export const EXPORT_ROOT = join(ROOT, "public/data/v2");
export const REPORTS = join(ROOT, "reports");

export const SCHEMA_VERSION = 4;
export const EXPORT_VERSION = 2;
export const SHARD_TARGET_BYTES = 220 * 1024;
export const SHARD_LIMIT_BYTES = 500 * 1024;

// Seed-shaped documents for the TypeScript modules that import whole files
// through the `#shard/*` alias. They are build inputs, not browser payloads, so
// the shard size budget does not apply; `data:audit` is what fails if one of
// them becomes reachable from a client component.
export const DOCUMENTS_PREFIX = "documents";
export const DOCUMENT_SKIP = new Set(["data/research/catalog.json"]);

// Loaded by path rather than through a `#shard/*` import, so the import scan
// cannot see them.
export const DOCUMENT_EXTRA_CONSUMERS = [
  "map/region-seeds.json", // scripts/build-map-terrain.mjs
  "map/wiki-league-regions.json", // src/map/data/plates.test.ts
];
export const PATCH_LIMIT_BYTES = 1024 * 1024;
export const PATCH_LIMIT_OPERATIONS = 1000;
export const DEFAULT_MAX_BYTES = 16_000;
export const DEFAULT_LIMIT = 20;

// Generated rows carry a fixed timestamp so a rebuild is byte-identical.
export const FIXED_TIME = "1970-01-01T00:00:00.000Z";

export const REGION_IDS = [
  "misthalin",
  "havenhythe",
  "karamja",
  "asgarnia",
  "kandarin",
  "fremennik",
  "forinthry",
  "desert",
  "morytania",
  "tirannwn",
  "anachronia",
];
export const REGION_SET = new Set([...REGION_IDS, "global"]);

// Names the game or the Wiki still uses for areas this taxonomy folds elsewhere.
export const REGION_ALIASES = new Map([
  ["wilderness", "forinthry"],
  ["the wilderness", "forinthry"],
  ["troll country", "asgarnia"],
  ["troll-country", "asgarnia"],
]);

export const DOMAIN_TABLES = new Map([
  ["ability", "abilities"],
  ["activity", "activities"],
  ["equipment", "equipment"],
  ["invention-perk", "invention_perks"],
  ["prayer", "prayers"],
  ["quest", "quests"],
  ["spell", "spells"],
  ["task", "tasks"],
  ["training-method", "training_methods"],
  ["unlock", "unlocks"],
]);

export const TRANSFORMS = [
  {
    name: "seed-ingest",
    stage: "ingest",
    version: 1,
    inputs: ["data/seed-v1.json.gz"],
    outputs: ["source_files", "source_records"],
    dependencies: [],
    incremental: false,
    validation: "parseable JSON and stable file hashes",
  },
  {
    name: "relational-core",
    stage: "normalize",
    version: 1,
    inputs: ["source_records"],
    outputs: ["entities", "domain tables", "normalized relationships"],
    dependencies: ["seed-ingest"],
    incremental: false,
    validation: "constraints, taxonomy, and conflict quarantine",
  },
  {
    name: "search-index",
    stage: "enrich",
    version: 1,
    inputs: ["entities", "aliases"],
    outputs: ["entity_search"],
    dependencies: ["relational-core"],
    incremental: true,
    validation: "one search row per entity",
  },
  {
    name: "relational-validation",
    stage: "validate",
    version: 1,
    inputs: ["normalized database"],
    outputs: ["reports/data-validation.json"],
    dependencies: ["search-index"],
    incremental: true,
    validation: "foreign keys, IDs, sources, cycles, regions, counts",
  },
  {
    name: "frontend-shards",
    stage: "export",
    version: 1,
    inputs: ["validated database"],
    outputs: ["public/data/v2/**"],
    dependencies: ["relational-validation"],
    incremental: true,
    validation: "content hashes, size budgets, exact research parity",
  },
];

export const TRANSFORM_BY_NAME = new Map(TRANSFORMS.map((transform) => [transform.name, transform]));
