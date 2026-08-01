/**
 * Generates src/lib/dataIconIndex.ts from assets/ and the asset catalog.
 *
 * The lookups gameArt.ts resolves against used to be derived from public/game -
 * generated web output feeding application source. This derives them from the
 * same publish plan the publisher uses, so a clean clone reproduces the file
 * without the web tree existing at all.
 *
 *   node scripts/assets/build-icon-index.mjs [--check]
 *
 * --check regenerates in memory and exits non-zero if the committed file differs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import prettier from "prettier";
import { planPublish } from "./plan.mjs";

const ROOT = process.cwd();
const CHECK = process.argv.includes("--check");
const OUT = "src/lib/dataIconIndex.ts";
const EXT = /\.(png|jpg|jpeg|gif|webp)$/i;

const { targets, collisions } = await planPublish(ROOT);
if (collisions.length) {
  console.error(`ICON INDEX: ${collisions.length} publish collision(s); fix those first`);
  for (const c of collisions) console.error(`  ${c.target} <- ${c.sources.join(" AND ")}`);
  process.exit(1);
}

/** Published paths under game/<category>/, sorted so output never depends on walk order. */
const published = [...targets.keys()]
  .filter((target) => EXT.test(target))
  .sort();

/** slug -> path relative to the category root, first match in sorted order. */
function bySlug(category) {
  const prefix = `game/${category}/`;
  const out = {};
  for (const target of published) {
    if (!target.startsWith(prefix)) continue;
    const rel = target.slice(prefix.length);
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
for (const rel of Object.values(bySlug("bosses"))) {
  const file = rel.slice(rel.lastIndexOf("/") + 1);
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

const body = `/** Generated from assets/ by scripts/assets/build-icon-index.mjs - do not hand-edit. */
export const UPGRADE_ICON_BY_SLUG: Record<string, string> = ${JSON.stringify(upgradeBySlug, null, 2)};

export const ACTIVITY_ICON_BY_SLUG: Record<string, string> = ${JSON.stringify(activityBySlug, null, 2)};

export const BOSS_ICON_SLUGS = new Set(${JSON.stringify(bossSlugs)});

/** Non-webp boss file extensions keyed by slug (legacy only; usually empty). */
export const BOSS_ICON_EXT: Record<string, string> = ${JSON.stringify(bossExt, null, 2)};

export const SKILL_ICON_SLUGS = new Set(${JSON.stringify(skillSlugs)});
`;

const formatted = await prettier.format(body, {
  ...(await prettier.resolveConfig(join(ROOT, OUT))),
  filepath: OUT,
});

const counts =
  `upgrades ${Object.keys(upgradeBySlug).length}, activities ${Object.keys(activityBySlug).length}, ` +
  `bosses ${bossSlugs.length}, skills ${skillSlugs.length}`;

if (CHECK) {
  if (readFileSync(join(ROOT, OUT), "utf8") === formatted) {
    console.log(`ICON INDEX OK: ${counts}`);
    process.exit(0);
  }
  console.error(`ICON INDEX DRIFT: ${OUT} does not match assets/ - run npm run assets:index`);
  process.exit(1);
}

writeFileSync(join(ROOT, OUT), formatted);
console.log(`ICON INDEX: wrote ${OUT} (${counts})`);
