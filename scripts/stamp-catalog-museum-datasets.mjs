/**
 * Stamp catalog.datasets.museumCollectionMatrix + museumCollectionUnobtainable
 * from the merged museum collection matrix.
 *
 * Prefer data/research (post sync-planner-supplements); fall back to scraped-data
 * durable mirror (post merge-museum-collection-matrix).
 *
 * Standalone:
 *   node scripts/stamp-catalog-museum-datasets.mjs
 *
 * Invoked at end of sync-planner-supplements.mjs (normalize:data path).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const CATALOG = "data/research/catalog.json";
const MATRIX_CANDIDATES = [
  "data/research/planner-expansions-archaeology-museum-collections-matrix.json",
  "scraped-data/planner-expansions-archaeology-museum-collections-matrix.json",
];

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const write = (rel, value) => {
  writeFileSync(join(ROOT, rel), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

/**
 * @returns {{ total: number, unobtainable: number, matrixPath: string }}
 */
export function stampCatalogMuseumDatasets() {
  const matrixPath = MATRIX_CANDIDATES.find((p) => existsSync(join(ROOT, p)));
  if (!matrixPath) {
    throw new Error(
      [
        "Museum matrix not found. Expected one of:",
        ...MATRIX_CANDIDATES.map((p) => `  ${p}`),
        "Run: node scripts/merge-museum-collection-matrix.mjs",
      ].join("\n"),
    );
  }
  if (!existsSync(join(ROOT, CATALOG))) {
    throw new Error(`Catalog missing: ${CATALOG}`);
  }

  const matrix = read(matrixPath);
  const collections = Array.isArray(matrix.collections) ? matrix.collections : [];
  const total =
    typeof matrix.counts?.total === "number" ? matrix.counts.total : collections.length;
  const unobtainable =
    typeof matrix.counts?.unobtainable === "number"
      ? matrix.counts.unobtainable
      : collections.filter((c) => c?.status === "unobtainable").length;

  if (!Number.isFinite(total) || total < 0) {
    throw new Error(`Invalid museum matrix total from ${matrixPath}: ${total}`);
  }
  if (!Number.isFinite(unobtainable) || unobtainable < 0) {
    throw new Error(`Invalid museum matrix unobtainable from ${matrixPath}: ${unobtainable}`);
  }

  const catalog = read(CATALOG);
  catalog.datasets ||= {};
  const before = {
    matrix: catalog.datasets.museumCollectionMatrix,
    unobtainable: catalog.datasets.museumCollectionUnobtainable,
  };
  catalog.datasets.museumCollectionMatrix = total;
  catalog.datasets.museumCollectionUnobtainable = unobtainable;
  write(CATALOG, catalog);

  console.log(
    [
      "STAMP CATALOG MUSEUM DATASETS",
      `  matrix source: ${matrixPath}`,
      `  museumCollectionMatrix: ${before.matrix ?? "(absent)"} -> ${total}`,
      `  museumCollectionUnobtainable: ${before.unobtainable ?? "(absent)"} -> ${unobtainable}`,
    ].join("\n"),
  );

  return { total, unobtainable, matrixPath };
}

const isMain =
  Boolean(process.argv[1]) && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  try {
    stampCatalogMuseumDatasets();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
