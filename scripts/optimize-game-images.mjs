/**
 * Resize oversized game art and convert raster files to WebP.
 *
 * Trees: public/game, assets/rs3, assets/leagues
 * Source formats: png, jpg, jpeg, gif (first frame), existing webp (re-encode if oversized)
 *
 *   node scripts/optimize-game-images.mjs [--dry-run] [--roots public/game,assets/rs3]
 *
 * After a real run, rebuild icon maps:
 *   node scripts/_build-icon-maps.mjs && node scripts/_emit-data-icon-index.mjs
 */
import { createReadStream } from "node:fs";
import {
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const DRY = ARGS.has("--dry-run");
const rootsArg = process.argv.find((a) => a.startsWith("--roots="));
const ROOTS = (rootsArg ? rootsArg.slice("--roots=".length) : "public/game,assets/rs3,assets/leagues")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SRC_EXT = /\.(png|jpe?g|gif|webp)$/i;
const CONCURRENCY = 6;

/** Long-edge caps by path (relative to tree root, forward slashes). */
function maxEdge(rel) {
  const r = rel.replace(/\\/g, "/").toLowerCase();
  if (/(^|\/)(skills|regions)\//.test(r) || /(^|\/)skills\/[^/]+$/.test(r)) return 128;
  if (/(^|\/)regions\/[^/]+$/.test(r)) return 128;
  if (/\/combat\/(equipment|abilities|spells|prayer)\//.test(r)) return 128;
  if (/\/combat\/[^/]+\.(webp|png|jpe?g|gif)$/.test(r)) return 256;
  if (/\/bosses\//.test(r)) return 768;
  if (/\/activities\//.test(r)) return 1280;
  if (/\/upgrades\/permanent-unlocks\//.test(r)) return 1280;
  if (/\/upgrades\//.test(r)) return 256;
  if (/\/terrain\//.test(r)) return 2048;
  if (/\/leagues\//.test(r) || r.startsWith("leagues/") || !r.includes("/")) {
    // assets/leagues flat or public/game/leagues
    if (r.includes("leagues")) return 1024;
  }
  if (/\/relics\//.test(r)) return 512;
  return 1024;
}

function qualityFor(edge) {
  if (edge <= 96) return 92;
  if (edge <= 256) return 88;
  if (edge <= 768) return 82;
  return 78;
}

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (SRC_EXT.test(e.name)) acc.push(p);
  }
  return acc;
}

function pool(items, limit, worker) {
  let i = 0;
  let active = 0;
  let rejected = false;
  return new Promise((resolve, reject) => {
    const results = [];
    const kick = () => {
      if (rejected) return;
      if (i >= items.length && active === 0) {
        resolve(results);
        return;
      }
      while (active < limit && i < items.length) {
        const idx = i++;
        const item = items[idx];
        active++;
        Promise.resolve(worker(item, idx))
          .then((r) => {
            results[idx] = r;
            active--;
            kick();
          })
          .catch((err) => {
            rejected = true;
            reject(err);
          });
      }
    };
    kick();
  });
}

function webpDestination(absPath) {
  const ext = extname(absPath).toLowerCase();
  return join(dirname(absPath), `${basename(absPath, ext)}.webp`);
}

async function optimizeOne(absPath, treeRoot) {
  const rel = relative(treeRoot, absPath).split(sep).join("/");
  const ext = extname(absPath).toLowerCase();
  const dest = webpDestination(absPath);
  const before = statSync(absPath).size;
  const cap = maxEdge(rel);

  let meta;
  try {
    meta = await sharp(absPath, { animated: false, pages: 1, failOn: "none" }).metadata();
  } catch (err) {
    return { rel, status: "skip-read", error: String(err?.message || err), before, after: before };
  }

  const w = meta.width || 0;
  const h = meta.height || 0;
  const edge = Math.max(w, h);
  const needsResize = edge > cap;
  const alreadyWebp = ext === ".webp";
  // Skip tiny already-webp that fit the cap and are small on disk.
  if (alreadyWebp && !needsResize && before < 40 * 1024) {
    return { rel, status: "skip-ok", before, after: before, w, h };
  }

  const q = qualityFor(needsResize ? cap : edge);
  let pipeline = sharp(absPath, { animated: false, pages: 1, failOn: "none" }).rotate();
  if (needsResize) {
    pipeline = pipeline.resize({
      width: cap,
      height: cap,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let buf;
  try {
    buf = await pipeline
      .webp({
        quality: q,
        alphaQuality: 100,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer();
  } catch (err) {
    return { rel, status: "skip-encode", error: String(err?.message || err), before, after: before };
  }

  // Keep original if webp would be larger and we did not resize (icons sometimes).
  if (!needsResize && alreadyWebp && buf.length >= before * 0.98) {
    return { rel, status: "skip-no-gain", before, after: before, w, h };
  }
  if (!needsResize && !alreadyWebp && buf.length > before * 1.15 && before < 12 * 1024) {
    // Tiny PNG beat webp — still convert for one format; only bail if much worse.
    // Prefer unified .webp for path simplicity even if a few bytes larger.
  }

  if (DRY) {
    return {
      rel,
      status: "dry",
      before,
      after: buf.length,
      w,
      h,
      cap,
      resize: needsResize,
    };
  }

  // Write via temp then replace. On Windows, rename over existing can EPERM —
  // fall back to writeFileSync on dest after unlinking.
  const tmp = `${dest}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  writeFileSync(tmp, buf);
  try {
    if (existsSync(dest)) {
      try {
        unlinkSync(dest);
      } catch {
        /* ignore */
      }
    }
    try {
      renameSync(tmp, dest);
    } catch {
      writeFileSync(dest, buf);
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }

  if (absPath !== dest && existsSync(absPath)) {
    try {
      unlinkSync(absPath);
    } catch {
      /* keep source if delete fails */
    }
  }

  return {
    rel,
    status: "ok",
    before,
    after: buf.length,
    w,
    h,
    cap,
    resize: needsResize,
  };
}

function sum(arr, key) {
  return arr.reduce((s, x) => s + (x[key] || 0), 0);
}

async function main() {
  const all = [];
  for (const r of ROOTS) {
    const tree = join(ROOT, r);
    if (!existsSync(tree)) {
      console.log(`skip missing root ${r}`);
      continue;
    }
    const files = walk(tree);
    console.log(`${r}: ${files.length} rasters`);
    for (const f of files) all.push({ f, tree });
  }

  const sourceByDestination = new Map();
  for (const { f } of all) {
    const destination = webpDestination(f).toLowerCase();
    const sources = sourceByDestination.get(destination) || [];
    sources.push(f);
    sourceByDestination.set(destination, sources);
  }
  const collisions = [...sourceByDestination.values()].filter((sources) => sources.length > 1);
  if (collisions.length) {
    throw new Error(
      `Multiple source images target the same WebP:\n${collisions
        .map((sources) => sources.map((source) => `  ${relative(ROOT, source)}`).join("\n"))
        .join("\n")}\nRename portrait and icon sources before optimizing.`,
    );
  }

  console.log(
    `optimize-game-images: ${all.length} files, concurrency=${CONCURRENCY}, dry=${DRY}`,
  );

  let done = 0;
  let bytesIn = 0;
  let bytesOut = 0;
  const t0 = Date.now();
  const results = await pool(all, CONCURRENCY, async ({ f, tree }) => {
    const r = await optimizeOne(f, tree);
    done++;
    bytesIn += r?.before || 0;
    bytesOut += r?.after || 0;
    if (done % 200 === 0 || done === all.length) {
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `  … ${done}/${all.length}  (~${(bytesIn / 1e6).toFixed(0)}→${(bytesOut / 1e6).toFixed(0)} MB so far, ${sec}s)`,
      );
    }
    return r;
  });

  const byStatus = {};
  for (const r of results) {
    if (!r) continue;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }
  const before = sum(results, "before");
  const after = sum(results, "after");
  const resized = results.filter((r) => r?.resize).length;
  const report = {
    at: new Date().toISOString(),
    dry: DRY,
    roots: ROOTS,
    files: results.length,
    byStatus,
    resized,
    bytesBefore: before,
    bytesAfter: after,
    savedBytes: before - after,
    savedMB: Number(((before - after) / 1e6).toFixed(2)),
    seconds: Number(((Date.now() - t0) / 1000).toFixed(1)),
  };

  const reportPath = join(ROOT, "scraped-data", "optimize-game-images-report.json");
  try {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  } catch {
    writeFileSync(join(ROOT, "optimize-game-images-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log("done", report);
  const failures = results.filter((r) => r?.status?.startsWith("skip-") && r.error);
  if (failures.length) {
    console.log("sample errors:", failures.slice(0, 8));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
