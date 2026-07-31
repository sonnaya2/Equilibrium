import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const REPORTS = join(ROOT, "reports");
const INVENTORY_PATH = join(REPORTS, "data-file-inventory.json");
const REPORT_PATH = join(REPORTS, "data-architecture-audit.md");
const EXTENSIONS = new Set([
  ".json",
  ".jsonl",
  ".csv",
  ".yaml",
  ".yml",
  ".sqlite",
  ".db",
  ".gz",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
]);
const EXCLUDED = new Set([
  ".git",
  // Sibling git worktrees are separate checkouts, not part of this inventory.
  ".claude",
  ".next",
  "node_modules",
  "build",
  "dist",
  "out",
  "coverage",
  "playwright-report",
  "test-results",
  ".cache",
]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const DATA_EXTENSIONS = new Set([".json", ".jsonl", ".csv", ".yaml", ".yml", ".sqlite", ".db", ".gz"]);

const slash = (value) => value.replaceAll("\\", "/");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

function walk(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(absolute);
  }
  return files;
}

function classify(file) {
  if (file.startsWith("scraped-data/")) return "raw-source-evidence";
  if (file === "data/seed-v1.json.gz") return "consolidated-seed";
  if (file.startsWith("public/data/")) return "generated-frontend-data";
  if (file.startsWith("public/map/")) return "generated-map-data";
  if (/^(assets\/.*manifest|data\/combat\/.*-icons\.json)/.test(file)) return "asset-metadata";
  if (/\/(archive|history)\//i.test(file) || /(^|[-_.])(obsolete|legacy|disabled)([-_.]|$)/i.test(file)) {
    return "historical-or-obsolete";
  }
  if (file.startsWith("data/canonical/")) return "generated-canonical-data";
  if (file.startsWith("data/")) {
    if (/\/(planner-expansions|regional-|reference-site-harvest|equipment-region-index|region-combos|.*review)/.test(file)) {
      return "temporary-overlay";
    }
    return "canonical-editable-content";
  }
  if (file.startsWith("scripts/")) return "pipeline-or-tooling";
  if (file.startsWith("reports/")) return "generated-report";
  if (file.startsWith("src/") || file.startsWith("app/")) return "application-source";
  return "project-metadata";
}

function topLevelCount(parsed) {
  if (Array.isArray(parsed)) return parsed.length;
  if (!parsed || typeof parsed !== "object") return null;
  if (Array.isArray(parsed.records)) return parsed.records.length;
  const arrays = Object.values(parsed).filter(Array.isArray);
  return arrays.length ? arrays.reduce((sum, rows) => sum + rows.length, 0) : Object.keys(parsed).length;
}

function jsonInfo(file, text) {
  const extension = extname(file).toLowerCase();
  if (extension === ".jsonl") {
    const lines = text.split(/\r?\n/).filter(Boolean);
    let valid = 0;
    for (const line of lines) {
      try {
        JSON.parse(line);
        valid += 1;
      } catch {
        break;
      }
    }
    return { topLevelRecords: lines.length, parseable: valid === lines.length };
  }
  if (extension !== ".json") return { topLevelRecords: null, parseable: null };
  try {
    const parsed = JSON.parse(text);
    return { parsed, topLevelRecords: topLevelCount(parsed), parseable: true };
  } catch (error) {
    return { topLevelRecords: null, parseable: false, parseError: error.message };
  }
}

function inspectValues(value, file, path, collections) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      inspectValues(value[index], file, `${path}[${index}]`, collections);
    }
    return;
  }
  if (!value || typeof value !== "object") return;

  if (typeof value.id === "string" && value.id) {
    const record = { file, path, hash: sha256(stableJson(value)) };
    const rows = collections.ids.get(value.id) ?? [];
    rows.push(record);
    collections.ids.set(value.id, rows);
    const duplicates = collections.recordHashes.get(record.hash) ?? [];
    duplicates.push({ file, path, id: value.id });
    collections.recordHashes.set(record.hash, duplicates);
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if ((key === "url" || key === "source_url") && typeof child === "string") {
      const uses = collections.urls.get(child) ?? [];
      uses.push({ file, path: childPath });
      collections.urls.set(child, uses);
    } else if (key === "source_urls" && Array.isArray(child)) {
      child.forEach((url, index) => {
        if (typeof url !== "string") return;
        const uses = collections.urls.get(url) ?? [];
        uses.push({ file, path: `${childPath}[${index}]` });
        collections.urls.set(url, uses);
      });
    }
    inspectValues(child, file, childPath, collections);
  }
}

function referencedPath(sourceFile, literal) {
  if (literal.startsWith("#shard/")) return `public/data/v2/documents/${literal.slice(7)}`;
  if (/^(data|public|assets|reports|scraped-data)\//.test(literal)) return slash(literal);
  if (!literal.startsWith(".")) return null;
  const absolute = resolve(ROOT, dirname(sourceFile), literal);
  const rel = slash(relative(ROOT, absolute));
  return rel.startsWith("../") ? null : rel;
}

function sourceReferences(file, text) {
  const refs = new Set();
  const pattern = /["'`]([^"'`\n]+\.(?:jsonl?|csv|ya?ml|sqlite|db))["'`]/gi;
  for (const match of text.matchAll(pattern)) {
    const path = referencedPath(file, slash(match[1]));
    if (path) refs.add(path);
  }
  return [...refs].sort();
}

const absoluteFiles = walk(ROOT)
  .filter((absolute) => {
    const file = slash(relative(ROOT, absolute));
    return file !== "reports/data-file-inventory.json" && file !== "reports/data-architecture-audit.md";
  })
  .sort((a, b) => slash(relative(ROOT, a)).localeCompare(slash(relative(ROOT, b))));
const collections = { ids: new Map(), urls: new Map(), recordHashes: new Map() };
const inventory = [];
const sources = [];

for (const absolute of absoluteFiles) {
  const file = slash(relative(ROOT, absolute));
  const extension = extname(file).toLowerCase();
  const stat = statSync(absolute);
  const binary = extension === ".sqlite" || extension === ".db" || extension === ".gz";
  const text = binary ? null : readFileSync(absolute, "utf8");
  const info = text == null ? {} : jsonInfo(file, text);
  const entry = {
    file,
    classification: classify(file),
    bytes: stat.size,
    lines: text == null ? null : text.split(/\r?\n/).length,
    topLevelRecords: info.topLevelRecords ?? null,
    parseable: info.parseable ?? null,
    sha256: sha256(binary ? readFileSync(absolute) : text),
    readers: [],
    writers: [],
    clientImports: [],
  };
  if (info.parseError) entry.parseError = info.parseError;
  inventory.push(entry);
  if (
    info.parsed &&
    DATA_EXTENSIONS.has(extension) &&
    !file.startsWith("public/data/") &&
    !file.startsWith("reports/")
  ) {
    inspectValues(info.parsed, file, "$", collections);
  }
  if (text != null && SOURCE_EXTENSIONS.has(extension)) sources.push({ file, text, refs: sourceReferences(file, text) });
}

const byFile = new Map(inventory.map((entry) => [entry.file, entry]));
const sourceFiles = new Set(sources.map(({ file }) => file));
const resolveSourceImport = (sourceFile, literal) => {
  let base;
  if (literal.startsWith("@/")) base = `src/${literal.slice(2)}`;
  else if (literal.startsWith(".")) {
    base = slash(relative(ROOT, resolve(ROOT, dirname(sourceFile), literal)));
  } else return null;
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.mjs`,
  ].find((candidate) => sourceFiles.has(candidate));
};
const dependencies = new Map(
  sources.map(({ file, text }) => [
    file,
    [...text.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/g)]
      .map((match) => resolveSourceImport(file, match[1]))
      .filter(Boolean),
  ]),
);
const clientReach = new Set(
  sources.filter(({ text }) => /^\s*["']use client["'];/m.test(text)).map(({ file }) => file),
);
const clientQueue = [...clientReach];
while (clientQueue.length) {
  const file = clientQueue.shift();
  for (const dependency of dependencies.get(file) ?? []) {
    if (clientReach.has(dependency)) continue;
    clientReach.add(dependency);
    clientQueue.push(dependency);
  }
}
for (const source of sources) {
  const reads = /\b(readFile|readFileSync|JSON\.parse|import\s+.+\s+from|fetch\s*\()/m.test(source.text);
  const writes = /\b(writeFile|writeFileSync|renameSync|cpSync|copyFile|rmSync)\b/m.test(source.text);
  const client = clientReach.has(source.file);
  for (const ref of source.refs) {
    const target = byFile.get(ref);
    if (!target) continue;
    if (reads) target.readers.push(source.file);
    if (writes) target.writers.push(source.file);
    if (client) target.clientImports.push(source.file);
  }
}

for (const entry of inventory) {
  entry.readers = [...new Set(entry.readers)].sort();
  entry.writers = [...new Set(entry.writers)].sort();
  entry.clientImports = [...new Set(entry.clientImports)].sort();
}

const duplicateIds = [...collections.ids]
  .filter(([, rows]) => new Set(rows.map((row) => row.file)).size > 1)
  .map(([id, rows]) => ({
    id,
    occurrences: rows.length,
    files: [...new Set(rows.map((row) => row.file))].sort(),
  }))
  .sort((a, b) => a.id.localeCompare(b.id));
const duplicateSourceUrls = [...collections.urls]
  .filter(([, rows]) => rows.length > 1)
  .map(([url, rows]) => ({
    url,
    occurrences: rows.length,
    files: [...new Set(rows.map((row) => row.file))].sort(),
  }))
  .sort((a, b) => b.occurrences - a.occurrences || a.url.localeCompare(b.url));
const duplicateRecords = [...collections.recordHashes]
  .filter(([, rows]) => new Set(rows.map((row) => row.file)).size > 1)
  .map(([recordHash, rows]) => ({
    hash: recordHash,
    occurrences: rows.length,
    ids: [...new Set(rows.map((row) => row.id))].sort(),
    files: [...new Set(rows.map((row) => row.file))].sort(),
  }))
  .sort((a, b) => b.occurrences - a.occurrences);

const largeFiles = inventory.filter((entry) => entry.bytes > 250 * 1024);
const veryLargeFiles = inventory.filter((entry) => entry.bytes > 1024 * 1024);
const multipleWriters = inventory.filter((entry) => entry.writers.length > 1);
const clientDataImports = inventory.filter((entry) => entry.clientImports.length > 0);
const oversizedClientShards = clientDataImports.filter(
  (entry) => entry.file.startsWith("public/data/v2/documents/") && entry.bytes > 250 * 1024,
);
const hardcodedCollections = sources
  .map(({ file, text }) => ({
    file,
    bytes: Buffer.byteLength(text),
    namedEntries: (text.match(/\b(?:id|name)\s*:/g) ?? []).length,
  }))
  .filter((entry) => entry.bytes > 20 * 1024 && entry.namedEntries >= 20)
  .sort((a, b) => b.namedEntries - a.namedEntries);
const wholeDatasetReads = inventory
  .filter((entry) => entry.bytes > 250 * 1024 && entry.readers.length > 0)
  .map((entry) => ({ file: entry.file, bytes: entry.bytes, readers: entry.readers }));
const nondeterministicWriters = sources
  .filter(({ text }) => /\b(writeFile|writeFileSync)\b/.test(text) && /Date\.now\(|new Date\(|Math\.random\(/.test(text))
  .map(({ file }) => file)
  .sort();

const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const splitStages = (script) =>
  String(script ?? "")
    .split(/\s*&&\s*/)
    .map((command, index) => ({ index: index + 1, command }))
    .filter((stage) => stage.command);
const normalizeStages = splitStages(packageJson.scripts?.["normalize:data"]);
const legacyNormalizeStages = splitStages(packageJson.scripts?.["normalize:data:legacy"]);
const tracked = (...paths) =>
  execFileSync("git", ["ls-files", "--", ...paths], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
const architectureFailures = [];
const trackedDataJson = tracked("data/**/*.json");
const trackedFrontend = tracked("public/data/v1/**", "public/data/v2/**");
const legacyReaders = sources
  .filter(
    ({ file, text }) =>
      (file.startsWith("app/") ||
        (file.startsWith("src/") && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file))) &&
      (/#data\//.test(text) ||
        /(?:readFile(?:Sync)?|path\.join)\s*\([^)]*["'][^"']*\.cache[\\/]data/.test(text)),
  )
  .map(({ file }) => file);
if (trackedDataJson.length) architectureFailures.push(`${trackedDataJson.length} per-domain data JSON files remain tracked`);
if (trackedFrontend.length) architectureFailures.push(`${trackedFrontend.length} generated frontend files remain tracked`);
if (legacyNormalizeStages.length) architectureFailures.push("normalize:data:legacy still exists");
if (existsSync(join(ROOT, "data/research/catalog.json"))) architectureFailures.push("legacy research catalog exists in data/");
if (existsSync(join(ROOT, ".cache/data"))) architectureFailures.push("legacy .cache/data tree exists");
if (legacyReaders.length) architectureFailures.push(`legacy data readers remain: ${legacyReaders.join(", ")}`);
if (readFileSync(join(ROOT, "tsconfig.json"), "utf8").includes('"#data/*"')) architectureFailures.push("legacy #data TypeScript alias remains");
if (oversizedClientShards.length) architectureFailures.push(`client shards exceed 250 KiB: ${oversizedClientShards.map(({ file }) => file).join(", ")}`);

// --- Stage 0 architecture gates ---------------------------------------------

// Generated trees must never become tracked. data/canonical/ is the deliberate
// exception - it is generated *and* committed, because the whole point of it is
// to be reviewable in a diff; `data:canonical:validate` is what stops a stale
// copy from surviving.
const trackedGenerated = tracked("reports/data-*.json", "reports/data-*.md", "reports/canonical-*.json", "reports/legacy-data-*", "reports/research-*.json", ".cache/**");
if (trackedGenerated.length) {
  architectureFailures.push(`generated files are tracked: ${trackedGenerated.slice(0, 5).join(", ")}`);
}

// Seed documents that reach neither the database nor the browser. Importing one
// would revive a format Stage 0 classified as dead; see
// reports/research-orphans.json for how each was proven unreachable.
const ORPHANED_SEED_DOCUMENTS = [
  "combat/ability-audit-2026-07-24.json",
  "combat/ability-icons.json",
  "combat/equipment-icons.json",
  "league/equilibrium-auto-quests.json",
  "league/quest-region-review.json",
  "league/quest-region-rules.json",
  "research/equipment-region-index.json",
];
const revivedOrphans = ORPHANED_SEED_DOCUMENTS.filter((document) =>
  sources.some(({ text }) => text.includes(`#shard/${document}`)),
);
if (revivedOrphans.length) {
  architectureFailures.push(`orphaned legacy documents were imported again: ${revivedOrphans.join(", ")}`);
}

// A package script naming a file that does not exist is dead on arrival; the
// icon-map pair sat in package.json long after the scripts were deleted.
const missingScriptFiles = Object.entries(packageJson.scripts ?? {})
  .flatMap(([name, script]) =>
    [...String(script).matchAll(/(?:^|\s)((?:scripts|tools)\/[\w./-]+\.(?:mjs|js|ts|py))/g)].map((match) => ({
      name,
      file: match[1],
    })),
  )
  .filter(({ file }) => !existsSync(join(ROOT, file)));
if (missingScriptFiles.length) {
  architectureFailures.push(
    `package scripts reference missing files: ${missingScriptFiles.map(({ name, file }) => `${name} -> ${file}`).join(", ")}`,
  );
}

// Two files claiming one domain: the same entity type and name produced by more
// than one source file, as separate entities. Stage 0 measured 253 across 18
// pairs; Stage 1 has resolved 225, leaving 41 across the 7 pairs below - all of
// them blocked on the same thing, a superseded record holding requirements a
// patch cannot move. The gate is a ratchet - a *new* pair of files, or an
// existing pair growing, fails, while the remaining backlog stays visible in
// reports/research-overlaps.json. Lower an entry as its pair is adjudicated and
// delete it at zero; counts match that report, and
// reports/research-adjudication.json says why each one is still here.
const OVERLAP_BASELINE = new Map([
  ["data/combat/equipment.json + data/reference/progression-unlocks.json", 33],
  ["data/combat/abilities.json + data/reference/progression-unlocks.json", 3],
  ["data/combat/equipment.json + data/reference/progression-support-items-2026-07-25.json + data/reference/progression-unlocks.json", 1],
  ["data/combat/equipment.json + data/research/regional-combat-unlocks.json", 1],
  ["data/reference/progression-container-bags-2026-07-25.json + data/reference/progression-unlocks.json", 1],
  ["data/reference/progression-support-items-2026-07-25.json + data/reference/progression-unlocks.json", 1],
  ["data/research/catalog.json + data/research/regional-skilling-unlocks.json", 1],
]);
if (existsSync(join(ROOT, ".cache/equilibrium.sqlite"))) {
  const { openDatabase } = await import("./database.mjs");
  const { entityOverlaps } = await import("./legacy-inventory.mjs");
  const db = openDatabase();
  try {
    for (const { files, records } of entityOverlaps(db).filePairs) {
      const baseline = OVERLAP_BASELINE.get(files);
      if (baseline === undefined) {
        architectureFailures.push(`new file pair claims one domain: ${files} (${records} records)`);
      } else if (records > baseline) {
        architectureFailures.push(`overlap grew for ${files}: ${baseline} -> ${records} records`);
      }
    }
  } finally {
    db.close();
  }
}

// data/ holds one seed, forward-only migrations and content patches. A new root
// here means a second authoring surface arrived without a decision.
const DATA_ROOTS = new Set(["migrations", "patches", "seed-v1.json.gz", "README.md", "canonical"]);
const undocumentedDataRoots = readdirSync(join(ROOT, "data")).filter((name) => !DATA_ROOTS.has(name));
if (undocumentedDataRoots.length) {
  architectureFailures.push(`undocumented data roots: ${undocumentedDataRoots.join(", ")}`);
}

const report = {
  schemaVersion: 1,
  generatedBy: "scripts/data/audit.mjs",
  summary: {
    files: inventory.length,
    dataFiles: inventory.filter((entry) => DATA_EXTENSIONS.has(extname(entry.file).toLowerCase())).length,
    bytes: inventory.reduce((sum, entry) => sum + entry.bytes, 0),
    over250KiB: largeFiles.length,
    over1MiB: veryLargeFiles.length,
    duplicateStableIdsAcrossFiles: duplicateIds.length,
    duplicateSourceUrls: duplicateSourceUrls.length,
    duplicateRecordsAcrossFiles: duplicateRecords.length,
    filesWithMultipleWriters: multipleWriters.length,
    clientDataImports: clientDataImports.length,
    oversizedClientShards: oversizedClientShards.length,
    normalizeStages: normalizeStages.length,
    legacyNormalizeStages: legacyNormalizeStages.length,
    architectureFailures: architectureFailures.length,
  },
  classifications: Object.fromEntries(
    [...new Set(inventory.map((entry) => entry.classification))]
      .sort()
      .map((classification) => [classification, inventory.filter((entry) => entry.classification === classification).length]),
  ),
  normalizeStages,
  legacyNormalizeStages,
  largeFiles,
  veryLargeFiles,
  duplicateIds,
  duplicateSourceUrls,
  duplicateRecords,
  multipleWriters,
  clientDataImports,
  oversizedClientShards,
  hardcodedCollections,
  wholeDatasetReads,
  nondeterministicWriters,
  architectureFailures,
  files: inventory,
};

const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
const table = (headers, rows) => {
  const line = `| ${headers.join(" | ")} |`;
  return [line, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
};
const architecture = [
  "# Data architecture audit",
  "",
  "Generated by `npm run data:audit`. The JSON inventory is the complete machine-readable evidence; this report keeps only decision-relevant summaries.",
  "",
  "## Measured inventory",
  "",
  `- ${report.summary.files} relevant project files (${report.summary.dataFiles} data files), ${kib(report.summary.bytes)} total.`,
  `- ${report.summary.over250KiB} files exceed 250 KiB; ${report.summary.over1MiB} exceed 1 MiB.`,
  `- \`normalize:data\` has ${report.summary.normalizeStages} staged entrypoint; the retired compatibility chain has ${report.summary.legacyNormalizeStages} commands.`,
  `- ${report.summary.filesWithMultipleWriters} files have multiple statically detected writers.`,
  `- ${report.summary.duplicateStableIdsAcrossFiles} stable IDs and ${report.summary.duplicateRecordsAcrossFiles} exact records repeat across files.`,
  `- ${report.summary.clientDataImports} data files are imported directly by client modules.`,
  "",
  "## Classification",
  "",
  table(["Class", "Files"], Object.entries(report.classifications).map(([name, count]) => [name, String(count)])),
  "",
  "## Largest active files",
  "",
  table(
    ["File", "Size", "Class", "Records", "Readers", "Writers"],
    largeFiles.slice(0, 30).map((entry) => [
      `\`${entry.file}\``,
      kib(entry.bytes),
      entry.classification,
      entry.topLevelRecords == null ? "—" : String(entry.topLevelRecords),
      String(entry.readers.length),
      String(entry.writers.length),
    ]),
  ),
  "",
  "## Current data entrypoint",
  "",
  ...normalizeStages.map((stage) => `${stage.index}. \`${stage.command}\``),
  "",
  "## Confirmed architecture pressure",
  "",
  `- ${wholeDatasetReads.length} large datasets are loaded wholesale by at least one script or module.`,
  `- ${hardcodedCollections.length} large scripts contain at least 20 embedded named records or mappings.`,
  `- ${nondeterministicWriters.length} writer scripts contain wall-clock or random calls and require deterministic-output review.`,
  `- Architecture gate: ${architectureFailures.length ? `FAIL (${architectureFailures.join("; ")})` : "PASS"}.`,
  "",
  "## Migration boundary",
  "",
  "The immutable compressed seed, migrations, and JSONL patches rebuild an ignored SQLite database. Client consumers use bounded, hashed documents under `public/data/v2/`; larger data is server-only. No compatibility tree is materialized.",
  "",
  "## Reports",
  "",
  "- Full inventory, readers, writers, duplicate IDs, duplicate URLs, and hashes: `reports/data-file-inventory.json`.",
  "- This report intentionally omits full record dumps.",
  "",
].join("\n");

mkdirSync(REPORTS, { recursive: true });
writeFileSync(INVENTORY_PATH, `${JSON.stringify(report)}\n`);
writeFileSync(REPORT_PATH, architecture);
console.log(`Data architecture audit: ${report.summary.files} files, ${largeFiles.length} over 250 KiB, ${normalizeStages.length} normalize stages`);
if (architectureFailures.length) process.exitCode = 1;
