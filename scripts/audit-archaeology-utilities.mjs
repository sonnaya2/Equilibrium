import { readFileSync } from "node:fs";
import { join } from "node:path";
import { wikiSource } from "./lib/runescape-wiki.mjs";

const ROOT = process.cwd();
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const utilities = read("scraped-data/planner-expansions-archaeology-utilities.json");
const guild = read("scraped-data/planner-expansions-archaeology-guild.json");

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

if ("relic_system_progression" in utilities || "existing_data_corrections" in utilities) {
  throw new Error("Archaeology utilities must not duplicate Guild relic-preset progression or stale-data corrections");
}

assertUniqueIds(utilities.collection_completion_tools, "collection_completion_tools");

const expectedTools = new Set([
  "arch-artefact-bad-luck-mitigation",
  "arch-journal-collector-information",
  "arch-journal-campus-routing",
  "arch-museum-donation-fallback",
]);
for (const tool of utilities.collection_completion_tools) expectedTools.delete(tool.id);
if (expectedTools.size > 0) {
  throw new Error(`Missing Archaeology collection utilities: ${[...expectedTools].join(", ")}`);
}

for (const forbiddenId of ["arch-fixate", "arch-master-outfit-routing"]) {
  if (utilities.collection_completion_tools.some((row) => row.id === forbiddenId)) {
    throw new Error(`${forbiddenId} belongs to the Archaeology Guild feed and must not be duplicated`);
  }
}

const guildLoadouts = guild.relic_loadout_progression.map((row) => row.loadout_count_after_unlock);
if (JSON.stringify(guildLoadouts) !== JSON.stringify([2, 3, 4])) {
  throw new Error(`Guild feed must remain authoritative for relic presets 2 -> 3 -> 4; found ${guildLoadouts.join(" -> ")}`);
}
if (!guild.collection_completion_infrastructure.some((row) => row.id === "fixate-master-outfit")) {
  throw new Error("Guild feed must remain authoritative for master-outfit Fixate");
}

const museum = utilities.collection_completion_tools.find((row) => row.id === "arch-museum-donation-fallback");
if (!museum || museum.collection_reward_eligible !== false || !museum.effect.includes("40%")) {
  throw new Error("Museum donation must remain a 40% chronote overflow route with no collection reward");
}

for (const row of utilities.collection_completion_tools) {
  if ("region" in row || "required_regions" in row || "hard_region_requirement" in row) {
    throw new Error(`${row.id} must remain a utility rather than a region gate`);
  }
}

const archaeology = await wikiSource("Archaeology");
for (const text of ["last five earned artefacts", "half as likely", "40%"] ) {
  assertContains(archaeology.content, text, "Archaeology collection utility rules");
}

const artefacts = await wikiSource("Artefacts");
for (const text of ["Fixate are also tracked", "secondary uses", "40%"] ) {
  assertContains(artefacts.content, text, "Artefact completion rules");
}

const collections = await wikiSource("Collections");
for (const text of ["Collector information", "Archaeology journal"]) {
  assertContains(collections.content, text, "Collections tracking");
}

const journal = await wikiSource("Archaeology journal");
for (const text of ["Archaeology Guild", "collector"] ) {
  assertContains(journal.content, text, "Archaeology journal routing");
}

console.log(
  `Archaeology utility audit passed: ${utilities.collection_completion_tools.length} non-Guild collection tools`,
);
