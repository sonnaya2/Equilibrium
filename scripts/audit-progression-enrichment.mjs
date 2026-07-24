import { readFileSync } from "node:fs";

const progression = JSON.parse(readFileSync("data/reference/progression-unlocks.json", "utf8"));
const planner = JSON.parse(readFileSync("data/research/planner-expansions.json", "utf8"));
const fail = (message) => { throw new Error(`progression enrichment audit: ${message}`); };
const byId = (rows, id) => (rows || []).find((row) => row?.id === id);

const livid = byId(progression.activity_unlocks, "livid-farm:lunar-spells");
const lividExpected = [10000, 20000, 35000, 45000, 60000, 75000, 90000, 100000, 110000, 120000, 130000];
if (JSON.stringify((livid?.unlock_ladder || []).map((row) => row.produce_points)) !== JSON.stringify(lividExpected)) {
  fail("Livid Farm is not using the post-16-March-2026 cumulative thresholds");
}

const necro = byId(progression.activity_unlocks, "necromancy:well-of-souls-talents");
if (necro?.talent_points?.maximum !== 21 || necro?.talent_points?.total_xp_for_all_21 !== 5740080) {
  fail("Well of Souls talent-point state drifted");
}
if (JSON.stringify((necro?.tiers || []).map((row) => row.souls)) !== JSON.stringify([1, 50, 400, 2000, 4500, 8500, 35000])) {
  fail("Well of Souls soul thresholds drifted");
}

for (const id of [
  "dungeoneering:spirit-cape-passive",
  "anachronia:slayer-lodge",
  "anachronia:player-lodge",
  "farms:combat-perk-state",
  "anachronia:totem-of-vitality",
  "legacy-of-zamorak:infernal-puzzle-box",
  "pvm:reaper-crew",
]) if (!byId(progression.account_unlocks, id)) fail(`missing account row ${id}`);

const spirit = byId(progression.account_unlocks, "dungeoneering:spirit-cape-passive");
if (spirit.token_cost !== 45000 || spirit.special_move_cost_reduction_percent !== 20) fail("Spirit cape drifted");
const vitality = byId(progression.account_unlocks, "anachronia:totem-of-vitality");
if (vitality.maximum_life_points_percent !== 25 || vitality.maximum_extra_life_points !== 1500) fail("Totem of Vitality drifted");
const reaper = byId(progression.account_unlocks, "pvm:reaper-crew");
if (reaper.bonuses?.prayer !== 2 || reaper.bonuses?.armour !== 20 || reaper.bonuses?.life_points !== 200) fail("Reaper Crew defensive bonuses drifted");
for (const style of ["melee", "ranged", "magic", "necromancy"]) {
  if (reaper.bonuses?.damage?.[style] !== 12) fail(`Reaper Crew ${style} damage bonus drifted`);
}

const enchantments = byId(progression.equipment_models, "zamorakian-slivers:enchantments");
if ((enchantments?.records || []).length !== 9 || enchantments?.region_status !== "unresolved_cross_boundary") {
  fail("Zamorakian sliver enchantment model is incomplete or over-resolved");
}
const blessed = byId(progression.equipment_models, "blessed-flask:prayer-storage");
if (blessed?.herblore_level !== 118 || blessed?.crafting_level !== 96 || blessed?.capacity_doses !== 80) fail("Blessed flask core requirements drifted");
if (!blessed?.major_raw_dependencies?.some((row) => row.item === "Blessed sand" && row.quantity === 40000)) fail("Blessed flask blessed-sand dependency drifted");

for (const id of [
  "herblore:overload-chain",
  "fort-forinthry:botanists-workbench",
  "potion:adrenaline-renewal",
  "bomb:vulnerability",
  "potion:weapon-poison-plus-plus-plus",
  "incense:kwuarm",
  "crafting:combat-flask-infrastructure",
  "potion:holy-overload",
  "potion:spiritual-prayer",
  "potion:extreme-prayer",
]) if (!byId(progression.consumable_unlocks, id)) fail(`missing consumable progression ${id}`);

const flask = byId(progression.consumable_unlocks, "crafting:combat-flask-infrastructure");
if (flask?.potion_flask?.crafting_level !== 89 || flask?.crystal_flask?.crafting_level !== 89) fail("flask Crafting requirements drifted");
const holy = byId(progression.consumable_unlocks, "potion:holy-overload");
if (holy?.herblore_level !== 97 || holy?.recipe_shop_cost_coins !== 700000 || holy?.recipe_page_required !== false) fail("Holy overload recipe drifted");
const spiritual = byId(progression.consumable_unlocks, "potion:spiritual-prayer");
if (spiritual?.herblore_level !== 110 || spiritual?.recipe_shop_cost_coins !== 1000000) fail("Spiritual prayer recipe drifted");
const extremePrayer = byId(progression.consumable_unlocks, "potion:extreme-prayer");
if (extremePrayer?.herblore_level !== 117) fail("Extreme prayer requirement drifted");

if (byId(progression.activity_unlocks, "mazcab:ability-codex-package")) fail("superseded Mazcab duplicate survived");
if (byId(progression.activity_unlocks, "shattered-worlds:utility-abilities")) fail("superseded Shattered Worlds duplicate survived");
for (const id of ["mazcab:teci-combat-ability-unlocks", "shattered-worlds:current-permanent-abilities", "tuskas-wrath:current-acquisition"]) {
  if (!byId(progression.activity_unlocks, id)) fail(`current activity audit row missing: ${id}`);
}

const relics = new Map((planner.archaeology_combat_relics || []).map((row) => [row.relic, row]));
for (const [name, level, energy] of [
  ["Font of Life", 5, 50],
  ["Berserker's Fury", 56, 250],
  ["Blessing of Het", 74, 100],
  ["Death Ward", 81, 150],
  ["Fury of the Small", 97, 150],
  ["Heightened Senses", 105, 350],
  ["Conservation of Energy", 118, 350],
]) {
  const row = relics.get(name);
  if (!row || row.archaeology_level !== level || row.monolith_energy !== energy) fail(`${name} relic metadata drifted`);
}
if (planner.archaeology_relic_system?.active_relic_limit !== 3) fail("Archaeology relic slot limit drifted");
if (JSON.stringify(planner.archaeology_relic_system?.monolith_energy_caps) !== JSON.stringify([150, 250, 400, 500, 650])) fail("Archaeology monolith energy-cap ladder drifted");
if (!planner.combat_training_spots?.some((row) => row.id === "combat-armoured-zombies")) fail("current planner audit Armoured Zombies row missing");

const banned = [
  "unlock the power",
  "game changer",
  "seamlessly",
  "robust solution",
  "comprehensive solution",
  "delve into",
  "revolutionize",
  "cutting edge",
  "elevate your",
  "supercharge your",
];
const prose = JSON.stringify({ progression, planner }).toLowerCase();
for (const phrase of banned) if (prose.includes(phrase)) fail(`clanker phrase: ${phrase}`);

console.log("Progression enrichment audit passed");
