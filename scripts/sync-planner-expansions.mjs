import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const inputPath = join(ROOT, "scraped-data/planner-expansions.json");
const outputPath = join(ROOT, "data/research/planner-expansions.json");
const data = JSON.parse(readFileSync(inputPath, "utf8"));

const requiredArrays = [
  "combat_training_spots",
  "runecrafting_altars",
  "invention_progression",
  "invention_component_sources",
  "archaeology_progression",
  "archaeology_combat_relics",
  "regional_unique_drops",
];

for (const key of requiredArrays) {
  if (!Array.isArray(data[key])) {
    throw new Error(`planner-expansions.json is missing array: ${key}`);
  }
}

function validateSources(rows, section) {
  for (const [index, row] of rows.entries()) {
    if (typeof row.source_url !== "string" || !row.source_url.startsWith("https://")) {
      throw new Error(`${section}[${index}] is missing a valid source_url`);
    }
  }
}

for (const key of requiredArrays) validateSources(data[key], key);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);

const counts = Object.fromEntries(requiredArrays.map((key) => [key, data[key].length]));
console.log("Synced planner expansions:", counts);
