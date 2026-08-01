/**
 * Size, duplicate and provenance report for the art tree.
 *
 *   node scripts/assets/inventory.mjs [--fast] [--json]
 *
 * --fast skips decoded-pixel hashing (byte hashes only; much quicker).
 * Writes reports/assets/inventory.json. Read-only.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import sharp from "sharp";
import { loadCatalog } from "./catalog.mjs";

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const FAST = ARGS.has("--fast");
const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;
const TREES = ["public/game", "public/brand"];
const CONCURRENCY = 8;

const fwd = (p) => p.split(sep).join("/");
const stripExt = (p) => p.replace(IMAGE_RE, "");

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

async function describe(abs) {
  const bytes = await readFile(abs);
  const record = {
    path: fwd(relative(ROOT, abs)),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  try {
    const meta = await sharp(bytes, { animated: false }).metadata();
    Object.assign(record, {
      width: meta.width ?? null,
      height: meta.height ?? null,
      format: meta.format ?? null,
      hasAlpha: Boolean(meta.hasAlpha),
    });
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

function duplicateGroups(records, key) {
  const groups = new Map();
  for (const record of records) {
    const value = record[key];
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(record.path);
  }
  return [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
}

const catalog = await loadCatalog();
/** Catalog `path` carries no extension - the file on disk decides it. */
const byPath = new Map(catalog.assets.map((row) => [row.path.toLowerCase(), row]));
const declared = new Set();
for (const row of catalog.assets) for (const also of row.alsoAt ?? []) declared.add(also.toLowerCase());

const files = [];
for (const tree of TREES) files.push(...(await walk(join(ROOT, tree))));
const records = await mapLimit(files, CONCURRENCY, describe);
for (const record of records) {
  const row = byPath.get(stripExt(record.path).toLowerCase());
  record.catalogId = row?.id ?? null;
  record.declaredCopy = declared.has(record.path.toLowerCase());
}

const byteDuplicates = duplicateGroups(records, "sha256");
const pixelDuplicates = FAST
  ? []
  : duplicateGroups(records, "pixelSha256").filter((group) => {
      // Byte-identical groups are already counted; report only cross-encoding pairs.
      const hashes = new Set(group.map((p) => records.find((r) => r.path === p)?.sha256));
      return hashes.size > 1;
    });

const wasted = byteDuplicates.reduce((sum, group) => {
  const record = records.find((r) => r.path === group[0]);
  return sum + (record?.bytes ?? 0) * (group.length - 1);
}, 0);

const report = {
  generatedWith: FAST ? "byte hashes only (--fast)" : "byte + decoded-pixel hashes",
  catalogRows: catalog.assets.length,
  files: records.length,
  bytes: records.reduce((sum, r) => sum + r.bytes, 0),
  withProvenance: records.filter((r) => r.catalogId || r.declaredCopy).length,
  unreadable: records.filter((r) => r.unreadable).map((r) => r.path),
  duplicates: {
    byteIdenticalGroups: byteDuplicates.length,
    redundantFiles: byteDuplicates.reduce((n, g) => n + g.length - 1, 0),
    wastedBytes: wasted,
    declaredCopies: declared.size,
    pixelIdenticalCrossEncodingGroups: pixelDuplicates.length,
    byteIdentical: byteDuplicates,
    pixelIdenticalCrossEncoding: pixelDuplicates,
  },
  records,
};

await mkdir(join(ROOT, "reports/assets"), { recursive: true });
await writeFile(join(ROOT, "reports/assets/inventory.json"), `${JSON.stringify(report, null, 2)}\n`);

if (ARGS.has("--json")) {
  console.log(JSON.stringify({ ...report, records: undefined }, null, 2));
} else {
  const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
  console.log("ART INVENTORY");
  console.log(`  ${report.files} images, ${mb(report.bytes)}`);
  console.log(`  provenance: ${report.withProvenance}/${report.files}`);
  console.log(
    `  byte-identical: ${byteDuplicates.length} groups, ` +
      `${report.duplicates.redundantFiles} redundant files, ${mb(wasted)} ` +
      `(${declared.size} declared via alsoAt)`,
  );
  console.log(`  pixel-identical across encodings: ${pixelDuplicates.length} groups`);
  if (report.unreadable.length) console.log(`  UNREADABLE: ${report.unreadable.length}`);
  console.log("  wrote reports/assets/inventory.json");
}
