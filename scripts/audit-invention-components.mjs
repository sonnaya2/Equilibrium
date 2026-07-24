import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const expected = [
  "Armadyl",
  "Ascended",
  "Avernic",
  "Bandos",
  "Brassican",
  "Clockwork",
  "Corporeal",
  "Culinary",
  "Cywir",
  "Dragonfire",
  "Ecliptic",
  "Explosive",
  "Faceted",
  "Fortunate",
  "Fungal",
  "Harnessed",
  "Ilujankan",
  "Knightly",
  "Manufactured",
  "Noxious",
  "Oceanic",
  "Pestiferous",
  "Resilient",
  "Rumbling",
  "Saradomin",
  "Seren",
  "Shadow",
  "Shifting",
  "Silent",
  "Third-age",
  "Undead",
  "Zamorak",
  "Zaros",
];

const sources = [
  read("scraped-data/planner-expansions-slayer.json").invention_component_chains,
  read("scraped-data/planner-expansions-invention-archaeology.json").rare_component_routes,
  [
    ...read("scraped-data/planner-expansions-invention-2026.json").new_2026_component_routes,
    ...read("scraped-data/planner-expansions-invention-2026.json").account_component_routes,
  ],
  [
    ...read("scraped-data/planner-expansions-invention-perks.json").component_supply_routes,
    ...read("scraped-data/planner-expansions-invention-perks.json").global_or_account_component_routes,
  ],
  read("scraped-data/planner-expansions-invention-component-coverage.json").remaining_component_routes,
];

const coverage = read("scraped-data/planner-expansions-invention-component-coverage.json");
if (coverage.current_rare_component_family_count !== expected.length) {
  throw new Error(
    `Rare-component taxonomy count drift: expected ${expected.length}, file says ${coverage.current_rare_component_family_count}`,
  );
}
if (coverage.coverage_after_this_file !== expected.length) {
  throw new Error(`Coverage manifest is not complete: ${coverage.coverage_after_this_file}/${expected.length}`);
}

const text = sources.flat().map((row) => String(row.component ?? "").toLowerCase()).join("\n");
const missing = expected.filter((name) => !text.includes(name.toLowerCase()));

if (missing.length > 0) {
  throw new Error(`Rare Invention component coverage is incomplete: ${missing.join(", ")}`);
}

console.log(`Rare Invention component coverage: ${expected.length}/${expected.length}`);
