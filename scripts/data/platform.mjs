// CLI entry point for the generated data platform. Every command is wired to an
// npm script in package.json; the work lives in the sibling modules.
import { mkdirSync } from "node:fs";
import { relative } from "node:path";
import { CACHE, DATABASE, DEFAULT_LIMIT, DEFAULT_MAX_BYTES, ROOT, TRANSFORMS } from "./config.mjs";
import { migrate, openDatabase } from "./database.mjs";
import { buildOutputs, compareOutputs, exportData, gitDataStatus } from "./export.mjs";
import { applyOne, rebuild } from "./pipeline.mjs";
import { benchmark } from "./benchmark.mjs";
import { doctor, entityContext, findEntities, formatContextMarkdown, runReadOnlyQuery, stats } from "./queries.mjs";
import { validate } from "./validate.mjs";
import { boundedPrint, scalar, slash } from "./utilities.mjs";

function getArg(name, fallback = null) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const hasArg = (name) => process.argv.includes(`--${name}`);
const boundedArg = (name, fallback, max) => Math.min(Number(getArg(name, fallback)) || fallback, max);

function requiredArg(name) {
  const value = scalar(getArg(name)).trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

const withDatabase = (run) => {
  const db = openDatabase();
  try {
    return run(db);
  } finally {
    db.close();
  }
};

function entityCommand(db, name) {
  const id = requiredArg("id");
  const context = entityContext(db, id, boundedArg("max-related", 30, 100));
  if (name === "show") {
    return {
      entity: context.entity,
      regions: context.regions,
      requirements: context.requirements,
      effects: context.effects,
      sources: context.sources,
    };
  }
  if (name === "related") return context.related;
  if (name === "sources") return context.sources;
  if (name === "impact") {
    return {
      entity: { id, type: context.entity.entity_type, name: context.entity.name },
      relationships: context.related,
      regions: context.regions.map(({ region_id }) => `/data/v2/regions/${region_id}.json`),
      domain: context.entity.entity_type,
      frontendShard: buildOutputs(db).idMap[id] ?? null,
      sources: context.sources.map(({ id: sourceId }) => sourceId),
      responsibility: context.responsibility,
      validation: ["foreign keys", "source URLs", "region taxonomy", "search index", "seed parity"],
    };
  }
  return getArg("format", "json") === "markdown" ? formatContextMarkdown(context) : context;
}

const COMMANDS = new Map([
  ["rebuild", () => rebuild(false)],
  ["import", () => rebuild(false)],
  ["benchmark", () => benchmark()],
  [
    "migrate",
    () => {
      mkdirSync(CACHE, { recursive: true });
      const db = openDatabase(DATABASE, false);
      try {
        return { migrations: migrate(db), database: slash(relative(ROOT, DATABASE)) };
      } finally {
        db.close();
      }
    },
  ],
  [
    "apply",
    () => {
      const path = process.argv.find((arg, index) => index > 2 && !arg.startsWith("--"));
      if (!path) throw new Error("Patch path is required");
      return applyOne(path);
    },
  ],
  ["stats", () => withDatabase(stats)],
  [
    "find",
    () =>
      withDatabase((db) =>
        findEntities(db, { query: requiredArg("query"), limit: boundedArg("limit", DEFAULT_LIMIT, 100) }),
      ),
  ],
  ["show", () => withDatabase((db) => entityCommand(db, "show"))],
  ["context", () => withDatabase((db) => entityCommand(db, "context"))],
  ["related", () => withDatabase((db) => entityCommand(db, "related"))],
  ["sources", () => withDatabase((db) => entityCommand(db, "sources"))],
  ["impact", () => withDatabase((db) => entityCommand(db, "impact"))],
  [
    "query",
    () => withDatabase((db) => runReadOnlyQuery(db, { sql: requiredArg("sql"), limit: boundedArg("limit", 100, 1000) })),
  ],
  ["validate", () => withDatabase((db) => validate(db, hasArg("changed")))],
  ["export", () => withDatabase((db) => exportData(db))],
  ["diff", () => withDatabase((db) => ({ generated: compareOutputs(buildOutputs(db).outputs), git: gitDataStatus() }))],
  ["doctor", () => withDatabase(doctor)],
  ["transforms", () => TRANSFORMS],
]);

const name = process.argv[2] ?? "help";
try {
  const run = COMMANDS.get(name);
  if (!run) throw new Error(`Unknown data command: ${name}`);
  boundedPrint(run(), Math.max(1000, Number(getArg("max-bytes", DEFAULT_MAX_BYTES)) || DEFAULT_MAX_BYTES));
} catch (error) {
  console.error(`data:${name}: ${error.message}`);
  process.exitCode = 1;
}
