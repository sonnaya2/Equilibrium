import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { brotliCompressSync } from "node:zlib";

const ROOT = process.cwd();
const SOURCE = join(ROOT, "data/research/catalog.json");
const TARGET = join(ROOT, "public/data/v1/research");
const CHECK = process.argv.includes("--check");
const MAX_REGION_BROTLI_BYTES = 64 * 1024;

const catalog = JSON.parse(readFileSync(SOURCE, "utf8"));
const methods = new Map();
const methodIds = new Set();
const skillIds = new Set();
const regionIds = new Set();
const files = new Map();

const hash = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => `${JSON.stringify(value)}\n`;
const normalizedName = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

function unique(set, value, label) {
  if (!value) throw new Error(`${label} is missing`);
  if (set.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
  set.add(value);
}

function uniqueNames(rows, label) {
  const names = new Set();
  for (const row of rows) unique(names, normalizedName(row.name), label);
}

for (const skill of catalog.skills ?? []) {
  unique(skillIds, skill.id, "skill id");
  for (const method of skill.methods ?? []) {
    unique(methodIds, method.id, "training method id");
    methods.set(method.id, method);
  }
}

const regionFiles = [];
for (const region of catalog.regions ?? []) {
  unique(regionIds, region.id, "region id");
  uniqueNames(region.content ?? [], `${region.id} content name`);
  uniqueNames(region.upgrades ?? [], `${region.id} upgrade name`);

  const training = (region.trainingMethodIds ?? []).map((id) => {
    const method = methods.get(id);
    if (!method) throw new Error(`${region.id} references missing training method ${id}`);
    return method;
  });
  const { trainingMethodIds: _, ...base } = region;
  const body = json({ ...base, training });
  const brotliBytes = brotliCompressSync(body).length;
  if (brotliBytes > MAX_REGION_BROTLI_BYTES) {
    throw new Error(
      `${region.id} shard is ${brotliBytes} Brotli bytes; budget is ${MAX_REGION_BROTLI_BYTES}`,
    );
  }

  const path = `regions/${region.id}.json`;
  files.set(path, body);
  regionFiles.push({
    id: region.id,
    name: region.name,
    availability: region.availability,
    training: training.length,
    href: `/data/v1/research/${path}`,
    bytes: Buffer.byteLength(body),
    brotliBytes,
    sha256: hash(body),
  });
}

const catalogBody = json(catalog);
const index = {
  schemaVersion: 1,
  snapshotDate: catalog.snapshotDate,
  catalogSha256: hash(catalogBody),
  regions: regionFiles,
  skills: catalog.skills.map(({ id, name }) => ({ id, name })),
};
files.set("index.json", json(index));

function diskFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? diskFiles(path) : [relative(TARGET, path).replaceAll("\\", "/")];
  });
}

if (CHECK) {
  const actual = new Set(diskFiles(TARGET));
  const stale = [...actual].filter((path) => !files.has(path));
  const changed = [...files].filter(
    ([path, body]) => !actual.has(path) || readFileSync(join(TARGET, path), "utf8") !== body,
  );
  if (stale.length || changed.length) {
    for (const path of stale) console.error(`Stale research shard: ${path}`);
    for (const [path] of changed) console.error(`Outdated research shard: ${path}`);
    process.exit(1);
  }
  console.log(`Research store valid: ${regionFiles.length} region shards`);
  process.exit(0);
}

mkdirSync(dirname(TARGET), { recursive: true });
const temporary = mkdtempSync(join(dirname(TARGET), ".research-"));
for (const [path, body] of files) {
  const destination = join(temporary, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, body);
}
rmSync(TARGET, { force: true, recursive: true });
cpSync(temporary, TARGET, { recursive: true });
rmSync(temporary, { force: true, recursive: true });
console.log(`Research store built: ${regionFiles.length} region shards`);
