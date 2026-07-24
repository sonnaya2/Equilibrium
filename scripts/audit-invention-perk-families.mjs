import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const expectedFamilies = [
  "Aftershock",
  "Caroming",
  "Eruptive",
  "Flanking",
  "Lunging",
  "Planted Feet",
  "Precise",
  "Absorbative",
  "Biting",
  "Clear Headed",
  "Crackling",
  "Crystal Shield",
  "Energising",
  "Enhanced Devoted",
  "Equilibrium",
  "Impatient",
  "Invigorating",
  "Lucky",
  "Turtling",
  "Ultimatums",
];

const archaeology = read("scraped-data/planner-expansions-invention-archaeology.json");
const invention2026 = read("scraped-data/planner-expansions-invention-2026.json");
const armour = read("scraped-data/planner-expansions-invention-perks.json");
const utility = read("scraped-data/planner-expansions-invention-utility-perks.json");

const names = [];
for (const row of archaeology.current_perk_component_dependencies) names.push(row.perk);
for (const row of invention2026.current_2026_perk_dependencies) {
  names.push(row.perk);
  for (const combo of row.important_combinations ?? []) names.push(combo.perk);
}
for (const row of armour.current_armour_perk_recipes) {
  names.push(row.perk);
  for (const combo of row.important_combinations ?? []) names.push(combo.perk);
}
for (const row of utility.utility_perk_recipes) names.push(row.perk);

const corpus = names.join("\n").toLowerCase();
const missing = expectedFamilies.filter((family) => !corpus.includes(family.toLowerCase()));
if (missing.length > 0) {
  throw new Error(`Current PvME perk-family coverage is incomplete: ${missing.join(", ")}`);
}

console.log(`Current PvME perk-family coverage: ${expectedFamilies.length}/${expectedFamilies.length}`);
