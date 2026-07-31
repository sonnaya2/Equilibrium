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
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { REPORTS, ROOT, SEED } from "./config.mjs";
import { openDatabase } from "./database.mjs";
import { atomicWrite, stableJson } from "./utilities.mjs";

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
        reachesBrowser: (shards.get(path) ?? []).length > 0,
        reachesSqlite: (entityCounts.get(path) ?? 0) > 0 || Number(stat.records ?? 0) > 0,
      };
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

function logicalGroups(db) {
  const groups = new Map();
  for (const row of db
    .prepare(
      `SELECT source_file, record_path, stable_id, entity_id, raw_json
       FROM source_records ORDER BY source_file, record_path`,
    )
    .all()) {
    const record = JSON.parse(row.raw_json);
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

function auditMarkdown(inventory, conflicts, duplicates) {
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
    "## Queued for Stage 1 adjudication",
    "",
    `- ${conflicts.length} logical records disagree across files (\`reports/research-conflicts.json\`)`,
    `- ${conflicts.filter((c) => c.humanAdjudicationRequired).length} of them need a human decision`,
    `- ${duplicates.length} logical records are stored byte-identically more than once (\`reports/research-duplicates.json\`)`,
    "",
  );
  return `${lines.join("\n")}\n`;
}

export function runLegacyInventory() {
  const { inventory, db } = legacyInventory();
  try {
    const { conflicts, duplicates } = conflictReports(db);
    const orphans = inventory.filter((entry) => entry.disposition === "orphaned");
    mkdirSync(REPORTS, { recursive: true });
    const write = (name, value) => atomicWrite(join(REPORTS, name), `${JSON.stringify(value, null, 2)}\n`);
    write("legacy-data-inventory.json", {
      generatedFrom: "data/seed-v1.json.gz + .cache/equilibrium.sqlite",
      documents: inventory.length,
      bytes: inventory.reduce((sum, entry) => sum + entry.bytes, 0),
      dispositionCounts: Object.fromEntries(
        DISPOSITIONS.map((name) => [name, inventory.filter((entry) => entry.disposition === name).length]),
      ),
      domainOwners: DOMAIN_OWNERS,
      inventory: [...inventory].sort((a, b) => (a.path < b.path ? -1 : 1)),
    });
    write("research-conflicts.json", { conflicts: conflicts.length, records: conflicts });
    write("research-duplicates.json", { duplicates: duplicates.length, records: duplicates.slice(0, 500) });
    write("research-orphans.json", {
      orphans: orphans.length,
      bytes: orphans.reduce((sum, entry) => sum + entry.bytes, 0),
      note: "Inside the immutable seed. Removal needs a verified compaction migration, which is Stage 1+ work, not Stage 0.",
      records: orphans,
    });
    atomicWrite(join(REPORTS, "legacy-data-audit.md"), auditMarkdown(inventory, conflicts, duplicates));
    return {
      documents: inventory.length,
      dispositionCounts: Object.fromEntries(
        DISPOSITIONS.map((name) => [name, inventory.filter((entry) => entry.disposition === name).length]).filter(
          ([, count]) => count > 0,
        ),
      ),
      orphaned: orphans.map(({ path, bytes }) => ({ path, bytes })),
      conflicts: conflicts.length,
      humanAdjudicationRequired: conflicts.filter((entry) => entry.humanAdjudicationRequired).length,
      duplicateRecords: duplicates.length,
      reports: [
        "reports/legacy-data-inventory.json",
        "reports/legacy-data-audit.md",
        "reports/research-conflicts.json",
        "reports/research-duplicates.json",
        "reports/research-orphans.json",
      ],
    };
  } finally {
    db.close();
  }
}
