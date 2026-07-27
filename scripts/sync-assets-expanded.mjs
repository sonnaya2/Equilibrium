import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const ASSETS_DIR = join(ROOT, "assets");
const BASE_PATH = join(ASSETS_DIR, "source-manifest.json");
const GENERATED_PATH = join(ASSETS_DIR, "manifest.generated.json");

const expansionNames = (await readdir(ASSETS_DIR))
  .filter((name) => /^source-manifest-expansion(?:-\d+)?\.json$/.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const EXPANSION_FILES = expansionNames.map((name) => `assets/${name}`);

const originalText = await readFile(BASE_PATH, "utf8");
const base = JSON.parse(originalText);
const expansions = await Promise.all(
  expansionNames.map(async (name) => JSON.parse(await readFile(join(ASSETS_DIR, name), "utf8"))),
);

const overrides = new Map([
  ["boss-zamorak", { fileTitle: "Zamorak, Lord of Chaos model 1.jpg", search: "Zamorak Lord of Chaos model boss image" }],
  ["boss-ambassador", { fileTitle: "The Ambassador (boss portal) texture.png", search: "The Ambassador boss portal texture" }],
  ["activity-player-owned-farm", { fileTitle: "Player-owned farm.png", search: "Player-owned farm Manor Farm activity image" }],
  ["activity-heart-of-gielinor", { fileTitle: "Heart of Gielinor skybox.png", search: "Heart of Gielinor location image" }],
  ["activity-wars-retreat", { fileTitle: "War's Retreat.png", search: "War's Retreat location image" }],
  ["activity-archaeology-guild", { fileTitle: "Collectors at the Archaeology Guild.png", search: "Archaeology Guild location image collectors" }],
  ["activity-big-game-hunter", { fileTitle: "Big Game Hunter arena.png", search: "Big Game Hunter arena activity image" }],
  ["activity-wilderness-agility-course", { fileTitle: "Wilderness Agility course.png", search: "Wilderness Agility Course location image" }],
  ["activity-max-guild", { fileTitle: "Max guild top view.png", search: "Max Guild top view location image" }],
  ["activity-monastery-of-ascension", { fileTitle: "Monastery of Ascension building.png", search: "Monastery of Ascension building location image" }],
  ["activity-sophanem-slayer-dungeon", { fileTitle: "Sophanem Slayer Dungeon.png", search: "Sophanem Slayer Dungeon location image" }],
  ["activity-god-wars-dungeon", { fileTitle: "God Wars Dungeon.png", search: "God Wars Dungeon location image" }],
  ["activity-artisans-workshop", { fileTitle: "Artisans' Workshop.png", search: "Artisans Workshop location image" }],
  ["place-cooks-guild", { fileTitle: "Cooking Guild.png", search: "Cooking Guild exterior location image" }],
  ["activity-everlight-dig-site", { fileTitle: "Everlight.png", search: "Everlight Dig Site location image" }],
  ["activity-barrows", { fileTitle: "Barrows Scenery.png", search: "Barrows scenery minigame location image" }],
  ["activity-rise-of-the-six", { fileTitle: "Well (Barrows Rise of the Six).png", search: "Rise of the Six entrance well boss activity image" }],
  ["activity-time-altar", { fileTitle: "Time Altar inside.png", search: "Time Altar inside current Rune Temple image" }],
  ["activity-livid-farm", { fileTitle: "Livid Farm.png", search: "Livid Farm location image" }],
  ["activity-lunar-isle", { fileTitle: "Lunar Isle.png", search: "Lunar Isle location image" }],
  ["activity-mage-arena", { fileTitle: "Succession - Bilrach's ritual.png", search: "Mage Arena Wilderness location image" }],
  ["upgrade-subjugation", { fileTitle: "Garb of subjugation.png", search: "Garb of subjugation inventory icon" }],
  ["activity-waterfall-fishing", { fileTitle: "Prifddinas waterfall fishing.png", canonicalPage: "https://runescape.wiki/w/Prifddinas_Waterfall_Fishing", search: "Prifddinas Waterfall Fishing activity image" }],
  ["skilling-pickaxe-earth-song", { fileTitle: "Pickaxe of earth and song.png", canonicalPage: "https://runescape.wiki/w/Pickaxe_of_earth_and_song", search: "Pickaxe of earth and song inventory icon" }],
  ["skilling-hatchet-ember-glade", { fileTitle: "Hatchet of ember and glade.png", canonicalPage: "https://runescape.wiki/w/Hatchet_of_ember_and_glade", search: "Hatchet of ember and glade inventory icon" }],
  ["skilling-hatchet-bloom-blight", { fileTitle: "Hatchet of bloom and blight.png", canonicalPage: "https://runescape.wiki/w/Hatchet_of_bloom_and_blight", search: "Hatchet of bloom and blight inventory icon" }],
  ["skilling-gem-bag-upgraded", { fileTitle: "Gem bag (upgraded).png", canonicalPage: "https://runescape.wiki/w/Gem_bag_(upgraded)", search: "Gem bag upgraded inventory icon" }],
  ["skilling-autoheater", { fileTitle: "Advanced smithing autoheater.png", canonicalPage: "https://runescape.wiki/w/Advanced_smithing_autoheater", search: "Advanced smithing autoheater inventory icon" }],
]);

function applyOverrides(asset) {
  const exactUpgrade = asset.category?.startsWith("rs3/upgrades/") && !asset.fileTitle
    ? { fileTitle: `${asset.label}.png` }
    : {};
  return { ...asset, ...exactUpgrade, ...(overrides.get(asset.id) ?? {}) };
}

const assets = [
  ...(base.assets ?? []).map(applyOverrides),
  ...expansions.flatMap((expansion) => expansion.assets ?? []).map(applyOverrides),
];
const ids = new Set();
const paths = new Set();
for (const asset of assets) {
  if (!asset?.id || !asset?.path) throw new Error("Every asset needs an id and path");
  if (ids.has(asset.id)) throw new Error(`Duplicate asset id: ${asset.id}`);
  if (paths.has(asset.path)) throw new Error(`Duplicate asset path: ${asset.path}`);
  ids.add(asset.id);
  paths.add(asset.path);
}

for (const stalePath of ["assets/rs3/bosses/zamorak.png", "assets/rs3/bosses/ambassador.gif"]) {
  await unlink(join(ROOT, stalePath)).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
}

const merged = {
  ...base,
  snapshotDate: expansions.at(-1)?.snapshotDate ?? base.snapshotDate,
  notes: [...(base.notes ?? []), ...expansions.flatMap((expansion) => expansion.notes ?? [])],
  assets,
};
await writeFile(BASE_PATH, `${JSON.stringify(merged, null, 2)}\n`);

try {
  await import(`./sync-assets.mjs?expanded=${Date.now()}`);
  const generated = JSON.parse(await readFile(GENERATED_PATH, "utf8"));
  generated.sourceManifest = "assets/source-manifest.json";
  generated.sourceManifests = ["assets/source-manifest.json", ...EXPANSION_FILES];
  generated.expansionManifests = EXPANSION_FILES;
  await writeFile(GENERATED_PATH, `${JSON.stringify(generated, null, 2)}\n`);
} finally {
  await writeFile(BASE_PATH, originalText);
}
