/**
 * Read-only inventory of every image tree the asset pipeline touches.
 *
 * Establishes the baseline the ownership migration is measured against: which
 * files exist where, which have a catalog row, which are byte- or pixel-identical,
 * and which live in public/ with no source to regenerate them from.
 *
 *   node scripts/assets/inventory.mjs [--fast] [--json]
 *
 * --fast skips decoded-pixel hashing (byte hashes only; ~10x quicker).
 * Writes reports/assets/inventory.json. Never modifies a tracked file.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import sharp from "sharp";
import { loadCatalog } from "./catalog.mjs";
import { publicTargetFor } from "./routes.mjs";

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const FAST = ARGS.has("--fast");
const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;
const CONCURRENCY = 8;

/** Source trees are editable; public trees are (meant to be) generated output. */
const TREES = [
  { name: "assets/rs3", kind: "source", publicRoot: "game" },
  { name: "assets/leagues", kind: "source", publicRoot: null },
  { name: "assets/brand", kind: "source", publicRoot: "brand" },
  { name: "public/game", kind: "public", publicRoot: "game" },
  { name: "public/brand", kind: "public", publicRoot: "brand" },
];

const fwd = (p) => p.split(sep).join("/");
const stripExt = (p) => p.replace(/\.(png|jpe?g|gif|webp)$/i, "");

async function walk(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === "ENOENT") return acc;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, acc);
    else if (entry.isFile() && IMAGE_RE.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** Files git knows about, so untracked work-in-progress is never mistaken for drift. */
function trackedFiles() {
  try {
    const out = execFileSync("git", ["ls-files", "-z", "assets", "public"], {
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
    });
    return new Set(out.toString("utf8").split("\0").filter(Boolean));
  } catch {
    return null;
  }
}

async function describe(abs) {
  const rel = fwd(relative(ROOT, abs));
  const bytes = await readFile(abs);
  const record = {
    path: rel,
    ext: (rel.match(IMAGE_RE)?.[0] ?? "").toLowerCase(),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  try {
    const image = sharp(bytes, { animated: false });
    const meta = await image.metadata();
    record.width = meta.width ?? null;
    record.height = meta.height ?? null;
    record.format = meta.format ?? null;
    record.hasAlpha = Boolean(meta.hasAlpha);
    record.frames = meta.pages ?? 1;
    if (!FAST) {
      // Pixel hash catches the same artwork stored in two encodings, which a
      // byte hash misses entirely.
      const raw = await sharp(bytes, { animated: false })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      record.pixelSha256 = createHash("sha256")
        .update(`${raw.info.width}x${raw.info.height}:`)
        .update(raw.data)
        .digest("hex");
    }
  } catch (err) {
    record.unreadable = String(err?.message ?? err);
  }
  return record;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        out[index] = await fn(items[index]);
      }
    }),
  );
  return out;
}

function groupBy(records, key) {
  const groups = new Map();
  for (const record of records) {
    const value = record[key];
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(record.path);
  }
  return [...groups.values()].filter((paths) => paths.length > 1).sort((a, b) => b.length - a.length);
}

const catalog = await loadCatalog();
/** Catalog `path` carries no extension - the file on disk decides it. */
const catalogByPath = new Map(catalog.assets.map((entry) => [entry.path.toLowerCase(), entry]));
const tracked = trackedFiles();

const trees = {};
const all = [];
for (const tree of TREES) {
  const files = await walk(join(ROOT, tree.name));
  const records = await mapLimit(files, CONCURRENCY, describe);
  for (const record of records) {
    record.tree = tree.name;
    record.kind = tree.kind;
    record.rel = record.path.slice(tree.name.length + 1);
    record.tracked = tracked ? tracked.has(record.path) : null;
    const row = catalogByPath.get(stripExt(record.path).toLowerCase());
    record.catalogId = row?.id ?? null;
    // Routing is the authority, so leagues renames and `publish` fan-out are
    // counted the same way the publisher counts them.
    record.expectedPublic =
      tree.kind === "source" ? publicTargetFor(tree.name, record.rel) : null;
    record.alsoPublishedAs = row?.publish ?? [];
  }
  trees[tree.name] = records;
  all.push(...records);
}

const sourceRecords = all.filter((r) => r.kind === "source");
const publicRecords = all.filter((r) => r.kind === "public");

/** Public paths a source file is expected to produce, for the mirror comparison. */
const expected = new Map();
for (const record of sourceRecords) {
  if (record.expectedPublic) expected.set(record.expectedPublic, record);
  for (const extra of record.alsoPublishedAs) expected.set(extra, record);
}
const publicByRel = new Map(
  publicRecords.map((record) => [`${record.tree.slice("public/".length)}/${record.rel}`, record]),
);

const publicOnly = [];
for (const [key, record] of publicByRel) {
  if (expected.has(key)) continue;
  publicOnly.push({
    publicPath: record.path,
    tracked: record.tracked,
    bytes: record.bytes,
    // A same-named file anywhere under assets/leagues is a likely home.
    leaguesCandidate:
      sourceRecords.find(
        (s) => s.tree === "assets/leagues" && s.rel.split("/").pop() === record.rel.split("/").pop(),
      )?.path ?? null,
  });
}

const sourceOnly = [...expected.entries()]
  .filter(([key]) => !publicByRel.has(key))
  .map(([key, record]) => ({ sourcePath: record.path, expectedPublic: key }));

const mismatched = [];
for (const [key, record] of expected) {
  const live = publicByRel.get(key);
  if (live && live.sha256 !== record.sha256) {
    mismatched.push({ sourcePath: record.path, publicPath: live.path });
  }
}

const caseCollisions = groupBy(
  sourceRecords.map((r) => ({ path: r.path, key: r.path.toLowerCase() })),
  "key",
);

const byteDuplicates = groupBy(sourceRecords, "sha256");
const pixelDuplicates = FAST
  ? []
  : groupBy(sourceRecords, "pixelSha256").filter((group) => {
      // Byte-identical groups are already counted; report only cross-encoding pairs.
      const hashes = new Set(group.map((p) => sourceRecords.find((r) => r.path === p)?.sha256));
      return hashes.size > 1;
    });

const wasted = byteDuplicates.reduce((sum, group) => {
  const record = sourceRecords.find((r) => r.path === group[0]);
  return sum + (record?.bytes ?? 0) * (group.length - 1);
}, 0);

const report = {
  generatedWith: FAST ? "byte hashes only (--fast)" : "byte + decoded-pixel hashes",
  catalogRows: catalog.assets.length,
  trees: Object.fromEntries(
    Object.entries(trees).map(([name, records]) => [
      name,
      {
        files: records.length,
        bytes: records.reduce((sum, r) => sum + r.bytes, 0),
        tracked: records.filter((r) => r.tracked).length,
        untracked: records.filter((r) => r.tracked === false).length,
        withCatalogRow: records.filter((r) => r.catalogId).length,
        unreadable: records.filter((r) => r.unreadable).map((r) => r.path),
      },
    ]),
  ),
  publicOnly,
  sourceOnly,
  mismatched,
  caseCollisions,
  duplicates: {
    byteIdenticalGroups: byteDuplicates.length,
    byteIdenticalRedundantFiles: byteDuplicates.reduce((sum, g) => sum + g.length - 1, 0),
    byteIdenticalWastedBytes: wasted,
    pixelIdenticalCrossEncodingGroups: pixelDuplicates.length,
    byteIdentical: byteDuplicates,
    pixelIdenticalCrossEncoding: pixelDuplicates,
  },
  files: all,
};

await mkdir(join(ROOT, "reports/assets"), { recursive: true });
await writeFile(
  join(ROOT, "reports/assets/inventory.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

if (ARGS.has("--json")) {
  console.log(JSON.stringify({ ...report, files: undefined }, null, 2));
} else {
  const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
  console.log("ASSET INVENTORY");
  for (const [name, stats] of Object.entries(report.trees)) {
    console.log(
      `  ${name.padEnd(16)} ${String(stats.files).padStart(5)} files  ${mb(stats.bytes).padStart(9)}` +
        `  tracked ${stats.tracked}  untracked ${stats.untracked}  catalogued ${stats.withCatalogRow}`,
    );
  }
  console.log(`  public-only (no source): ${publicOnly.length}`);
  console.log(`    of which untracked:    ${publicOnly.filter((p) => p.tracked === false).length}`);
  console.log(`  source-only (unpublished): ${sourceOnly.length}`);
  console.log(`  source/public content mismatch: ${mismatched.length}`);
  console.log(`  case collisions: ${caseCollisions.length}`);
  console.log(
    `  byte-identical: ${report.duplicates.byteIdenticalGroups} groups, ` +
      `${report.duplicates.byteIdenticalRedundantFiles} redundant files, ${mb(wasted)}`,
  );
  console.log(`  pixel-identical across encodings: ${pixelDuplicates.length} groups`);
  console.log("  wrote reports/assets/inventory.json");
}
