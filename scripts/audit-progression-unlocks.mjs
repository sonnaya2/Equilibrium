import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("scraped-data/progression-unlocks.json", "utf8"));

function fail(message) {
  throw new Error(`progression unlock audit: ${message}`);
}

function rows(name) {
  if (!Array.isArray(data[name])) fail(`${name} must be an array`);
  return data[name];
}

const questUnlocks = rows("quest_unlocks");
const accountUnlocks = rows("account_unlocks");
const activityUnlocks = rows("activity_unlocks");
const equipmentModels = rows("equipment_models");
const allRows = [...questUnlocks, ...accountUnlocks, ...activityUnlocks, ...equipmentModels];

const ids = allRows.map((row) => row.id);
if (new Set(ids).size !== ids.length) fail("duplicate unlock/model id");

for (const row of allRows) {
  const urls = [row.source_url, ...(row.source_urls || [])].filter(Boolean);
  if (!urls.length || urls.some((url) => typeof url !== "string" || !url.startsWith("https://"))) {
    fail(`${row.id} needs an https source`);
  }
}

if (questUnlocks.some((row) => row.id === "succession:dive")) {
  fail("Dive must not be restored as a Succession unlock; it moved to 30 Agility on 20 July 2026");
}

const dive = accountUnlocks.find((row) => row.id === "agility:dive");
if (!dive?.access_requirements?.includes("30 Agility")) {
  fail("Dive must use the current 30 Agility base-game gate");
}

const onePiercingNote = questUnlocks.find((row) => row.id === "one-piercing-note:gwd1-abilities");
const movedAbilities = new Set((onePiercingNote?.unlocks || []).map((entry) => entry.name));
for (const name of ["Sacrifice", "Devotion", "Transfigure"]) {
  if (!movedAbilities.has(name)) fail(`One Piercing Note is missing ${name}`);
}

const lunar = questUnlocks.find((row) => row.id === "lunar-diplomacy:lunar-spellbook");
const lunarNames = new Set((lunar?.unlocks || []).map((entry) => entry.name));
for (const name of ["Lunar spellbook", "Lunar Isle", "Astral altar"]) {
  if (!lunarNames.has(name)) fail(`Lunar Diplomacy is missing ${name}`);
}

const dreamMentor = questUnlocks.find((row) => row.id === "dream-mentor:lunar-spells");
if (!dreamMentor?.unlocks?.some((entry) => entry.name === "Spellbook Swap")) {
  fail("Dream Mentor must include Spellbook Swap");
}

const wars = accountUnlocks.find((row) => row.id === "wars-retreat:permanent-hub-unlocks");
const expectedMilestones = new Map([
  ["War's Retreat Teleport", 10],
  ["Second attunable boss portal", 100],
  ["Altar of War", 200],
  ["Altar ability-cooldown reset", 500],
  ["War's Grimoire spellbook switching", 750],
  ["Adrenaline crystal", 1000],
  ["Adrenaline-potion cooldown refresh", 2000],
]);
for (const [name, bossKills] of expectedMilestones) {
  const row = wars?.milestones?.find((entry) => entry.name === name);
  if (row?.boss_kills !== bossKills) fail(`War's Retreat milestone drift: ${name}`);
}

if (!data.policy?.dedupe_rule?.includes("regional")) {
  fail("dedupe policy must keep regional boss/drop data out of this graph");
}

console.log(`Progression unlock audit passed: ${questUnlocks.length} quest groups, ${accountUnlocks.length} account groups, ${activityUnlocks.length} activity groups.`);
