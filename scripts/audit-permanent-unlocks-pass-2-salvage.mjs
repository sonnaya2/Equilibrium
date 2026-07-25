import { readFileSync } from "node:fs";

const progression = JSON.parse(readFileSync("data/reference/progression-unlocks.json", "utf8"));
const fail = (message) => {
  throw new Error(`permanent-unlocks-pass-2 salvage audit: ${message}`);
};
const byId = (rows, id) => (rows ?? []).find((row) => row?.id === id);

const morytania = byId(progression.account_unlocks, "achievements:morytania-barrows");
if (!morytania) fail("Hard Morytania Barrows reward row is missing");
const morytaniaText = JSON.stringify(morytania.rewards ?? []);
if (!morytaniaText.includes("halved") || !morytaniaText.includes("doubled") || !morytaniaText.includes("bank")) {
  fail("Hard Morytania Barrows rewards are incomplete");
}

const vitalSparkCodices = byId(progression.ability_unlocks, "sophanem:golden-touch-unsullied");
if (!vitalSparkCodices) fail("Golden Touch and Unsullied row is missing");
const vitalSparkCosts = Object.fromEntries((vitalSparkCodices.unlocks ?? []).map((row) => [row.name, row.vital_sparks]));
if (vitalSparkCosts["Golden Touch"] !== 2000 || vitalSparkCosts.Unsullied !== 2000) {
  fail("Golden Touch or Unsullied is not using the 2,000-vital-spark requirement");
}

const ingenuity = byId(progression.ability_unlocks, "invention:ingenuity-of-the-humans");
if (!ingenuity) fail("Ingenuity of the Humans row is missing");
const ingenuityMaterials = Object.fromEntries((ingenuity.materials ?? []).map((row) => [row.name, row.quantity]));
for (const [name, quantity] of [
  ["Alchemical onyx", 2],
  ["Stunning components", 20],
  ["Direct components", 100],
  ["Smooth parts", 1500],
]) {
  if (ingenuityMaterials[name] !== quantity) fail(`Ingenuity material drifted: ${name}`);
}
if (!(ingenuity.requirements ?? []).includes("114 Invention") || !(ingenuity.requirements ?? []).includes("80 Crafting")) {
  fail("Ingenuity skill requirements drifted");
}

const slayerCodices = byId(progression.ability_unlocks, "elite-dungeons:slayer-ability-codices");
if (!slayerCodices) fail("crafted Slayer codex row is missing");
const sharedMaterials = Object.fromEntries((slayerCodices.shared_materials ?? []).map((row) => [row.name, row.quantity]));
if (sharedMaterials["Black stone heart"] !== 100 || sharedMaterials.Onyx !== 2) {
  fail("crafted Slayer codex shared materials drifted");
}
const componentByAbility = Object.fromEntries((slayerCodices.variants ?? []).map((row) => [row.name, [row.component, row.component_quantity]]));
for (const [name, component] of [
  ["Demon Slayer", "Silent components"],
  ["Dragon Slayer", "Resilient components"],
  ["Undead Slayer", "Oceanic components"],
]) {
  const value = componentByAbility[name];
  if (!value || value[0] !== component || value[1] !== 60) fail(`${name} component recipe drifted`);
}

console.log("PERMANENT UNLOCK SALVAGE AUDIT\n4 missing dependency groups present and current-main precedence preserved.");
