/**
 * Report-only provenance gap audit.
 *
 * Walks public/game, assets/rs3, and assets/leagues for png/jpg/webp files.
 * Compares against assets/manifest.generated.json (path, basename, id, label).
 *
 * Writes scraped-data/public-game-provenance-gap.json.
 * Always exits 0 (report only).
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, "assets/manifest.generated.json");
const OUT_PATH = join(ROOT, "scraped-data/public-game-provenance-gap.json");
const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const SAMPLE_SIZE = 40;

async function walkImages(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === "ENOENT") return acc;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkImages(full, acc);
      continue;
    }
    if (entry.isFile() && IMAGE_RE.test(entry.name)) acc.push(full);
  }
  return acc;
}

function norm(p) {
  return String(p).replaceAll("\\", "/");
}

function stemOf(name) {
  return basename(name, extname(name)).toLowerCase();
}

function labelKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripImageExt(p) {
  return norm(p).replace(/\.(png|jpe?g|webp|gif)$/i, "");
}

async function main() {
  const raw = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const assets = raw.assets ?? [];

  const byPath = new Set();
  const byPathStem = new Set();
  const byBasename = new Set();
  const byStem = new Set();
  const byId = new Set();
  const byLabel = new Set();

  for (const a of assets) {
    if (a.path) {
      const p = norm(a.path);
      byPath.add(p);
      byPathStem.add(stripImageExt(p));
      byBasename.add(basename(p).toLowerCase());
      byStem.add(stemOf(p));
    }
    if (a.id) {
      byId.add(String(a.id).toLowerCase());
      byStem.add(labelKey(a.id));
    }
    if (a.label) {
      byLabel.add(labelKey(a.label));
      byStem.add(labelKey(a.label));
    }
  }

  const roots = [
    { key: "publicGame", dir: join(ROOT, "public/game"), prefix: "public/game" },
    { key: "assetsRs3", dir: join(ROOT, "assets/rs3"), prefix: "assets/rs3" },
    { key: "assetsLeagues", dir: join(ROOT, "assets/leagues"), prefix: "assets/leagues" },
  ];

  const trees = {};

  for (const { key, dir, prefix } of roots) {
    const files = await walkImages(dir);
    const pathMatched = [];
    const softMatched = [];
    const unmatched = [];

    for (const full of files) {
      const rel = norm(relative(ROOT, full));
      const file = basename(full);
      const fileStem = stemOf(file);
      const lowerBase = file.toLowerCase();

      // Strict path match (plus public/game <-> assets/rs3 mirror)
      let pathReason = null;
      if (byPath.has(rel) || byPathStem.has(stripImageExt(rel))) {
        pathReason = "path";
      } else if (prefix === "public/game") {
        const under = norm(relative(join(ROOT, "public/game"), full));
        const assetsCand = `assets/rs3/${under}`;
        if (byPath.has(assetsCand) || byPathStem.has(stripImageExt(assetsCand))) {
          pathReason = "assets-path-map";
        }
      } else if (prefix === "assets/rs3") {
        const under = norm(relative(join(ROOT, "assets/rs3"), full));
        const pubCand = `public/game/${under}`;
        // reverse map is informational only for pathReason
        if (byPath.has(rel) || byPathStem.has(stripImageExt(rel))) pathReason = "path";
        void pubCand;
      }

      let softReason = null;
      if (!pathReason) {
        if (byBasename.has(lowerBase)) softReason = "basename";
        else if (byStem.has(fileStem)) softReason = "stem";
        else if (byId.has(fileStem)) softReason = "id";
        else if (byLabel.has(fileStem) || byLabel.has(labelKey(fileStem))) softReason = "label";
      }

      const row = {
        path: rel,
        basename: file,
        stem: fileStem,
        match: pathReason ?? softReason,
        matchKind: pathReason ? "path" : softReason ? "soft" : "none",
      };

      if (pathReason) pathMatched.push(row);
      else if (softReason) softMatched.push(row);
      else unmatched.push(row);
    }

    // Primary "matched" = path-level only (real provenance row for this file).
    // Soft matches are noted separately — basename can collide across categories.
    trees[key] = {
      root: prefix,
      total: files.length,
      matched: pathMatched.length,
      softMatched: softMatched.length,
      unmatched: unmatched.length + softMatched.length,
      unmatchedStrict: unmatched.length,
      pathMatchedCount: pathMatched.length,
      softMatchedCount: softMatched.length,
      unmatchedSample: [...unmatched, ...softMatched].slice(0, SAMPLE_SIZE).map((r) => r.path),
      unmatchedPaths: [...unmatched, ...softMatched].map((r) => r.path),
      unmatchedStrictPaths: unmatched.map((r) => r.path),
      softMatchedSample: softMatched.slice(0, SAMPLE_SIZE).map((r) => r.path),
    };
  }

  const publicUnmatched = trees.publicGame.unmatchedPaths;

  const priorityOrder = [
    "upgrades/permanent-unlocks",
    "upgrades/progression",
    "combat/equipment",
    "upgrades/combat-utility",
    "upgrades/ability-codices",
    "upgrades/permanent-equipment",
    "upgrades/enchantments",
    "upgrades/skilling-tools",
    "upgrades/skilling-outfits",
    "upgrades/skilling-production",
    "upgrades/skilling-utility",
    "upgrades/skilling-offhands",
  ];

  const priorityBuckets = Object.fromEntries(priorityOrder.map((k) => [k, []]));
  priorityBuckets.other = [];

  for (const p of publicUnmatched) {
    const rel = p.replace(/^public\/game\//, "");
    let bucketed = false;
    for (const key of priorityOrder) {
      if (rel === key || rel.startsWith(`${key}/`)) {
        priorityBuckets[key].push(p);
        bucketed = true;
        break;
      }
    }
    if (!bucketed) priorityBuckets.other.push(p);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    manifestPath: "assets/manifest.generated.json",
    manifestCount: assets.length,
    manifestGeneratedAt: raw.generatedAt ?? null,
    matchPolicy: {
      matched: "exact path or public/game -> assets/rs3 path map against assets[].path",
      softMatched: "basename / stem / id / label only (not counted as path provenance)",
      unmatched: "no path match (includes soft-only hits) — primary gap for registration",
    },
    counts: {
      totalScanned: trees.publicGame.total + trees.assetsRs3.total + trees.assetsLeagues.total,
      publicGame: {
        total: trees.publicGame.total,
        matched: trees.publicGame.matched,
        softMatched: trees.publicGame.softMatched,
        unmatched: trees.publicGame.unmatched,
        unmatchedStrict: trees.publicGame.unmatchedStrict,
      },
      assetsRs3: {
        total: trees.assetsRs3.total,
        matched: trees.assetsRs3.matched,
        softMatched: trees.assetsRs3.softMatched,
        unmatched: trees.assetsRs3.unmatched,
        unmatchedStrict: trees.assetsRs3.unmatchedStrict,
      },
      assetsLeagues: {
        total: trees.assetsLeagues.total,
        matched: trees.assetsLeagues.matched,
        softMatched: trees.assetsLeagues.softMatched,
        unmatched: trees.assetsLeagues.unmatched,
        unmatchedStrict: trees.assetsLeagues.unmatchedStrict,
      },
      primary: {
        total: trees.publicGame.total,
        matched: trees.publicGame.matched,
        unmatched: trees.publicGame.unmatched,
      },
    },
    unmatchedSample: {
      publicGame: trees.publicGame.unmatchedSample,
      assetsRs3: trees.assetsRs3.unmatchedSample,
      assetsLeagues: trees.assetsLeagues.unmatchedSample,
    },
    unmatchedPaths: {
      publicGame: publicUnmatched,
      assetsRs3: trees.assetsRs3.unmatchedPaths,
      assetsLeagues: trees.assetsLeagues.unmatchedPaths,
    },
    priorityBuckets: Object.fromEntries(
      Object.entries(priorityBuckets).map(([k, v]) => [k, { count: v.length, paths: v }]),
    ),
    notes: [
      "Path match is authoritative provenance; basename soft-match can false-positive across categories.",
      "Register gaps in assets/source-manifest.json, then harvest.",
      "Exit always 0; this is a report, not a gate.",
    ],
  };

  await mkdir(join(ROOT, "scraped-data"), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("public-game provenance gap report");
  console.log(`  manifest assets: ${assets.length}`);
  console.log(
    `  public/game: path-matched ${trees.publicGame.matched}/${trees.publicGame.total}, soft ${trees.publicGame.softMatched}, unmatched(path-gap) ${trees.publicGame.unmatched}`,
  );
  console.log(
    `  assets/rs3:  path-matched ${trees.assetsRs3.matched}/${trees.assetsRs3.total}, soft ${trees.assetsRs3.softMatched}, unmatched ${trees.assetsRs3.unmatched}`,
  );
  console.log(
    `  assets/leagues: path-matched ${trees.assetsLeagues.matched}/${trees.assetsLeagues.total}, soft ${trees.assetsLeagues.softMatched}, unmatched ${trees.assetsLeagues.unmatched}`,
  );
  console.log(`  wrote ${norm(relative(ROOT, OUT_PATH))}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 0;
});
