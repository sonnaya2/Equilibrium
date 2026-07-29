import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const CATALOG = "data/research/catalog.json";
const MATRIX_CANDIDATES = [
  "data/research/planner-expansions-archaeology-museum-collections-matrix.json",
  "scraped-data/planner-expansions-archaeology-museum-collections-matrix.json",
];

const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

export function stampCatalogMuseumDatasets() {
  const matrixPath = MATRIX_CANDIDATES.find((path) => existsSync(join(ROOT, path)));
  if (!matrixPath) throw new Error(`Museum matrix not found: ${MATRIX_CANDIDATES.join(" or ")}`);

  const matrix = read(matrixPath);
  const collections = Array.isArray(matrix.collections) ? matrix.collections : [];
  const total = matrix.counts?.total ?? collections.length;
  const unobtainable =
    matrix.counts?.unobtainable ??
    collections.filter((collection) => collection?.status === "unobtainable").length;
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(unobtainable) || unobtainable < 0) {
    throw new Error(`Invalid museum matrix counts in ${matrixPath}`);
  }

  const catalog = read(CATALOG);
  catalog.datasets ||= {};
  catalog.datasets.museumCollectionMatrix = total;
  catalog.datasets.museumCollectionUnobtainable = unobtainable;
  writeFileSync(join(ROOT, CATALOG), `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Museum datasets: ${total} collections, ${unobtainable} unobtainable`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  stampCatalogMuseumDatasets();
}
