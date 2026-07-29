import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();

function read(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function canonicalize(value) {
  const serialized = JSON.stringify(value)
    .replaceAll("Asgarnia + Troll Country", "Asgarnia")
    .replaceAll("Troll Country", "Asgarnia");
  return JSON.parse(serialized);
}

function write(path, value) {
  const target = join(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(canonicalize(value), null, 2)}\n`);
}

function mergeAddition(target, addition) {
  if (typeof addition?.id !== "string" || !addition.id) throw new Error("Progression enrichment addition is missing id");
  const index = target.findIndex((row) => row.id === addition.id);
  if (index < 0) {
    target.push(addition);
    return;
  }
  const existing = target[index];
  const merged = { ...addition, ...existing };
  // Array fields union across overlays; scalar fields keep existing-first precedence.
  for (const [key, value] of Object.entries(addition)) {
    if (!Array.isArray(value) || !Array.isArray(existing[key])) continue;
    const seen = new Map();
    for (const entry of [...existing[key], ...value]) seen.set(JSON.stringify(entry), entry);
    merged[key] = [...seen.values()];
  }
  target[index] = merged;
}

function applyEnrichment(progressionUnlocks, enrichment, sourceName) {
  progressionUnlocks.account_unlocks ||= [];
  progressionUnlocks.activity_unlocks ||= [];
  progressionUnlocks.equipment_models ||= [];
  progressionUnlocks.consumable_unlocks ||= [];
  progressionUnlocks.ability_unlocks ||= [];
  progressionUnlocks.prayer_unlocks ||= [];

  const excluded = new Set(enrichment.policy?.activity_exclusions ?? []);
  progressionUnlocks.activity_unlocks = progressionUnlocks.activity_unlocks.filter((row) => !excluded.has(row.id));

  for (const patch of enrichment.activity_patches ?? []) {
    const row = progressionUnlocks.activity_unlocks.find((entry) => entry.id === patch.id);
    if (!row) throw new Error(`Progression enrichment patch target not found in ${sourceName}: ${patch.id}`);
    Object.assign(row, patch.set ?? {});
    if (Array.isArray(row.source_urls) && row.source_url) delete row.source_url;
  }

  for (const addition of enrichment.activity_additions ?? []) mergeAddition(progressionUnlocks.activity_unlocks, addition);
  for (const addition of enrichment.account_additions ?? []) mergeAddition(progressionUnlocks.account_unlocks, addition);
  for (const addition of enrichment.equipment_additions ?? []) mergeAddition(progressionUnlocks.equipment_models, addition);
  for (const addition of enrichment.consumable_additions ?? []) mergeAddition(progressionUnlocks.consumable_unlocks, addition);
  for (const addition of enrichment.ability_additions ?? []) mergeAddition(progressionUnlocks.ability_unlocks, addition);
  for (const addition of enrichment.prayer_additions ?? []) mergeAddition(progressionUnlocks.prayer_unlocks, addition);

  progressionUnlocks.snapshot_date = [progressionUnlocks.snapshot_date, enrichment.snapshot_date].filter(Boolean).sort().at(-1);
}

const MANUAL_ACTIVITY_ADDITIONS = [
  {
    id: "forinthry:dragon-harpoon",
    name: "Dragon harpoon",
    category: "Fishing tool progression",
    region_hint: "forinthry",
    unlocks: ["Wieldable Fishing tool with a 9% catch-rate boost at harpoon fishing spots"],
    source_urls: ["https://runescape.wiki/w/Dragon_harpoon"],
    confidence: "confirmed_wiki_2026",
    league_treatment: "Major Forinthry Fishing tool unlock",
  },
  {
    id: "anachronia:effigy-incubator",
    name: "Effigy Incubator",
    category: "monthly Distraction and Diversion",
    region_hint: "anachronia",
    requirements: ["Desperate Measures and level 85 in Crafting, RuneCrafting, Invention, or Smithing"],
    unlocks: ["Create monthly effigies from gathered materials and casings", "Filled effigies award skill XP lamps or stars"],
    source_urls: ["https://runescape.wiki/w/Effigy_Incubator"],
    confidence: "confirmed_wiki",
    league_treatment: "Major Anachronia monthly skilling unlock",
  },
  {
    id: "misthalin:pure-essence-chest",
    name: "Pure essence chest",
    category: "Runecrafting pure essence supply",
    region_hint: "misthalin",
    location: "Wizards' Tower beside Archmage Sedridor",
    requirements: ["Completion of Rune Memories"],
    unlocks: [
      "Archmage Sedridor's Rune chest supplies up to 24,750 pure essence in total",
      "The amount is 5 × each Runecrafting level gained through level 99",
    ],
    notes: "One-time scalable pure essence source; the full level-99 claim totals 24,750 pure essence",
    source_urls: [
      "https://runescape.wiki/w/Rune_chest",
      "https://runescape.wiki/w/Rune_Memories",
    ],
    confidence: "confirmed_wiki",
    league_treatment: "Major Misthalin Runecrafting supply unlock",
  },
  {
    id: "kandarin:eternal-magic-trees",
    name: "Eternal magic trees",
    category: "Woodcutting resource supply",
    region_hint: "kandarin",
    requirements: [
      "Piscatoris Hunter area access in Kandarin",
      "100 Woodcutting for eternal magic trees"
    ],
    unlocks: [
      "Kandarin eternal magic log supply from the Piscatoris grove",
      "Perfect eternal magic branch chance at 110 Woodcutting"
    ],
    notes: "The Kandarin grove is a complete eternal magic tree route. Dalia's Havenhythe nursery is an optional alternate plot, not a requirement",
    source_urls: [
      "https://runescape.wiki/w/Eternal_magic_tree",
      "https://runescape.wiki/w/Pay-to-play_Woodcutting_training"
    ],
    confidence: "confirmed_wiki",
    league_treatment: "Hard Kandarin for the Piscatoris eternal magic tree grove"
  },
  {
    id: "misthalin:fort-forinthry",
    name: "Fort Forinthry",
    category: "Construction, skilling and operations hub",
    region_hint: "misthalin",
    requirements: ["Fort Forinthry access", "Construction levels for the relevant building tiers"],
    unlocks: [
      "Botanist's Workbench Herblore batching and supplies",
      "Command Centre operations and Archaeology research",
      "Guardhouse Slayer, Kitchen Cooking and Ranger's Workroom Fletching bonuses",
      "Town Hall bank/rested XP and Workshop Construction, Invention, Archaeology and Smithing facilities",
      "Fort chapel Prayer support",
    ],
    notes: "One Misthalin Fort Forinthry infrastructure line replaces the separate building rows",
    source_urls: [
      "https://runescape.wiki/w/Fort_Forinthry",
      "https://runescape.wiki/w/Botanist%27s_Workbench",
      "https://runescape.wiki/w/Command_Centre",
      "https://runescape.wiki/w/Guardhouse",
      "https://runescape.wiki/w/Kitchen_(Fort_Forinthry)",
      "https://runescape.wiki/w/Ranger%27s_Workroom",
      "https://runescape.wiki/w/Town_Hall_(Fort_Forinthry)",
      "https://runescape.wiki/w/Workshop_(Fort_Forinthry)",
    ],
    confidence: "confirmed_wiki",
    league_treatment: "Hard Misthalin for Fort Forinthry infrastructure under the current working taxonomy",
  }
];

const REMOVED_ACTIVITY_IDS = new Set([
  "misthalin:archaeology-campus-hub",
  "misthalin:archaeology-collectors",
  "misthalin:croesus-front-skilling",
  "misthalin:draynor-skilling-hub",
  "misthalin:edgeville-skilling-hub",
  "misthalin:family-crest-skilling-gauntlets",
  "misthalin:fort-botanists-workbench",
  "misthalin:fort-command-centre",
  "misthalin:fort-forinthry-workshop",
  "misthalin:fort-guardhouse-slayer",
  "misthalin:fort-kitchen",
  "misthalin:fort-rangers-workroom",
  "misthalin:fort-town-hall",
  "misthalin:fort-chapel",
  "misthalin:guildmaster-qualification",
  "misthalin:it-belongs-in-a-museum-log",
  "misthalin:runespan-ethereal-outfits",
  "misthalin:um-ritual-site-infrastructure",
  "cross-region:imcando-tools-family",
  "cross-region:poh-portal-towns",
  "misthalin:monolith-energy-research-ladder",
  "misthalin:museum-donation-bin",
  "misthalin:necromantic-rune-temple",
  "misthalin:professor-relic-loadout-purchase",
  "misthalin:runecrafting-altars",
  "misthalin:varrock-museum-kudos",
  "misthalin:velucia-museum-chronote-tiers",
  "misthalin:velucia-museum-collections",
  "asgarnia:thieves-guild-master-tools",
  "misthalin:kerapac-hard-mode-fsoa-farm",
  "misthalin:rasial-necro-bis-farm",
  "misthalin:wars-blessing-combat-mastery",
  "havenhythe:apex-hide-masterwork-ranged-path",
  "havenhythe:canoe-network",
  "havenhythe:open-water-fishing-spots",
  "havenhythe:shrine-of-the-spirit-wolves",
  "havenhythe:jackalope-familiar",
  "havenhythe:jackalope-hunting",
  "havenhythe:trader-woes-bank-chest",
  "asgarnia:modified-blacksmiths-helmet",
  "asgarnia:modified-botanists-mask",
  "havenhythe:modified-shamans-headdress",
  "kandarin:modified-diviners-headwear",
  "kandarin:modified-sous-chefs-toque",
  "desert:modified-farmers-hat",
  "misthalin:modified-artisans-bandana",
  "misthalin:modified-ritualists-mask",
  "morytania:modified-first-age-tiara",
  "misthalin:wars-grimoire",
  "misthalin:well-of-souls",
  "misthalin:wizards-tower-runecrafting-guild",
  "misthalin:wood-box-tier-upgrades",
  "misthalin:woodcutters-grove",
]);

const REMOVED_EQUIPMENT_IDS = new Set([
  "boss:arch-glacor",
  "boss:croesus",
  "boss:kerapac",
  "boss:rasial",
  "boss:sanctum-of-rebirth",
  "boss:tzkal-zuk",
  "misthalin:rasial-first-necromancer-equipment",
  "misthalin:fletchers-outfit",
  "misthalin:focus-storage",
  "misthalin:infinity-ethereal-outfit",
  "asgarnia:toolbelt-master-thief-tools",
  "misthalin:necromancy-conjure-residuals",
  "misthalin:scripture-of-bik",
  "misthalin:wood-box-tier-upgrades",
  "havenhythe:jackalope-familiar",
  "asgarnia:modified-blacksmiths-helmet",
  "asgarnia:modified-botanists-mask",
  "havenhythe:modified-shamans-headdress",
  "kandarin:modified-diviners-headwear",
  "kandarin:modified-sous-chefs-toque",
  "desert:modified-farmers-hat",
  "misthalin:modified-artisans-bandana",
  "misthalin:modified-ritualists-mask",
  "morytania:modified-first-age-tiara",
]);

function enrichPrayerCatalogue(prayerSource, details) {
  const enriched = structuredClone(prayerSource);
  enriched.purpose = "Complete current prayer catalogue with effects and normal-game region dependencies for Equilibrium planning.";
  enriched.region_methodology = details.region_methodology;
  enriched.sources = details.sources;
  enriched.unlock_profiles = details.unlock_profiles;

  for (const book of enriched.books) {
    const defaultProfileId = details.default_profile_by_book?.[book.id];
    if (!defaultProfileId) throw new Error(`Prayer details are missing a default unlock profile for ${book.id}`);

    for (const prayer of book.prayers) {
      const overrideKey = `${book.id}:${prayer.name}`;
      const profileId = details.profile_overrides?.[overrideKey] ?? defaultProfileId;
      const profile = details.unlock_profiles?.[profileId];
      const effect = details.effects?.[prayer.name];
      if (!profile) throw new Error(`Prayer details are missing unlock profile ${profileId} for ${overrideKey}`);
      if (typeof effect !== "string" || !effect.trim()) throw new Error(`Prayer details are missing an effect for ${overrideKey}`);

      const baseSourceRef = book.id === "standard-prayers" ? "prayer" : "curses";
      prayer.effect = effect;
      prayer.required_regions = [...profile.required_regions];
      prayer.region_requirement_type = profile.region_requirement_type;
      prayer.unlock_profile_id = profileId;
      prayer.unlock_requirements = [...profile.requirements];
      prayer.source_refs = [...new Set([baseSourceRef, ...(profile.source_refs ?? [])])];
      if (profile.acquisition_location_region) prayer.acquisition_location_region = profile.acquisition_location_region;
    }
  }

  return enriched;
}

const combat = read("scraped-data/combat-2026.json");
const combatAbilityAudit = read("scraped-data/combat-ability-audit-2026-07-24.json");
const catalyst = read("scraped-data/catalyst.json");
const changes = read("scraped-data/2026-changes.json");
const rebalance = read("scraped-data/midgame-rebalance-2026-07-20.json");
const progressionUnlocks = read("scraped-data/progression-unlocks.json");
const prayerBooks = read("scraped-data/prayer-books.json");
const prayerSource = read("scraped-data/prayers.json");
const prayerDetails = read("scraped-data/prayer-effects-regions.json");
const prayers = enrichPrayerCatalogue(prayerSource, prayerDetails);
const spellbooks = read("scraped-data/spellbooks.json");
const regionDependencies = read("scraped-data/region-dependencies.json");
const referenceHarvest = read("scraped-data/reference-site-harvest.json");
const masterworkStaffChain = read("scraped-data/masterwork-staff-chain.json");
const unknowns = read("scraped-data/unknowns.json");

const progressionAuditPath = join(ROOT, "scraped-data/progression-unlocks-audit-2026-07-24.json");
if (existsSync(progressionAuditPath)) {
  const progressionAudit = JSON.parse(readFileSync(progressionAuditPath, "utf8"));
  const knownQuestIds = new Set(progressionUnlocks.quest_unlocks.map((row) => row.id));
  const knownActivityIds = new Set(progressionUnlocks.activity_unlocks.map((row) => row.id));

  for (const addition of progressionAudit.quest_unlock_additions ?? []) {
    if (typeof addition.id !== "string" || !addition.id) throw new Error("Progression quest unlock audit addition is missing id");
    if (!knownQuestIds.has(addition.id)) {
      progressionUnlocks.quest_unlocks.push(addition);
      knownQuestIds.add(addition.id);
    }
  }

  for (const addition of progressionAudit.activity_unlock_additions ?? []) {
    if (typeof addition.id !== "string" || !addition.id) throw new Error("Progression activity unlock audit addition is missing id");
    if (!knownActivityIds.has(addition.id)) {
      progressionUnlocks.activity_unlocks.push(addition);
      knownActivityIds.add(addition.id);
    }
  }
}

const enrichmentFiles = readdirSync(join(ROOT, "scraped-data"))
  .filter((name) => /^progression-enrichment-.*\.json$/.test(name))
  .sort();
for (const file of enrichmentFiles) {
  applyEnrichment(progressionUnlocks, read(`scraped-data/${file}`), file);
}

for (const addition of MANUAL_ACTIVITY_ADDITIONS) {
  mergeAddition(progressionUnlocks.activity_unlocks, addition);
}

const woodcuttersGrove = progressionUnlocks.activity_unlocks.find(
  (row) => row.id === "misthalin:woodcutters-grove-facilities",
);
if (woodcuttersGrove) {
  Object.assign(woodcuttersGrove, {
    name: "Woodcutters' Grove",
    category: "Woodcutting hub and Imcando hatchet progression",
    requirements: [
      "Unwelcome Guests and eastern border wall progression to unlock Grove cabin blueprints",
      "Construction 50 for Grove tiers 1-2; Construction 60 for tier 3",
      "Tier 3 Woodcutter's Grove for Imcando hatchet fragment nests",
    ],
    unlocks: [
      "Tier 1: normal and oak trees; wood spirit storage in wood boxes; log piles to bank; nests/geodes auto into backpack",
      "Tier 2: willow, yew, and ivy; fairy ring BJP; Farming tree patch; nests/geodes into wood boxes",
      "Tier 3: elder tree; improved bird nests; Imcando hatchet fragment nests",
      "One guaranteed first Imcando fragment from Oak and bad-luck mitigation on fragment nests",
      "Counts as in-fort for Town Hall rested experience",
    ],
    notes: "Single Woodcutters' Grove row combines facility tiers, Woodcutting access, storage, and the Imcando hatchet fragment gate",
    source_urls: [
      "https://runescape.wiki/w/Woodcutters%27_Grove",
      "https://runescape.wiki/w/Woodcutter%27s_Grove",
      "https://runescape.wiki/w/Imcando_hatchet",
    ],
  });
}

const shrine = progressionUnlocks.activity_unlocks.find(
  (row) => row.id === "havenhythe:shrine-of-inanna-summoning-hub",
);
if (shrine) {
  Object.assign(shrine, {
    name: "Shrine of Inanna and Spirit Wolves Summoning hub",
    category: "regional Summoning production and reward-shop hub",
    notes: "One Havenhythe shrine complex combines the empowered Summoning obelisks, Spirit Plane Connection, Blessings of the Wolf shop, shaman outfit stock and local pouch logistics",
    league_treatment: "Hard Havenhythe Summoning shrine and shop path",
  });
}

const highwealdRocks = progressionUnlocks.activity_unlocks.find(
  (row) => row.id === "havenhythe:highweald-ruins-mine",
);
if (highwealdRocks) {
  Object.assign(highwealdRocks, {
    name: "Necrite rocks, Phasmatite rocks, Platinum rocks and Havensilver rock",
    category: "Mining / Highweald Forest",
    unlocks: [
      "Necrite rocks",
      "Phasmatite rocks",
      "Platinum rocks",
      "Havensilver rock",
      "Hearts of Sanguine opens the Highweald Ruins mine",
      "104 Mining (boostable) and the Oh Yeah! achievement open the platinum rocks behind the primeval slabs",
    ],
    notes: "Highweald Ruins mine resource set",
    source_urls: ["https://runescape.wiki/w/Highweald_Ruins_mine"],
  });
}

progressionUnlocks.activity_unlocks = progressionUnlocks.activity_unlocks.filter(
  (row) => !REMOVED_ACTIVITY_IDS.has(row.id),
);
progressionUnlocks.equipment_models = progressionUnlocks.equipment_models.filter(
  (row) => !REMOVED_EQUIPMENT_IDS.has(row.id),
);
for (const rows of Object.values(progressionUnlocks)) {
  if (!Array.isArray(rows)) continue;
  for (const row of rows) {
    if (Array.isArray(row.links_existing_ids)) {
      row.links_existing_ids = row.links_existing_ids.filter(
        (id) => !REMOVED_ACTIVITY_IDS.has(id) && !REMOVED_EQUIPMENT_IDS.has(id),
      );
    }
  }
}

// Enrich the overload progression chain with the per-record research from the
// consumables pass (ids, recipe unlock flag, boost effect, provenance).
// Existing canonical values win; a numeric disagreement is drift and throws.
const consumablesPass = read("scraped-data/combat-consumables-pass-1.json");
const overloadChain = progressionUnlocks.consumable_unlocks?.find((row) => row.id === "herblore:overload-chain");
if (overloadChain && Array.isArray(consumablesPass.overload_chain?.records)) {
  for (const researched of consumablesPass.overload_chain.records) {
    if (typeof researched?.id !== "string" || !researched.id) throw new Error("Consumables pass overload record is missing id");
    const record = overloadChain.records.find((entry) => entry.name === researched.name);
    if (!record) throw new Error(`Consumables pass overload record not found in progression unlocks: ${researched.name}`);
    for (const [key, value] of Object.entries(researched)) {
      if (key === "name") continue;
      if (record[key] == null) record[key] = value;
      else if (Object(record[key]) !== record[key] && Object(value) !== value && record[key] !== value) {
        throw new Error(`Overload chain drift on ${researched.id}.${key}: ${JSON.stringify(record[key])} vs ${JSON.stringify(value)}`);
      }
    }
  }
}

write("data/combat/modernisation-2026.json", combat);
write("data/combat/ability-audit-2026-07-24.json", combatAbilityAudit);
write("data/league/catalyst.json", catalyst);
write("data/league/region-dependencies.json", regionDependencies);
write("data/reference/changes-2026.json", changes);
write("data/reference/midgame-rebalance-2026-07-20.json", rebalance);
write("data/reference/progression-unlocks.json", progressionUnlocks);
write("data/reference/prayer-books.json", prayerBooks);
write("data/reference/prayers.json", prayers);
write("data/reference/spellbooks.json", spellbooks);
write("data/research/reference-site-harvest.json", referenceHarvest);
write("data/research/masterwork-staff-chain.json", masterworkStaffChain);
write("data/reference/unknowns.json", unknowns);

console.log(`REFERENCE DATA SYNC
Combat system data, audited ability records, Catalyst, region dependencies, 2026 changes, mid-game rebalance, permanent unlocks, prayer books, prayer effects and region dependencies, spellbooks, ${enrichmentFiles.length} progression enrichment overlay(s), reference research, Masterwork staff chain and unknowns updated.`);
