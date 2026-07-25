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
const abilityUnlocks = rows("ability_unlocks");
const prayerUnlocks = rows("prayer_unlocks");
const allRows = [...questUnlocks, ...accountUnlocks, ...activityUnlocks, ...equipmentModels, ...abilityUnlocks, ...prayerUnlocks];

const ids = allRows.map((row) => row.id);
if (new Set(ids).size !== ids.length) fail("duplicate unlock/model id across progression groups");

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

const limitless = abilityUnlocks.find((row) => row.id === "sophanem:limitless");
if (!limitless?.materials?.some((entry) => entry.name === "Vital spark" && entry.quantity === 2000)) {
  fail("Limitless must retain the 2,000 vital spark base-game requirement");
}

const ed2 = abilityUnlocks.find((row) => row.id === "dragonkin-laboratory:greater-melee-codices");
const ed2Unlocks = new Map((ed2?.unlocks || []).map((entry) => [entry.name, entry.source]));
for (const [ability, source] of [["Greater Flurry", "Astellarn"], ["Greater Fury", "Verak Lith"], ["Greater Barge", "Black Stone Dragon"]]) {
  if (ed2Unlocks.get(ability) !== source) fail(`ED2 source drift for ${ability}`);
}

const zamorak = abilityUnlocks.find((row) => row.id === "zamorak-undercity:ability-codices");
if (zamorak?.region_status !== "unresolved_cross_boundary") {
  fail("Zamorakian Undercity ability codices must stay region-unresolved");
}
const zamorakRegions = new Set(zamorak?.region_candidates || []);
for (const region of ["misthalin", "forinthry"]) {
  if (!zamorakRegions.has(region)) fail(`Zamorakian Undercity boundary is missing ${region} as a candidate`);
}
for (const name of ["Greater Sunshine", "Greater Death's Swiftness"]) {
  const unlock = zamorak?.unlocks?.find((entry) => entry.name === name);
  if (unlock?.invention_requirement !== 85 || !unlock?.components?.includes("Cywir components")) {
    fail(`${name} must preserve the 85 Invention + Cywir-component dependency`);
  }
}

for (const id of ["fort-forinthry:greater-sonic-wave", "fort-forinthry:invoke-lord-of-bones"]) {
  const row = abilityUnlocks.find((entry) => entry.id === id);
  if (row?.region_status !== "historical_catalyst_working_taxonomy" || row?.region_hint !== "misthalin") {
    fail(`${id} must keep the provisional Fort/Misthalin working taxonomy`);
  }
}

const praesul = prayerUnlocks.find((row) => row.id === "nex-aod:praesul-curses");
if (praesul?.prerequisite !== "Ancient Curses") fail("Praesul curses must retain Ancient Curses as their base prerequisite");
const praesulUnlocks = new Map((praesul?.unlocks || []).map((entry) => [entry.name, entry]));
for (const name of ["Malevolence", "Desolation", "Affliction", "Ruination"]) {
  if (praesulUnlocks.get(name)?.prayer_requirement !== 99) fail(`${name} must remain a level-99 Prayer unlock`);
}
if (praesulUnlocks.get("Ruination")?.necromancy_requirement !== 95) {
  fail("Ruination must retain its 95 Necromancy requirement");
}

for (const id of ["sanctum-of-rebirth:divine-rage", "gate-of-elidinis:eclipsed-soul"]) {
  const row = prayerUnlocks.find((entry) => entry.id === id);
  if (!String(row?.region_status || "").includes("historical") || row?.region_hint !== "misthalin") {
    fail(`${id} must keep the City of Um/Misthalin locality visibly provisional`);
  }
}

if (!data.policy?.dedupe_rule?.includes("regional")) {
  fail("dedupe policy must keep regional boss/drop data out of this graph");
}

console.log(`Progression unlock audit passed: ${questUnlocks.length} quest, ${accountUnlocks.length} account, ${activityUnlocks.length} activity, ${abilityUnlocks.length} ability and ${prayerUnlocks.length} prayer groups.`);
