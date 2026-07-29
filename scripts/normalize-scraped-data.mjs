import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const write = (path, value) => {
  const target = join(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

const index = read("scraped-data/index.json");
const equilibrium = read("scraped-data/equilibrium.json");
const rawRegions = read("scraped-data/regions.json");
const dependencies = read("scraped-data/region-dependencies.json");
const upgrades = read("scraped-data/major-upgrades-by-region.json");
const trainingSeed = read("scraped-data/training-methods.json");
const trainingHigh = read("scraped-data/training-high-value.json");
const trainingAudit = read("scraped-data/training-current-audit.json");
// training-gap-*.json merged only by scripts/sync-training-gaps.mjs (sole post-step; avoids dual-merge notes)
const sourceManifest = read("scraped-data/sources.json");

const verifiedAt = index.snapshot_date;
const manifestById = new Map(sourceManifest.sources.map((source) => [source.id, source]));

const SOURCE_FALLBACKS = {
  smithing_training_wiki: {
    title: "Pay-to-play Smithing training",
    url: "https://runescape.wiki/w/Pay-to-play_Smithing_training",
  },
  necromancy_training_wiki: {
    title: "Necromancy training",
    url: "https://runescape.wiki/w/Necromancy_training",
  },
};

const WIKI_TRAINING_SOURCES = {
  Agility: ["Agility training", "https://runescape.wiki/w/Agility_training"],
  Archaeology: ["Archaeology training", "https://runescape.wiki/w/Archaeology_training"],
  Attack: ["Pay-to-play melee training", "https://runescape.wiki/w/Pay-to-play_melee_training"],
  Constitution: ["Pay-to-play melee training", "https://runescape.wiki/w/Pay-to-play_melee_training"],
  Construction: ["Construction training", "https://runescape.wiki/w/Construction_training"],
  Cooking: ["Pay-to-play Cooking training", "https://runescape.wiki/w/Pay-to-play_Cooking_training"],
  Crafting: ["Pay-to-play Crafting training", "https://runescape.wiki/w/Pay-to-play_Crafting_training"],
  Defence: ["Pay-to-play melee training", "https://runescape.wiki/w/Pay-to-play_melee_training"],
  Divination: ["Divination training", "https://runescape.wiki/w/Divination_training"],
  Dungeoneering: ["Pay-to-play Dungeoneering training", "https://runescape.wiki/w/Pay-to-play_Dungeoneering_training"],
  Farming: ["Farming training", "https://runescape.wiki/w/Farming_training"],
  Firemaking: ["Pay-to-play Firemaking training", "https://runescape.wiki/w/Pay-to-play_Firemaking_training"],
  Fishing: ["Pay-to-play Fishing training", "https://runescape.wiki/w/Pay-to-play_Fishing_training"],
  Fletching: ["Fletching training", "https://runescape.wiki/w/Fletching_training"],
  Herblore: ["Herblore training", "https://runescape.wiki/w/Herblore_training"],
  Hunter: ["Hunter training", "https://runescape.wiki/w/Hunter_training"],
  Invention: ["Invention training", "https://runescape.wiki/w/Invention_training"],
  Magic: ["Pay-to-play Magic training", "https://runescape.wiki/w/Pay-to-play_Magic_training"],
  Mining: ["Pay-to-play Mining training", "https://runescape.wiki/w/Pay-to-play_Mining_training"],
  Necromancy: ["Necromancy training", "https://runescape.wiki/w/Necromancy_training"],
  Prayer: ["Pay-to-play Prayer training", "https://runescape.wiki/w/Pay-to-play_Prayer_training"],
  Ranged: ["Pay-to-play Ranged training", "https://runescape.wiki/w/Pay-to-play_Ranged_training"],
  Runecrafting: ["Pay-to-play Runecrafting training", "https://runescape.wiki/w/Pay-to-play_Runecrafting_training"],
  Slayer: ["Slayer training", "https://runescape.wiki/w/Slayer_training"],
  Smithing: ["Pay-to-play Smithing training", "https://runescape.wiki/w/Pay-to-play_Smithing_training"],
  Strength: ["Pay-to-play melee training", "https://runescape.wiki/w/Pay-to-play_melee_training"],
  Summoning: ["Summoning training", "https://runescape.wiki/w/Summoning_training"],
  Thieving: ["Thieving training", "https://runescape.wiki/w/Thieving_training"],
  Woodcutting: ["Pay-to-play Woodcutting training", "https://runescape.wiki/w/Pay-to-play_Woodcutting_training"],
};

const ACTUAL_SKILLS = new Set(Object.keys(WIKI_TRAINING_SOURCES));

const DROP_HAVENHYTHE_UPGRADE_NAMES = new Set([
  "Kerapac progression",
  "Kerapac hard mode FSoA farm",
  "Kerapac, the bound",
  "Arch-Glacor",
  "Arch-Glacor progression",
  "Croesus",
  "Croesus progression",
  "Croesus Front skilling nodes and skilling-boss access",
  "First Necromancer's equipment",
  "First Necromancer's equipment (Rasial)",
  "Archaeology Campus and Varrock Dig Site hub",
  "Archaeology collectors and collection system",
  "Archaeology Guildmaster qualification permanent rewards",
  "City of Um ritual site and focus storage",
  "Draynor Village skilling hub",
  "Edgeville skilling and Wilderness on-ramp hub",
  "Family Crest cooking and smelting gauntlets",
  "Focus storage",
  "Infinity ethereal outfit",
  "Infinity ethereal and Runespan utility rewards",
  "It Belongs in a Museum! (Velucia meta collection log)",
  "Imcando tools family (pickaxe, hatchet, related craft pressure)",
  "Master thief's lockpick + stethoscope (toolbelt)",
  "Master thief's lockpick + master thief's stethoscope",
  "Master thief's tools",
  "Misthalin Runecrafting altars (Water, Earth) and essence access",
  "Museum donation bin (40% chronote overflow)",
  "Mysterious monolith energy + relic loadout ladder",
  "Necromancy conjure unlocks",
  "Necromantic Rune Temple",
  "Player-owned house portal towns and Construction utilities",
  "Professor additional relic loadout (80k chronotes)",
  "Rasial Necromancy BiS farm",
  "Rasial, the First Necromancer",
  "Sanctum of Rebirth (Nakatra)",
  "Scripture of Bik",
  "Sanctum of Rebirth uniques",
  "TzKal-Zuk",
  "TzKal-Zuk progression",
  "Varrock Museum kudos progression",
  "Velucia museum Archaeology collections",
  "Velucia museum collection chronote tiers (225% set bonus)",
  "War's Blessing 1-4 (Combat Mastery)",
  "War's Blessing combat mastery",
  "War's Blessing 1-4 (Combat Mastery)",
  "Fort Forinthry Botanist's Workbench",
  "Fort Forinthry Command Centre",
  "Fort Forinthry Workshop",
  "Fort Forinthry Guardhouse and Raptor Slayer hub",
  "Fort Forinthry Kitchen",
  "Fort Forinthry Ranger's Workroom",
  "Fort Forinthry Town Hall",
  "Apex Hide Armour",
  "Havenhythe Hunter 110 progression",
  "Havenhythe canoe network",
  "Havenhythe open-water fishing spots (beyond fish farm)",
  "War's Grimoire (Retreat spellbook and prayer-book swap)",
  "Well of Souls talent infrastructure",
  "Wizards' Tower and Runecrafting Guild",
  "Wood box tier upgrades",
  "Tier 3 Woodcutter's Grove and Imcando hatchet fragments",
  "Woodcutters' Grove facility tiers",
  "Ring of Wealth (relic power)",
  "Tetracompass pieces → ancient caskets → complete tomes",
  "Runespan portals at Wizards' Tower",
  "Screening station (Archaeology Campus)",
  "Skull sceptre",
  "Soul Supplies and City of Um skilling shops",
  "Woodcutters' Grove",
  "Prayer training infrastructure stack (altars + powders + books)",
  "Deathdealer robe armour (necro power)",
  "Deathwarden robe armour (necro tank)",
  "Drygore weapons",
  "Enchanted water tiara",
  "Full slayer helmet and point upgrades (reinforced through corrupted)",
  "Powder of burials",
  "Powder of penance",
  "Powder of pulverising",
  "Elite skilling outfits core set (ironman fragment paths)",
  "Jackalope familiar (Archaeology soil BoB)",
  "Jackalope hunting (antler tertiary)",
  "Trader Woes shrine bank chest",
  "Old Meats (Hollow Hill meat shop)",
  "Shrine of Inanna and Spirit Wolves Summoning hub",
  "Modified artisan's bandana",
  "Modified ritualist's mask",
  "Modified shaman's headdress",
  "Modified blacksmith's helmet",
  "Modified botanist's mask",
  "Modified diviner's headwear",
  "Modified sous chef's toque",
  "Modified farmer's hat",
  "Modified first age tiara",
]);

const DROP_HAVENHYTHE_CONTENT_NAMES = new Set(["Marigold Farm patch cluster"]);

const DROP_MISTHALIN_CONTENT_NAMES = new Set(["Infernal Source Dig Site"]);

const DROP_FORINTHRY_CONTENT_NAMES = new Set([
  "Edgeville Dungeon combat",
  "Edgeville resource dungeons",
  "Green dragons",
  "Lesser demons",
]);

const DROP_KARAMJA_CONTENT_NAMES = new Set([
  "Calquat farming patch",
  "Jadinko Favour offering stone",
  "Karamja Volcano resource dungeon",
  "Musa Point banana plantation",
  "Musa Point fishing dock and Stiles",
  "Shilo Village",
  "TzHaar City skilling hub",
]);

const DROP_KARAMJA_UPGRADE_NAMES = new Set([
  "Agility Arena Ticket Exchange (Pirate Jackie)",
  "Brimhaven Agility Arena",
  "Calquat farming patch (Tai Bwo Wannai)",
  "Classic TzHaar obsidian weapons",
  "Deadliest Catch skilling deposit boxes",
  "Fight Cauldron obsidian armour progression",
  "Full slayer helmet and point upgrades (reinforced through corrupted)",
  "Hexcrest",
  "Herblore Habitat",
  "Jadinko Favour offering stone",
  "Jadinko Lair curly roots",
  "Juju farming potion path (Herblore Habitat)",
  "Karamja overgrown idols (Gara-Dul)",
  "Karambwan vessel fishing",
  "Karamja Volcano resource dungeon",
  "Musa Point banana plantation",
  "Musa Point fishing dock and Stiles",
  "Musa Point free teaks",
  "Pirate hook (left)",
  "TokHaar-Kal capes",
  "TzHaar City skilling hub",
  "TzHaar-Hur-Lek Ore and Gem Store (uncut onyx)",
]);

const MANUAL_MAJOR_CONTENT = {
  misthalin: [{
    name: "Pure essence chest",
    kind: "Runecrafting",
    detail: "Archmage Sedridor's Rune chest supplies up to 24,750 pure essence in total: 5 × each Runecrafting level gained through level 99",
    confidence: "confirmed_wiki",
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Rune_chest",
      title: "Pure essence chest",
      verifiedAt: "2026-07-28",
    },
  }],
  forinthry: [
    {
      name: "Dragon harpoon",
      kind: "Fishing tool",
      detail: "Wilderness Fishing tool with a 9% catch-rate boost at harpoon fishing spots",
      confidence: "confirmed_wiki_2026",
      source: {
        source: "runescape-wiki",
        url: "https://runescape.wiki/w/Dragon_harpoon",
        title: "Dragon harpoon",
        verifiedAt: "2026-07-28",
      },
    },
    {
      name: "Magic axe hut chest",
      kind: "Thieving",
      detail: "Deep Wilderness chest with muddy keys and rune hatchets.",
      confidence: "confirmed_wiki",
      source: {
        source: "runescape-wiki",
        url: "https://runescape.wiki/w/Chest_(magic_axe_hut)",
        title: "Chest (magic axe hut)",
        verifiedAt: "2026-07-29",
      },
    },
    {
      name: "Bandit Camp shops",
      kind: "Shops",
      detail:
        "Skulled-only Wilderness camp with Bandit Duty Free and Tony's Pizza Bases.",
      confidence: "confirmed_wiki",
      source: {
        source: "runescape-wiki",
        url: "https://runescape.wiki/w/Bandit_Duty_Free",
        title: "Bandit Duty Free",
        verifiedAt: "2026-07-29",
      },
    },
    {
      name: "Infernal Puzzle Box",
      kind: "Combat unlock",
      detail:
        "Upgradeable box with Wilderness and Infernus effects, adrenaline retention, bloodwood bonuses, and tier-6 tool-belt storage.",
      confidence: "confirmed_wiki",
      source: {
        source: "runescape-wiki",
        url: "https://runescape.wiki/w/Infernal_Puzzle_Box",
        title: "Infernal Puzzle Box",
        verifiedAt: "2026-07-29",
      },
    },
  ],
  anachronia: [{
    name: "Effigy Incubator",
    kind: "Distraction and Diversion",
    detail: "Monthly Anachronia activity that gathers materials and casings, creates effigies, and awards skill XP lamps or stars after they are filled",
    confidence: "confirmed_wiki",
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Effigy_Incubator",
      title: "Effigy Incubator",
      verifiedAt: "2026-07-28",
    },
  }],
  havenhythe: [{
    name: "Old Meats",
    kind: "Food and farm-supply shop",
    detail: "PoF food and raw meat source: permanent raw rabbit, beef, bird, rat, bear and chicken stock, plus cooked meat supplies",
    confidence: "confirmed_wiki",
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Old_Meats",
      title: "Old Meats",
      verifiedAt: "2026-07-28",
    },
  }, {
    name: "Jackalope familiar",
    kind: "Archaeology / Havenhythe",
    detail: "Archaeology soil storage and bonus material supply from the Jackalope familiar",
    confidence: "confirmed_wiki",
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Jackalope",
      title: "Jackalope familiar",
      verifiedAt: "2026-07-28",
    },
  }, {
    name: "Allotment patches",
    kind: "Farming / Marigold Farm",
    detail: "Two allotment patches at Marigold Farm",
    confidence: "confirmed_wiki",
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Allotment_patch",
      title: "Allotment patch",
      verifiedAt: "2026-07-28",
    },
  }, {
    name: "Herb patch",
    kind: "Farming / Marigold Farm",
    detail: "One herb patch at Marigold Farm",
    confidence: "confirmed_wiki",
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Herb_patch",
      title: "Herb patch",
      verifiedAt: "2026-07-28",
    },
  }, {
    name: "Flower patch",
    kind: "Farming / Marigold Farm",
    detail: "One flower patch at Marigold Farm",
    confidence: "confirmed_wiki",
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Flower_patch",
      title: "Flower patch",
      verifiedAt: "2026-07-28",
    },
  }],
  karamja: [{
    name: "Fruit tree patch",
    kind: "Farming / Herblore Habitat",
    detail: "Fruit tree patch at Herblore Habitat",
    confidence: "confirmed_wiki",
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Herblore_Habitat",
      title: "Herblore Habitat",
      verifiedAt: "2026-07-28",
    },
  }, {
    name: "Karamja overgrown idols",
    kind: "Woodcutting / Karamja",
    detail: "Woodcutting method at overgrown idols with a temporary Woodcutting buff",
    confidence: "confirmed_wiki",
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Overgrown_idol",
      title: "Overgrown idol",
      verifiedAt: "2026-07-28",
    },
  }, {
    name: "Obsidian armour",
    kind: "Combat / Fight Cauldron",
    detail: "Obsidian armour crafted from Fight Cauldron shards, with damage reduction against TzHaar, TokHaar and TzekHaar encounters",
    confidence: "confirmed_wiki",
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Obsidian_equipment",
      title: "Obsidian equipment",
      verifiedAt: "2026-07-28",
    },
  }],
};

const HIGHWEALD_ROCKS_NAME = "Necrite rocks, Phasmatite rocks, Platinum rocks and Havensilver rock";
const HIGHWEALD_ROCKS_SOURCE = "https://runescape.wiki/w/Highweald_Ruins_mine";
const HIGHWEALD_ROCKS_DETAIL = "Unlocks: Necrite rocks, Phasmatite rocks, Platinum rocks and Havensilver rock · Hearts of Sanguine opens the Highweald Ruins mine · 104 Mining (boostable) and the Oh Yeah! achievement open the platinum rocks behind the primeval slabs";

const ENTITY_SOURCE_OVERRIDES = {
  "Varrock Dig Site / early Archaeology": ["Varrock Dig Site", "https://runescape.wiki/w/Varrock_Dig_Site"],
  "Pale wisps near Draynor": ["Pale wisp", "https://runescape.wiki/w/Pale_wisp"],
  "Havenhythe Big Game Hunter": ["2026 Hunter update", "https://runescape.wiki/w/Hunter_update"],
  "Apex Hide Armour": ["Apex hide armour", "https://runescape.wiki/w/Apex_hide_armour"],
  "Masterwork Ranged Armour materials": ["Masterwork ranged armour", "https://runescape.wiki/w/Masterwork_ranged_armour"],
  "Fish farming / Giant Crayfish": ["Giant crayfish", "https://runescape.wiki/w/Giant_crayfish"],
  "Artisans' Workshop burial smithing": ["Artisans' Workshop", "https://runescape.wiki/w/Artisans%27_Workshop"],
  "Safecracking route": ["Safecracking", "https://runescape.wiki/w/Safecracking"],
  "Lunar spellbook and Lunar utility": ["Lunar spellbook", "https://runescape.wiki/w/Lunar_spellbook"],
  "Sophanem Slayer Dungeon / The Magister": ["Sophanem Slayer Dungeon", "https://runescape.wiki/w/Sophanem_Slayer_Dungeon"],
  "Araxxor / Araxxi": ["Araxxor", "https://runescape.wiki/w/Araxxor"],
  "Crystal equipment and Prifddinas skilling content": ["Prifddinas", "https://runescape.wiki/w/Prifddinas"],
  "Herby Werby / Ranch Out of Time": ["Ranch Out of Time", "https://runescape.wiki/w/Ranch_Out_of_Time"],
  "God Wars Dungeon 1 equipment": ["God Wars Dungeon", "https://runescape.wiki/w/God_Wars_Dungeon"],
  "Nex equipment": ["Nex", "https://runescape.wiki/w/Nex"],
  "Ancient Invention": ["Ancient Invention", "https://runescape.wiki/w/Ancient_Invention"],
  "Lunar spellbook": ["Lunar spellbook", "https://runescape.wiki/w/Lunar_spellbook"],
  "Dagannoth Kings uniques": ["Dagannoth Kings", "https://runescape.wiki/w/Dagannoth_Kings"],
  "Daemonheim / Dungeoneering": ["Daemonheim", "https://runescape.wiki/w/Daemonheim"],
  "Primal ore / high-level Mining": ["Primal ore", "https://runescape.wiki/w/Primal_ore"],
  "Abyss access": ["Abyss", "https://runescape.wiki/w/Abyss"],
  "God Wars Dungeon 2 weapon and anima-core progression": ["Heart of Gielinor", "https://runescape.wiki/w/Heart_of_Gielinor"],
  "Telos weapon progression": ["Telos, the Warden", "https://runescape.wiki/w/Telos,_the_Warden"],
  "Powder of burials": ["Powder of burials", "https://runescape.wiki/w/Powder_of_burials"],
  "Vyres / Sunspear multi-skill training": ["Vyrewatch", "https://runescape.wiki/w/Vyrewatch"],
  "Crystal mattock": ["Crystal mattock", "https://runescape.wiki/w/Crystal_mattock"],
  "Solak / Lost Grove rewards": ["Solak", "https://runescape.wiki/w/Solak"],
  "Dragon mattock": ["Dragon mattock", "https://runescape.wiki/w/Dragon_mattock"],
  "Terrasaur maul components": ["Terrasaur maul", "https://runescape.wiki/w/Terrasaur_maul"],
  "Raksha ability upgrades": ["Raksha", "https://runescape.wiki/w/Raksha"],
  "Raksha boot upgrades": ["Raksha", "https://runescape.wiki/w/Raksha"],
  "Anachronia Agility codex-page progression": ["Anachronia Agility Course", "https://runescape.wiki/w/Anachronia_Agility_Course"],
};

function sourceKind(url) {
  if (!url) return "derived";
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host === "runescape.wiki" || host.endsWith(".runescape.wiki")) return "runescape-wiki";
  if (host === "pvme.io" || host.endsWith(".pvme.io")) return "pvme";
  if (host === "rs-analysis.xyz" || host.endsWith(".rs-analysis.xyz")) return "rs-analysis";
  if (host === "secure.runescape.com" || host.endsWith(".runescape.com")) return "jagex";
  return "derived";
}

function sourceReference(source, fallbackTitle) {
  if (!source?.url) return null;
  return {
    source: sourceKind(source.url),
    url: source.url,
    title: source.title || fallbackTitle || undefined,
    publishedAt: source.published || source.publishedAt || undefined,
    verifiedAt,
  };
}

function sourceFromId(id, fallbackTitle) {
  const source = manifestById.get(id) || SOURCE_FALLBACKS[id];
  return sourceReference(source, fallbackTitle);
}

function sourceFromUrl(url, title) {
  return typeof url === "string" && url.startsWith("http")
    ? sourceReference({ url, title }, title)
    : null;
}

function wikiTrainingSource(skill) {
  const source = WIKI_TRAINING_SOURCES[skill];
  return source ? sourceFromUrl(source[1], source[0]) : null;
}

function canonicalSource({ directUrl, directTitle, sourceIds = [], fallbackId, fallbackTitle }) {
  const direct = sourceFromUrl(directUrl, directTitle || fallbackTitle);
  if (direct && (direct.source === "pvme" || direct.source === "rs-analysis")) return direct;
  if (direct?.source === "runescape-wiki") return direct;
  if (direct?.source === "jagex") return direct;

  const candidates = sourceIds.map((id) => sourceFromId(id, fallbackTitle)).filter(Boolean);
  const wiki = candidates.find((source) => source.source === "runescape-wiki");
  if (wiki) return wiki;

  const fallback = fallbackId ? sourceFromId(fallbackId, fallbackTitle) : null;
  if (fallback?.source === "runescape-wiki") return fallback;

  if (direct) return direct;
  if (fallback) return fallback;
  return candidates[0] || null;
}

function text(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(compact).filter(Boolean).join(", ");
  return Object.entries(value)
    .map(([key, entry]) => `${key.replaceAll("_", " ")}: ${compact(entry)}`)
    .join(" · ");
}

function first(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return compact(value);
  }
  return "";
}

function regionHints(record) {
  const result = new Set();
  for (const key of ["region", "method_region", "resource_region", "required_unlock_region"]) {
    const value = text(record[key]);
    if (value) result.add(value);
  }
  for (const key of ["resource_region_options", "regions", "region_options", "region_hints", "required_regions"]) {
    for (const value of list(record[key])) {
      if (typeof value === "string" || typeof value === "number") {
        if (text(value)) result.add(text(value));
        continue;
      }
      if (value && typeof value === "object") {
        const nested = text(value.region || value.method_region || value.id || value.name);
        if (nested) result.add(nested);
      }
    }
  }
  // Gather-style rows often nest sites as { region, location }
  for (const site of list(record.sites || record.locations || record.routes)) {
    if (site && typeof site === "object" && text(site.region)) result.add(text(site.region));
  }
  return [...result];
}

// Gap coerce/expand lives in scripts/lib/training-gaps.mjs — consumed by sync-training-gaps only.

function wikiEntitySource(name) {
  const override = ENTITY_SOURCE_OVERRIDES[name];
  if (override) return sourceFromUrl(override[1], override[0]);

  if (/\s\/\s|\b(progression|route|access|materials|content|rewards|upgrades|uniques)\b/i.test(name)) {
    return null;
  }

  const clean = name.replace(/\s*\(.*/, "").trim();
  if (!clean) return null;
  return sourceFromUrl(`https://runescape.wiki/w/${encodeURIComponent(clean.replaceAll(" ", "_"))}`, clean);
}

function trainingSource(record) {
  const candidates = [
    record.source,
    ...list(record.source_urls || record.sources).map((entry) =>
      typeof entry === "string" ? entry : entry?.url,
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const direct = sourceFromUrl(candidate, record.method);
    if (direct && (direct.source === "pvme" || direct.source === "rs-analysis")) return direct;
    if (direct?.source === "runescape-wiki") return direct;
    if (direct?.source === "jagex") return direct;
    if (direct) return direct;
  }

  const wiki = wikiTrainingSource(record.skill);
  if (wiki) return wiki;
  return null;
}

function normalizeTraining(record) {
  const skill = text(record.skill, "Unknown");
  const method = text(record.method, "Unnamed method");
  const source = trainingSource(record);
  const notes = [record.notes, record.note, record.league_note, record.resource_note, record.importance]
    .map((value) => text(value))
    .filter(Boolean);

  return {
    id: `${skill.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}:${method.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
    skill,
    method,
    levelRange: first(record, ["level_range", "level", "unlock_level"]),
    xpRate: first(record, [
      "base_xp_per_hour",
      "base_xp_per_hour_by_unlock",
      "example_base_xp_per_hour",
      "xp_rate",
      "legacy_base_xp_per_hour",
      "throughput",
      "xp_event",
    ]),
    intensity: text(record.intensity),
    location: text(record.location),
    requirements: list(record.requirements).map(String),
    requiredUnlock: text(record.required_unlock),
    resourceSource: text(record.resource_source),
    hardRegionRequirement: Boolean(record.hard_region_requirement),
    regionHints: regionHints(record),
    note: notes.join(" · "),
    warning: text(record.warning || record.region_warning),
    freshness: first(record, ["freshness", "status"]),
    confidence: text(record.confidence, "unclassified"),
    source,
  };
}

function trainingKey(method) {
  return `${method.skill.toLowerCase()}|${method.method.toLowerCase()}`;
}

const training = new Map();
for (const rows of [trainingSeed.methods, trainingHigh.methods, trainingAudit.methods]) {
  for (const raw of rows || []) {
    const method = normalizeTraining(raw);
    if (!method.source?.url) continue;
    training.set(trainingKey(method), method);
  }
}
// Gaps: run `npm run sync:training-gaps` (or normalize:data pipeline post-step). Do not merge here.
const allTraining = [...training.values()].sort((a, b) =>
  a.skill === b.skill ? a.method.localeCompare(b.method) : a.skill.localeCompare(b.skill),
);

function hintMatchesRegion(hint, regionId) {
  const normalized = hint.toLowerCase();
  if (normalized === regionId) return true;
  if (normalized.startsWith(`${regionId}_`)) return true;
  if (normalized.includes(`${regionId}_plus_`)) return true;
  if (normalized.includes(`_${regionId}_`)) return true;
  if (regionId === "forinthry") return normalized.includes("wilderness") || normalized.includes("wildy");
  if (regionId === "asgarnia") return normalized.includes("troll country") || normalized.includes("trollheim");
  return false;
}

const dependencyRows = [
  ...list(dependencies.boundary_overrides),
  ...list(dependencies.dependencies),
];

function leagueRegionSource(region) {
  return sourceFromId("equilibrium_official_2026_07_23", region.display_name || region.id);
}

function regionWikiFallback(region) {
  const sourceIds = list(region.source_ids);
  const source = canonicalSource({ sourceIds, fallbackTitle: region.display_name || region.id });
  return source?.source === "runescape-wiki" ? source : null;
}

function contentSource(region, raw, name, kind) {
  const direct = sourceFromUrl(raw?.source_url || raw?.source, name);
  if (direct && (direct.source === "pvme" || direct.source === "rs-analysis")) return direct;
  if (direct?.source === "runescape-wiki") return direct;
  if (direct?.source === "jagex") return direct;

  const skillWiki = wikiTrainingSource(kind);
  if (skillWiki) return skillWiki;

  return wikiEntitySource(name) || regionWikiFallback(region) || direct || leagueRegionSource(region);
}

function normalizeContent(region, raw, fallbackKind) {
  if (typeof raw === "string") {
    return {
      name: raw,
      kind: fallbackKind,
      detail: "",
      confidence: "unclassified",
      source: contentSource(region, null, raw, fallbackKind),
    };
  }

  const rawName = text(raw.name, "Unnamed content");
  const isHighwealdRocks = /^(?:Highweald Ruins mine \(necrite \/ phasmatite \/ platinum \/ havensilver\)|Necrite rocks, Phasmatite rocks, Platinum rocks and Havensilver rock)$/i.test(rawName);
  const isWendlewickFishFarm = /^Wendlewick fish farm(?: \(Havenhythe\))?$/i.test(rawName);
  const name = isHighwealdRocks ? HIGHWEALD_ROCKS_NAME : rawName;
  const kind = isHighwealdRocks ? "Mining / Highweald Forest" : first(raw, ["skill", "type", "group"]) || fallbackKind;
  const detail = [
    first(raw, ["note", "notes", "level_range", "base_game_requirements"]),
    raw.unlock_level ? `Level ${raw.unlock_level}` : "",
    raw.slayer_level ? `Slayer ${raw.slayer_level}` : "",
    raw.tier ? `Tier ${raw.tier}` : "",
    text(raw.style),
    raw.xp_rates ? compact(raw.xp_rates) : "",
    compact(raw.upgrade_examples),
    text(raw.status),
  ].filter(Boolean).join(" · ");

  return {
    name,
    kind,
    detail: isHighwealdRocks
      ? HIGHWEALD_ROCKS_DETAIL
      : isWendlewickFishFarm
        ? `High XP/h Active Fishing method · ${detail}`
        : detail,
    confidence: text(raw.confidence, "unclassified"),
    source: isHighwealdRocks
      ? sourceFromUrl(HIGHWEALD_ROCKS_SOURCE, HIGHWEALD_ROCKS_NAME)
      : contentSource(region, raw, name, kind),
  };
}

function upgradeSource(regionId, raw, name) {
  const direct = sourceFromUrl(raw.source_url || raw.source, name);
  if (direct && (direct.source === "pvme" || direct.source === "rs-analysis")) return direct;
  if (direct?.source === "runescape-wiki") return direct;
  if (direct?.source === "jagex") return direct;
  return wikiEntitySource(name) || direct || leagueRegionSource({ id: regionId });
}

function normalizeUpgrade(regionId, raw) {
  const name = text(raw.name, "Unnamed upgrade");
  const detail = [
    text(raw.notes),
    text(raw.league_relevance),
    text(raw.league_warning),
    text(raw["2026_change"]),
    compact(raw["2026_changes"]),
    raw.level ? `Level ${raw.level}` : "",
    raw.tier ? `Tier ${raw.tier}` : "",
    raw.location ? `Location: ${compact(raw.location)}` : "",
    raw.locations ? `Locations: ${compact(raw.locations)}` : "",
    raw.location_group ? `Location: ${compact(raw.location_group)}` : "",
    raw.unlocks ? `Unlocks: ${compact(raw.unlocks)}` : "",
    raw.examples ? compact(raw.examples) : "",
    raw.drop_rate ? `Drop rate: ${compact(raw.drop_rate)}` : "",
    raw.base_drop_rate ? `Base drop rate: ${compact(raw.base_drop_rate)}` : "",
    raw.source && !String(raw.source).startsWith("http") ? `Source: ${text(raw.source)}` : "",
  ].filter(Boolean).join(" · ");

  const requirements = [
    ...list(raw.requirements).map(String),
    ...list(raw.base_game_requirements).map(String),
    text(raw.base_game_requirement),
  ].filter(Boolean);

  return {
    name,
    category: text(raw.category, "upgrade"),
    detail,
    requirements: [...new Set(requirements)],
    confidence: text(raw.confidence, "unclassified"),
    source: upgradeSource(regionId, raw, name),
    regionId,
  };
}

/** Existing catalog areas — never shrink place lists to thin scraped stubs. */
let existingCatalogAreas = new Map();
try {
  const existing = read("data/research/catalog.json");
  for (const region of list(existing.regions)) {
    if (region?.id) existingCatalogAreas.set(region.id, list(region.areas).map(String).filter(Boolean));
  }
} catch {
  existingCatalogAreas = new Map();
}

/** Drop non-place stubs that used to wipe Anachronia etc. */
const AREA_STUBS = new Set(["dinosaurs", "hunting", "farming", "skilling", "combat"]);

function mergeRegionAreas(regionId, scrapedAreas) {
  const scraped = [...new Set(scrapedAreas.map(String).filter((a) => a && !AREA_STUBS.has(a.toLowerCase())))];
  const preserved = (existingCatalogAreas.get(regionId) || []).filter(
    (a) => a && !AREA_STUBS.has(String(a).toLowerCase()),
  );
  // Prefer the larger, place-first set. If both non-empty, union (preserve expansions).
  if (!preserved.length) return scraped;
  if (!scraped.length) return preserved;
  return [...new Set([...preserved, ...scraped])];
}

const normalizedRegions = rawRegions.regions.map((region) => {
  const regionId = region.id;
  const methods = allTraining.filter((method) => method.regionHints.some((hint) => hintMatchesRegion(hint, regionId)));
  const content = [
    ...list(region.notable_content).map((row) => normalizeContent(region, row, "content")),
    ...list(region.bosses_and_combat).map((row) => normalizeContent(region, row, "combat")),
    ...list(region.skilling).map((row) => normalizeContent(region, row, "skilling")),
    ...list(region.power_upgrades).map((row) => normalizeContent(region, row, "upgrade")),
  ].filter((row) => {
    if (regionId === "havenhythe") return !DROP_HAVENHYTHE_CONTENT_NAMES.has(row.name);
    if (regionId === "misthalin") return !DROP_MISTHALIN_CONTENT_NAMES.has(row.name);
    if (regionId === "forinthry") return !DROP_FORINTHRY_CONTENT_NAMES.has(row.name);
    if (regionId === "karamja") return !DROP_KARAMJA_CONTENT_NAMES.has(row.name);
    return true;
  });
  for (const row of MANUAL_MAJOR_CONTENT[regionId] ?? []) {
    if (!content.some((existing) => existing.name === row.name)) content.push(row);
  }
  const regionUpgrades = list(upgrades.regions?.[regionId])
    .map((row) => normalizeUpgrade(regionId, row))
    .filter((row) => {
      if (DROP_HAVENHYTHE_UPGRADE_NAMES.has(row.name)) return false;
      return regionId !== "karamja" || !DROP_KARAMJA_UPGRADE_NAMES.has(row.name);
    });
  const hardRules = dependencyRows
    .filter((row) => row.required_region === regionId)
    .map((row) => row.planner_rule)
    .filter(Boolean);
  const warnings = [
    ...list(region.open_questions),
    region.legacy_warning,
    region.boundary_rule,
  ].filter(Boolean);
  const skills = [...new Set([
    ...methods.filter((method) => ACTUAL_SKILLS.has(method.skill)).map((method) => method.skill),
    ...content.map((row) => row.kind).filter((kind) => ACTUAL_SKILLS.has(kind)),
  ])].sort();

  const scrapedAreas = [...list(region.major_areas), ...list(region.official_examples)];

  return {
    id: regionId,
    name: region.display_name || regionId.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    availability: region.availability,
    aliases: list(region.aliases),
    areas: mergeRegionAreas(regionId, scrapedAreas),
    skills,
    content,
    upgrades: regionUpgrades,
    // Only link methods that also appear under skill pages (ACTUAL_SKILLS filter).
    trainingMethodIds: methods.filter((method) => ACTUAL_SKILLS.has(method.skill)).map((method) => method.id),
    hardRules,
    warnings,
    source: leagueRegionSource(region),
    verified: false,
  };
});

const karamja = normalizedRegions.find((region) => region.id === "karamja");
if (karamja) {
  const calquat = karamja.content.find((row) => /Calquat tree patch/i.test(row.name));
  if (calquat) {
    calquat.name = "Calquat tree patch";
    calquat.kind = "Farming / Tai Bwo Wannai";
    calquat.detail = "The only calquat patch, north of Tai Bwo Wannai";
    calquat.source = {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Calquat_patch",
      title: "Calquat patch",
      verifiedAt,
    };
  }

  const habitat = karamja.content.find((row) => row.name === "Herblore Habitat");
  if (habitat) {
    habitat.detail = "Southern Karamja hub for Juju potions, Jadinko patches, vine herbs and Papa Mambo's shop";
  }

  const jadinko = karamja.content.find((row) => /Jadinko Lair curly roots/i.test(row.name));
  if (jadinko) {
    jadinko.name = "Jadinko Lair";
    jadinko.kind = "Woodcutting / Jadinko Lair";
    jadinko.detail = "Curly roots for Woodcutting and Firemaking; Jadinko Favour shop for seeds, fruits and outfits";
    jadinko.source = {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Curly_root",
      title: "Curly root",
      verifiedAt,
    };
  }

  const arena = karamja.content.find((row) => row.name === "Brimhaven Agility Arena");
  if (arena) arena.detail = "Brimhaven Agility minigame and ticket exchange for Agility lamps, herbs and rewards";

  const obsidian = karamja.content.find((row) => /Fight Cauldron obsidian armour/i.test(row.name));
  if (obsidian) {
    obsidian.name = "Obsidian armour";
    obsidian.kind = "Combat / Fight Cauldron";
    obsidian.detail = "Obsidian armour crafted from Fight Cauldron shards, with damage reduction against TzHaar, TokHaar and TzekHaar encounters";
    obsidian.source = {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Obsidian_equipment",
      title: "Obsidian equipment",
      verifiedAt,
    };
  }

  const harAken = karamja.upgrades.find((row) => row.name === "Har-Aken (Fight Kiln)");
  if (harAken) harAken.detail = `${harAken.detail} · Unlocks: TokHaar-Kal combat capes from Fight Kiln`;
}

const kandarin = normalizedRegions.find((region) => region.id === "kandarin");
if (kandarin && !kandarin.upgrades.some((row) => row.name === "Hexcrest")) {
  kandarin.upgrades.push({
    name: "Hexcrest",
    category: "Slayer helmet Magic component",
    detail: "Jungle strykewyrm drop used with the focus sight for the full Slayer helmet",
    requirements: ["73 Slayer to fight jungle strykewyrms", "20 Magic and 20 Defence to wear"],
    confidence: "confirmed_wiki",
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Hexcrest",
      title: "Hexcrest",
      verifiedAt,
    },
    regionId: "kandarin",
  });
}

const skillMap = new Map();
for (const method of allTraining) {
  if (!ACTUAL_SKILLS.has(method.skill)) continue;
  const existing = skillMap.get(method.skill) || [];
  existing.push(method);
  skillMap.set(method.skill, existing);
}
const normalizedSkills = [...skillMap.entries()]
  .map(([name, methods]) => ({
    id: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
    name,
    regions: normalizedRegions
      .filter((region) => methods.some((method) => method.regionHints.some((hint) => hintMatchesRegion(hint, region.id))))
      .map((region) => region.name),
    methods,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const leagueSource = sourceFromId("equilibrium_official_2026_07_23", "Leagues II: EQUILIBRIUM");
const relicTiers = Array.from({ length: equilibrium.relics.tiers }, (_, index) => {
  const tier = index + 1;
  const choices = tier === 1
    ? equilibrium.relics.tier_1.map((choice) => ({
        name: choice.name,
        effects: choice.effects,
        source: leagueSource,
        verified: false,
      }))
    : [];
  return {
    tier,
    revealed: tier === 1,
    choices,
    source: leagueSource,
    verified: false,
  };
});

const blessingTiers = Array.from({ length: equilibrium.blessings.tiers }, (_, index) => ({
  tier: index + 1,
  revealed: false,
  paths: equilibrium.blessings.paths,
  godTier: equilibrium.blessings.god_tiers.includes(index + 1),
  choices: [],
  source: leagueSource,
  verified: false,
}));

const leagueRegionRecords = normalizedRegions.map((region) => ({
  id: region.id,
  name: region.name,
  availability: region.availability,
  aliases: region.aliases,
  areas: region.areas,
  hardRules: region.hardRules,
  warnings: region.warnings,
  source: region.source,
  verified: region.verified,
}));

write("data/league/regions.json", {
  lastSynced: verifiedAt,
  verified: leagueRegionRecords.every((record) => record.verified),
  records: leagueRegionRecords,
});

write("data/league/relics.json", {
  lastSynced: verifiedAt,
  verified: relicTiers.every((record) => record.verified),
  records: relicTiers,
});

write("data/league/blessings.json", {
  lastSynced: verifiedAt,
  verified: blessingTiers.every((record) => record.verified),
  records: blessingTiers,
  paths: equilibrium.blessings.paths,
  godTiers: equilibrium.blessings.god_tiers,
  resetCount: equilibrium.blessings.resets.total,
});

write("data/league/tasks.json", {
  lastSynced: verifiedAt,
  verified: false,
  records: [],
  tiers: equilibrium.progression.task_point_values,
  tierConfidence: equilibrium.progression.task_point_value_confidence || {},
  pointValueNote: equilibrium.progression.task_point_value_note || "Jagex has confirmed the Easy-to-Master range and 10-to-400 point bounds; any unconfirmed intermediate values stay provisional.",
  note: "The full Equilibrium task list has not been published yet.",
  testFallback: {
    enabled: true,
    league: "Catalyst League",
    testingOnly: true,
    url: "https://runescape.wiki/w/Catalyst_League/Tasks",
    completionSource: "https://runescape.wiki/w/Module:Catalyst_League/Tasks/completion.json",
    expectedRecords: 1117,
    note: "Catalyst League tasks are temporarily shown on /tasks only to test the task browser. They are not Equilibrium tasks and must be replaced when the Equilibrium task list is published.",
  },
  source: leagueSource,
});

write("data/research/catalog.json", {
  snapshotDate: verifiedAt,
  sourcePolicy: {
    defaultGroundTruth: "runescape-wiki",
    explicitSourceGroundTruth: ["pvme", "rs-analysis"],
    provisionalFallback: "jagex",
    note: "Use the RuneScape Wiki as canonical game-data ground truth unless a row was specifically sourced from PvME or RS Analysis; then keep and link that source for that row. Jagex reveal data remains provisional until the Wiki confirms it.",
  },
  coverage: index.coverage,
  hardRules: index.hard_rules,
  datasets: {
    regions: normalizedRegions.length,
    relicTiers: relicTiers.length,
    revealedRelicTiers: relicTiers.filter((tier) => tier.revealed).length,
    blessingTiers: blessingTiers.length,
    revealedBlessingTiers: blessingTiers.filter((tier) => tier.revealed).length,
    publishedTasks: 0,
    skills: normalizedSkills.length,
    trainingMethods: allTraining.filter((method) => ACTUAL_SKILLS.has(method.skill)).length,
  },
  regions: normalizedRegions,
  skills: normalizedSkills,
});

write("data/research/sources.json", {
  lastSynced: verifiedAt,
  policy: {
    defaultGroundTruth: "runescape-wiki",
    explicitSourceGroundTruth: ["pvme", "rs-analysis"],
    provisionalFallback: "jagex",
  },
  records: sourceManifest.sources.map((source) => sourceReference(source)).filter(Boolean),
});

console.log(
  `DATA NORMALIZE\nRegions: ${normalizedRegions.length}   Relic tiers: ${relicTiers.length}   Blessing tiers: ${blessingTiers.length}   Skills: ${normalizedSkills.length}   Training methods: ${allTraining.filter((method) => ACTUAL_SKILLS.has(method.skill)).length}   Gap merge: deferred to sync-training-gaps`,
);
