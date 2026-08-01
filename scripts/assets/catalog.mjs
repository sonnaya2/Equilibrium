/**
 * Reads the sharded asset provenance catalog under assets/catalog/.
 *
 * One 1.1 MB file made every asset change an unreviewable diff. The catalog is
 * split by domain instead; this is the only place that knows the layout, so
 * readers do not care how many files it is spread across.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const CATALOG_DIR = join(ROOT, "assets/catalog");

/** category prefix -> shard file. Longest matching prefix wins. */
export const SHARDS = [
  ["rs3/activities", "rs3/activities.json"],
  ["rs3/bosses", "rs3/bosses.json"],
  ["rs3/combat", "rs3/combat.json"],
  ["rs3/regions", "rs3/regions.json"],
  ["rs3/skills", "rs3/skills.json"],
  ["rs3/upgrades", "rs3/upgrades.json"],
  ["rs3", "rs3/misc.json"],
  ["leagues/catalyst", "leagues/catalyst.json"],
  ["leagues/equilibrium", "leagues/equilibrium.json"],
  ["brand", "brand.json"],
];

export function shardFor(category) {
  const match = SHARDS.filter(([prefix]) => category === prefix || category.startsWith(`${prefix}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (!match) throw new Error(`No catalog shard for category: ${category}`);
  return match[1];
}

async function shardFiles(dir = CATALOG_DIR, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await shardFiles(full, acc);
    else if (entry.name.endsWith(".json") && entry.name !== "schema.json") acc.push(full);
  }
  return acc;
}

/** Every catalog row, ordered by shard then by id, with its shard recorded. */
export async function loadCatalog() {
  const files = (await shardFiles()).sort();
  const assets = [];
  for (const file of files) {
    const shard = relative(CATALOG_DIR, file).split(sep).join("/");
    const rows = JSON.parse(await readFile(file, "utf8"));
    for (const row of rows) assets.push({ ...row, shard });
  }
  return { assets };
}
