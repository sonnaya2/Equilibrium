import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("data/reference/progression-unlocks.json", "utf8"));
const fail = (message) => { throw new Error(`Aura Overhaul audit: ${message}`); };
const byId = (rows, id) => (rows || []).find((row) => row?.id === id);

const vamp = byId(data.ability_unlocks, "aura-overhaul:vampyrism-aspect");
if (!vamp || vamp.magic_level !== 69 || vamp.duration_minutes !== 12 || !vamp.effect?.includes("5%") || !vamp.effect?.includes("50 life points")) {
  fail("Vampyrism Aspect values drifted");
}
if (vamp.spellbook !== "Ancient Magicks" || vamp.aspect_rule !== "Only one Aspect can be active at a time.") fail("Vampyrism Aspect state drifted");

const penance = byId(data.ability_unlocks, "aura-overhaul:penance-aspect");
if (!penance || penance.magic_level !== 67 || penance.duration_minutes !== 12 || !penance.effect?.includes("5%") || !penance.effect?.includes("100 Prayer points")) {
  fail("Penance Aspect values drifted");
}
if (penance.spellbook !== "Standard spellbook" || penance.aspect_rule !== "Only one Aspect can be active at a time.") fail("Penance Aspect state drifted");

const green = byId(data.account_unlocks, "aura-overhaul:greenfingers-passive");
if (green?.cost !== 30000 || !green?.effect?.includes("7%")) fail("Greenfingers passive drifted");
const siphon = byId(data.account_unlocks, "aura-overhaul:focused-siphoning-passive");
if (siphon?.cost !== 20000 || !siphon?.effect?.includes("7.5%")) fail("Focused Siphoning passive drifted");
const fingers = byId(data.account_unlocks, "aura-overhaul:five-finger-discount-passive");
if (fingers?.ranks !== 5 || fingers?.cost_per_rank !== 1000 || fingers?.success_per_rank_percent !== 2 || fingers?.maximum_success_bonus_percent !== 10) fail("Five-Finger Discount progression drifted");

const div = byId(data.account_unlocks, "aura-overhaul:divination-enrichment-progression");
if (JSON.stringify((div?.bonuses || []).map((row) => [row.divination_level, row.enriched_memory_chance_percent])) !== JSON.stringify([[39,2],[59,4],[79,7],[99,10]])) {
  fail("Divination enrichment ladder drifted");
}
const mining = byId(data.account_unlocks, "aura-overhaul:mining-critical-progression");
if (mining?.maximum_added_critical_chance_percent !== 10 || JSON.stringify((mining?.bonuses || []).map((row) => row.mining_level)) !== JSON.stringify([59,85])) fail("Mining critical progression drifted");
const cache = byId(data.account_unlocks, "aura-overhaul:resourceful-material-cache-rule");
if (!cache?.effect?.includes("first two gathers")) fail("Resourceful material-cache replacement drifted");
const sunspear = byId(data.account_unlocks, "aura-overhaul:sunspear-prayer-sustain");
if (JSON.stringify((sunspear?.thresholds || []).map((row) => [row.vyres_cremated, row.prayer_restore_percent_on_vyre_kill])) !== JSON.stringify([[50,1],[100,2],[150,3],[200,4],[250,5]])) {
  fail("Sunspear/Vyre prayer sustain ladder drifted");
}

const fishing = byId(data.equipment_models, "aura-overhaul:fishing-catch-replacements");
if (!fishing?.tool_bonuses?.some((row) => row.name === "Tavia's fishing rod" && row.catch_rate_percent === 14)) fail("Tavia catch-rate replacement drifted");
if (!fishing?.tool_bonuses?.some((row) => row.name === "Dragon harpoon" && row.catch_rate_percent === 9)) fail("Dragon harpoon catch-rate replacement drifted");
const hatchets = byId(data.equipment_models, "aura-overhaul:hatchet-chopping-bonuses");
if (JSON.stringify((hatchets?.tiers || []).map((row) => row.chopping_chance_percent)) !== JSON.stringify([5,10,15])) fail("Lumberjack replacement hatchet bonuses drifted");
const antipoison = byId(data.equipment_models, "aura-overhaul:antipoison-totem");
if (antipoison?.poison_immunity_percent !== 100 || antipoison?.slot !== "pocket") fail("Antipoison totem replacement drifted");

const removal = byId(data.activity_unlocks, "aura-overhaul:system-removal-guard");
if (!removal?.aura_slot_removed || !removal?.aura_refreshes_removed || !removal?.wars_wares_aura_refreshes_removed) fail("Aura system removal guard drifted");
for (const name of ["Berserker", "Maniacal", "Reckless", "Vampyrism", "Penance"] ) {
  if ((removal?.removed_auras || []).includes(name) === false && ["Vampyrism", "Penance"].includes(name) === false) fail(`removed combat aura missing from guard: ${name}`);
}

console.log("Aura Overhaul audit passed");
