import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE_PATH = join(ROOT, "assets/source-manifest.json");
const EXPANSION_PATH = join(ROOT, "assets/source-manifest-expansion.json");
const GENERATED_PATH = join(ROOT, "assets/manifest.generated.json");

const originalText = await readFile(BASE_PATH, "utf8");
const base = JSON.parse(originalText);
const expansion = JSON.parse(await readFile(EXPANSION_PATH, "utf8"));

const overrides = new Map([
  [
    "boss-zamorak",
    {
      fileTitle: "Zamorak, Lord of Chaos model 1.jpg",
      search: "Zamorak Lord of Chaos model boss image",
    },
  ],
]);

const expansionAssets = (expansion.assets ?? []).map((asset) => ({
  ...asset,
  ...(overrides.get(asset.id) ?? {}),
}));
const assets = [...(base.assets ?? []), ...expansionAssets];
const ids = new Set();
const paths = new Set();

for (const asset of assets) {
  if (!asset?.id || !asset?.path) throw new Error("Every asset needs an id and path");
  if (ids.has(asset.id)) throw new Error(`Duplicate asset id: ${asset.id}`);
  if (paths.has(asset.path)) throw new Error(`Duplicate asset path: ${asset.path}`);
  ids.add(asset.id);
  paths.add(asset.path);
}

// The first broad search resolved a seasonal Zamorak variant. Remove it before
// writing the pinned model render so stale art cannot survive an extension change.
await unlink(join(ROOT, "assets/rs3/bosses/zamorak.png")).catch((error) => {
  if (error?.code !== "ENOENT") throw error;
});

const merged = {
  ...base,
  snapshotDate: expansion.snapshotDate ?? base.snapshotDate,
  notes: [...(base.notes ?? []), ...(expansion.notes ?? [])],
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
  ];
  generated.expansionManifest = "assets/source-manifest-expansion.json";
  await writeFile(GENERATED_PATH, `${JSON.stringify(generated, null, 2)}\n`);
} finally {
  await writeFile(BASE_PATH, originalText);
}
