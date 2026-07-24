import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("data/reference/progression-unlocks.json", "utf8"));
const fail = (message) => { throw new Error(`Dungeoneering Remastered audit: ${message}`); };
const byId = (rows, id) => (rows || []).find((row) => row?.id === id);

const rapid = byId(data.prayer_unlocks, "dungeoneering:rapid-renewal-current");
if (!rapid || rapid.token_cost !== 38000 || rapid.dungeoneering_level !== 65 || rapid.prayer_level !== 65) {
  fail("Rapid Renewal is not using the current 38k / 65 Dungeoneering / 65 Prayer gate");
}

const floor = byId(data.activity_unlocks, "dungeoneering:remaster-floor-progression");
if (!floor) fail("remaster floor/storage state is missing");
const removed = floor.removed_rewards?.find((row) => row.name === "Scroll of Daemonheim");
if (!removed || removed.removed_on !== "2026-05-11" || removed.refund_tokens !== 30000) {
  fail("Scroll of Daemonheim removal/refund guard drifted");
}
if (floor.smugglers_storage?.starting_slots !== 3 || floor.smugglers_storage?.stack_limit !== 100) {
  fail("Smuggler's storage base state drifted");
}
const storage = Object.fromEntries((floor.smugglers_storage?.milestones || []).map((row) => [row.dungeoneering_level, row.slots]));
for (const [level, slots] of [[10, 6], [40, 9], [80, 12], [110, 15]]) {
  if (storage[level] !== slots) fail(`Smuggler's storage level ${level} milestone drifted`);
}
if (floor.bind_system?.loadouts !== 4 || floor.bind_system?.maximum_possible_bound_items !== 16) {
  fail("remaster bind/loadout state drifted");
}
const buffs = Object.fromEntries((floor.floor_buff_cycle || []).map((row) => [row.name, row.increment_percent]));
for (const [name, amount] of [
  ["Death Penalty Reduction", 1],
  ["Extra Resource Chance", 2],
  ["Skilling XP Boost", 1],
  ["Damage Reduction", 1],
  ["Large Floor XP Boost", 5],
]) {
  if (buffs[name] !== amount) fail(`${name} floor-buff increment drifted`);
}

const necro = byId(data.equipment_models, "dungeoneering:necromancy-gravite-chaotic-current");
if (!necro || (necro.weapons || []).length !== 4) fail("Gravite/Chaotic Necromancy ladder is incomplete");
const weapons = Object.fromEntries((necro.weapons || []).map((row) => [row.name, row]));
for (const [name, tier, tokens, dg, nec] of [
  ["Gravite guard", 55, 22500, 55, 55],
  ["Gravite lantern", 55, 7500, 55, 55],
  ["Chaotic guard", 80, 150000, 70, 80],
  ["Chaotic lantern", 80, 50000, 70, 80],
]) {
  const row = weapons[name];
  if (!row || row.tier !== tier || row.token_cost !== tokens || row.dungeoneering_level !== dg || row.necromancy_level !== nec) {
    fail(`${name} current reward-shop values drifted`);
  }
}

// Prevent old reward tables from reintroducing Scroll of Daemonheim as an active unlock.
for (const section of ["quest_unlocks", "account_unlocks", "equipment_models", "ability_unlocks", "prayer_unlocks", "consumable_unlocks"]) {
  for (const row of data[section] || []) {
    if (row.id === "dungeoneering:scroll-of-daemonheim" || row.name === "Scroll of Daemonheim") {
      fail(`removed Scroll of Daemonheim returned as active content in ${section}`);
    }
  }
}

console.log("Dungeoneering Remastered audit passed");
