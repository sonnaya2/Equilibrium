/**
 * Promotes cached downloads into public/game, optimizing on the way in.

 * Requires explicit asset ids. Re-importing the whole catalog is what used to
 * silently overwrite optimized art with raw upstream copies, so there is no
 * flag for it.

 *   node scripts/assets/import-sources.mjs <asset-id> [more-ids...]

 * Fetch first with scripts/assets/fetch-sources.mjs. Never run during a build.
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { loadCatalog } from "./catalog.mjs";

const ROOT = process.cwd();
const MANIFEST = join(ROOT, ".asset-cache/fetched.json");
const KNOWN_EXT = [".webp", ".png", ".jpg", ".jpeg", ".gif"];

const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!ids.length) {
  console.error(
    "Usage: node scripts/assets/import-sources.mjs <asset-id>...\n" +
      "Import is deliberate and per-asset; there is no bulk mode.",
  );
  process.exit(1);
}
if (!existsSync(MANIFEST)) {
  console.error("No .asset-cache/fetched.json - run npm run art:fetch first.");
  process.exit(1);
}

const cached = new Map(
  JSON.parse(readFileSync(MANIFEST, "utf8")).assets.map((a) => [a.id.toLowerCase(), a]),
);
const catalog = new Map((await loadCatalog()).assets.map((a) => [a.id.toLowerCase(), a]));

/** Long-edge caps mirror scripts/optimize-game-images.mjs so imports land already sized. */
function maxEdge(category) {
  const c = category.toLowerCase();
  if (/^rs3\/(skills|regions)/.test(c)) return 128;
  if (/^rs3\/combat\/(equipment|abilities|spells|prayer)/.test(c)) return 128;
  if (/^rs3\/combat/.test(c)) return 256;
  if (/^rs3\/(bosses|activities|upgrades)/.test(c)) return 256;
  if (/^leagues/.test(c)) return 1024;
  return 1024;
}

let imported = 0;
for (const raw of ids) {
  const id = raw.toLowerCase();
  const entry = catalog.get(id);
  const download = cached.get(id);
  if (!entry) {
    console.error(`  SKIP ${raw}: no catalog row`);
    continue;
  }
  if (!download) {
    console.error(`  SKIP ${raw}: not in the fetch cache`);
    continue;
  }

  const source = join(ROOT, download.cachePath);
  const cap = maxEdge(entry.category);
  const meta = await sharp(source).metadata();
  const edge = Math.max(meta.width ?? 0, meta.height ?? 0);

  const target = join(ROOT, `${entry.path}.webp`);
  await mkdir(dirname(target), { recursive: true });
  await sharp(source)
    .resize({ width: cap, height: cap, fit: "inside", withoutEnlargement: true })
    .webp({ quality: edge <= 96 ? 92 : edge <= 256 ? 88 : 82 })
    .toFile(target);

  // A previous import may have left a different extension behind at the same stem.
  for (const ext of KNOWN_EXT) {
    if (ext === ".webp") continue;
    const stale = join(ROOT, entry.path + ext);
    if (existsSync(stale)) await unlink(stale);
  }

  const after = await sharp(target).metadata();
  console.log(
    `  ${entry.id}: ${meta.width}x${meta.height} ${meta.format} -> ${after.width}x${after.height} webp`,
  );
  imported++;
}

console.log(`ART IMPORT: ${imported}/${ids.length} into public/`);
console.log("Next: npm run art:index && npm run art:check");
if (imported !== ids.length) process.exitCode = 1;
await writeFile(join(ROOT, ".asset-cache/last-import.json"), `${JSON.stringify({ ids, imported }, null, 2)}\n`);
