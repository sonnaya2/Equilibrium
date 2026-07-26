/**
 * One-shot / re-run fence for catalog region upgrades.
 *
 * Usage:
 *   node scripts/dedupe-catalog-upgrades.mjs
 *   node scripts/dedupe-catalog-upgrades.mjs --dry-run
 *
 * See scraped-data/fix-patches/issue-08-fence.md
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const ROOT = process.cwd();
const CATALOG_PATH = join(ROOT, "data/research/catalog.json");
const dryRun = process.argv.includes("--dry-run");

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
const before = (catalog.regions || []).reduce((n, r) => n + (r.upgrades || []).length, 0);
const stats = dedupeRegionUpgrades(catalog);
const after = (catalog.regions || []).reduce((n, r) => n + (r.upgrades || []).length, 0);

const report = {
  dryRun,
  catalog: "data/research/catalog.json",
  upgradesBefore: before,
  upgradesAfter: after,
  removed: before - after,
  ...stats,
};

if (!dryRun) {
  writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
