import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

function normalizeMaterial(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\d+(?:\.\d+)?\s+/, "")
    .replace(/\s+(?:components?|parts?)$/i, "")
    .replace(/\s+warpriest farm$/i, "")
    .trim()
    .toLowerCase();
}

function addComponentField(set, value) {
  for (const part of String(value ?? "").split(/\s*\/\s*/)) {
    const normalized = normalizeMaterial(part);
    if (normalized) set.add(normalized);
  }
}

const slayer = read("scraped-data/planner-expansions-slayer.json");
const archaeology = read("scraped-data/planner-expansions-invention-archaeology.json");
const invention2026 = read("scraped-data/planner-expansions-invention-2026.json");
const perks = read("scraped-data/planner-expansions-invention-perks.json");
const utilityPerks = read("scraped-data/planner-expansions-invention-utility-perks.json");
const rareCoverage = read("scraped-data/planner-expansions-invention-component-coverage.json");
const bottlenecks = read("scraped-data/planner-expansions-invention-material-bottlenecks.json");

const supply = new Set();
for (const row of archaeology.ancient_invention_materials) addComponentField(supply, row.component);
for (const row of archaeology.rare_component_routes) addComponentField(supply, row.component);
for (const row of invention2026.new_2026_component_routes) addComponentField(supply, row.component);
for (const row of invention2026.account_component_routes) addComponentField(supply, row.component);
for (const row of perks.component_supply_routes) addComponentField(supply, row.component);
for (const row of perks.global_or_account_component_routes) addComponentField(supply, row.component);
for (const row of rareCoverage.remaining_component_routes) addComponentField(supply, row.component);
for (const row of bottlenecks.materials) addComponentField(supply, row.material);
for (const row of slayer.invention_component_chains) addComponentField(supply, row.component);

const recipeMaterials = new Set();
const addRecipe = (value) => {
  const normalized = normalizeMaterial(value);
  if (normalized) recipeMaterials.add(normalized);
};

for (const row of archaeology.current_perk_component_dependencies) {
  for (const value of row.components ?? []) addRecipe(value);
}

for (const row of invention2026.current_2026_perk_dependencies) {
  for (const value of row.recommended_components ?? []) addRecipe(value);
  for (const combo of row.important_combinations ?? []) {
    for (const value of combo.components ?? []) addRecipe(value);
  }
}

for (const row of perks.current_armour_perk_recipes) {
  for (const value of row.representative_recipe ?? []) addRecipe(value);
  for (const value of row.low_level_alternative ?? []) addRecipe(value);
  for (const combo of row.important_combinations ?? []) {
    for (const value of combo.components ?? []) addRecipe(value);
  }
}

for (const row of utilityPerks.utility_perk_recipes) {
  for (const value of row.components ?? []) addRecipe(value);
}

const missing = [...recipeMaterials].filter((material) => !supply.has(material)).sort();
if (missing.length > 0) {
  throw new Error(`Current perk recipes reference materials with no supply row: ${missing.join(", ")}`);
}

console.log(`Current perk material supply coverage: ${recipeMaterials.size}/${recipeMaterials.size}`);
