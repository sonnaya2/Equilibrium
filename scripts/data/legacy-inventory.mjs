// Stage 0: inventory and classify every research/game-data input before the
// canonical dataset is built.
//
// The thing to know before reading this: the research documents are not files.
// data/research/, data/combat/ and data/reference/ do not exist on disk - all 65
// documents live inside data/seed-v1.json.gz. A filesystem walk sees none of
// them, which is exactly how several generations of overlays, audits and
// snapshots survived unnoticed. So the inventory has two layers: the seed
// documents, and the tracked files that produce or consume them.
//
// Deliberately not a dependency-analysis framework. Consumers are found three
// ways and no more: the #shard alias, an explicit table of script readers, and
// the relational tables the importer already writes.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { gunzipSync } from "node:zlib";
import { EXPORT_VERSION, PATCHES, REPORTS, ROOT, SCHEMA_VERSION, SEED } from "./config.mjs";
import { openDatabase } from "./database.mjs";
import { atomicWrite, slash, stableJson } from "./utilities.mjs";

// Documents read by a script or the importer rather than through #shard. Every
// entry names the reader, so a stale line here is visible rather than silent.
const SCRIPT_READERS = new Map([
  ["data/research/catalog.json", ["scripts/data/ingest.mjs importResearchCatalog"]],
  ["data/league/regions.json", ["scripts/data/ingest.mjs seedRegions"]],
  ["data/map/region-seeds.json", ["scripts/data/ingest.mjs addMapPoints", "scripts/build-map-terrain.mjs"]],
  ["data/map/wiki-league-regions.json", ["src/map/data/plates.test.ts"]],
  ["data/research/regional-skilling-unlocks.json", ["scripts/data/research.mjs researchPanels"]],
  ["data/research/regional-combat-unlocks.json", ["scripts/data/research.mjs researchPanels"]],
  ["data/reference/progression-unlocks.json", ["scripts/data/research.mjs researchPanels"]],
  ["data/reference/progression-support-items-2026-07-25.json", ["scripts/data/research.mjs equipment_models"]],
  ["data/reference/progression-container-bags-2026-07-25.json", ["scripts/data/research.mjs equipment_models"]],
]);

// The one future editable owner of each domain. Two active-authoritative inputs
// claiming the same domain is the failure this table exists to make visible.
export const DOMAIN_OWNERS = [
  { domain: "regions and taxonomy", owner: "canonical regions.jsonl + entity-regions.jsonl", today: "data/league/regions.json" },
  { domain: "research catalog", owner: "canonical research/*.jsonl", today: "data/research/catalog.json" },
  { domain: "equipment", owner: "canonical domains/equipment.jsonl + equipment-stats.jsonl", today: "data/combat/equipment.json" },
  { domain: "abilities", owner: "canonical domains/abilities.jsonl", today: "data/combat/abilities.json" },
  { domain: "prayers", owner: "canonical domains/prayers.jsonl", today: "data/combat/prayers.json + data/reference/prayers.json" },
  { domain: "spells", owner: "canonical domains/spells.jsonl", today: "data/reference/spellbooks.json" },
  { domain: "invention perks", owner: "canonical domains/invention-perks.jsonl", today: "data/combat/perks.json" },
  { domain: "quests", owner: "canonical domains/quests.jsonl", today: "data/league/quests.json" },
  { domain: "tasks", owner: "canonical domains/tasks.jsonl", today: "data/league/catalyst-tasks-snapshot.json" },
  { domain: "training methods", owner: "canonical domains/training-methods.jsonl", today: "data/research/catalog.json" },
  { domain: "unlocks and activities", owner: "canonical domains/unlocks.jsonl + activities.jsonl", today: "data/reference/progression-unlocks.json" },
  { domain: "source provenance", owner: "canonical sources.jsonl + entity-sources.jsonl", today: "per-record source objects" },
  { domain: "map geometry", owner: "generated only (public/map/)", today: "data/map/region-seeds.json" },
  { domain: "frontend shards", owner: "generated only (public/data/v2/)", today: "generated" },
  { domain: "SQLite", owner: "generated only (.cache/)", today: "generated" },
];

const DOMAIN_OF = [
  // On-disk trees first. These never collide with the seed-document paths below,
  // which all live under data/research, data/combat, data/reference and friends.
  [/^data\/(seed-v1|migrations|patches|README)/, "snapshots"],
  [/^data\/canonical\//, "canonical dataset"],
  [/^public\/data\//, "generated frontend artifacts"],
  [/^reports\//, "audits and migration tools"],
  [/^assets\//, "sources and provenance"],
  [/^data\/research\/catalog\.json$/, "research catalog"],
  [/^data\/research\/regional-/, "regional skilling and combat unlocks"],
  [/^data\/reference\/progression-/, "regional skilling and combat unlocks"],
  [/^data\/research\/planner-expansions-archaeology/, "archaeology"],
  [/^data\/research\/planner-expansions-invention/, "invention"],
  [/^data\/research\/planner-expansions-slayer/, "slayer"],
  [/^data\/research\/planner/, "training methods"],
  [/^data\/combat\/(equipment|ability|perk)/, "equipment and combat"],
  [/^data\/combat\//, "equipment and combat"],
  [/^data\/reference\/(prayer|spellbook|combat-consumables|permanent-unlocks|midgame|changes)/, "equipment and combat"],
  [/^data\/league\/(quest)/, "quests and tasks"],
  [/^data\/league\/(task|catalyst)/, "quests and tasks"],
  [/^data\/league\/(region|equilibrium)/, "map and regions"],
  [/^data\/map\//, "map and regions"],
  [/^data\/league\//, "league rules"],
  [/^data\/research\/sources\.json$/, "sources and provenance"],
  [/^data\/research\//, "research catalog"],
  [/^data\/reference\//, "equipment and combat"],
];
const domainOf = (path) => DOMAIN_OF.find(([pattern]) => pattern.test(path))?.[1] ?? "unclassified";

// --- layer 2: files on disk -------------------------------------------------

// Which script writes each generated path, prefix-matched longest-first. A
// generated file no script claims is the interesting case - it means an
// artifact outlived its producer - so an unmatched path stays null rather than
// being attributed to something plausible.
const FILE_PRODUCERS = [
  ["reports/data-architecture-audit.md", "scripts/data/audit.mjs"],
  ["reports/data-file-inventory.json", "scripts/data/audit.mjs"],
  ["reports/data-migration-parity.json", "scripts/data/export.mjs"],
  ["reports/data-platform-benchmark.md", "scripts/data/benchmark.mjs"],
  // Written by a test rather than a script, which is why it looked producerless.
  ["reports/data-icon-audit.json", "src/lib/dataIconAudit.test.ts"],
  ["reports/data-quarantine.json", "scripts/data/validate.mjs"],
  ["reports/data-validation.json", "scripts/data/validate.mjs"],
  ["reports/seed-compaction.json", "scripts/data/compact-seed.mjs"],
  ["reports/canonical-", "scripts/data/canonical/validate.mjs"],
  ["reports/legacy-data-", "scripts/data/legacy-inventory.mjs"],
  ["reports/research-", "scripts/data/legacy-inventory.mjs"],
  ["data/canonical/", "scripts/data/canonical/export.mjs"],
  ["public/data/v2/", "scripts/data/export.mjs"],
  ["data/seed-v1.json.gz", "scripts/data/compact-seed.mjs"],
];
const producerOf = (path) =>
  [...FILE_PRODUCERS].sort((a, b) => b[0].length - a[0].length).find(([prefix]) => path.startsWith(prefix))?.[1] ?? null;

// Generated trees. data/canonical/ is generated *and* tracked on purpose - it is
// the reviewable form of the dataset - so "generated" and "tracked" are two
// independent facts here, not opposites.
const GENERATED_PREFIXES = ["public/data/", "reports/", "data/canonical/", ".cache/"];
const FILE_ROOTS = ["data", "scripts", "app/data", "src/research", "public/data", "assets", "e2e", "reports"];
// Data files only. The eight dispositions describe data, not the code that moves
// it, so scripts and components are inventoried as producers, readers and tests
// of these paths rather than being given a disposition of their own.
const FILE_EXTENSIONS = new Set([".json", ".jsonl", ".gz", ".sql", ".sqlite"]);

// The successor each on-disk input hands its job to after the cleanup. Only the
// inputs that actually retire have one; a file that is already its own future
// owner is left null rather than pointed at itself.
const FILE_SUCCESSORS = [
  ["data/seed-v1.json.gz", "data/canonical/ (retired after Stage 3)"],
  ["public/data/v2/", "regenerated only - never edited"],
  ["reports/", "regenerated only - never edited"],
];
const successorOf = (path) => FILE_SUCCESSORS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? null;

function schemaGeneration(path) {
  if (path.startsWith("data/canonical/")) return "canonical-v1";
  if (path.startsWith("public/data/v2/")) return `export-v${EXPORT_VERSION}`;
  if (path === "data/seed-v1.json.gz") return "seed-v1";
  if (path.startsWith("data/migrations/")) return `schema-v${SCHEMA_VERSION}`;
  if (path.startsWith(".cache/")) return `schema-v${SCHEMA_VERSION}`;
  return null;
}

function trackedFiles() {
  return new Set(
    execFileSync("git", ["ls-files", "--", ...FILE_ROOTS], { cwd: ROOT, encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean),
  );
}

// Sibling worktrees live under .claude/ and are separate checkouts, so a plain
// walk would inventory this repository several times over.
function walkRoot(directory, out = []) {
  if (!existsSync(directory)) return out;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".claude" || entry.name === "node_modules") continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) walkRoot(absolute, out);
    else if (FILE_EXTENSIONS.has(extname(entry.name).toLowerCase())) out.push(slash(relative(ROOT, absolute)));
  }
  return out;
}

// Readers of a path, found by literal mention in tracked source. Deliberately
// textual: these are files loaded by string path, so there is no import graph to
// follow, and a name that appears in a comment is a lead worth showing anyway.
function pathMentions(paths) {
  const mentions = new Map(paths.map((path) => [path, []]));
  const sources = execFileSync("git", ["ls-files", "--", "scripts", "src", "app", "e2e"], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter((file) => /\.(mjs|js|tsx?|json)$/.test(file));
  for (const file of sources) {
    const text = readFileSync(join(ROOT, file), "utf8");
    for (const path of paths) {
      if (path === file) continue;
      // Basename alone is too loose; the last two segments identify a file
      // without demanding the exact repo-relative prefix a script may build up.
      const tail = path.split("/").slice(-2).join("/");
      if (text.includes(path) || text.includes(tail)) mentions.get(path).push(file);
    }
  }
  return mentions;
}

function fileLayer() {
  const tracked = trackedFiles();
  const present = new Set(FILE_ROOTS.flatMap((root) => walkRoot(join(ROOT, root))));
  const paths = [...new Set([...tracked, ...present])].filter((path) => FILE_EXTENSIONS.has(extname(path).toLowerCase()));
  const mentions = pathMentions(paths);
  return paths.sort().map((path) => {
    const generated = GENERATED_PREFIXES.some((prefix) => path.startsWith(prefix));
    const readers = mentions.get(path) ?? [];
    const isTracked = tracked.has(path);
    return {
      path,
      layer: "file",
      domain: domainOf(path),
      format: extname(path).slice(1) || "none",
      bytes: existsSync(join(ROOT, path)) ? statSync(join(ROOT, path)).size : 0,
      tracked: isTracked,
      generated,
      producedBy: producerOf(path),
      // Rewritten in place on every run by whatever produces it; nothing else
      // edits a generated path, and the authored inputs are append-only.
      mutatedBy: generated && producerOf(path) ? [producerOf(path)] : [],
      readers: readers.filter((file) => !/\.(test|spec)\.[cm]?[jt]sx?$/.test(file) && !file.startsWith("e2e/")),
      tests: readers.filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.startsWith("e2e/")),
      reachesBrowser: path.startsWith("public/"),
      reachesSqlite: path === "data/seed-v1.json.gz" || path.startsWith("data/migrations/") || path.startsWith("data/patches/"),
      records: recordCount(path),
      schemaGeneration: schemaGeneration(path),
      // A generated artifact has no provenance of its own - it inherits the
      // provenance of whatever produced it.
      provenanceQuality: generated ? "derived" : "authored",
      successor: successorOf(path),
      uniqueInformation: !generated,
      disposition: generated ? "active-generated" : "active-authoritative",
    };
  });
}

// Cheap top-level record count. Binary and oversized inputs report null rather
// than being parsed: the seed's contents are already the other layer of this
// inventory, and nothing here needs a second pass over 4.5 MB.
function recordCount(path) {
  const absolute = join(ROOT, path);
  const extension = extname(path).toLowerCase();
  if (extension === ".gz" || extension === ".sqlite" || extension === ".sql" || !existsSync(absolute)) return null;
  if (extension === ".jsonl") return readFileSync(absolute, "utf8").split(/\r?\n/).filter(Boolean).length;
  try {
    const parsed = JSON.parse(readFileSync(absolute, "utf8"));
    if (Array.isArray(parsed)) return parsed.length;
    if (Array.isArray(parsed?.records)) return parsed.records.length;
    const arrays = Object.values(parsed ?? {}).filter(Array.isArray);
    return arrays.length ? arrays.reduce((sum, rows) => sum + rows.length, 0) : null;
  } catch {
    return null;
  }
}

const shardImports = () => {
  const out = new Map();
  const output = execFileSync("git", ["grep", "-hn", "-o", "#shard/[a-zA-Z0-9/_.-]*\\.json", "--", "app", "src"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  for (const match of output.split("\n").filter(Boolean)) {
    const file = `data/${match.slice(match.indexOf("#shard/") + "#shard/".length)}`;
    out.set(file, (out.get(file) ?? 0) + 1);
  }
  // Which modules import it, for the report.
  const withFiles = new Map();
  const detailed = execFileSync("git", ["grep", "-ln", "#shard/", "--", "app", "src"], { cwd: ROOT, encoding: "utf8" });
  for (const module of detailed.split("\n").filter(Boolean)) {
    for (const match of readFileSync(join(ROOT, module), "utf8").matchAll(/#shard\/([a-zA-Z0-9/_.-]+\.json)/g)) {
      const file = `data/${match[1]}`;
      withFiles.set(file, [...new Set([...(withFiles.get(file) ?? []), module])]);
    }
  }
  return withFiles;
};

function seedDocuments() {
  const seed = JSON.parse(gunzipSync(readFileSync(SEED)));
  return seed.files.map((entry) => ({ path: entry.path, data: entry.data }));
}

// A patch edits an entity, and an entity came from a document, so a patch is a
// mutator of whichever documents produced the entities it targets. This is the
// only writer a seed document has that is not the seed itself.
function patchMutators(db) {
  const out = new Map();
  if (!existsSync(PATCHES)) return out;
  const createdSource = db.prepare("SELECT created_source FROM entities WHERE id = ?");
  for (const name of readdirSync(PATCHES).filter((file) => file.endsWith(".jsonl")).sort()) {
    for (const line of readFileSync(join(PATCHES, name), "utf8").split(/\r?\n/).filter(Boolean)) {
      let operation;
      try {
        operation = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof operation.entity !== "string") continue;
      const path = createdSource.get(operation.entity)?.created_source;
      if (!path) continue;
      out.set(path, [...new Set([...(out.get(path) ?? []), `data/patches/${name}`])]);
    }
  }
  return out;
}

// Tests that name a seed document, through the #shard alias or by path. A
// document only a test reads is a different disposition from one nothing reads.
function documentTestReaders() {
  const out = new Map();
  const tests = execFileSync("git", ["ls-files", "--", "src", "app", "e2e"], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.startsWith("e2e/"));
  for (const file of tests) {
    const text = readFileSync(join(ROOT, file), "utf8");
    for (const match of text.matchAll(/#shard\/([a-zA-Z0-9/_.-]+\.json)|(data\/[a-z0-9/_.-]+\.json)/g)) {
      const path = match[1] ? `data/${match[1]}` : match[2];
      out.set(path, [...new Set([...(out.get(path) ?? []), file])]);
    }
  }
  return out;
}

function disposition(entry) {
  const consumed = entry.shardImporters.length > 0 || entry.scriptReaders.length > 0;
  if (!consumed && entry.entities === 0) return "orphaned";
  if (entry.entities > 0 && entry.shardImporters.length > 0) return "duplicate";
  if (entry.entities > 0) return "active-authoritative";
  if (entry.shardImporters.length > 0) return "active-raw-source";
  return "legacy-needed-for-migration";
}

export function legacyInventory() {
  const db = openDatabase();
  try {
    const shards = shardImports();
    const documents = seedDocuments();
    const stats = new Map(
      db
        .prepare(
          `SELECT source_file, count(*) AS records, sum(entity_id IS NOT NULL) AS mapped,
                  sum(stable_id IS NOT NULL) AS stable
           FROM source_records GROUP BY source_file`,
        )
        .all()
        .map((row) => [row.source_file, row]),
    );
    const entityCounts = new Map(
      db
        .prepare("SELECT created_source, count(*) AS n FROM entities GROUP BY created_source")
        .all()
        .map((row) => [row.created_source, Number(row.n)]),
    );
    const quarantined = new Map(
      db
        .prepare("SELECT source_file, count(*) AS n FROM quarantine GROUP BY source_file")
        .all()
        .map((row) => [row.source_file, Number(row.n)]),
    );
    const files = new Map(
      db.prepare("SELECT path, classification, bytes FROM source_files").all().map((row) => [row.path, row]),
    );
    // Provenance measured, not assumed: the share of a document's entities that
    // carry at least one citation. A document nothing cites is a document whose
    // values cannot be re-verified.
    const sourced = new Map(
      db
        .prepare(
          `SELECT e.created_source AS path, count(DISTINCT e.id) AS n
           FROM entities e JOIN entity_sources s ON s.entity_id = e.id GROUP BY e.created_source`,
        )
        .all()
        .map((row) => [row.path, Number(row.n)]),
    );
    const patchTargets = patchMutators(db);
    const testReaders = documentTestReaders();

    const inventory = documents.map((document) => {
      const path = document.path;
      const stat = stats.get(path) ?? {};
      const entry = {
        path,
        layer: "seed-document",
        domain: domainOf(path),
        format: "json",
        bytes: files.get(path)?.bytes ?? 0,
        records: Number(stat.records ?? 0),
        recordsMappedToEntities: Number(stat.mapped ?? 0),
        recordsWithStableId: Number(stat.stable ?? 0),
        entities: entityCounts.get(path) ?? 0,
        quarantined: quarantined.get(path) ?? 0,
        tracked: false,
        generated: false,
        containedIn: "data/seed-v1.json.gz",
        seedClassification: files.get(path)?.classification ?? "unknown",
        shardImporters: shards.get(path) ?? [],
        scriptReaders: SCRIPT_READERS.get(path) ?? [],
        tests: testReaders.get(path) ?? [],
        producedBy: "data/seed-v1.json.gz (immutable seed)",
        mutatedBy: patchTargets.get(path) ?? [],
        successor: "data/canonical/ (Stage 1+)",
        schemaGeneration: "seed-v1",
        reachesBrowser: (shards.get(path) ?? []).length > 0,
        reachesSqlite: (entityCounts.get(path) ?? 0) > 0 || Number(stat.records ?? 0) > 0,
      };
      const entities = entityCounts.get(path) ?? 0;
      const cited = sourced.get(path) ?? 0;
      entry.provenanceQuality =
        entities === 0 ? "not-applicable" : cited === 0 ? "uncited" : cited >= entities * 0.9 ? "cited" : "partial";
      entry.citedEntities = cited;
      entry.disposition = disposition(entry);
      entry.uniqueInformation = entry.disposition !== "orphaned";
      return entry;
    });

    return { inventory, db };
  } catch (error) {
    db.close();
    throw error;
  }
}

// --- conflicts, duplicates, orphans ----------------------------------------

// Two records are the same logical record when the importer resolved them to
// the same entity. Grouping on the raw `id` field instead looks tempting and is
// wrong: those IDs are unique only within a document, so `id: "ranged"` matches
// a revolution bar against the Ranged skill and invents a conflict.
//
// Unmapped records fall back to domain + normalized name, which is the loosest
// key that still cannot cross a domain boundary.
const normalizedName = (row) => {
  const name = [row.name, row.title, row.method, row.quest].find((value) => typeof value === "string" && value.trim());
  return name ? name.trim().toLocaleLowerCase("en") : null;
};

// A citation is not a record. Source objects carry a `title` that often repeats
// the name of the thing they cite, so without this an equipment record and its
// own sources[] entry group together and "disagree" about `url`.
const SOURCE_OBJECT_KEYS = new Set([
  "url", "title", "source", "publisher", "verifiedAt", "verified_at", "retrievedAt", "retrieved_at",
  "role", "content_hash", "publishedAt", "published_at", "note", "accessed", "revision",
]);
const isCitation = (row) => Object.keys(row).every((key) => SOURCE_OBJECT_KEYS.has(key));

function logicalGroups(db) {
  const groups = new Map();
  for (const row of db
    .prepare(
      `SELECT source_file, record_path, stable_id, entity_id, raw_json
       FROM source_records ORDER BY source_file, record_path`,
    )
    .all()) {
    const record = JSON.parse(row.raw_json);
    if (isCitation(record)) continue;
    const name = normalizedName(record);
    const key = row.entity_id
      ? `entity:${row.entity_id}`
      : name
        ? `${domainOf(row.source_file)}|name:${name}`
        : null;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...row, record });
  }
  return groups;
}

const SKIP_CONFLICT_FIELDS = new Set(["sources", "source", "source_urls", "sourceFile", "verifiedAt", "snapshotDate"]);

export function conflictReports(db) {
  const groups = logicalGroups(db);
  const conflicts = [];
  const duplicates = [];
  for (const [key, rows] of groups) {
    const acrossFiles = new Set(rows.map(({ source_file }) => source_file));
    if (rows.length < 2) continue;
    // A record nested inside another is not a second opinion about it.
    const nested = rows.some((row) =>
      rows.some((other) => other !== row && row.record_path.startsWith(`${other.record_path}.`)),
    );
    if (nested) continue;
    const bodies = new Set(rows.map(({ record }) => stableJson(record)));
    if (bodies.size === 1) {
      duplicates.push({
        logicalRecord: key,
        copies: rows.length,
        files: [...acrossFiles],
        paths: rows.map(({ source_file, record_path }) => `${source_file}#${record_path}`),
        identical: true,
      });
      continue;
    }
    // Records that disagree inside one document still matter: the importer kept
    // whichever it reached first and dropped the rest without saying so.
    // Which scalar fields actually disagree.
    const fields = new Map();
    for (const row of rows) {
      for (const [field, value] of Object.entries(row.record)) {
        if (SKIP_CONFLICT_FIELDS.has(field) || (value && typeof value === "object")) continue;
        if (!fields.has(field)) fields.set(field, new Map());
        fields.get(field).set(`${row.source_file}#${row.record_path}`, value);
      }
    }
    const differing = [...fields]
      .filter(([, values]) => new Set([...values.values()].map((value) => stableJson(value))).size > 1)
      .map(([field, values]) => ({ field, values: Object.fromEntries(values) }));
    if (!differing.length) continue;
    const entityId = rows.map(({ entity_id }) => entity_id).find(Boolean) ?? null;
    const current = entityId
      ? db.prepare("SELECT id, name, short_description, status, extra_json FROM entities WHERE id = ?").get(entityId)
      : null;
    // The importer keeps the first record it reaches and silently drops the
    // rest. Naming the winner is the point of the report.
    const winner =
      current && rows.find(({ record }) => stableJson(record) === current.extra_json);
    conflicts.push({
      logicalRecord: key,
      entityId,
      files: [...acrossFiles],
      contributingRecords: rows.map(({ source_file, record_path }) => `${source_file}#${record_path}`),
      differingFields: differing.slice(0, 12),
      currentSqliteValue: current
        ? { id: current.id, name: current.name, description: current.short_description, status: current.status }
        : null,
      valueInUse: winner ? `${winner.source_file}#${winner.record_path}` : null,
      droppedRecords: winner
        ? rows.filter((row) => row !== winner).map(({ source_file, record_path }) => `${source_file}#${record_path}`)
        : [],
      recommendedAuthority: recommendAuthority([...acrossFiles]),
      // A cross-file disagreement means two generations of research disagree,
      // which no rule can settle on its own.
      humanAdjudicationRequired: acrossFiles.size > 1,
    });
  }
  return { conflicts, duplicates };
}

// --- overlapping domains ----------------------------------------------------

// The conflict report groups records by the entity the importer resolved them
// to, which by construction cannot see two files that describe the same thing
// under *different* ids. That is the larger duplication: data/combat/prayers.json
// and data/reference/prayers.json hold the same 90 prayers, one keyed
// `prayer:protect-item` and the other `prayer:standard-prayers:protect-item`, so
// they never group and never appear as a conflict. Grouping on type + name
// instead is what makes two files claiming one domain visible.
// A removed entity is no longer a claim on the domain - resolving an overlap by
// removing the superseded side has to make the overlap stop counting, or the
// gate can never ratchet down.
export function entityOverlaps(db) {
  const groups = new Map();
  for (const row of db
    .prepare(
      `SELECT id, entity_type, name, created_source FROM entities
       WHERE name IS NOT NULL AND name <> '' AND status <> 'removed'`,
    )
    .all()) {
    const key = `${row.entity_type}|${row.name.trim().toLocaleLowerCase("en")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const overlaps = [];
  const pairs = new Map();
  for (const [key, rows] of groups) {
    const files = [...new Set(rows.map(({ created_source }) => created_source))].sort();
    if (files.length < 2) continue;
    const pair = files.join(" + ");
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
    overlaps.push({
      logicalRecord: key,
      entityType: rows[0].entity_type,
      name: rows[0].name,
      files,
      entityIds: rows.map(({ id }) => id).sort(),
      recommendedAuthority: recommendAuthority(files),
      // Same name, different ids, both live. Which one the app should show is a
      // content decision, never a mechanical one.
      humanAdjudicationRequired: true,
    });
  }
  return {
    overlaps: overlaps.sort((a, b) => (a.logicalRecord < b.logicalRecord ? -1 : 1)),
    filePairs: [...pairs]
      .map(([files, records]) => ({ files, records }))
      .sort((a, b) => b.records - a.records || a.files.localeCompare(b.files)),
  };
}

// --- Stage 1 adjudication ledger --------------------------------------------

// Why each unresolved overlap is still unresolved. Both reasons are refusals to
// guess, not missing work:
//
//   authority-vs-completeness - the authority order picks one file and the
//     richer record is in the other. Picking either silently overrides a rule
//     the project wrote down.
//   requirements-would-be-lost - the superseded record holds requirements or
//     effects the survivor lacks, and a patch can move sources and regions but
//     not those. Unioning them is what produced the blended entities this audit
//     exists to report, so it is not the fix.
const DEFERRAL_REASONS = new Map([
  ["data/reference/progression-unlocks.json + data/research/catalog.json", "authority-vs-completeness"],
  ["data/combat/equipment.json + data/reference/progression-unlocks.json", "requirements-would-be-lost"],
  ["data/research/catalog.json + data/research/regional-skilling-unlocks.json", "authority-vs-completeness"],
  ["data/combat/abilities.json + data/reference/progression-unlocks.json", "requirements-would-be-lost"],
  ["data/reference/progression-support-items-2026-07-25.json + data/reference/progression-unlocks.json", "no-consistent-winner"],
  ["data/combat/equipment.json + data/reference/progression-support-items-2026-07-25.json + data/reference/progression-unlocks.json", "requirements-would-be-lost"],
  ["data/combat/equipment.json + data/research/regional-combat-unlocks.json", "authority-vs-completeness"],
  ["data/reference/progression-container-bags-2026-07-25.json + data/reference/progression-unlocks.json", "requirements-would-be-lost"],
  ["data/reference/progression-unlocks.json + data/research/catalog.json + data/research/planner-expansions.json", "authority-vs-completeness"],
]);

// Resolved overlaps are recoverable from the database: a patch set status to
// 'removed' and patch_changes records which patch did it, so the ledger is
// derived rather than hand-maintained.
export function adjudicationLedger(db, overlaps) {
  const resolved = db
    .prepare(
      `SELECT e.id, e.name, e.entity_type, e.created_source, c.patch_id
       FROM entities e JOIN patch_changes c ON c.entity_id = e.id
       WHERE e.status = 'removed' AND c.operation = 'remove'
       ORDER BY e.id`,
    )
    .all();
  const byPatch = new Map();
  for (const row of resolved) byPatch.set(row.patch_id, (byPatch.get(row.patch_id) ?? 0) + 1);
  const deferred = overlaps.filePairs.map(({ files, records }) => ({
    files,
    records,
    reason: DEFERRAL_REASONS.get(files) ?? "unclassified",
    humanAdjudicationRequired: true,
  }));
  return {
    resolvedRecords: resolved.length,
    resolvedByPatch: [...byPatch].map(([patch, records]) => ({ patch, records })).sort((a, b) => b.records - a.records),
    deferredRecords: overlaps.overlaps.length,
    deferredPairs: deferred,
    deferredByReason: [...deferred.reduce((map, entry) => map.set(entry.reason, (map.get(entry.reason) ?? 0) + entry.records), new Map())]
      .map(([reason, records]) => ({ reason, records }))
      .sort((a, b) => b.records - a.records),
    resolved: resolved.map(({ id, name, entity_type, created_source, patch_id }) => ({
      entity: id,
      name,
      entityType: entity_type,
      supersededSource: created_source,
      patch: `data/patches/${patch_id}.jsonl`,
    })),
  };
}

// Repository authority order, applied to the file a record came from.
const AUTHORITY_ORDER = [
  [/^data\/league\//, "official League material (Jagex reveal documents)"],
  [/^data\/combat\//, "RuneScape Wiki general game data"],
  [/^data\/reference\//, "RuneScape Wiki general game data"],
  [/^data\/research\/catalog\.json$/, "project research catalog (specialized, verified)"],
  [/^data\/research\//, "project research overlay (lowest - snapshot or inference)"],
];
const recommendAuthority = (files) => {
  for (const [pattern, label] of AUTHORITY_ORDER) {
    const match = files.find((file) => pattern.test(file));
    if (match) return { file: match, basis: label };
  }
  return { file: files[0], basis: "unresolved" };
};

// --- report writing ---------------------------------------------------------

const DISPOSITIONS = [
  "active-authoritative",
  "active-raw-source",
  "active-generated",
  "legacy-needed-for-migration",
  "superseded",
  "duplicate",
  "orphaned",
  "unknown",
];

function auditMarkdown(inventory, files, conflicts, duplicates, overlaps, ledger) {
  const byDomain = new Map();
  for (const entry of inventory) {
    if (!byDomain.has(entry.domain)) byDomain.set(entry.domain, []);
    byDomain.get(entry.domain).push(entry);
  }
  const counts = Object.fromEntries(
    DISPOSITIONS.map((name) => [name, inventory.filter((entry) => entry.disposition === name).length]).filter(
      ([, count]) => count > 0,
    ),
  );
  const kib = (bytes) => `${(bytes / 1024).toFixed(0)} KiB`;
  const lines = [
    "# Legacy research and data audit",
    "",
    "Generated by `npm run data:legacy-inventory`. Stage 0 of the data-platform cleanup:",
    "classification only, plus deletions that are provably safe.",
    "",
    "The 65 research documents are **not files on disk**. `data/research/`, `data/combat/` and",
    "`data/reference/` exist only inside `data/seed-v1.json.gz`, so a filesystem walk finds none of",
    "them. That is how several generations of overlays, audits and snapshots survived unreviewed.",
    "",
    "## Disposition",
    "",
    "| Disposition | Documents | Bytes |",
    "| --- | ---: | ---: |",
    ...Object.entries(counts).map(([name, count]) => {
      const bytes = inventory.filter((entry) => entry.disposition === name).reduce((sum, e) => sum + e.bytes, 0);
      return `| ${name} | ${count} | ${kib(bytes)} |`;
    }),
    "",
    "`duplicate` means the records reach SQLite *and* the document is imported whole through",
    "`#shard`, so two live representations exist. It does not mean the document is worthless: it",
    "still carries fields the relational schema never modelled.",
    "",
    "## By domain",
    "",
  ];
  for (const [domain, entries] of [...byDomain].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${domain}`, "");
    lines.push("| Document | Bytes | Records | Entities | Disposition | Consumers |");
    lines.push("| --- | ---: | ---: | ---: | --- | --- |");
    for (const entry of [...entries].sort((a, b) => b.bytes - a.bytes)) {
      const consumers = [
        ...entry.shardImporters.map((module) => `\`${module}\``),
        ...entry.scriptReaders.map((reader) => `\`${reader}\``),
      ];
      lines.push(
        `| \`${entry.path}\` | ${kib(entry.bytes)} | ${entry.records} | ${entry.entities} | ${entry.disposition} | ${
          consumers.length ? consumers.slice(0, 3).join("<br>") : "**none**"
        } |`,
      );
    }
    lines.push("");
  }
  lines.push(
    "## Future owner per domain",
    "",
    "There must not be two active editable sources for one fact after the final cleanup.",
    "",
    "| Domain | Future canonical owner | Today |",
    "| --- | --- | --- |",
    ...DOMAIN_OWNERS.map(({ domain, owner, today }) => `| ${domain} | ${owner} | \`${today}\` |`),
    "",
    "## Files on disk",
    "",
    "The layer above is documents *inside* the seed. This one is the tracked and generated data files",
    "that carry them. Scripts and components are not listed here - they appear as the producers,",
    "readers and tests of these paths.",
    "",
    "| Disposition | Files | Bytes |",
    "| --- | ---: | ---: |",
    ...[...new Set(files.map((entry) => entry.disposition))].sort().map((name) => {
      const rows = files.filter((entry) => entry.disposition === name);
      return `| ${name} | ${rows.length} | ${kib(rows.reduce((sum, entry) => sum + entry.bytes, 0))} |`;
    }),
    "",
    `${files.filter((entry) => entry.generated && entry.tracked).length} generated files are tracked on purpose (\`data/canonical/\`);`,
    `${files.filter((entry) => entry.generated && !entry.producedBy).length} generated files have no identified producer.`,
    "",
    "## Two files claiming one domain",
    "",
    "Grouped by entity type and name rather than by id. The conflict report cannot see these: the two",
    "records resolve to *different* entity ids, so they never group, yet they describe the same thing",
    "and both are live.",
    "",
    `${ledger.resolvedRecords} have been resolved and ${overlaps.overlaps.length} remain`,
    "(`reports/research-overlaps.json`, `reports/research-adjudication.json`).",
    "",
    "| Files | Records | Still open because |",
    "| --- | ---: | --- |",
    ...ledger.deferredPairs.slice(0, 12).map(({ files: pair, records, reason }) => `| \`${pair}\` | ${records} | ${reason} |`),
    "",
    "| Resolved by | Records |",
    "| --- | ---: |",
    ...ledger.resolvedByPatch.map(({ patch, records }) => `| \`data/patches/${patch}.jsonl\` | ${records} |`),
    "",
    "## Queued for Stage 1 adjudication",
    "",
    `- ${conflicts.length} logical records disagree across files (\`reports/research-conflicts.json\`)`,
    `- ${conflicts.filter((c) => c.humanAdjudicationRequired).length} of them need a human decision`,
    `- ${duplicates.length} logical records are stored byte-identically more than once (\`reports/research-duplicates.json\`)`,
    `- ${overlaps.overlaps.length} logical records are split across two files under different ids (\`reports/research-overlaps.json\`)`,
    "",
  );
  return `${lines.join("\n")}\n`;
}

export function runLegacyInventory() {
  const { inventory, db } = legacyInventory();
  try {
    const { conflicts, duplicates } = conflictReports(db);
    const overlaps = entityOverlaps(db);
    const ledger = adjudicationLedger(db, overlaps);
    const files = fileLayer();
    const orphans = inventory.filter((entry) => entry.disposition === "orphaned");
    mkdirSync(REPORTS, { recursive: true });
    const write = (name, value) => atomicWrite(join(REPORTS, name), `${JSON.stringify(value, null, 2)}\n`);
    const all = [...inventory, ...files];
    write("legacy-data-inventory.json", {
      generatedFrom: "data/seed-v1.json.gz + .cache/equilibrium.sqlite + tracked files",
      documents: inventory.length,
      files: files.length,
      bytes: all.reduce((sum, entry) => sum + entry.bytes, 0),
      dispositionCounts: Object.fromEntries(
        DISPOSITIONS.map((name) => [name, all.filter((entry) => entry.disposition === name).length]),
      ),
      bytesByDisposition: Object.fromEntries(
        DISPOSITIONS.map((name) => [
          name,
          all.filter((entry) => entry.disposition === name).reduce((sum, entry) => sum + entry.bytes, 0),
        ]),
      ),
      domainOwners: DOMAIN_OWNERS,
      inventory: [...all].sort((a, b) => (a.path < b.path ? -1 : 1)),
    });
    write("research-conflicts.json", { conflicts: conflicts.length, records: conflicts });
    write("research-duplicates.json", { duplicates: duplicates.length, records: duplicates.slice(0, 500) });
    write("research-overlaps.json", {
      overlaps: overlaps.overlaps.length,
      note: "Same entity type and name in two source files under different entity ids. Invisible to research-conflicts.json, which groups by entity id.",
      filePairs: overlaps.filePairs,
      records: overlaps.overlaps,
    });
    write("research-adjudication.json", ledger);
    write("research-orphans.json", {
      orphans: orphans.length,
      bytes: orphans.reduce((sum, entry) => sum + entry.bytes, 0),
      note: "Inside the immutable seed. Removal needs a verified compaction migration, which is Stage 1+ work, not Stage 0.",
      records: orphans,
    });
    atomicWrite(join(REPORTS, "legacy-data-audit.md"), auditMarkdown(inventory, files, conflicts, duplicates, overlaps, ledger));
    return {
      documents: inventory.length,
      files: files.length,
      dispositionCounts: Object.fromEntries(
        DISPOSITIONS.map((name) => [name, all.filter((entry) => entry.disposition === name).length]).filter(
          ([, count]) => count > 0,
        ),
      ),
      orphaned: orphans.map(({ path, bytes }) => ({ path, bytes })),
      conflicts: conflicts.length,
      humanAdjudicationRequired: conflicts.filter((entry) => entry.humanAdjudicationRequired).length,
      duplicateRecords: duplicates.length,
      overlappingRecords: overlaps.overlaps.length,
      resolvedOverlaps: ledger.resolvedRecords,
      topOverlapPairs: overlaps.filePairs.slice(0, 3),
      reports: [
        "reports/legacy-data-inventory.json",
        "reports/legacy-data-audit.md",
        "reports/research-conflicts.json",
        "reports/research-duplicates.json",
        "reports/research-overlaps.json",
        "reports/research-adjudication.json",
        "reports/research-orphans.json",
      ],
    };
  } finally {
    db.close();
  }
}
