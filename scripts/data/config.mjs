import { join, resolve } from "node:path";

export const ROOT = process.cwd();

// Everything a build writes moves together when EQUILIBRIUM_BUILD_ROOT is set,
// so a whole database can be built somewhere other than the working tree.
// Unset in every normal run.
const BUILD_ROOT = process.env.EQUILIBRIUM_BUILD_ROOT
  ? resolve(ROOT, process.env.EQUILIBRIUM_BUILD_ROOT)
  : null;

export const CACHE = BUILD_ROOT ? join(BUILD_ROOT, "cache") : join(ROOT, ".cache");
export const DATABASE = join(CACHE, "equilibrium.sqlite");
export const CHANGED = join(CACHE, "data-changed.json");
export const MIGRATIONS = join(ROOT, "data/migrations");
export const PATCHES = join(ROOT, "data/patches");
export const EXPORT_ROOT = BUILD_ROOT ? join(BUILD_ROOT, "data/v2") : join(ROOT, "public/data/v2");
export const REPORTS = BUILD_ROOT ? join(BUILD_ROOT, "reports") : join(ROOT, "reports");
export const DATA_CATALOG = BUILD_ROOT ? join(BUILD_ROOT, "data-catalog.md") : join(ROOT, "docs/data-catalog.md");

export const SCHEMA_VERSION = 5;
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
    name: "canonical-ingest",
    stage: "ingest",
    version: 2,
    inputs: ["data/canonical/**"],
    outputs: ["source_files", "source_documents", "source_records"],
    dependencies: [],
    incremental: false,
    validation: "declared canonical shapes, keys, references and ordering",
  },
  {
    name: "relational-core",
    stage: "ingest",
    version: 2,
    inputs: ["data/canonical/**"],
    outputs: ["entities", "domain tables", "links and relationships"],
    dependencies: ["canonical-ingest"],
    incremental: false,
    validation: "foreign keys and table constraints, in one transaction",
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
