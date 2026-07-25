import { readFileSync } from "node:fs";
import { join } from "node:path";
import { wikiSource } from "./lib/runescape-wiki.mjs";

const ROOT = process.cwd();
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const utilities = read("scraped-data/planner-expansions-archaeology-utilities.json");
const collections = read("scraped-data/planner-expansions-archaeology-collections.json");

function normalize(value) {
  return String(value ?? "")
    .replace(/[_\s]+/g, " ")
    .toLowerCase();
}

function assertContains(haystack, needle, context) {
  if (!normalize(haystack).includes(normalize(needle))) {
    throw new Error(`${context} no longer contains expected text: ${needle}`);
  }
}

function assertUniqueIds(rows, section) {
  const ids = rows.map((row) => row.id);
  if (ids.some((id) => typeof id !== "string" || !id)) {
    throw new Error(`${section} contains a missing id`);
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${section} contains duplicate ids`);
  }
}

assertUniqueIds(utilities.relic_system_progression, "relic_system_progression");
assertUniqueIds(utilities.collection_completion_tools, "collection_completion_tools");

const presetCounts = utilities.relic_system_progression
  .filter((row) => Number.isInteger(row.loadout_count_after_unlock))
  .map((row) => row.loadout_count_after_unlock);
if (JSON.stringify(presetCounts) !== JSON.stringify([2, 3, 4])) {
  throw new Error(`Relic preset progression must be 2 -> 3 -> 4; found ${presetCounts.join(" -> ")}`);
}

const professor = utilities.relic_system_progression.find((row) => row.id === "arch-relic-presets-professor");
if (!professor || professor.chronote_cost !== 80000 || professor.loadout_count_after_unlock !== 3) {
  throw new Error("Professor relic-preset purchase must unlock preset 3 for 80,000 chronotes");
}

const guildmaster = utilities.relic_system_progression.find((row) => row.id === "arch-relic-presets-guildmaster");
if (!guildmaster || guildmaster.loadout_count_after_unlock !== 4) {
  throw new Error("Guildmaster qualification must unlock preset 4");
}

const switchCost = utilities.relic_system_progression.find((row) => row.id === "arch-relic-preset-switch-cost");
if (!switchCost || switchCost.cost_percent_of_normal_harnessing !== 80) {
  throw new Error("Relic preset switch cost must remain 80% of normal harnessing cost");
}

const expectedTools = new Set([
  "arch-fixate",
  "arch-artefact-bad-luck-mitigation",
  "arch-journal-collector-information",
  "arch-master-outfit-routing",
  "arch-journal-campus-routing",
  "arch-museum-donation-fallback",
]);
for (const tool of utilities.collection_completion_tools) expectedTools.delete(tool.id);
if (expectedTools.size > 0) {
  throw new Error(`Missing Archaeology collection utilities: ${[...expectedTools].join(", ")}`);
}

const fixate = utilities.collection_completion_tools.find((row) => row.id === "arch-fixate");
if (!fixate || fixate.baseline_daily_uses_with_outfit !== 3) {
  throw new Error("Fixate baseline must remain three daily uses with the full master outfit");
}

const museum = utilities.collection_completion_tools.find((row) => row.id === "arch-museum-donation-fallback");
if (!museum || museum.collection_reward_eligible !== false || !museum.effect.includes("40%")) {
  throw new Error("Museum donation must remain a 40% chronote overflow route with no collection reward");
}

const correction = utilities.existing_data_corrections.find(
  (row) => row.target_id === "arch-guildmaster-second-loadout",
);
if (!correction) throw new Error("Missing stale Guildmaster loadout correction");
if (!collections.relic_system_progression.some((row) => row.id === correction.target_id)) {
  throw new Error("Guildmaster loadout correction no longer matches the source collection dataset");
}

const presetUpdate = await wikiSource("Update:Relic Presets & February Mini Strike - This Week In RuneScape");
for (const text of ["first two presets", "80,000 Chronotes", "Guildmaster qualification", "80%"] ) {
  assertContains(presetUpdate.content, text, "Relic Presets official update");
}

const archaeology = await wikiSource("Archaeology");
for (const text of ["last five earned artefacts", "half as likely", "40%", "Fixate can be activated 3 times per day"]) {
  assertContains(archaeology.content, text, "Archaeology utility rules");
}

const fixateTranscript = await wikiSource("Transcript:Fixate");
for (const text of ["guarantee it on your next discovery", "master archaeologist's outfit", "Fixate charge token"]) {
  assertContains(fixateTranscript.content, text, "Fixate transcript");
}

const collectionPage = await wikiSource("Collections");
for (const text of ["Collector information", "Archaeology journal"]) {
  assertContains(collectionPage.content, text, "Collections tracking");
}

const training = await wikiSource("Archaeology training");
for (const text of ["3 uses per day of the Fixate spell", "Unlimited teleports", "dig sites and collectors"]) {
  assertContains(training.content, text, "Archaeology training utilities");
}

console.log(
  `Archaeology utility audit passed: ${utilities.relic_system_progression.length} relic-system rows, ${utilities.collection_completion_tools.length} collection tools`,
);
