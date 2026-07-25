import { readFileSync } from "node:fs";

const support = JSON.parse(readFileSync("data/reference/progression-support-items-2026-07-25.json", "utf8"));
const equipment = support.equipment_models || [];
const byId = (id) => equipment.find((row) => row?.id === id);
const fail = (message) => { throw new Error(`drop-cleaner enrichment audit: ${message}`); };

const gold = byId("dungeoneering:advanced-gold-accumulator-current");
if (!gold) fail("advanced gold accumulator row missing");
if (gold.dungeoneering_level !== 60 || gold.token_cost !== 1500000) fail("advanced gold accumulator reward requirements drifted");
if (!gold.effect?.includes("90%") || !gold.effect?.includes("10%") || gold.degrades !== false) fail("advanced gold accumulator collection rule drifted");
if (gold.toolbelt_unlock?.currency !== "Slayer points" || gold.toolbelt_unlock?.cost !== 500) fail("advanced gold accumulator tool-belt unlock drifted");
if (gold.region_hint !== "forinthry" || gold.hard_region_requirement !== true) fail("advanced gold accumulator Daemonheim region rule drifted");

const seedicide = byId("drop-cleaner:seedicide");
if (!seedicide) fail("Seedicide row missing");
const routes = Object.fromEntries((seedicide.acquisition_routes || []).map((row) => [row.route, row]));
if (routes["Cabbage Facepunch Bonanza Quartermaster"]?.cost !== 2200 || routes["Cabbage Facepunch Bonanza Quartermaster"]?.currency !== "renown") fail("Seedicide Cabbage Facepunch route drifted");
if (routes["Farmers' Market"]?.cost !== 10000 || routes["Farmers' Market"]?.currency !== "beans") fail("Seedicide Farmers' Market route drifted");
if (routes["Stanley Limelight"]?.cost !== 360 || routes["Stanley Limelight"]?.currency !== "Thaler") fail("Seedicide Thaler route drifted");
if (!seedicide.effect?.includes("twice the Farming experience") || seedicide.uses !== "unlimited") fail("Seedicide conversion effect drifted");
if (seedicide.pickup_upgrade?.cost !== 25000 || seedicide.pickup_upgrade?.currency !== "beans") fail("Seedicide pickup upgrade drifted");
if (seedicide.toolbelt_unlock?.cost !== 500 || seedicide.toolbelt_unlock?.currency !== "Slayer points") fail("Seedicide tool-belt unlock drifted");
if (seedicide.region_status !== "multiple_acquisition_routes") fail("Seedicide must retain alternative regional acquisition routes");

const springCleaner = byId("invention:spring-cleaner-current");
if (!springCleaner) fail("Spring cleaner progression row missing");
if (springCleaner.invention_level !== 43) fail("Spring cleaner Invention requirement drifted");
const baseRecipe = Object.fromEntries((springCleaner.base_device_recipe || []).map((row) => [row.material, row.quantity]));
for (const [material, quantity] of [["Simple parts", 300], ["Tensile parts", 500], ["Flexible parts", 300], ["Precise components", 50]]) {
  if (baseRecipe[material] !== quantity) fail(`Spring cleaner base recipe drifted: ${material}`);
}
const tightRecipe = Object.fromEntries((springCleaner.tight_spring_recipe?.materials || []).map((row) => [row.material, row.quantity]));
if (springCleaner.tight_spring_recipe?.output_quantity !== 20 || tightRecipe["Tensile parts"] !== 120 || tightRecipe["Subtle components"] !== 1) fail("Tight spring recipe drifted");
const upgrades = Object.fromEntries((springCleaner.upgrade_ladder || []).map((row) => [row.version, row]));
if (upgrades["Spring cleaner 2000"]?.cumulative_springs !== 200 || !upgrades["Spring cleaner 2000"]?.unlock?.includes("one spring")) fail("Spring cleaner 2000 milestone drifted");
if (upgrades["Spring cleaner 3000"]?.cumulative_springs !== 600 || !upgrades["Spring cleaner 3000"]?.unlock?.includes("without consuming")) fail("Spring cleaner 3000 milestone drifted");
if (upgrades["Spring cleaner 5000"]?.cumulative_springs !== 1800) fail("Spring cleaner 5000 milestone drifted");
if (upgrades["Spring cleaner 9000"]?.cumulative_springs !== 4000) fail("Spring cleaner 9000 milestone drifted");
if (upgrades["Spring cleaner 9001"]?.cumulative_springs !== 10000 || !upgrades["Spring cleaner 9001"]?.unlock?.includes("noted salvage")) fail("Spring cleaner 9001 milestone drifted");
if (springCleaner.maximum_stored_springs !== 250000 || !springCleaner.supply_bottleneck?.includes("subtle-component")) fail("Spring cleaner storage or supply bottleneck drifted");

console.log("Drop-cleaner enrichment audit passed");
