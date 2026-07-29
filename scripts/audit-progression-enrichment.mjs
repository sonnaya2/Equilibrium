import { readFileSync } from "node:fs";

function mergeRows(supplement, base) {
  const rows = new Map();
  for (const row of supplement || []) rows.set(String(row.id), row);
  for (const row of base || []) rows.set(String(row.id), row);
  return [...rows.values()];
}

const progressionBase = JSON.parse(readFileSync("data/reference/progression-unlocks.json", "utf8"));
const progressionSupport = JSON.parse(readFileSync("data/reference/progression-support-items-2026-07-25.json", "utf8"));
const plannerBase = JSON.parse(readFileSync("data/research/planner-expansions.json", "utf8"));
const plannerSupport = JSON.parse(readFileSync("data/research/planner-support-items-2026-07-25.json", "utf8"));
const progression = {
  ...progressionBase,
  equipment_models: mergeRows(progressionSupport.equipment_models, progressionBase.equipment_models),
};
const planner = {
  ...plannerBase,
  regional_unique_drops: mergeRows(plannerSupport.regional_unique_drops, plannerBase.regional_unique_drops),
};
const fail = (message) => { throw new Error(`progression enrichment audit: ${message}`); };
const byId = (rows, id) => (rows || []).find((row) => row?.id === id);

const livid = byId(progression.activity_unlocks, "livid-farm:lunar-spells");
const lividExpected = [10000, 20000, 35000, 45000, 60000, 75000, 90000, 100000, 110000, 120000, 130000];
if (JSON.stringify((livid?.unlock_ladder || []).map((row) => row.produce_points)) !== JSON.stringify(lividExpected)) fail("Livid Farm is not using the post-16-March-2026 cumulative thresholds");

const necro = byId(progression.activity_unlocks, "necromancy:well-of-souls-talents");
if (necro?.talent_points?.maximum !== 21 || necro?.talent_points?.total_xp_for_all_21 !== 5740080) fail("Well of Souls talent-point state drifted");
if (JSON.stringify((necro?.tiers || []).map((row) => row.souls)) !== JSON.stringify([1, 50, 400, 2000, 4500, 8500, 35000])) fail("Well of Souls soul thresholds drifted");

for (const id of [
  "dungeoneering:spirit-cape-passive",
  "dungeoneering:ring-of-vigour-passive",
  "dungeoneering:bonecrusher-current",
  "dungeoneering:charming-imp-current",
  "dungeoneering:herbicide-current",
  "dungeoneering:scroll-of-restoration",
  "anachronia:slayer-lodge",
  "anachronia:player-lodge",
  "farms:combat-perk-state",
  "anachronia:totem-of-vitality",
  "legacy-of-zamorak:infernal-puzzle-box",
  "pvm:reaper-crew",
  "achievements:seers-combat",
  "achievements:fremennik-combat",
  "achievements:tirannwn-combat",
  "achievements:desert-keris",
]) if (!byId(progression.account_unlocks, id)) fail(`missing account row ${id}`);

const spirit = byId(progression.account_unlocks, "dungeoneering:spirit-cape-passive");
if (spirit.token_cost !== 45000 || spirit.special_move_cost_reduction_percent !== 20) fail("Spirit cape drifted");
const vigour = byId(progression.account_unlocks, "dungeoneering:ring-of-vigour-passive");
if (vigour?.base_ring?.dungeoneering_tokens !== 50000 || !vigour?.conversion?.quest?.includes("Extinction")) fail("Passive Ring of Vigour progression drifted");
for (const [id, tokens, level] of [
  ["dungeoneering:bonecrusher-current", 50000, 41],
  ["dungeoneering:charming-imp-current", 50000, 41],
  ["dungeoneering:herbicide-current", 50000, 41],
]) {
  const row = byId(progression.account_unlocks, id);
  if (row?.token_cost !== tokens || row?.dungeoneering_level !== level) fail(`${id} is not using the 11-May-2026 reward table`);
}
const restoration = byId(progression.account_unlocks, "dungeoneering:scroll-of-restoration");
if (restoration?.token_cost !== 20000 || restoration?.dungeoneering_level !== 44 || restoration?.archaeology_level !== 44 || !restoration?.effect?.includes("2%")) fail("Scroll of Restoration remaster values drifted");
const vitality = byId(progression.account_unlocks, "anachronia:totem-of-vitality");
if (vitality.maximum_life_points_percent !== 25 || vitality.maximum_extra_life_points !== 1500) fail("Totem of Vitality drifted");
const reaper = byId(progression.account_unlocks, "pvm:reaper-crew");
if (reaper.bonuses?.prayer !== 2 || reaper.bonuses?.armour !== 20 || reaper.bonuses?.life_points !== 200) fail("Reaper Crew defensive bonuses drifted");
for (const style of ["melee", "ranged", "magic", "necromancy"]) if (reaper.bonuses?.damage?.[style] !== 12) fail(`Reaper Crew ${style} damage bonus drifted`);
const seers = byId(progression.account_unlocks, "achievements:seers-combat");
if (!JSON.stringify(seers?.rewards ?? []).includes("+2 percentage points")) fail("Seers bolt-proc reward drifted");
const frem = byId(progression.account_unlocks, "achievements:fremennik-combat");
if (!JSON.stringify(frem?.rewards ?? []).includes("10%") || !JSON.stringify(frem?.rewards ?? []).includes("5%")) fail("Fremennik combat rewards drifted");
const tir = byId(progression.account_unlocks, "achievements:tirannwn-combat");
// Reward rows may be strings or objects.
if ((tir?.rewards ?? []).filter((row) => JSON.stringify(row).includes("5%")).length < 4) fail("Tirannwn combat reward set incomplete");
const keris = byId(progression.account_unlocks, "achievements:desert-keris");
if (!keris?.effect?.includes("25%") || !keris?.effect?.includes("5%")) fail("Hard Desert Keris reward drifted");

for (const id of [
  "zamorakian-slivers:enchantments",
  "blessed-flask:prayer-storage",
  "salve-amulet:enchanted",
  "broken-home:asylum-surgeons-ring",
  "dungeoneering:split-dragontooth-necklace-current",
  "dungeoneering:demon-horn-necklace-current",
  "dungeoneering:amulet-of-zealots-current",
  "dungeoneering:chaotic-grimoire",
  "dungeoneering:ruinous-weapons",
  "dungeoneering:occultist-necromancy-necklaces",
  "rum-deal:holy-wrench",
  "drop-cleaner:attuned-ectoplasmator",
]) if (!byId(progression.equipment_models, id)) fail(`missing equipment progression ${id}`);
const enchantments = byId(progression.equipment_models, "zamorakian-slivers:enchantments");
if ((enchantments?.records || []).length !== 9 || enchantments?.region_status !== "unresolved_cross_boundary") fail("Zamorakian sliver enchantment model is incomplete or over-resolved");
const blessed = byId(progression.equipment_models, "blessed-flask:prayer-storage");
if (blessed?.herblore_level !== 118 || blessed?.crafting_level !== 96 || blessed?.capacity_doses !== 80) fail("Blessed flask core requirements drifted");
if (!blessed?.major_raw_dependencies?.some((row) => row.item === "Blessed sand" && row.quantity === 40000)) fail("Blessed flask blessed-sand dependency drifted");
const salve = byId(progression.equipment_models, "salve-amulet:enchanted");
if (!salve?.effect?.includes("20%") || !salve?.quest_dependencies?.includes("Lair of Tarn Razorlor for Tarn's diary and the enchantment")) fail("Salve amulet (e) progression drifted");
const asylum = byId(progression.equipment_models, "broken-home:asylum-surgeons-ring");
const asylumRegions = [...(asylum?.required_regions || []), ...(asylum?.region_hints || [])].map(String);
if (!asylum?.requirements?.some((row) => row.includes("37 minutes"))) fail("Asylum surgeon's ring acquisition drifted");
// The Archaeology Guild is in Misthalin.
if (!asylumRegions.includes("misthalin") && asylum?.region_hint !== "misthalin") fail("Asylum surgeon's ring should map to Misthalin");
if (asylum?.region_status === "unresolved_misthalin_morytania_boundary") fail("Asylum surgeon's ring still unresolved boundary");
const split = byId(progression.equipment_models, "dungeoneering:split-dragontooth-necklace-current");
if (split?.token_cost !== 15500 || split?.dungeoneering_level !== 41 || split?.prayer_level !== 60) fail("Split dragontooth remaster values drifted");
const demonHorn = byId(progression.equipment_models, "dungeoneering:demon-horn-necklace-current");
if (demonHorn?.token_cost !== 35000 || demonHorn?.dungeoneering_level !== 75 || demonHorn?.prayer_level !== 90) fail("Demon horn remaster values drifted");
const zealots = byId(progression.equipment_models, "dungeoneering:amulet-of-zealots-current");
if (zealots?.token_cost !== 40000 || zealots?.dungeoneering_level !== 38 || zealots?.prayer_level !== 48) fail("Amulet of zealots remaster values drifted");
const grimoire = byId(progression.equipment_models, "dungeoneering:chaotic-grimoire");
if (grimoire?.token_cost !== 150000 || grimoire?.dungeoneering_level !== 60 || grimoire?.page?.token_cost !== 5000 || !grimoire?.active_effect?.includes("+7%")) fail("Chaotic grimoire remaster values drifted");
const ruinous = byId(progression.equipment_models, "dungeoneering:ruinous-weapons");
if (ruinous?.dungeoneering_level !== 90 || ruinous?.shared_properties?.damage_tier !== 90 || ruinous?.shared_properties?.accuracy_tier !== 100 || ruinous?.shared_properties?.warpbane_damage_bonus_percent !== 12 || (ruinous?.weapons || []).length !== 8) fail("Ruinous weapon family core values drifted");
const ruinousCosts = Object.fromEntries((ruinous?.weapons || []).map((row) => [row.name, row.token_cost]));
for (const [name, cost] of [["Ruinous guard", 750000], ["Ruinous lantern", 250000], ["Ruinous maul", 1000000], ["Ruinous staff", 1000000], ["Ruinous crossbow", 750000], ["Ruinous off-hand crossbow", 250000]]) {
  if (ruinousCosts[name] !== cost) fail(`${name} token cost drifted`);
}
const occultist = byId(progression.equipment_models, "dungeoneering:occultist-necromancy-necklaces");
const occultistBase = Object.fromEntries((occultist?.base_rewards || []).map((row) => [row.name, row]));
if (occultistBase["Occultist's undead necklace"]?.token_cost !== 6500 || occultistBase["Occultist's revival necklace"]?.token_cost !== 15500) fail("Occultist base necklace costs drifted");
const hex = (occultist?.upgrade_chain || []).find((row) => row.name === "Occultist's hex necklace");
if (hex?.chaotic_remnant?.token_cost !== 100000 || hex?.chaotic_remnant?.dungeoneering_level !== 60 || !JSON.stringify(hex?.region_pressure ?? []).includes("asgarnia")) fail("Occultist hex cross-region chain drifted");
const holyWrench = byId(progression.equipment_models, "rum-deal:holy-wrench");
if (!holyWrench?.quest_dependencies?.includes("Rum Deal for the Holy wrench") || !holyWrench?.usable_slots?.includes("pocket") || !JSON.stringify(holyWrench?.effects ?? []).includes("10%")) fail("Holy wrench progression drifted");
const ectoplasmator = byId(progression.equipment_models, "drop-cleaner:attuned-ectoplasmator");
if (ectoplasmator?.upgrade?.quantity !== 100 || ectoplasmator?.charges?.initial !== 1000 || ectoplasmator?.charges?.maximum !== 5009 || ectoplasmator?.charges?.consumed_per_absorption !== 1) fail("Attuned ectoplasmator upgrade or charge state drifted");

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
  "dungeoneering:meilyr-recipe-page-purchase",
]) if (!byId(progression.consumable_unlocks, id)) fail(`missing consumable progression ${id}`);

const flask = byId(progression.consumable_unlocks, "crafting:combat-flask-infrastructure");
if (flask?.potion_flask?.crafting_level !== 89 || flask?.crystal_flask?.crafting_level !== 89) fail("flask Crafting requirements drifted");
const holy = byId(progression.consumable_unlocks, "potion:holy-overload");
if (holy?.herblore_level !== 97 || holy?.recipe_shop_cost_coins !== 700000 || holy?.recipe_page_required !== false) fail("Holy overload recipe drifted");
const spiritual = byId(progression.consumable_unlocks, "potion:spiritual-prayer");
if (spiritual?.herblore_level !== 110 || spiritual?.recipe_shop_cost_coins !== 1000000) fail("Spiritual prayer recipe drifted");
const extremePrayer = byId(progression.consumable_unlocks, "potion:extreme-prayer");
if (extremePrayer?.herblore_level !== 117) fail("Extreme prayer requirement drifted");
const recipePage = byId(progression.consumable_unlocks, "dungeoneering:meilyr-recipe-page-purchase");
if (recipePage?.token_cost !== 100000 || recipePage?.dungeoneering_level !== 75) fail("Meilyr recipe-page remaster price drifted");

for (const id of ["mage-arena:guthix-staff", "dominion-tower:dreadnips"]) if (!byId(progression.activity_unlocks, id)) fail(`missing general combat acquisition ${id}`);
const mageArena = byId(progression.activity_unlocks, "mage-arena:guthix-staff");
if (!mageArena?.requirements?.some((row) => row.includes("60 Magic")) || !mageArena?.requirements?.some((row) => row.includes("100 times")) || mageArena?.region_hint !== "forinthry") fail("Mage Arena acquisition drifted");
const dreadnips = byId(progression.activity_unlocks, "dominion-tower:dreadnips");
if (!dreadnips?.requirements?.some((row) => row.includes("450")) || !dreadnips?.requirements?.some((row) => row.includes("Spectate")) || dreadnips?.region_hint !== "desert") fail("Dreadnip acquisition drifted");

if (byId(progression.activity_unlocks, "mazcab:ability-codex-package")) fail("superseded Mazcab duplicate survived");
if (byId(progression.activity_unlocks, "shattered-worlds:utility-abilities")) fail("superseded Shattered Worlds duplicate survived");
for (const id of ["mazcab:teci-combat-ability-unlocks", "shattered-worlds:current-permanent-abilities", "tuskas-wrath:current-acquisition"]) if (!byId(progression.activity_unlocks, id)) fail(`current activity audit row missing: ${id}`);

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
const ritualShard = byId(planner.regional_unique_drops, "kandarin-lost-grove-ancient-elven-ritual-shard");
if (ritualShard?.region !== "kandarin" || !ritualShard?.support_item_effect?.includes("37.5%") || !ritualShard?.support_item_effect?.includes("five-minute")) fail("Ancient elven ritual shard region or effect drifted");
const groveRoute = (ritualShard?.self_source_routes || []).find((row) => row.source === "Lost Grove creatures");
const solakRoute = (ritualShard?.self_source_routes || []).find((row) => row.source === "Solak, Guardian of the Grove");
if (groveRoute?.drop_rate_on_slayer_task !== "1/1,500" || groveRoute?.drop_rate_off_slayer_task !== "1/5,000" || solakRoute?.drop_rate_per_player !== "1/1,000") fail("Ancient elven ritual shard self-source rates drifted");

const banned = ["unlock the power", "game changer", "seamlessly", "robust solution", "comprehensive solution", "delve into", "revolutionize", "cutting edge", "elevate your", "supercharge your"];
const prose = JSON.stringify({ progression, planner }).toLowerCase();
for (const phrase of banned) if (prose.includes(phrase)) fail(`clanker phrase: ${phrase}`);

console.log("Progression enrichment audit passed");
