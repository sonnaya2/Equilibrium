import { readFileSync } from "node:fs";
import { join } from "node:path";
import { wikiSource } from "./lib/runescape-wiki.mjs";

const ROOT = process.cwd();
const data = JSON.parse(
  readFileSync(join(ROOT, "scraped-data/planner-expansions-archaeology-guild.json"), "utf8"),
);

function normalize(value) {
  return String(value ?? "")
    .replace(/,/g, "")
    .replace(/[_\s]+/g, " ")
    .trim()
    .toLowerCase();
}

function assertContains(haystack, needle, context) {
  if (!normalize(haystack).includes(normalize(needle))) {
    throw new Error(`${context} no longer contains expected text: ${needle}`);
  }
}

const loadouts = data.relic_loadout_progression;
const expectedLoadouts = [
  { stage: "tutorial", count: 2 },
  { stage: "professor-purchase", count: 3, cost: 80000 },
  { stage: "guildmaster-award", count: 4, cost: 0 },
];

for (const expected of expectedLoadouts) {
  const row = loadouts.find((entry) => entry.stage === expected.stage);
  if (!row) throw new Error(`Missing relic loadout stage: ${expected.stage}`);
  if (row.loadout_count_after_unlock !== expected.count) {
    throw new Error(`${expected.stage} loadout count drifted`);
  }
  if (expected.cost != null && row.chronote_cost !== expected.cost) {
    throw new Error(`${expected.stage} chronote cost drifted`);
  }
}

const expectedShopRows = [
  { qualification: "Assistant", name: "Soil box upgrade", cost: 3500 },
  { qualification: "Assistant", name: "Material storage upgrade", cost: 7000 },
  { qualification: "Assistant", name: "Mattock precision upgrade", cost: 8000 },
  { qualification: "Associate", name: "Archaeologist's outfit", cost: 50000 },
  { qualification: "Associate", name: "Soil box upgrade", cost: 18000 },
  { qualification: "Associate", name: "Material storage upgrade", cost: 25000 },
  { qualification: "Associate", name: "Mattock precision upgrade", cost: 30000 },
  { qualification: "Associate", name: "Auto-screener v1.080 blueprint", cost: 50000 },
  { qualification: "Professor", name: "Soil box upgrade", cost: 48000 },
  { qualification: "Professor", name: "Material storage upgrade", cost: 60000 },
  { qualification: "Professor", name: "Mattock precision upgrade", cost: 75000 },
  { qualification: "Professor", name: "Additional relic loadout", cost: 80000 },
  { qualification: "Guildmaster", name: "Master archaeologist's outfit", cost: 250000 },
  { qualification: "Guildmaster", name: "Energised meteorite shard", cost: 250000 },
  { qualification: "Guildmaster", name: "Mattock precision upgrade", cost: 150000 },
];

for (const expected of expectedShopRows) {
  const tier = data.shop_progression.find((entry) => entry.qualification === expected.qualification);
  if (!tier) throw new Error(`Missing Archaeology shop tier: ${expected.qualification}`);
  const row = tier.upgrades.find((entry) => entry.name === expected.name);
  if (!row) throw new Error(`Missing ${expected.qualification} shop upgrade: ${expected.name}`);
  if (row.chronote_cost !== expected.cost) {
    throw new Error(`${expected.qualification} ${expected.name} cost drifted`);
  }
}

const training = await wikiSource("Archaeology training");
const guildmaster = await wikiSource("Qualification - Guildmaster");
const presetUpdate = await wikiSource("Update:Relic Presets & February Mini Strike - This Week In RuneScape");
const fixateTranscript = await wikiSource("Transcript:Fixate");
const masterOutfit = await wikiSource("Master archaeologist's outfit");

for (const text of ["first two presets", "80,000 Chronotes", "Professor qualification", "80%"] ) {
  assertContains(presetUpdate.content, text, "Relic preset update");
}
assertContains(guildmaster.content, "additional relic loadout tab", "Guildmaster qualification");

for (const text of [
  "Soil box upgrade",
  "Material storage upgrade",
  "Mattock precision upgrade",
  "Archaeologist's outfit",
  "Auto-screener v1.080",
  "Additional relic loadout",
  "Master archaeologist's outfit",
  "Energised meteorite shard",
]) {
  assertContains(training.content, text, `Archaeology training:${text}`);
}
for (const cost of [3500, 7000, 8000, 18000, 25000, 30000, 48000, 50000, 60000, 75000, 80000, 150000, 250000]) {
  assertContains(training.content, String(cost), `Archaeology training:chronote cost ${cost}`);
}

const fixateRow = data.collection_completion_infrastructure.find((entry) => entry.id === "fixate-master-outfit");
if (!fixateRow) throw new Error("Missing master-outfit Fixate infrastructure row");
if (fixateRow.daily_energy !== 3) throw new Error("Master-outfit Fixate daily energy must be 3");
assertContains(training.content, "3 uses per day of the Fixate", "Fixate daily energy");
assertContains(fixateTranscript.content, "master archaeologist's outfit", "Fixate outfit requirement");
assertContains(fixateTranscript.content, "Fixate charge token", "Fixate token route");
assertContains(masterOutfit.content, "Fixate", "Master archaeologist outfit Fixate unlock");

const tokenRow = data.collection_completion_infrastructure.find((entry) => entry.id === "fixate-charge-token");
if (!tokenRow) throw new Error("Missing Fixate charge-token infrastructure row");
if (tokenRow.planner_classification !== "supplemental_non_core_supply") {
  throw new Error("Fixate charge tokens must remain supplemental rather than deterministic planner supply");
}

console.log(
  `Archaeology Guild audit passed: ${expectedLoadouts.length} loadout stages, ${expectedShopRows.length} shop upgrades, Fixate ${fixateRow.daily_energy}/day`,
);
