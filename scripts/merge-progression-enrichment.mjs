import { readFileSync, writeFileSync } from "node:fs";

const donorProgressionPath = process.argv[2];
const donorPlannerPath = process.argv[3];
if (!donorProgressionPath || !donorPlannerPath) {
  throw new Error("usage: node scripts/merge-progression-enrichment.mjs <donor-progression.json> <donor-planner.json>");
}

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const find = (rows, id) => (rows || []).find((row) => row?.id === id);
const addIfMissing = (target, source, id) => {
  if (find(target, id)) return;
  const row = find(source, id);
  if (!row) throw new Error(`validated donor is missing ${id}`);
  target.push(row);
};
const upsertCurrent = (rows, row) => {
  const index = rows.findIndex((entry) => entry?.id === row.id);
  if (index >= 0) rows[index] = { ...rows[index], ...row };
  else rows.push(row);
};

const progressionPath = "scraped-data/progression-unlocks.json";
const progression = read(progressionPath);
const donor = read(donorProgressionPath);
progression.account_unlocks ||= [];
progression.activity_unlocks ||= [];
progression.equipment_models ||= [];
progression.consumable_unlocks ||= [];

// Current main owns the newer activity audit for Mazcab, Shattered Worlds and Tuska's Wrath.
// Never restore the superseded research IDs for those concepts.
progression.activity_unlocks = progression.activity_unlocks.filter((row) => ![
  "mazcab:ability-codex-package",
  "shattered-worlds:utility-abilities",
].includes(row.id));

const liveLivid = find(progression.activity_unlocks, "livid-farm:lunar-spells");
const donorLivid = find(donor.activity_unlocks, "livid-farm:lunar-spells");
if (!liveLivid || !donorLivid) throw new Error("Livid Farm canonical/donor row missing");
for (const key of ["unlock_ladder", "point_semantics", "current_change", "source_urls"]) {
  if (liveLivid[key] == null && donorLivid[key] != null) liveLivid[key] = donorLivid[key];
}
if ((!liveLivid.confidence || liveLivid.confidence === "confirmed_wiki_unlocks_rate_not_used") && donorLivid.confidence) {
  liveLivid.confidence = donorLivid.confidence;
}
if (Array.isArray(liveLivid.source_urls) && liveLivid.source_url) delete liveLivid.source_url;

addIfMissing(progression.activity_unlocks, donor.activity_unlocks, "necromancy:well-of-souls-talents");

for (const id of [
  "dungeoneering:spirit-cape-passive",
  "anachronia:slayer-lodge",
  "anachronia:player-lodge",
  "farms:combat-perk-state",
  "anachronia:totem-of-vitality",
  "legacy-of-zamorak:infernal-puzzle-box",
  "pvm:reaper-crew",
]) addIfMissing(progression.account_unlocks, donor.account_unlocks, id);

addIfMissing(progression.equipment_models, donor.equipment_models, "zamorakian-slivers:enchantments");
for (const row of donor.consumable_unlocks || []) {
  if (!find(progression.consumable_unlocks, row.id)) progression.consumable_unlocks.push(row);
}

// Six-dose container infrastructure is an access dependency distinct from Herblore recipe ownership.
upsertCurrent(progression.consumable_unlocks, {
  id: "crafting:combat-flask-infrastructure",
  name: "Potion and crystal flask infrastructure",
  category: "six-dose combat container access",
  potion_flask: {
    crafting_level: 89,
    material: "Robust glass",
    material_access: ["As a First Resort", "81 Mining for red sandstone"],
    capacity_doses: 6,
  },
  crystal_flask: {
    crafting_level: 89,
    material: "Crystal glass",
    material_access: ["As a First Resort", "Plague's End", "81 Mining for crystal-flecked sandstone"],
    capacity_doses: 6,
    primary_use: "Combination potions",
  },
  source_urls: [
    "https://runescape.wiki/w/Crafting",
    "https://runescape.wiki/w/Potion_flask",
    "https://runescape.wiki/w/Crystal_flask",
  ],
  confidence: "confirmed_current_wiki",
  league_treatment: "Keep robust-glass and crystal-glass access separate. Six-dose container access is not implied by Herblore level alone.",
});

upsertCurrent(progression.consumable_unlocks, {
  id: "potion:holy-overload",
  name: "Holy overload potion",
  category: "permanent Meilyr combination-potion recipe",
  herblore_level: 97,
  recipe_shop_cost_coins: 700000,
  recipe_page_required: false,
  ingredients: ["Overload (4)", "Prayer renewal (4)", "Crystal flask"],
  output_doses: 6,
  source_urls: ["https://runescape.wiki/w/Holy_overload_potion"],
  confidence: "confirmed_current_wiki",
  league_treatment: "This direct Meilyr purchase is distinct from combination recipes that first require an unreadable Daemonheim recipe page.",
});

upsertCurrent(progression.consumable_unlocks, {
  id: "potion:spiritual-prayer",
  name: "Spiritual prayer potion",
  category: "permanent Meilyr combination-potion recipe",
  herblore_level: 110,
  recipe_shop_cost_coins: 1000000,
  ingredients: ["Prayer potion (4)", "Summoning potion (4)", "Primal extract", "Crystal flask"],
  output_doses: 6,
  effect_summary: "Combines prayer and summoning restoration and restores familiar special-move points per dose.",
  source_urls: ["https://runescape.wiki/w/Spiritual_prayer_potion"],
  confidence: "confirmed_current_wiki",
});

upsertCurrent(progression.consumable_unlocks, {
  id: "potion:extreme-prayer",
  name: "Extreme prayer potion",
  category: "high-level untradeable prayer consumable",
  herblore_level: 117,
  recipe_unlock: "automatic_by_level",
  ingredients: ["Primal extract", "Super prayer (3)", "Spark chitin"],
  source_urls: [
    "https://runescape.wiki/w/Extreme_prayer",
    "https://runescape.wiki/w/Calculator:Herblore/Extreme_potions",
  ],
  confidence: "confirmed_current_wiki",
  league_treatment: "This is the refill consumable for the blessed flask and a separate 117 Herblore gate from constructing the flask itself.",
});

upsertCurrent(progression.equipment_models, {
  id: "blessed-flask:prayer-storage",
  name: "Blessed flask",
  category: "refillable prayer-storage account item",
  herblore_level: 118,
  crafting_level: 96,
  capacity_doses: 80,
  refill: "Extreme prayer potion variants",
  final_components: [
    { item: "Blessed flask shell", quantity: 1 },
    { item: "Glorious silvthril chain", quantity: 1 },
    { item: "Holy elixir", quantity: 1 },
    { item: "Holy water", quantity: 1 },
    { item: "Light core", quantity: 5 },
    { item: "Holy overload potion (6)", quantity: 5 },
    { item: "Extreme prayer (4)", quantity: 5 },
    { item: "Positive energy", quantity: 500 },
  ],
  major_raw_dependencies: [
    { item: "Blessed sand", quantity: 40000 },
    { item: "Soda ash", quantity: 1200 },
    { item: "Red sandstone", quantity: 1200 },
    { item: "Crystal-flecked sandstone", quantity: 1200 },
    { item: "Harmonic dust", quantity: 5000 },
    { item: "Alaea sea salt", quantity: 250 },
  ],
  quest_dependencies: [
    "As a First Resort for sandstone glassmaking",
    "Plague's End for crystal-flecked sandstone / Prifddinas",
    "Legacy of Seergaze progression for the chain-link mould used in the silvthril-chain branch",
  ],
  source_urls: [
    "https://runescape.wiki/w/Blessed_flask",
    "https://runescape.wiki/w/Holy_overload_potion",
  ],
  confidence: "confirmed_current_wiki",
  league_treatment: "Model the flask as a dependency graph, not a single Crafting/Herblore checkbox. Do not store live GE cost estimates.",
});

progression.snapshot_date = [progression.snapshot_date, donor.snapshot_date, "2026-07-24"].filter(Boolean).sort().at(-1);
write(progressionPath, progression);

// Archaeology already has current region/source rows on main. Fill only validated missing fields.
const plannerPath = "scraped-data/planner-expansions.json";
const planner = read(plannerPath);
const donorPlanner = read(donorPlannerPath);
const donorRelics = new Map((donorPlanner.archaeology_combat_relics || []).map((row) => [row.relic, row]));
const liveRelics = planner.archaeology_combat_relics || [];
for (const live of liveRelics) {
  const relic = donorRelics.get(live.relic);
  if (!relic) continue;
  if (live.monolith_energy == null && relic.monolith_energy != null) live.monolith_energy = relic.monolith_energy;
  if (live.invention_level == null && relic.invention_level != null) live.invention_level = relic.invention_level;
  if ((!live.effect_summary || live.effect_summary === "PvM permanent unlock tracked by PvME") && relic.effect_summary) {
    live.effect_summary = relic.effect_summary;
  }
}
if (!liveRelics.some((row) => row.relic === "Blessing of Het")) {
  const relic = donorRelics.get("Blessing of Het");
  if (!relic) throw new Error("validated Blessing of Het row missing");
  liveRelics.push(relic);
}
planner.archaeology_combat_relics = liveRelics;
if (!planner.archaeology_relic_system && donorPlanner.archaeology_relic_system) {
  planner.archaeology_relic_system = donorPlanner.archaeology_relic_system;
}
write(plannerPath, planner);

console.log("Merged progression enrichment by stable ID");
