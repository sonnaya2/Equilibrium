/**
 * Generates src/lib/dataIconIndex.ts from public/game.
 *
 * public/game is the art tree - what is on disk is what the browser gets - so
 * the lookups gameArt.ts resolves against are read straight off it.
 *
 *   node scripts/assets/build-icon-index.mjs [--check]
 *
 * --check regenerates in memory and exits non-zero if the committed file differs.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import prettier from "prettier";

const ROOT = process.cwd();
const CHECK = process.argv.includes("--check");
const OUT = "src/lib/dataIconIndex.ts";
const GAME = join(ROOT, "public/game");
const EXT = /\.(png|jpg|jpeg|gif|webp)$/i;

/** Sorted walk so output never depends on filesystem enumeration order. */
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (EXT.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** slug -> path relative to the category root, first match in sorted order. */
function bySlug(category) {
  const root = join(GAME, category);
  const out = {};
  for (const path of walk(root)) {
    const rel = relative(root, path).split(sep).join("/");
    const slug = rel.slice(rel.lastIndexOf("/") + 1).replace(EXT, "");
    out[slug] ??= rel;
  }
  return out;
}

const upgradeBySlug = bySlug("upgrades");
const activityBySlug = bySlug("activities");

/** Prefer webp > png > jpg > gif when one boss has several files. */
const EXT_RANK = { webp: 4, png: 3, jpg: 2, jpeg: 2, gif: 1 };
const extOf = (file) => file.slice(file.lastIndexOf(".") + 1).toLowerCase().replace("jpeg", "jpg");

const bossBySlug = {};
for (const file of readdirSync(join(GAME, "bosses")).filter((name) => EXT.test(name))) {
  const slug = file.replace(EXT, "");
  const previous = bossBySlug[slug];
  if (!previous || (EXT_RANK[extOf(file)] ?? 0) > (EXT_RANK[extOf(previous)] ?? 0)) {
    bossBySlug[slug] = file;
  }
}
const bossExt = {};
for (const [slug, file] of Object.entries(bossBySlug)) {
  if (extOf(file) !== "webp") bossExt[slug] = extOf(file);
}

const bossSlugs = Object.keys(bossBySlug).sort();
const skillSlugs = Object.keys(bySlug("skills")).sort();
// League art often lands before the record describing it does, so these are
// membership sets: art resolves by name as soon as a record names it.
const relicSlugs = Object.keys(bySlug("relics")).sort();
const blessingSlugs = Object.keys(bySlug("blessings")).sort();
// Combat equipment inventory icons live flat under combat/equipment/.
const equipmentSlugs = Object.keys(bySlug(join("combat", "equipment"))).sort();

const body = `/** Generated from public/game by scripts/assets/build-icon-index.mjs - do not hand-edit. */
export const UPGRADE_ICON_BY_SLUG: Record<string, string> = ${JSON.stringify(upgradeBySlug, null, 2)};

export const ACTIVITY_ICON_BY_SLUG: Record<string, string> = ${JSON.stringify(activityBySlug, null, 2)};

export const BOSS_ICON_SLUGS = new Set(${JSON.stringify(bossSlugs)});

/** Non-webp boss file extensions keyed by slug (legacy only; usually empty). */
export const BOSS_ICON_EXT: Record<string, string> = ${JSON.stringify(bossExt, null, 2)};

export const SKILL_ICON_SLUGS = new Set(${JSON.stringify(skillSlugs)});

export const RELIC_ICON_SLUGS = new Set(${JSON.stringify(relicSlugs)});

export const BLESSING_ICON_SLUGS = new Set(${JSON.stringify(blessingSlugs)});

/** Verified local combat equipment inventory icons under public/game/combat/equipment/. */
export const EQUIPMENT_ICON_SLUGS = new Set(${JSON.stringify(equipmentSlugs)});
`;

const formatted = await prettier.format(body, {
  ...(await prettier.resolveConfig(join(ROOT, OUT))),
  filepath: OUT,
});

const counts =
  `upgrades ${Object.keys(upgradeBySlug).length}, activities ${Object.keys(activityBySlug).length}, ` +
  `bosses ${bossSlugs.length}, skills ${skillSlugs.length}, relics ${relicSlugs.length}, ` +
  `blessings ${blessingSlugs.length}, equipment ${equipmentSlugs.length}`;

if (CHECK) {
  if (readFileSync(join(ROOT, OUT), "utf8") === formatted) {
    console.log(`ICON INDEX OK: ${counts}`);
    process.exit(0);
  }
  console.error(`ICON INDEX DRIFT: ${OUT} does not match public/game - run npm run art:index`);
  process.exit(1);
}

writeFileSync(join(ROOT, OUT), formatted);
console.log(`ICON INDEX: wrote ${OUT} (${counts})`);
