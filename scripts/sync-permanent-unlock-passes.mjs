import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();

// Research passes copied verbatim into data/reference/ so the app can load them.
const passes = [
  "combat-consumables-pass-1.json",
  "permanent-unlocks-pass-3.json",
  "permanent-unlocks-pass-5.json",
];

// Canonical supplements aggregated from progression/planner enrichment overlays.
// Row order and id set are pinned by audit-drop-cleaner-enrichment.mjs,
// audit-container-bag-enrichment.mjs and audit-progression-enrichment.mjs.
const supplements = [
  {
    output: "data/reference/progression-support-items-2026-07-25.json",
    purpose: "Canonical supplement for combat support equipment added after the latest monolithic progression normalization.",
    key: "equipment_additions",
    rename: "equipment_models",
    inputs: [
      "progression-enrichment-support-items-2026-07-25.json",
      "progression-enrichment-drop-cleaners-2026-07-25.json",
      "progression-enrichment-spring-cleaner-2026-07-25.json",
    ],
  },
  {
    output: "data/reference/progression-container-bags-2026-07-25.json",
    purpose: "Canonical container-bag supplement pending the next monolithic progression normalization.",
    key: "equipment_additions",
    rename: "equipment_models",
    inputs: ["progression-enrichment-container-bags-2026-07-25.json"],
  },
  {
    output: "data/research/planner-support-items-2026-07-25.json",
    purpose: "Canonical regional support-item supplement pending the next monolithic planner normalization.",
    key: "regional_unique_drop_additions",
    rename: "regional_unique_drops",
    inputs: ["planner-enrichment-support-items-2026-07-25.json"],
  },
];

function read(file) {
  return JSON.parse(readFileSync(join(ROOT, "scraped-data", file), "utf8"));
}

function write(outputPath, data) {
  mkdirSync(dirname(join(ROOT, outputPath)), { recursive: true });
  writeFileSync(join(ROOT, outputPath), `${JSON.stringify(data, null, 2)}\n`);
}

function validateUrls(value, path = "root") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateUrls(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, entry] of Object.entries(value)) {
    const currentPath = `${path}.${key}`;
    if (key.endsWith("_url") && typeof entry === "string" && !entry.startsWith("https://")) {
      throw new Error(`${currentPath} must use https://`);
    }
    if (key.endsWith("_urls") && Array.isArray(entry)) {
      for (const [index, url] of entry.entries()) {
        if (typeof url !== "string" || !url.startsWith("https://")) {
          throw new Error(`${currentPath}[${index}] must use https://`);
        }
      }
    }
    validateUrls(entry, currentPath);
  }
}

function validatePass(file, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${file} must contain a JSON object`);
  }
  if (typeof data.snapshot_date !== "string" || !data.snapshot_date) {
    throw new Error(`${file} is missing snapshot_date`);
  }
  validateUrls(data, file);
}

for (const file of passes) {
  const data = read(file);
  validatePass(file, data);
  write(`data/reference/${file}`, data);
}

for (const supplement of supplements) {
  const rows = [];
  let snapshotDate = "";
  for (const input of supplement.inputs) {
    const data = read(input);
    validatePass(input, data);
    if (data.snapshot_date > snapshotDate) snapshotDate = data.snapshot_date;
    for (const row of data[supplement.key] ?? []) {
      if (typeof row?.id !== "string" || !row.id) {
        throw new Error(`${input} contains a ${supplement.key} row without an id`);
      }
      if (rows.some((existing) => existing.id === row.id)) {
        throw new Error(`${input} duplicates id already aggregated: ${row.id}`);
      }
      rows.push(row);
    }
  }
  if (!rows.length) throw new Error(`${supplement.output} would be empty`);
  write(supplement.output, {
    snapshot_date: snapshotDate,
    purpose: supplement.purpose,
    [supplement.rename]: rows,
  });
}

console.log(`Synced permanent-unlock passes: ${passes.length} pass file(s), ${supplements.length} canonical supplement(s)`);
