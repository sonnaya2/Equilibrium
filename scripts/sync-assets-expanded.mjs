import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE_PATH = join(ROOT, "assets/source-manifest.json");
const EXPANSION_PATHS = [
  join(ROOT, "assets/source-manifest-expansion.json"),
  join(ROOT, "assets/source-manifest-expansion-2.json"),
];
const GENERATED_PATH = join(ROOT, "assets/manifest.generated.json");

const originalText = await readFile(BASE_PATH, "utf8");
const base = JSON.parse(originalText);
const expansions = await Promise.all(
  EXPANSION_PATHS.map(async (path) => JSON.parse(await readFile(path, "utf8"))),
);

const overrides = new Map([
  [
    "boss-zamorak",
    {
      fileTitle: "Zamorak, Lord of Chaos model 1.jpg",
      search: "Zamorak Lord of Chaos model boss image",
    },
  ],
  [
    "boss-ambassador",
    {
      fileTitle: "The Ambassador (boss portal) texture.png",
      search: "The Ambassador boss portal texture",
    },
  ],
  [
    "activity-player-owned-farm",
    {
      fileTitle: "Player-owned farm.png",
      search: "Player-owned farm Manor Farm activity image",
    },
  ],
  [
    "activity-heart-of-gielinor",
    {
      fileTitle: "Heart of Gielinor skybox.png",
      search: "Heart of Gielinor location image",
    },
  ],
  [
    "activity-wars-retreat",
    {
      fileTitle: "War's Retreat.png",
      search: "War's Retreat location image",
    },
  ],
  [
    "activity-archaeology-guild",
    {
      fileTitle: "Collectors at the Archaeology Guild.png",
      search: "Archaeology Guild location image collectors",
    },
  ],
]);

function applyOverrides(asset) {
  const preferExactUpgradeIcon =
    asset.category?.startsWith("rs3/upgrades/") && !asset.fileTitle
      ? { fileTitle: `${asset.label}.png` }
      : {};
  return {
    ...asset,
    ...preferExactUpgradeIcon,
    ...(overrides.get(asset.id) ?? {}),
  };
}

const expansionAssets = expansions
  .flatMap((expansion) => expansion.assets ?? [])
  .map(applyOverrides);
const assets = [...(base.assets ?? []).map(applyOverrides), ...expansionAssets];
const ids = new Set();
const paths = new Set();

for (const asset of assets) {
  if (!asset?.id || !asset?.path) throw new Error("Every asset needs an id and path");
  if (ids.has(asset.id)) throw new Error(`Duplicate asset id: ${asset.id}`);
  if (paths.has(asset.path)) throw new Error(`Duplicate asset path: ${asset.path}`);
  ids.add(asset.id);
  paths.add(asset.path);
}

// Remove stale variants when a pinned or exact source changes the output extension.
for (const stalePath of [
  "assets/rs3/bosses/zamorak.png",
  "assets/rs3/bosses/ambassador.gif",
]) {
  await unlink(join(ROOT, stalePath)).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
}

const merged = {
  ...base,
  snapshotDate: expansions.at(-1)?.snapshotDate ?? base.snapshotDate,
  notes: [
    ...(base.notes ?? []),
    ...expansions.flatMap((expansion) => expansion.notes ?? []),
  ],
  assets,
};

await writeFile(BASE_PATH, `${JSON.stringify(merged, null, 2)}\n`);

try {
  await import(`./sync-assets.mjs?expanded=${Date.now()}`);

  const generated = JSON.parse(await readFile(GENERATED_PATH, "utf8"));
  generated.sourceManifest = "assets/source-manifest.json";
  generated.sourceManifests = [
    "assets/source-manifest.json",
    "assets/source-manifest-expansion.json",
    "assets/source-manifest-expansion-2.json",
  ];
  generated.expansionManifests = [
    "assets/source-manifest-expansion.json",
    "assets/source-manifest-expansion-2.json",
  ];
  await writeFile(GENERATED_PATH, `${JSON.stringify(generated, null, 2)}\n`);
} finally {
  await writeFile(BASE_PATH, originalText);
}
