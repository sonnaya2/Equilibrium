import { readFileSync } from "node:fs";
import { join } from "node:path";
import { wikiArchaeologyCollectionLevel } from "./lib/archaeology-collection.mjs";
import { wikiSource } from "./lib/runescape-wiki.mjs";

const ROOT = process.cwd();
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const graph = read("scraped-data/planner-expansions-archaeology-collections.json");
const repeatables = read("scraped-data/planner-expansions-archaeology-repeatables.json");

function normalize(text) {
  return String(text ?? "")
    .replace(/\{\{!\}\}/g, "|")
    .replace(/[_\s]+/g, " ")
    .toLowerCase();
}

function assertContains(haystack, needle, context) {
  if (!normalize(haystack).includes(normalize(needle))) {
    throw new Error(`${context} no longer contains expected text: ${needle}`);
  }
}

const collectionExpectations = [
  { title: "Zarosian I", level: 25, required: ["Seal of the Praefectus Praetorio", "20 pylon batteries"] },
  { title: "Zarosian II", level: 81, required: ["50 Kharid-et pylon batteries"] },
  { title: "Zarosian III", level: 107, required: ["100 Kharid-et pylon batteries"] },
  { title: "Zarosian IV", level: 118, required: ["Inquisitor staff piece", "100 Kharid-et pylon batteries"] },
  { title: "Saradominist I", level: 56, required: ["Lock of hair"] },
  { title: "Saradominist II", level: 72, required: ["Tetracompass piece"] },
  { title: "Saradominist III", level: 100, required: ["Tetracompass piece"] },
  { title: "Saradominist IV", level: 117, required: ["Petasos", "Tetracompass piece"] },
  { title: "Zamorakian II", level: 81, required: ["Tetracompass piece"] },
  { title: "Zamorakian III", level: 104, required: ["Tetracompass piece"] },
  { title: "Zamorakian IV", level: 116, required: ["Ariadne's Diadem", "Tetracompass piece"] },
  { title: "Armadylean I", level: 81, required: ["King Oberon's moonshroom spores", "50 torn blueprint fragments"] },
  { title: "Armadylean II", level: 98, required: ["75 torn blueprint fragments"] },
  { title: "Armadylean III", level: 118, required: ["Howl's Thinking Cap", "150 torn blueprint fragments"] },
  { title: "Wise Am the Music Man", level: 91, required: ["Koschei's needle"] },
  { title: "Dragonkin I", level: 99, required: ["6 Anachronia resource packs"] },
  { title: "Dragonkin II", level: 102, required: ["75 rex skeleton fragments"] },
  { title: "Dragonkin III", level: 108, required: ["Kaladanda"] },
  { title: "Dragonkin IV", level: 120, required: ["150 rex skeleton fragments"] },
  { title: "Dragonkin V", level: 77, required: ["large Dungeoneering token box"] },
  { title: "Dragonkin VI", level: 87, required: ["Pastkeeper's tapestry", "Dungeoneering Wildcard", "large Dungeoneering token box"] },
  { title: "Dragonkin VII", level: 113, required: ["Tetracompass piece"] },
  { title: "Urns of the Empire", level: 67, required: ["Tetracompass piece"] },
  { title: "Green Gobbo Goodies I", required: ["Tetracompass piece"] },
  { title: "Green Gobbo Goodies II", required: ["Tetracompass piece"] },
  { title: "Green Gobbo Goodies III", level: 119, required: ["Helm of Terror (outside)", "Tetracompass piece"] },
  { title: "Red Rum Relics I", required: ["Tetracompass piece"] },
  { title: "Red Rum Relics II", required: ["Tetracompass piece"] },
  { title: "Red Rum Relics III", level: 119, required: ["Helm of Terror (inside)", "Tetracompass piece"] },
];

for (const expectation of collectionExpectations) {
  const page = await wikiArchaeologyCollectionLevel(expectation.title);
  if (expectation.level != null && page.archlevel !== expectation.level) {
    throw new Error(`${expectation.title} Archaeology level drift: expected ${expectation.level}, Wiki has ${page.archlevel}`);
  }
  for (const text of expectation.required) assertContains(page.content, text, expectation.title);
}

const qualificationExpectations = [
  { qualification: "Assistant", level: 40, uniqueCollections: 1 },
  { qualification: "Associate", level: 70, uniqueCollections: 5 },
  { qualification: "Professor", level: 90, uniqueCollections: 20 },
  { qualification: "Guildmaster", level: 99, uniqueCollections: 25 },
];

for (const expectation of qualificationExpectations) {
  const row = graph.qualification_milestones.find((entry) => entry.qualification === expectation.qualification);
  if (!row) throw new Error(`Missing serialized qualification: ${expectation.qualification}`);
  if (row.archaeology_level !== expectation.level || row.unique_collections_required !== expectation.uniqueCollections) {
    throw new Error(`Serialized ${expectation.qualification} qualification requirements drifted`);
  }
}

const qualifications = await wikiSource("Qualifications");
for (const expectation of qualificationExpectations) {
  assertContains(qualifications.content, `Archaeology ${expectation.level}`, `Qualifications:${expectation.qualification}`);
}

const guildmaster = await wikiSource("Qualification - Guildmaster");
assertContains(guildmaster.content, "additional relic loadout tab", "Qualification - Guildmaster");
assertContains(guildmaster.content, "10 February 2025", "Qualification - Guildmaster update history");

const archaeology = await wikiSource("Archaeology");
assertContains(archaeology.content, "650", "Archaeology monolith power cap");
assertContains(archaeology.content, "120 Archaeology", "Archaeology monolith power cap");

const serializedCorrection = graph.existing_data_corrections.find((entry) => entry.target_relic === "Berserker's Fury");
if (!serializedCorrection) throw new Error("Missing Berserker's Fury cross-region correction");
const corrected = new Set(serializedCorrection.recommended_value);
for (const region of ["morytania", "asgarnia"]) {
  if (!corrected.has(region)) throw new Error(`Berserker's Fury correction is missing ${region}`);
}

const repeatableByCollection = new Map(repeatables.repeatable_collection_rewards.map((entry) => [entry.collection, entry]));
for (const collection of [
  "Saradominist II",
  "Saradominist III",
  "Saradominist IV",
  "Zamorakian II",
  "Zamorakian III",
  "Zamorakian IV",
  "Zarosian II",
  "Zarosian III",
  "Zarosian IV",
  "Dragonkin I",
  "Dragonkin II",
  "Dragonkin IV",
  "Urns of the Empire",
]) {
  if (!repeatableByCollection.has(collection)) throw new Error(`Missing serialized repeatable collection: ${collection}`);
}

for (const relic of ["Inspire Love", "Inspire Genius", "Inspire Awe"]) {
  if (!repeatables.additional_collection_relic_routes.some((entry) => entry.relic_power === relic)) {
    throw new Error(`Missing serialized collection relic route: ${relic}`);
  }
}

console.log(
  `Archaeology collection audit passed: ${collectionExpectations.length} collections, ${qualificationExpectations.length} qualifications, ${repeatables.repeatable_collection_rewards.length} added repeatable routes`,
);
