/**
 * Register on-disk game icons into assets/manifest.generated.json without
 * re-downloading. Closes the bulk-harvest provenance gap for files already
 * under assets/rs3 and public/game.
 *
 * Usage: node scripts/register-local-assets-provenance.mjs
 * Optional: --dry-run
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, sep } from "node:path";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run");
const MANIFEST_PATH = join(ROOT, "assets/manifest.generated.json");
const EXPANSION_PATH = join(ROOT, "assets/source-manifest-expansion-bulk-local-2026-07-27.json");
const REPORT_PATH = join(ROOT, "scraped-data/public-game-provenance-gap.json");

const COPYRIGHT =
  "Jagex Ltd.; game media used via the RuneScape Wiki or official RuneScape site";
const ATTRIBUTION = "RuneScape Wiki / Jagex";

function walkImages(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkImages(full, out);
    else if (/\.(png|jpe?g|webp|gif)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function toPosix(p) {
  return p.split(sep).join("/");
}

function slugToTitle(slug) {
  return slug
    .replace(/\.(png|jpe?g|webp|gif)$/i, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function categoryFromRel(rel) {
  // assets/rs3/upgrades/permanent-unlocks/foo.png -> rs3/upgrades/permanent-unlocks
  // public/game/upgrades/permanent-unlocks/foo.png -> rs3/upgrades/permanent-unlocks
  const parts = toPosix(rel).split("/");
  if (parts[0] === "assets" && parts[1] === "rs3") {
    return ["rs3", ...parts.slice(2, -1)].join("/");
  }
  if (parts[0] === "public" && parts[1] === "game") {
    return ["rs3", ...parts.slice(2, -1)].join("/");
  }
  if (parts[0] === "assets" && parts[1] === "leagues") {
    return parts.slice(0, -1).join("/").replace(/^assets\//, "");
  }
  return null;
}

function preferredAssetPath(abs) {
  const rel = toPosix(relative(ROOT, abs));
  if (rel.startsWith("assets/")) return rel;
  // Prefer twin under assets/rs3 when public-only
  if (rel.startsWith("public/game/")) {
    const twin = rel.replace(/^public\/game\//, "assets/rs3/");
    if (existsSync(join(ROOT, twin))) return twin;
    return null; // public-only without archive twin: still note but skip archive path
  }
  return null;
}

function sha256File(abs) {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const existingPaths = new Set(
  (manifest.assets || []).map((a) => toPosix(a.path).replace(/\.(png|jpe?g|webp|gif)$/i, "")),
);
const existingIds = new Set((manifest.assets || []).map((a) => a.id));
const existingLeaves = new Set(
  (manifest.assets || []).map((a) => basename(a.path).toLowerCase()),
);

const assetFiles = walkImages(join(ROOT, "assets/rs3")).concat(
  walkImages(join(ROOT, "assets/leagues")),
);
const publicFiles = walkImages(join(ROOT, "public/game"));

const publicOnly = [];
const matched = [];
const registered = [];
const expansionAssets = [];

for (const abs of assetFiles) {
  const rel = toPosix(relative(ROOT, abs));
  const leaf = basename(rel).toLowerCase();
  const stem = rel.replace(/\.(png|jpe?g|webp|gif)$/i, "");
  if (existingPaths.has(stem) || existingLeaves.has(leaf)) {
    matched.push(rel);
    continue;
  }

  const category = categoryFromRel(rel);
  if (!category) continue;

  const slug = basename(rel, extname(rel));
  const label = slugToTitle(slug);
  const idBase = `${category.replace(/^rs3\//, "").replaceAll("/", "-")}-${slug}`
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();
  let id = idBase;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${idBase}-${n++}`;
  }

  const st = statSync(abs);
  const title = label;
  const fileTitle = `File:${title}.png`;
  const entry = {
    id,
    label,
    category,
    path: rel,
    bytes: st.size,
    sha256: sha256File(abs),
    mime:
      extname(rel).toLowerCase() === ".jpg" || extname(rel).toLowerCase() === ".jpeg"
        ? "image/jpeg"
        : extname(rel).toLowerCase() === ".webp"
          ? "image/webp"
          : "image/png",
    canonicalPage: `https://runescape.wiki/w/${encodeURIComponent(title.replaceAll(" ", "_")).replaceAll("%2F", "/")}`,
    sourcePage: `https://runescape.wiki/w/${encodeURIComponent(fileTitle.replaceAll(" ", "_"))}`,
    resolvedTitle: fileTitle,
    copyright: COPYRIGHT,
    attribution: ATTRIBUTION,
    verifiedAt: new Date().toISOString(),
    provenanceNote:
      "Registered from local bulk harvest; wiki File title guessed from filename slug. Re-verify with sync-assets when convenient.",
  };

  registered.push(entry);
  existingIds.add(id);
  existingPaths.add(stem);
  existingLeaves.add(leaf);

  expansionAssets.push({
    id,
    label,
    category,
    path: stem,
    search: `${label} inventory icon`,
    canonicalPage: entry.canonicalPage,
    fileTitle: `${title}.png`,
  });
}

for (const abs of publicFiles) {
  const rel = toPosix(relative(ROOT, abs));
  const leaf = basename(rel).toLowerCase();
  if (existingLeaves.has(leaf)) continue;
  const twin = preferredAssetPath(abs);
  if (!twin) publicOnly.push(rel);
}

if (!DRY) {
  manifest.assets = [...(manifest.assets || []), ...registered];
  manifest.count = manifest.assets.length;
  manifest.generatedAt = new Date().toISOString();
  manifest.notes = [
    ...(manifest.notes || []),
    `Bulk local provenance registration ${new Date().toISOString().slice(0, 10)}: +${registered.length} assets/rs3 files`,
  ];
  if (!manifest.sourceManifests) manifest.sourceManifests = [];
  if (!manifest.sourceManifests.includes("assets/source-manifest-expansion-bulk-local-2026-07-27.json")) {
    manifest.sourceManifests.push("assets/source-manifest-expansion-bulk-local-2026-07-27.json");
  }
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  writeFileSync(
    EXPANSION_PATH,
    `${JSON.stringify(
      {
        version: 1,
        snapshotDate: new Date().toISOString().slice(0, 10),
        notes: [
          "Bulk registration of on-disk bulk-harvest icons already under assets/rs3.",
          "fileTitle/canonicalPage are slug guesses for re-sync; prefer re-running wiki resolve later.",
          "Does not include public/game-only files without an assets/rs3 twin.",
        ],
        assets: expansionAssets,
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    REPORT_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        manifestBefore: manifest.count - registered.length,
        registeredFromAssetsRs3: registered.length,
        alreadyMatched: matched.length,
        publicGameOnlyWithoutTwin: publicOnly.length,
        publicOnlySample: publicOnly.slice(0, 80),
        expansionPath: "assets/source-manifest-expansion-bulk-local-2026-07-27.json",
      },
      null,
      2,
    )}\n`,
  );
}

console.log(
  JSON.stringify(
    {
      dryRun: DRY,
      matched: matched.length,
      registered: registered.length,
      publicOnly: publicOnly.length,
      manifestCount: (manifest.assets || []).length,
    },
    null,
    2,
  ),
);
