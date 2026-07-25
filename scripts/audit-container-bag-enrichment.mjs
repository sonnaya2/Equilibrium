import { readFileSync } from "node:fs";

const supplement = JSON.parse(readFileSync("data/reference/progression-container-bags-2026-07-25.json", "utf8"));
const equipment = supplement.equipment_models || [];
const byId = (id) => equipment.find((row) => row?.id === id);
const fail = (message) => { throw new Error(`container-bag enrichment audit: ${message}`); };

const herb = byId("anachronia:herb-bag-current");
if (!herb) fail("Herb bag row missing");
if (herb.region_hint !== "anachronia" || herb.hard_region_requirement !== true || herb.activity !== "Herby Werby") fail("Herb bag region/activity drifted");
if (herb.weekly_point_cap !== 100 || herb.base?.cost !== 200 || herb.upgrade?.cost !== 200) fail("Herb bag weekly currency milestones drifted");
if (herb.base?.capacity_per_grimy_herb !== 50 || herb.upgrade?.capacity_per_grimy_herb !== 100 || herb.stores_noted_items !== true) fail("Herb bag capacity or noted-item rule drifted");

const gem = byId("dungeoneering:gem-bag-current");
if (!gem) fail("Gem bag row missing");
if (gem.region_hint !== "forinthry" || gem.hard_region_requirement !== true) fail("Gem bag Daemonheim region rule drifted");
if (gem.base?.dungeoneering_level !== 25 || gem.base?.crafting_level !== 25 || gem.base?.token_cost !== 2000 || gem.base?.capacity_total !== 100) fail("base Gem bag values drifted");
if (gem.upgrade?.dungeoneering_level !== 40 || gem.upgrade?.crafting_level !== 45 || gem.upgrade?.additional_token_cost !== 20000) fail("upgraded Gem bag requirements drifted");
if (gem.upgrade?.capacity_per_type !== 60 || gem.upgrade?.capacity_total !== 300 || !gem.upgrade?.gem_types?.includes("Dragonstone") || gem.stores_noted_items !== true) fail("upgraded Gem bag storage drifted");

const measure = byId("crafting:artificers-measure");
if (!measure) fail("Artificer's measure row missing");
if (measure.region_status !== "cross_region_dependency_chain") fail("Artificer's measure must remain cross-region");
for (const region of ["forinthry", "tirannwn", "morytania"]) if (!measure.region_pressure?.includes(region)) fail(`Artificer's measure region chain missing ${region}`);
for (const requirement of ["99 Crafting", "102 Archaeology", "40 Dungeoneering through the upgraded gem bag", "99 Smithing for self-sufficient glorious-bar production"]) {
  if (!measure.requirements?.includes(requirement)) fail(`Artificer's measure requirement missing: ${requirement}`);
}
if (measure.gem_storage?.capacity_per_type !== 100 || !measure.gem_storage?.gem_types?.includes("Dragonstone") || measure.gem_storage?.shared_with_other_artificers_measures !== true) fail("Artificer's measure gem storage drifted");
const materials = Object.fromEntries((measure.materials || []).map((row) => [row.item, row.quantity]));
for (const [item, quantity] of [["Gem bag (upgraded)", 1], ["Mystic cloth", 10], ["Blessed molten glass", 10], ["Glorious silvthril chain", 1], ["Onyx", 1]]) {
  if (materials[item] !== quantity) fail(`Artificer's measure material drifted: ${item}`);
}

console.log("Container-bag enrichment audit passed");
