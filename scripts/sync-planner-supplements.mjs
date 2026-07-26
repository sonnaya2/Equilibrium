import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();

const supplements = [
  "planner-expansions-archaeology-collections.json",
  "planner-expansions-archaeology-repeatables.json",
  "planner-expansions-archaeology-guild.json",
  "planner-expansions-archaeology-utilities.json",
  "planner-expansions-archaeology-production.json",
  "planner-expansions-archaeology-special-relics.json",
  "planner-expansions-invention-2026.json",
  "planner-expansions-invention-active-perks.json",
  "planner-expansions-invention-archaeology.json",
  "planner-expansions-invention-component-coverage.json",
  "planner-expansions-invention-material-bottlenecks.json",
  "planner-expansions-invention-perks.json",
  "planner-expansions-invention-utility-perks.json",
  "planner-expansions-slayer.json",
  "planner-expansions-slayer-collection.json",
  "planner-expansions-slayer-edge.json",
];

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

for (const file of supplements) {
  const inputPath = join(ROOT, "scraped-data", file);
  const outputPath = join(ROOT, "data", "research", file);
  const data = JSON.parse(readFileSync(inputPath, "utf8"));

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${file} must contain a JSON object`);
  }
  if (typeof data.snapshot_date !== "string" || !data.snapshot_date) {
    throw new Error(`${file} is missing snapshot_date`);
  }

  validateUrls(data, file);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
}

console.log("Synced planner supplements:", supplements.length);
