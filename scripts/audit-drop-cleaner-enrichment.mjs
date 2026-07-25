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

console.log("Drop-cleaner enrichment audit passed");
