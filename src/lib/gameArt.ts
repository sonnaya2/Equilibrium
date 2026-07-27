/**
 * Conventional paths to web-served game art. Art lands in public/game/<category>/
 * via scripts/publish-assets.mjs from the attributed assets/ manifest — never hotlink
 * the wiki, never invent substitute art.
 */
import {
  ACTIVITY_ICON_BY_SLUG,
  BOSS_ICON_EXT,
  BOSS_ICON_SLUGS,
  SKILL_ICON_SLUGS,
  UPGRADE_ICON_BY_SLUG,
} from "./dataIconIndex";
import equipmentIconSlugs from "../../data/combat/equipment-icon-slugs.json";

/** Slugs with a verified local equipment inventory icon (no 404 wells). */
const EQUIPMENT_OK = new Set(equipmentIconSlugs as string[]);

export function gameIconPath(category: string, name: string): string {
  return `/game/${category}/${name}.png`;
}

export const STYLE_ICON = {
  melee: "melee-abilities",
  ranged: "ranged-abilities",
  magic: "magic-abilities",
  necromancy: "necromancy-abilities",
} as const;

export const styleIconPath = (style: keyof typeof STYLE_ICON) => gameIconPath("combat", STYLE_ICON[style]);

export const regionCrestPath = (regionId: string) => gameIconPath("regions", regionId);

/** Wiki World Map icon — global / multi-region task crest (CC BY-NC-SA 3.0). */
export const worldMapIconPath = () => "/game/leagues/world-map-icon.png";

/**
 * Local equipment inventory icons (synced from the wiki, never hotlinked).
 * Path: public/game/combat/equipment/<id-without-item-prefix>.png
 * Only returns a path when the slug is in equipment-icon-slugs.json (ok:true).
 * Built by scripts/sync-equipment-icons.mjs → equipment-icons.json + equipment-icon-slugs.json.
 */
export function equipmentIconPath(equipmentId: string): string | null {
  const slug = equipmentId.replace(/^(?:item|equipment):/, "");
  if (!EQUIPMENT_OK.has(slug)) return null;
  return `/game/combat/equipment/${slug}.png`;
}

/**
 * Local ability icons (synced from the wiki, never hotlinked).
 * Path: public/game/combat/abilities/<style>/<id-with-underscores-as-hyphens>.png
 * Built by scripts/sync-ability-icons.mjs → data/combat/ability-icons.json.
 */
export function abilityIconPath(
  abilityId: string,
  style: keyof typeof STYLE_ICON | string,
): string {
  const slug = abilityId.replace(/_/g, "-").toLowerCase();
  const folder = style in STYLE_ICON ? style : "melee";
  return `/game/combat/abilities/${folder}/${slug}.png`;
}

/**
 * Player-facing ability category chip.
 * Post-CSM engine uses `enhanced`; UI still labels it threshold (player term).
 */
export function abilityCategoryLabel(
  category: "basic" | "enhanced" | "ultimate" | "utility" | string,
): string {
  if (category === "enhanced") return "threshold";
  return category;
}

// ---------------------------------------------------------------------------
// Data route resolvers — return null when unknown (prefer no icon over wrong).
// ---------------------------------------------------------------------------

/** Explicit name / label → published slug. Wrong icon is worse than none. */
const DATA_ICON_ALIASES: Record<string, string> = {
  "abyss": "abyss",
  "abyss access": "abyss",
  "abyss entrance": "abyss",
  "abyss runecrafting stack": "abyss",
  "abyssal link (the subtle blade)": "abyssal-link",
  "abyssal scourge": "abyssal-scourge",
  "abyssal wand and abyssal orb": "abyssal-wand",
  "advanced gnome stronghold course": "advanced-gnome-stronghold-course",
  "advanced gold accumulator": "advanced-gold-accumulator",
  "advanced smithing autoheater": "advanced-smithing-autoheater",
  "agile legs": "agile-legs",
  "agile top": "agile-top",
  "agility arena ticket exchange (pirate jackie)": "agility-arena-ticket-exchange",
  "agility pyramid (jaleustrophos)": "agility-pyramid",
  "alchemiser / mk. ii (invention guild machine)": "alchemiser",
  "all fired up beacons (ring of fire / flame gloves)": "ring-of-fire",
  "altar of inanna": "altar-of-inanna",
  "altar of zaros (senntisten temple prayer switch)": "altar-of-zaros",
  "always adze (seed of the charyou tree)": "always-adze",
  "ambassador (ed3)": "ambassador",
  "amlodd voice of seren summoning efficiency": "voice-of-seren",
  "amulet of glory": "amulet-of-glory",
  "amulet of zealots": "amulet-of-zealots",
  "anachronia agility codex pages (double surge / double escape)": "double-surge",
  "anachronia agility course": "anachronia-agility-course",
  "anachronia base camp": "anachronia-base-camp",
  "anachronia base-camp spa pools": "anachronia-base",
  "anachronia big game hunter": "big-game-hunter",
  "anachronia codex lectern (double surge/escape)": "double-surge",
  "anachronia dinosaur farm farmers' market (beans)": "farmers-market",
  "anachronia has no area tasks diary reward": "anachronia",
  "anachronia overgrown idols (woodcutting)": "overgrown-idol",
  "anachronia totems (permanent multi-skill buffs)": "anachronia-totem",
  "ancient components discovery (classic / historic / vintage / timeworn)": "historic-components",
  "ancient curses (the temple at senntisten)": "ancient-curses",
  "ancient enhanced tools (enhanced hammer-tron / pyro-matic / rod-o-matic)": "enhanced-hammer-tron",
  "ancient invention": "ancient-invention",
  "ancient weapon / armour / tool gizmo shells": "weapon-gizmo-shell",
  "anima core armour (gwd2 t80 power)": "anima-core-body-of-zaros",
  "antipoison totem": "antipoison-totem",
  "apex hide armour": "apex-hide-body",
  "araxxi": "araxxi",
  "araxxor": "araxxor",
  "arc journal (permanent arc travel tracker)": "arc-journal",
  "arch glacor": "arch-glacor",
  "arch-glacor": "arch-glacor",
  "armadyl equipment": "armadyl-chestplate",
  "armadyl equipment (gwd1 ranged power ladder)": "armadyl-chestplate",
  "archaeologist's outfit": "archaeologists",
  "archaeologist's tea": "archaeologists-tea",
  "archaeologist's tea (guild shop excavation xp boost)": "archaeologists-tea",
  "archaeologist's workbench": "archaeologists-workbench",
  "archaeologist's workbench damaged-artefact storage ladder": "archaeologists-workbench",
  "archaeology campus and varrock dig site hub": "varrock-dig-site",
  "archaeology collector rewards": "archaeology",
  "archaeology collectors and collection system": "archaeology",
  "archaeology culture expert titles": "archaeology",
  "archaeology guild": "archaeology-guild",
  "archaeology guild qualifications intern → professor": "archaeology-guild",
  "archaeology guild shop and qualification upgrades": "archaeology-guild-shop",
  "archaeology guildmaster qualification permanent rewards": "archaeology",
  "archaeology research system": "archaeology-research",
  "archaeology research team permanent (guildmaster)": "archaeology-research",
  "ardougne cloak (ourania rune output)": "ardougne-cloak-4",
  "ardougne cloak 1-4": "ardougne-cloak-4",
  "ardougne cloak 1–4": "ardougne-cloak-4",
  "area tasks (achievement diaries) skilling overview": "area-tasks",
  "armoured hide barricade perk": "armoured-hide",
  "artificer's measure component region map": "artificers-measure",
  "artisan's outfit": "artisans",
  "artisan's workshop": "artisans-workshop",
  "artisans' workshop": "artisans-workshop",
  "artisans' workshop burial equipment hub": "artisans-workshop",
  "artisans' workshop burial smithing": "artisans-workshop",
  "artisans' workshop full permanent reward stack": "artisans-workshop",
  "artisans' workshop reward shop": "artisans-workshop-reward-shop",
  "ascension crossbows": "ascension-crossbow",
  "asgarnia runecrafting altars (mind, body, law)": "mind-altar",
  "asgarnia safecracking circuit": "safecracking",
  "astral altar (lunar isle)": "astral-altar",
  "augmentable gather tools research (pickaxe / hatchet / mattock)": "dragon-pickaxe",
  "auto disassembler / mk. ii (invention guild machine)": "auto-disassembler",
  "auto-sanctifier (dwarven tech prayer device)": "auto-sanctifier",
  "auto-screener v1.080": "auto-screener-v1080",
  "automatic / optimised hide tanner (invention guild)": "optimised-hide-tanner",
  "ava's device chain (attractor / accumulator / alerter)": "avas-alerter",
  "azure skillchompas (rellekka hunter area)": "azure-skillchompas",
  "bait and switch (evil bob's catspaw)": "bait-and-switch",
  "bait and switch + always adze dual monolith skilling paths": "bait-and-switch",
  "bake pie (lunar)": "bake-pie",
  "base juju potion family (herblore habitat)": "juju-farming",
  "barbarian outpost agility course": "barbarian-outpost-agility-course",
  "barrows": "barrows",
  "barrows: rise of the six": "barrows-rise-of-the-six",
  "bandos equipment": "bandos-chestplate",
  "bandos equipment (gwd1 melee power ladder)": "bandos-chestplate",
  "beastmaster durzag": "beastmaster-durzag",
  "big game hunter": "big-game-hunter",
  "big game hunter permanent unlock package": "big-game-hunter",
  "binding contract (ancient summoning) craft + bind loop": "binding-contract",
  "bird house": "bird-house",
  "bird houses": "bird-house",
  "birdhouses": "bird-house",
  "black chinchompas": "black-chinchompa",
  "black ibis outfit": "black-ibis-outfit",
  "black mask": "black-mask",
  "black salamanders (boneyard hunter)": "black-salamanders",
  "black stone dragon": "black-stone-dragon",
  "blacksmith's outfit": "blacksmiths-outfit",
  "blast diffusion / enhanced blast diffusion boots": "blast-diffusion-boots",
  "blast furnace (keldagrim)": "blast-furnace",
  "blessing of het relic (eye of het ii)": "eye-of-het",
  "blightbound crossbows": "blightbound-crossbow",
  "bonecrusher": "bonecrusher",
  "bonecrusher + demon horn necklace prayer stack": "bonecrusher",
  "bonecrusher auto-pickup upgrade (waiko / boni)": "bonecrusher",
  "botanist's amulet": "botanists-amulet",
  "botanist's outfit": "botanists-outfit",
  "botanist's workbench": "botanists-workbench",
  "bow of the last guardian": "bow-of-the-last-guardian",
  "bow of the last guardian (bolg)": "bow-of-the-last-guardian",
  "brimhaven agility arena": "brimhaven-agility-arena",
  "calquat farming patch (tai bwo wannai)": "calquat-tree",
  "calquat tree patch (tai bwo wannai)": "calquat-tree-patch",
  "camdozaal sacred forge (ramarno)": "sacred-forge",
  "canifis-mort'ton trapdoor shortcut": "canifis",
  "canifis–mort'ton trapdoor shortcut": "canifis",
  "certificates of qualification (poh display permanents)": "certificates-of-qualification",
  "champion's tackle box": "champions-tackle-box",
  "channeler's ring": "channelers-ring",
  "channeller's ring": "channelers-ring",
  "classic tzhaar obsidian weapons": "tzhaar",
  "chaos elemental": "chaos-elemental",
  "chaotic equipment": "chaotic-rapier",
  "chaotic grimoire": "chaotic-grimoire",
  "chaotic melee and ranged weapons": "chaotic-rapier",
  "charming imp": "charming-imp",
  "charming moths": "charming-moths",
  "charming potion": "charming-potion",
  "chronicle attraction (seren skilling prayer)": "chronicle-attraction",
  "chronotes currency economy (earn + spend sinks)": "chronotes",
  "city of senntisten": "city-of-senntisten",
  "city of um": "city-of-um",
  "city of um / underworld": "city-of-um",
  "city of um mushroom patch": "um-mushroom-patch",
  "city of um ritual site and focus storage": "um-ritual-site",
  "city of um soul forge (ensoul production hub)": "um-soul-forge",
  "clockwork box traps": "box-trap",
  "crystal mattock": "crystal-mattock",
  "hireable research team recruitment ladder": "archaeology-research",
  "columbarium ring": "columbarium-ring",
  "commander zilyana": "commander-zilyana",
  "construction contracts (estate agents)": "construction-contracts",
  "constructor's outfit": "constructors-outfit",
  "corporeal beast": "corporeal-beast",
  "corporeal beast holy-elixir supply": "holy-elixir",
  "corrupted / full multi-style slayer helmet (all components)": "corrupted-slayer-helmet",
  "crafteneering (not tzhaar)": "crafteneering",
  "crafting guild": "crafting-guild",
  "creeping ivy": "creeping-ivy",
  "cremation ability unlock": "sunspear-melee",
  "crimson skillchompas (desert quarry hunter site)": "crimson-skillchompas",
  "cryptbloom armour": "cryptbloom-top",
  "crystal equipment and prifddinas skilling content": "prifddinas",
  "crystal hammer": "crystal-hammer",
  "crystal mask (seren skilling spell)": "crystal-mask",
  "crystal mask + light form thieving stack": "crystal-mask",
  "crystal sandstone": "crystal-sandstone",
  "crystal skillchompas (isafdar catch + pof produce)": "crystal-skillchompas",
  "crystal tinderbox": "crystal-tinderbox",
  "crystal tool siphon blueprint (waiko permanent)": "crystal-tool-siphon-blueprint",
  "crystal tools (dragon base + prifddinas conversion)": "crystal-pickaxe",
  "crystal utility tools (chisel, knife, saw, binding rod)": "crystal-chisel",
  "crystallise (seren skilling spell)": "crystallise",
  "curly roots firemaking ceiling stack (jadinko + all fired up gear)": "curly-root",
  "custom-fit trimmed masterwork (elof / master crafter)": "trimmed-masterwork-platebody",
  "daemonheim": "daemonheim",
  "daemonheim area tasks passive rewards": "daemonheim",
  "daemonheim dig site": "daemonheim-dig-site",
  "daemonheim dig site (dragonkin mini-site)": "daemonheim-dig-site",
  "daemonheim dungeoneering floors": "daemonheim",
  "dagannoth kings": "dagannoth-kings",
  "dark facet of grace (gote enchantment)": "dark-facet-of-grace",
  "dark facet of luck (tier-4 luck account permanent)": "dark-facet-of-luck",
  "dark facet of passage (passage of the abyss infinite charges)": "dark-facet-of-passage",
  "dark ice -> dark shard/sliver of leng": "dark-shard-of-leng",
  "dark ice → dark shard/sliver of leng": "dark-shard-of-leng",
  "death altar (temple of light runecrafting)": "death-altar",
  "death note relic power": "death-note",
  "deathdealer robe armour (necro power)": "deathdealer-robe-top",
  "deathdealer robe armour (necro power residual)": "deathdealer-robe-top",
  "deathless (koschei's death egg)": "deathless",
  "deathwarden / deathdealer armour": "deathdealer-robe-top",
  "deathwarden / deathdealer armour residual": "deathdealer-robe-top",
  "deathwarden robe armour": "deathwarden-robe-top",
  "deathwarden robe armour (necro tank)": "deathwarden-robe-top",
  "deathwarden robe armour (necro tank residual)": "deathwarden-robe-top",
  "decorated and exquisite urn craft (morytania)": "decorated-fishing-urn",
  "decorated and exquisite urn craft infrastructure": "exquisite-fishing-urn",
  "deep sea fishing": "deep-sea-fishing",
  "deep sea fishing hub": "deep-sea-fishing",
  "deep sea fishing hub methods": "deep-sea-fishing",
  "deep sea fishing hub methods and boosts": "deep-sea-fishing",
  "dig site pendant": "dig-site-pendant",
  "demon, dragon and undead slayer ability codices": "demon-slayer",
  "demonic skull (removed)": "demonic-skull",
  "deployable herb burner": "deployable-herb-burner",
  "desert amulet 1-4": "desert-amulet-4",
  "desert amulet 1–4": "desert-amulet-4",
  "desert cactus farming patches": "cactus",
  "desert treasure": "desert-treasure",
  "dive": "dive",
  "divine conversion (cres framework)": "divine-conversion",
  "divine rage prayer codex": "divine-rage-prayer-codex",
  "divine-o-matic vacuum": "divine-o-matic-vacuum",
  "diviner's outfit": "diviners-headwear",
  "dominion tower": "dominion-tower",
  "dracolich armour (t90 ranged bow power)": "dracolich-hauberk",
  "dragon claws": "superior-dragon-claws",
  "dragon claws residual": "superior-dragon-claws",
  "dragon mattock": "dragon-mattock",
  "dragon mattock (ancient caskets — general)": "dragon-mattock",
  "dragon mattock (big game hunter / ancient casket)": "dragon-mattock",
  "dragonkin laboratory": "dragonkin-laboratory",
  "draynor village skilling hub": "draynor-village",
  "dreadnip": "dreadnip",
  "dreadnips": "dreadnip",
  "dream mentor": "dream-mentor",
  "dream of iaia": "dream-of-iaia",
  "drygore weapon set": "drygore-mace",
  "drygore weapons": "drygore-weapons",
  "dundee's crocodile upgrades": "dundees-crocodile-upgrades",
  "dwarven army axe": "dwarven-army-axe",
  "eastfold farm (sheep and spinning)": "eastfold-farm",
  "eclipsed soul prayer codex": "eclipsed-soul-prayer-codex",
  "ectofuntus": "ectofuntus",
  "ectofuntus pool of slime (slime pit)": "ectofuntus",
  "ectofuntus prayer worship": "ectofuntus",
  "ectoplasmator (base)": "ectoplasmator",
  "edgeville skilling and wilderness on-ramp hub": "edgeville",
  "ek-zekkil": "ek-zekkil",
  "ek-zekkil (zuk 2h melee)": "ek-zekkil",
  "elder divination outfit": "elder-divination-headwear",
  "elder overload salve recipe (meilyr)": "elder-overload-salve-recipe",
  "elemental workshop": "elemental-workshop",
  "elite dracolich armour (t92 ranged bow power)": "elite-dracolich-hauberk",
  "elite fremennik combat rewards": "fremennik-sea-boots-4",
  "elite sirenic armour (t92 ranged power)": "elite-sirenic-hauberk",
  "elite tectonic robe armour": "tectonic-robe-top",
  "emberkeen / hailfire / flarefrost boots (t90 glacor upgrades)": "emberkeen-boots",
  "enchanted lyre": "enchanted-lyre",
  "enchanted notepaper blueprint (ironman note craft)": "enchanted-notepaper-blueprint",
  "enchanted water tiara": "enchanted-water-tiara",
  "endurance (oo'glog wellspring)": "endurance",
  "enhanced excalibur": "enhanced-excalibur",
  "enhanced fishing rod-o-matic": "enhanced-fishing-rod-o-matic",
  "enhanced nightmare gauntlets": "enhanced-nightmare-gauntlets",
  "enhanced nightmare gauntlets (t90 ranged)": "enhanced-nightmare-gauntlets",
  "enhanced yaktwee stick": "enhanced-yaktwee-stick",
  "entrana law altar and island skilling access": "law-altar",
  "equipment dissolver (permanent invention blueprint)": "equipment-dissolver",
  "equipment separator (recover gizmos intact)": "equipment-separator",
  "essence of finality": "essence-of-finality",
  "essence of finality amulet": "essence-of-finality",
  "essence of finality amulet (neck bis chain)": "essence-of-finality",
  "everlight archaeology": "everlight-dig-site",
  "everlight dig site": "everlight-dig-site",
  "everlight dig-site infrastructure": "everlight-dig-site",
  "explorer's ring 1-4": "explorers-ring-4",
  "explorer's ring 1–4": "explorers-ring-4",
  "explorer's ring 4": "explorers-ring-4",
  "extinction": "extinction",
  "extreme prayer potion": "extreme-prayer-potion",
  "fight cauldron obsidian armour": "obsidian-platebody",
  "fight cauldron obsidian armour progression": "obsidian-platebody",
  "factory outfit (flash powder factory)": "factory-outfit",
  "fairy ring network (zanaris hub)": "zanaris",
  "falador shield 1-4": "falador-shield-4",
  "falador shield 1–4": "falador-shield-4",
  "fang of mohegan": "fang-of-mohegan",
  "farmer's market": "farmers-market",
  "farmer's outfit": "farmers-hat",
  "farmers market": "farmers-market",
  "feather of ma'at (shifting tombs supply)": "feather-of-maat",
  "fight kiln": "fight-kiln",
  "fire cape": "fire-cape",
  "first necromancer equipment": "first-necromancer-robe-top",
  "first necromancer's equipment": "first-necromancer-robe-top",
  "first necromancer's equipment (rasial)": "first-necromancer-robe-top",
  "fish farming": "player-owned-farm",
  "fish flingers (isla anglerine d&d)": "fish-flingers",
  "fishing guild": "fishing-guild",
  "fishing guild membership and dsf access": "fishing-guild",
  "fishing outfit (fish flingers)": "fishing-outfit",
  "fishing rod-o-matic": "fishing-rod-o-matic",
  "fishing trawler (port khazard)": "fishing-trawler",
  "five-finger discount passive": "five-finger-discount",
  "flame gloves": "flame-gloves",
  "flash powder factory": "flash-powder-factory",
  "fletcher's outfit": "fletchers-outfit",
  "focus sight": "focus-sight",
  "focus storage": "focus-storage",
  "focused siphoning passive": "focused-siphoning",
  "font of life relic (archaeology tutorial)": "font-of-life",
  "fort command centre global operations tier ladder densify": "fort-forinthry-command-centre",
  "fort forinthry": "fort-forinthry",
  "fort forinthry chapel": "fort-forinthry-chapel",
  "fort forinthry command centre": "fort-forinthry-command-centre",
  "fort forinthry construction and slayer hub": "fort-forinthry",
  "fort forinthry eternal reinforcement (105 construction training)": "fort-forinthry",
  "fort forinthry guardhouse and raptor slayer hub": "fort-forinthry",
  "fort forinthry kitchen": "fort-forinthry-kitchen",
  "fort forinthry ranger's workroom": "fort-forinthry",
  "fort forinthry rangers workroom": "fort-forinthry",
  "fort forinthry town hall": "fort-forinthry-town-hall",
  "fort forinthry town hall rested experience": "fort-forinthry-town-hall",
  "fort forinthry workshop": "fort-forinthry-workshop",
  "fort kitchen": "fort-kitchen",
  "fort kitchen tier 1 never-fail web slash (account permanent)": "fort-kitchen",
  "fort kitchen tier 3 soup creation station": "fort-kitchen",
  "fort refined plank / timber frame materials ladder": "fort-forinthry-workshop",
  "fort town hall rested xp conversion densify (aster)": "aster",
  "fort workshop invention remote management and power capacity": "fort-forinthry",
  "fractured staff of armadyl": "fractured-staff-of-armadyl",
  "fremennik sea boots": "fremennik-sea-boots",
  "fremennik sea boots 1-4": "fremennik-sea-boots-4",
  "fruit tree patch hubs (kandarin core)": "fruit-tree-seed",
  "fury of the small": "fury-of-the-small",
  "fury shark outfit (elite fishing)": "fury-shark-outfit",
  "garden of kharid": "garden-of-kharid",
  "gate of elidinis": "gate-of-elidinis",
  "gemstone armour (t80 hybrid enchanted touch)": "gemstone-hauberk",
  "gemstone cavern (shilo underground)": "gemstone-cavern",
  "gemstone golem outfit": "gemstone-golem-outfit",
  "general graardor": "general-graardor",
  "ghast familiar (temple trekking)": "ghast-familiar",
  "ghostly essence (attuned ectoplasmator supply)": "ghostly-essence",
  "ghostly sole": "ghostly-sole",
  "ghostly sole fishing": "ghostly-sole",
  "giant crayfish fishing": "raw-giant-crayfish",
  "giant crayfish fishing and cooking": "raw-giant-crayfish",
  "giant mole": "giant-mole",
  "giant oyster monthly d&d": "giant-oyster",
  "gleaming wisp colony": "gleaming-wisp-colony",
  "gnome restaurant": "gnome-restaurant",
  "gnome stronghold agility course (basic + advanced)": "gnome-stronghold-agility-course",
  "god wars dungeon": "god-wars-dungeon",
  "god wars dungeon 1": "god-wars-dungeon",
  "god wars dungeon 1 (+ nex)": "god-wars-dungeon",
  "god wars dungeon 2 (heart of gielinor)": "heart-of-gielinor",
  "godswords (gwd1 hilt + shard assembly)": "godswords",
  "gold accumulator": "gold-accumulator",
  "greenfingers passive": "greenfingers",
  "guthix staff": "guthix-staff",
  "guildmaster tony": "guildmaster-tony",
  "guildmaster tony's mattock": "guildmaster-tonys-mattock",
  "hall of memories": "hall-of-memories",
  "hall of memories divination training": "hall-of-memories",
  "hammer-tron": "hammer-tron",
  "h.a.m. hideout": "ham-hideout",
  "h.a.m hideout": "ham-hideout",
  "ham hideout": "ham-hideout",
  "ham-hideout": "ham-hideout",
  "har-aken": "har-aken",
  "hard desert keris upgrade": "keris",
  "hard morytania barrows rewards": "barrows",
  "harmony pillars (meilyr harmony moss)": "harmony-pillars",
  "hatchet of bloom and blight": "hatchet-of-bloom-and-blight",
  "hatchet of ember and glade": "hatchet-of-ember-and-glade",
  "havenhythe big game hunter": "big-game-hunter",
  "havenhythe birdhouses": "bird-house",
  "havenhythe canoe network": "canoe-station-havenhythe",
  "havenhythe empowered summoning obelisks (spirit plane connection)": "summoning-obelisk",
  "havenhythe has no area tasks diary reward": "havenhythe-has",
  "havenhythe hunter 110 progression": "hunter-cape",
  "havenhythe open-water fishing spots (beyond fish farm)": "raw-sailfish",
  "heart of gielinor": "heart-of-gielinor",
  "hefin agility course": "hefin-agility-course",
  "hefin serenity posts (afk agility)": "hefin-agility-course",
  "herb protector (invention farming device)": "herb-protector",
  "herbicide": "herbicide",
  "herblore habitat": "herblore-habitat",
  "hermod": "hermod",
  "hermod, the spirit of war": "hermod",
  "het's oasis": "hets-oasis",
  "het's oasis agility course": "hets-oasis-agility-course",
  "hets oasis": "hets-oasis",
  "hexcrest": "hexcrest",
  "highweald ruins mine (necrite / phasmatite / platinum / havensilver)": "highweald-ruins-mine",
  "hoardstalker ring": "hoardstalker-ring",
  "holy elixir supply": "holy-elixir",
  "holy overload potion": "holy-overload-potion",
  "holy scarab familiar": "holy-scarab-familiar",
  "humidify (lunar)": "humidify",
  "hunter mark shop (irwinsson)": "hunter-mark-shop",
  "hunter's outfit": "hunters-outfit",
  "imcando hatchet": "imcando-hatchet",
  "imcando mattock": "imcando-mattock",
  "imcando pickaxe": "imcando-pickaxe",
  "imcando tools family (pickaxe, hatchet, related craft pressure)": "imcando-pickaxe",
  "igneous cape progression": "igneous-kal-zuk",
  "infernal puzzle box": "infernal-puzzle-box",
  "infernal puzzle box combat progression": "infernal-puzzle-box",
  "infernal source dig site (zamorakian)": "infernal-source-dig-site",
  "inferno adze": "inferno-adze",
  "infinity ethereal and runespan utility rewards": "infinity-ethereal-head",
  "infinity ethereal outfit": "infinity-ethereal-outfit",
  "inspire awe (helm of terror)": "inspire-awe",
  "inspire effort (petasos)": "inspire-effort",
  "inspire genius (howl's thinking cap)": "inspire-genius",
  "inspire love (ariadne's diadem)": "inspire-love",
  "invention guild": "invention-guild",
  "invention machines (invention guild + fort workshop power)": "invention-machines",
  "iorwerth slayer and utility district": "iorwerth-clan",
  "it belongs in a museum! (velucia meta collection log)": "velucia-museum",
  "ithell harmonium harps (harmonic dust)": "harmonium",
  "ivar, king of bones": "ivar",
  "jackalope familiar (archaeology soil bob)": "jackalope-familiar",
  "jackalope hunting (antler tertiary)": "jackalope",
  "jatizso dungeon mine": "jatizso-dungeon-mine",
  "juju and perfect juju potions": "juju-farming",
  "juju farming potion": "juju-farming",
  "k'ril tsutsaroth": "kril-tsutsaroth",
  "kalphite king": "kalphite-king",
  "kalphite queen": "kalphite-queen",
  "karamja gloves 1-4": "karamja-gloves-4",
  "karamja gloves skilling perks": "karamja-gloves-4",
  "karamja overgrown idols (gara-dul)": "overgrown-idol",
  "keldagrim brewery (laughing miner pub)": "laughing-miner-pub",
  "keldagrim dwarven traders and multi-step chests": "keldagrim",
  "kerapac the bound": "kerapac",
  "kerapac, the bound": "kerapac",
  "kezalam, the wanderer": "kezalam",
  "kharid-et dig site": "kharid-et-dig-site",
  "kharid-et dig-site progression": "kharid-et-dig-site",
  "king black dragon": "king-black-dragon",
  "kree'arra": "kreearra",
  "kreearra": "kreearra",
  "kril tsutsaroth": "kril-tsutsaroth",
  "kuradal (ancient cavern slayer master)": "kuradal",
  "kwuarm incense sticks": "kwuarm-incense-sticks",
  "lava flow mine": "lava-flow-mine",
  "learn broad arrow / bolt fletching (300 slayer points)": "full-slayer-helmet",
  "learn quicker killing blows (400 slayer points)": "full-slayer-helmet",
  "liberation of mazcab (beastmaster durzag / yakamaru)": "liberation-of-mazcab",
  "livid farm": "livid-farm",
  "living rock caverns": "living-rock-caverns",
  "lorehound": "lorehound",
  "lorehound pet": "lorehound",
  "lorehound (pet)": "lorehound",
  "lost grove": "lost-grove",
  "luck of the dwarves": "luck-of-the-dwarves",
  "luck of the dwarves (ring + archaeology relic power)": "luck-of-the-dwarves",
  "lumberjack outfit": "lumberjack-outfit",
  "lumberjack replacement hatchet bonuses": "dragon-hatchet",
  "lumbridge early skilling hub": "lumbridge",
  "lunar diplomacy": "lunar-diplomacy",
  "lunar farming utility spells": "lunar-spellbook",
  "lunar isle": "lunar-isle",
  "lunar spellbook and lunar utility": "lunar-spellbook",
  "mage arena": "mage-arena",
  "mage training arena (bones to peaches + reward shop)": "mage-training-arena",
  "magic golem outfit": "magic-golem-outfit",
  "magic imbue (lunar)": "magic-imbue",
  "magic stones (poh construction)": "magic-stones",
  "magical thread (abyss rc + wilderness diary rates)": "magical-thread",
  "make leather (lunar)": "make-leather",
  "malevolent armour (t90 melee power craft)": "malevolent-cuirass",
  "malevolent armour and malevolent energy": "malevolent-cuirass",
  "managing miscellania": "managing-miscellania",
  "mandrith (wilderness slayer master)": "mandrith",
  "marble blocks (poh construction)": "marble-blocks",
  "master archaeologist's outfit": "master-archaeologist",
  "master archaeologist's outfit (guildmaster shop claim)": "master-archaeologist",
  "master runecrafter robes": "master-runecrafter",
  "master thief's lockpick + stethoscope (toolbelt)": "master-thiefs-lockpick",
  "masterwork ranged armour (anachronia + wildy + kandarin)": "masterwork-ranged-body",
  "masterwork ranged armour material pressure (havenhythe/anachronia hunter)": "masterwork-ranged",
  "material manuals (guild shop archaeology boost)": "material-manual",
  "mattock of time and space": "mattock-of-time-and-space",
  "mattock precision upgrade": "mattock-precision",
  "mattock precision upgrades": "mattock-precision",
  "mattock precision upgrades (guild shop permanent)": "mattock-precision",
  "mattock progression checklist (dragon → crystal / imcando → motas → tony)": "dragon-mattock",
  "mattock tier ladder (bronze through elder rune + specials)": "dragon-mattock",
  "max guild": "max-guild",
  "mechanised siphon (auto equipment/crystal tool siphon)": "mechanised-siphon",
  "memorial to guthix": "memorial-to-guthix",
  "memory dowser": "memory-dowser",
  "menaphos": "menaphos",
  "menaphos city quests (reputation engine)": "menaphos-city-quests",
  "menaphos mineral deposits (worker + vip sandstone)": "sandstone",
  "mining guild": "mining-guild",
  "misthalin runecrafting altars (water, earth) and essence access": "water-altar",
  "modified blacksmith's helmet": "modified-blacksmiths-helmet",
  "modified botanist's mask": "modified-botanists-mask",
  "modified diviner's headwear": "modified-diviners-headwear",
  "modified farmer's hat": "modified-farmers-hat",
  "modified first age tiara": "modified-first-age-tiara",
  "modified ritualist's mask": "modified-ritualists-mask",
  "modified shaman's headdress": "modified-shamans-headdress",
  "modified sous chef's toque": "modified-sous-chefs-toque",
  "monastery of ascension": "monastery-of-ascension",
  "moonrise archaeology activity": "moonrise-dig-site",
  "moonrise dig site": "moonrise-dig-site",
  "moonrise dig-site hub (collections & mysteries)": "moonrise-dig-site",
  "morvran (prifddinas slayer master)": "morvran",
  "morytania legs 1-4": "morytania-legs-4",
  "morytania legs 2": "morytania-legs-2",
  "morytania legs 3": "morytania-legs-3",
  "motherlode maw": "motherlode-maw",
  "musa point banana plantation": "musa-point-banana-plantation",
  "musa point free teaks": "musa-point",
  "museum donation bin": "museum-donation-bin",
  "museum donation bin (40% chronote overflow)": "museum-donation-bin",
  "mysterious monolith": "mysterious-monolith",
  "mysterious monolith energy + relic loadout ladder": "mysterious-monolith",
  "mysterious monolith relic power hub": "mysterious-monolith",
  "nakatra, devourer eternal": "nakatra",
  "nardah elidinis statuette": "desert-amulet-4",
  "nature altar": "nature-altar",
  "necklace of salamancy": "necklace-of-salamancy",
  "necromancy conjure unlocks": "conjure-undead-army",
  "necromantic rune temple": "necromantic-rune-temple",
  "nex aod": "nex-aod",
  "nex equipment": "nex",
  "nex t80 power armour (torva / pernix / virtus)": "torva-platebody",
  "nex t80 power armour residual (torva / pernix / virtus)": "torva-platebody",
  "nex tier-80 armour sets": "nex",
  "nex: angel of death": "nex-aod",
  "nex: angel of death (ed3)": "nex-aod",
  "nex: angel of death progression": "nex-aod",
  "nexus mod (abyssal gatestone)": "nexus-mod",
  "nimble outfit (the pit agility xp set)": "nimble-outfit",
  "no fear meteor strike perk": "no-fear",
  "noxious scythe and noxious longbow": "noxious-scythe",
  "noxious weapons": "noxious-weapons",
  "npc contact (lunar)": "npc-contact",
  "old meats (hollow hill meat shop)": "old-meats",
  "one piercing note": "one-piercing-note",
  "orthen dig site": "orthen-dig-site",
  "orthen dig site full mastery (monolith + recipes)": "orthen-dig-site",
  "orthen dig-site collections and mysteries": "orthen-dig-site",
  "orthen teleportation device network": "orthen-dig-site",
  "ourania runecrafting altar (zmi)": "ourania-runecrafting-altar",
  "ouroboros pouch": "ouroboros-pouch",
  "pale wisps near draynor": "pale-energy",
  "papa mambo's shop (herblore habitat)": "papa-mambos-shop",
  "passage of the abyss (compacted jewellery pocket)": "passage-of-the-abyss",
  "penance": "penance",
  "penguin agility course (iceberg)": "penguin-agility-course",
  "perfect juju potion production path": "perfect-juju",
  "perfect plus potion recipe (daemonheim)": "perfect-plus-potion-recipe",
  "pernix armour": "pernix-body",
  "pest control": "pest-control",
  "pharm ecology (queen mab's moonstone)": "pharm-ecology",
  "pickaxe of earth and song": "pickaxe-of-earth-and-song",
  "pickaxe of life and death": "pickaxe-of-life-and-death",
  "pikkupstix summoning shop and large obelisk (taverley)": "taverley",
  "piscatoris fishing colony": "piscatoris-fishing-colony",
  "piscatoris hunter area": "piscatoris-hunter-area",
  "piscatoris monkfish colony (swan song unlock)": "raw-monkfish",
  "plank make (lunar)": "plank-make",
  "player owned farm": "player-owned-farm",
  "player-owned farm": "player-owned-farm",
  "player-owned farm combat perk state": "player-owned-farm",
  "pof farm totems + tier-2 dual-pen animal perks": "player-owned-farm",
  "poh gilded altar (chapel offering)": "gilded-altar",
  "pontifex observation ring": "pontifex-observation-ring",
  "pouch protector (threads of fate)": "pouch-protector",
  "powder of penance": "powder-of-penance",
  "powder of pulverising": "powder-of-pulverising",
  "player-owned house portal towns and construction utilities": "house-portal",
  "player owned house portal towns and construction utilities": "house-portal",
  "poh portal towns": "house-portal",
  "poh portal towns and construction utilities": "house-portal",
  "prayer training infrastructure stack (altars + powders + books)": "gilded-altar",
  "prayer-book switch network (zaros / fort / elven / war)": "god-books",
  "prifddinas": "prifddinas",
  "prifddinas city access": "prifddinas",
  "prifddinas spirit tree + glouron three-tree unlock": "prifddinas-spirit-tree",
  "prifddinas waterfall fishing": "waterfall-fishing",
  "primal ore / high-level mining": "primal-ore",
  "primal ores (daemonheim peninsula mining)": "primal-ores",
  "professor additional relic loadout (80k chronotes)": "chronotes",
  "puro-puro impetuous impulses (dragon implings)": "dragon-implings",
  "pyramid plunder": "pyramid-plunder",
  "pyro-matic": "pyro-matic",
  "queen black dragon": "queen-black-dragon",

  "quick traps (bgh permanent trap speed)": "quick-traps",
  "raksha ability upgrades": "raksha",
  "raksha boot upgrades": "raksha",
  "ranch out of time": "ranch-out-of-time",
  "ranging guild": "ranging-guild",
  "rasial, the first necromancer": "rasial",
  "reaper crew": "reaper-crew",
  "red sandstone": "red-sandstone",
  "refined anima core armour (gwd2)": "refined-anima-core-body-of-zaros",
  "repair rune pouch (livid farm lunar)": "repair-rune-pouch",
  "research team size ladder (assistant → guildmaster)": "archaeology-research",
  "rex matriarchs": "rex-matriarchs",
  "ring of fire": "ring-of-fire",
  "ring of fortune": "ring-of-fortune",
  "ring of fortune (relic power)": "ring-of-fortune",
  "ring of imbuing": "ring-of-imbuing",
  "ring of kayazu": "ring-of-kayazu",
  "ring of kinship": "ring-of-kinship",
  "ring of slaying (craft unlock)": "ring-of-slaying",
  "ring of vigour": "ring-of-vigour",
  "ring of vigour and passive conversion": "ring-of-vigour",
  "ring of vitur": "ring-of-vitur",
  "ring of wealth": "ring-of-wealth",
  "ring of wealth (relic power)": "ring-of-wealth",
  "ring of whispers": "ring-of-whispers",
  "ripper claws": "ripper-claws",
  "rise of the six": "rise-of-the-six",
  "ritualist's outfit": "ritualists",
  "robes of subjugation (gwd1 magic power ladder)": "subjugation-robe-top",
  "roar of osseous (rex skeleton island buff)": "roar-of-osseous",
  "rogue equipment (flash powder factory rubble)": "rogue-equipment",
  "runespan": "runespan",
  "runespan portals at wizards' tower": "runespan",
  "runic attuner": "runic-attuner",
  "safecracking route": "safecracking",
  "salve amulet (base)": "salve-amulet",
  "sanctum of rebirth": "sanctum-of-rebirth",
  "sanctum of rebirth uniques": "sanctum-of-rebirth",
  "sceptre of the gods": "sceptre-of-the-gods",
  "screening station": "screening-station",
  "screening station (archaeology campus)": "screening-station",
  "scrimshaw of sacrifice (+ superior pop upgrade)": "scrimshaw-of-sacrifice",
  "scripture of amascut": "scripture-of-amascut",
  "scripture of bik": "scripture-of-bik",
  "scripture of elidinis": "scripture-of-elidinis",
  "scripture of ful": "scripture-of-ful",
  "scripture of jas": "scripture-of-jas",
  "scripture of wen": "scripture-of-wen",
  "scroll of cleansing": "scroll-of-cleansing",
  "scroll of dexterity": "scroll-of-dexterity",
  "scroll of efficiency": "scroll-of-efficiency",
  "scroll of gathering": "scroll-of-gathering",
  "scroll of life": "scroll-of-life",
  "scroll of proficiency": "scroll-of-proficiency",
  "scroll of quick teleportation (daemonheim permanent)": "scroll-of-quick-teleportation",
  "scroll of renewal": "scroll-of-renewal",
  "scroll of restoration": "scroll-of-restoration",
  "sealed large rune pouch (combat rune storage)": "sealed-large-rune-pouch",
  "sealed small rune pouch (combat rune storage)": "sealed-small-rune-pouch",
  "seedicide": "seedicide",
  "seedicide collector upgrade": "seedicide-collector-upgrade",
  "seer's headband 1-4": "seers-headband-1",
  "seismic wand and singularity": "seismic-wand",
  "selene necromancy prayer and curse unlocks (city of um)": "well-of-souls",
  "soul supplies and city of um skilling shops": "soul-supplies",
  "senntisten dig site": "senntisten-dig-site",
  "shadow glaives": "shadow-glaives",
  "shadow reef": "shadow-reef",
  "shaman's outfit": "shamans-outfit",
  "shard of the lumberjack": "shard-of-the-lumberjack",
  "shattered worlds": "shattered-worlds",
  "shrine of inanna summoning hub": "altar-of-inanna",
  "shrine of the spirit wolves (blessings of the wolf shop)": "spirit-wolf-pouch",
  "silverhawk boots (agility xp from feathers/down)": "silverhawk-boots",
  "silverquill, the dreadhog": "silverquill",
  "sirenic → elite sirenic armour": "sirenic-hauberk",
  "sirenic armour (t90 ranged power craft)": "sirenic-hauberk",
  "skillchompas": "skillchompas",
  "skull sceptre": "skull-sceptre",
  "slayer codex": "slayer-codex",
  "slayer introspection (amascut's enchanted gem)": "slayer-introspection",
  "slayer tower": "slayer-tower",
  "smelting gauntlets": "smelting-gauntlets",
  "smithing autoheater": "smithing-autoheater",
  "smoking kills (full slayer points unlock)": "smoking-kills",
  "soil box + material storage capacity ladders": "archaeological-soil-box",
  "sophanem plover birds and slayer support skilling": "sophanem",
  "sophanem slayer dungeon": "sophanem-slayer-dungeon",
  "soul altar (menaphos imperial)": "soul-altar",
  "sous chef's outfit": "sous-chefs-outfit",
  "sparkling wisp colony": "sparkling-wisp-colony",
  "spear of annihilation": "spear-of-annihilation",
  "spear of annihilation (base archaeology spear)": "spear-of-annihilation",
  "spectral lens": "spectral-lens",
  "spin flax (lunar)": "spin-flax",
  "spiny helmet, face mask, earmuffs, nose peg (shop pack)": "spiny-helmet",
  "spirit cape": "spirit-cape",
  "spirit cape passive": "spirit-cape",
  "spirit moths (highweald charm supply)": "gold-charm",
  "spirit weaver (pastkeeper's tapestry)": "spirit-weaver",
  "spirit wolf pouch": "spirit-wolf-pouch",
  "spring cleaner (invention drop cleaner)": "spring-cleaner",
  "spring cleaner 9001": "spring-cleaner-9001",
  "staff of armadyl": "fractured-staff-of-armadyl",
  "staff of limitless family (elemental impetus craft)": "staff-of-limitless-fire",
  "statue of het (oasis skilling xp blessing)": "statue-of-het",
  "sticky fingers (andvaranaut)": "sticky-fingers",
  "stormguard citadel dig site (armadylean)": "stormguard-citadel-dig-site",
  "string jewellery (lunar)": "string-jewellery",
  "subjugation equipment": "subjugation-robe-top",
  "summoning charm-conservation tools": "summoning-charm",
  "sumona (pollnivneach slayer master)": "sumona",
  "sunspear vyre cremation multi-skill training": "sunspear-melee",
  "superglass make (lunar)": "superglass-make",
  "superheat form (seren prayer)": "superheat-form",
  "superior dragon claws (wilderness hilt upgrade)": "superior-dragon-claws",
  "taverley dungeon": "taverley-dungeon",
  "tear of inanna / hungry like the wolf": "tear-of-inanna",
  "tectonic robe armour": "tectonic-robe-top",
  "telekinetic grind (lunar)": "telekinetic-grind",
  "telos the warden": "telos",
  "telos, the warden": "telos",
  "temple of aminishi": "temple-of-aminishi",
  "temple of aminishi (ed1)": "temple-of-aminishi",
  "temple trekking": "temple-trekking",
  "tetracompass pieces": "tetracompass",
  "tetracompass pieces → ancient caskets → complete tomes": "tetracompass",
  "the abyss": "abyss",
  "the ambassador": "ambassador",
  "the barrows brothers": "barrows",
  "the dig site": "the-dig-site",
  "the empty throne room": "the-empty-throne-room",
  "the gate of elidinis": "gate-of-elidinis",
  "the light within": "the-light-within",
  "the lost grove": "lost-grove",
  "the magister": "the-magister",
  "the prodigal spender (all guild shop permanents)": "the-prodigal-spender",
  "the shadow reef": "shadow-reef",
  "the shadow reef / ambassador (ed3)": "shadow-reef",
  "the temple at senntisten": "the-temple-at-senntisten",
  "the world wakes": "the-world-wakes",
  "thieves' guild (lumbridge)": "thieves-guild",
  "time altar": "time-altar",
  "tirannwn combat achievement rewards": "tirannwn-quiver-4",
  "tirannwn quiver 1-4": "tirannwn-quiver-4",
  "tokhaar-kal capes": "tokhaar",
  "toolbelt attach: bonecrusher": "bonecrusher",
  "toolbelt attach: charming imp": "charming-imp",
  "toolbelt attach: herbicide": "herbicide",
  "toolbelt attach: seedicide": "seedicide",
  "torva armour and praesulic essence (melee)": "torva-platebody",
  "totem of summoning": "totem-of-summoning",
  "totem of vitality": "totem-of-vitality",
  "trimmed masterwork melee armour (t92)": "trimmed-masterwork-platebody",
  "troll invasion": "troll-invasion",
  "twin furies": "twin-furies",
  "twisted bird skull necklace": "twisted-bird-skull-necklace",
  "tzhaar fight cave": "tzhaar-fight-cave",
  "tzhaar-hur-lek ore and gem store (uncut onyx)": "uncut-onyx",
  "tzkal zuk": "tzkal-zuk",
  "tzkal-zuk": "tzkal-zuk",
  "tztok-jad": "tztok-jad",
  "underworld grimoire 1-4": "underworld-grimoire-1",
  "underworld grimoire skilling milestone ladder (ug1-4 densify)": "underworld-grimoire-1",
  "underworld grimoire skilling milestone ladder (ug1–4 densify)": "underworld-grimoire-1",
  "unexpected diplomacy (seal of the praefectus praetorio)": "unexpected-diplomacy",
  "urn enhancer (permanent invention device)": "urn-enhancer",
  "vampyrism": "vampyrism",
  "varrock armour 1-4": "varrock-armour-4",
  "varrock armour 1–4": "varrock-armour-4",
  "varrock dig site": "varrock-dig-site",
  "varrock dig site / early archaeology": "varrock-dig-site",
  "varrock lumber yard sawmill operator": "sawmill",
  "varrock museum kudos progression": "varrock-museum",
  "velucia museum archaeology collections": "velucia",
  "velucia museum collection chronote tiers (225% set bonus)": "velucia",
  "vermyx, brood mother": "vermyx",
  "vestments of havoc (t95 melee glass cannon)": "vestments-of-havoc-robe-top",
  "vindicta": "vindicta-gorvek",
  "vindicta & gorvek": "vindicta-gorvek",
  "volatile chinchompas": "volatile-chinchompas",
  "vyres / sunspear multi-skill training": "vyres",
  "waiko commodity sell permanent upgrades": "waiko",
  "waiko contracts-per-day permanent upgrades": "waiko-contracts",
  "waiko grill (permanent arc cooking station)": "waiko-grill",
  "waiko uncharted supplies permanent upgrades (cap + cost)": "waiko",
  "wand / orb of the cywir elders": "wand-of-the-cywir-elders",
  "wand of the praesul and imperium core": "wand-of-the-praesul",
  "war's blessing 1-4 (combat mastery)": "wars-blessing-4",
  "war's blessing 1-4 (combat mastery residual)": "wars-blessing-4",
  "war's blessing combat mastery": "wars-blessing-4",
  "war's blessing combat mastery residual": "wars-blessing-4",
  "war's retreat": "wars-retreat-hub",
  "war's retreat combat hub": "wars-retreat-hub",
  "war's retreat combat hub residual": "wars-retreat-hub",
  "war's retreat hub amenities (bank / altar of war / grimoire host)": "altar-of-war",
  "warforge dig site (feldip hills archaeology)": "warforge-dig-site",
  "warped depths (daemonheim depths excavation)": "warped-depths",
  "warped gem": "warped-gem",
  "warped gorajan trailblazer outfit": "warped-gorajan",
  "warriors' guild": "warriors-guild",
  "war's retreat": "wars-retreat-hub",
  "wars retreat": "wars-retreat-hub",
  "war's retreat combat hub": "wars-retreat-hub",
  "wars retreat combat hub": "wars-retreat-hub",
  "waterbirth island": "waterbirth-island",
  "waterfall fishing": "waterfall-fishing",
  "weapon poison+++": "weapon-poison",
  "well of souls": "well-of-souls",
  "well of souls talent infrastructure": "well-of-souls",
  "wendlewick deserted mine (clay and uncommon gems)": "wendlewick-deserted-mine",
  "wendlewick fish farm (havenhythe)": "wendlewick-fish-farm",
  "wendlewick limestone mine": "wendlewick-limestone-mine",
  "wendlewick lodestone": "wendlewick-lodestone",
  "wendlewick teleport (standard spellbook)": "wendlewick-teleport",
  "werewolf agility course": "werewolf-agility-course",
  "wicked hood (runecrafting talisman storage + altar teleports)": "wicked-hood",
  "wilderness agility course": "wilderness-agility-course",
  "wilderness bloodwood trees": "wilderness-slayer",
  "wilderness chaos altars (prayer offer)": "chaos-altar",
  "wilderness herb patch": "wilderness-herb-patch",
  "wilderness sword 1-4": "wilderness-sword-4",
  "witchdoctor camo outfit": "witchdoctor-camo",
  "witchdoctor mask (habitat teleport)": "witchdoctor-mask",
  "wood box tier upgrades": "eternal-magic-wood-box",
  "woodcutters grove": "woodcutters-grove",
  "woodcutters grove facility tiers": "woodcutters-grove",
  "woodcutters' grove": "woodcutters-grove",
  "woodcutters' grove facility tiers": "woodcutters-grove",
  "yak-hide armour": "yak-hide-armour",
  "zamorakian sliver enchantments": "zamorak",
  "zamorakian undercity ability codices": "zamorakian-undercity",
  "zemouregal & vorkath": "zemouregal-vorkath",
  "zemouregal & vorkath progression": "zemouregal-vorkath",
  "zemouregal and vorkath": "zemouregal-vorkath",
};

/** Normalize a free-text label to a kebab slug candidate. */
export function slugifyIconLabel(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Containment only for long inventory/boss slugs so short tokens ("armour", "tools")
 * never steal an unrelated icon.
 */
const CONTAIN_ITEM_SLUGS: string[] = (() => {
  const set = new Set<string>(Object.keys(UPGRADE_ICON_BY_SLUG));
  return [...set].filter((s) => s.length >= 10).sort((a, b) => b.length - a.length);
})();

const CONTAIN_BOSS_SLUGS: string[] = (() =>
  [...BOSS_ICON_SLUGS].filter((s) => s.length >= 5).sort((a, b) => b.length - a.length))();

const PACKAGEY =
  /\b(progression|family|network|uniques|materials|residual|ladder|chain|hub|system|economy|loop|infrastructure|package|checklist|rule|state|titles?|rewards?|overview|efficiency|milestones|research|access)\b/i;

/** Data rows tied to Archaeology skill systems (not combat/other skills). */
const ARCH_ENTITY_RE =
  /archaeolog|dig.?site|mattock|chronote|monolith|artefact|velucia|museum donation|tetracompass|soil box|screening/i;

/**
 * Strict candidate slugs: alias → exact clauses → long containment.
 * Prefer no icon over a weakly related one.
 */
export function iconSlugCandidates(name: string): string[] {
  const raw = name.trim();
  if (!raw) return [];
  const lower = raw.toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  // 1) Explicit alias wins.
  if (DATA_ICON_ALIASES[lower]) push(DATA_ICON_ALIASES[lower]);
  const fullSlug = slugifyIconLabel(raw);
  if (DATA_ICON_ALIASES[fullSlug]) push(DATA_ICON_ALIASES[fullSlug]);
  push(fullSlug);

  // 2) Compound parts (bonecrusher + necklace) and leading clause only.
  const parts = raw
    .split(/\s*(?:\+|\/|·|&| → |->)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const clauses = [
    ...parts,
    raw.split(/[,;|]/)[0]?.trim() ?? "",
    raw.split(/\s*[—(]\s*/)[0]?.trim() ?? "",
  ].filter(Boolean);

  for (const c of clauses) {
    const key = c.toLowerCase();
    if (DATA_ICON_ALIASES[key]) push(DATA_ICON_ALIASES[key]);
    const cleaned = c
      .replace(/\s+\d+\s*[-–]\s*\d+\s*$/i, "")
      .replace(/\s+\(t\d+[^)]*\)/gi, "")
      .replace(/\s+(mk\.?\s*ii|mk\.?\s*2)$/i, "")
      .trim();
    if (DATA_ICON_ALIASES[cleaned.toLowerCase()]) push(DATA_ICON_ALIASES[cleaned.toLowerCase()]);
    push(slugifyIconLabel(cleaned));
  }

  // 3) Long containment only — never short generic tokens.
  if (!PACKAGEY.test(raw) || raw.split(/\s+/).length <= 8) {
    const hay = `-${fullSlug}-`;
    let hits = 0;
    for (const s of CONTAIN_ITEM_SLUGS) {
      if (hay.includes(`-${s}-`)) {
        push(s);
        hits++;
        if (hits >= 2) break;
      }
    }
  }

  return out;
}

function firstHit(
  candidates: string[],
  lookup: (slug: string) => string | null,
): string | null {
  for (const slug of candidates) {
    const path = lookup(slug);
    if (path) return path;
  }
  return null;
}

/** Exact-only candidates (alias + full slug + first clause) — no containment. */
function exactSlugCandidates(name: string): string[] {
  const raw = name.trim();
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  const lower = raw.toLowerCase();
  if (DATA_ICON_ALIASES[lower]) push(DATA_ICON_ALIASES[lower]);
  push(slugifyIconLabel(raw));
  // Split on clause punctuation only — do NOT break internal hyphens (Kharid-et).
  const first = raw.split(/[,;|·/+(—–]/)[0]?.trim() ?? "";
  if (first && first !== raw) {
    if (DATA_ICON_ALIASES[first.toLowerCase()]) push(DATA_ICON_ALIASES[first.toLowerCase()]);
    push(slugifyIconLabel(first));
  }
  // Boss epithet: "Kerapac, the bound"
  const comma = raw.split(",")[0]?.trim() ?? "";
  if (comma && comma !== raw) push(slugifyIconLabel(comma));
  return out;
}

export function skillIconPath(skillIdOrName: string): string | null {
  return firstHit(exactSlugCandidates(skillIdOrName), (slug) =>
    SKILL_ICON_SLUGS.has(slug) ? `/game/skills/${slug}.png` : null,
  );
}

export function bossIconPath(name: string): string | null {
  // Exact first, then long boss-name containment (Kerapac progression → kerapac only via alias).
  const cands = exactSlugCandidates(name);
  const hay = `-${slugifyIconLabel(name)}-`;
  for (const s of CONTAIN_BOSS_SLUGS) {
    if (hay.includes(`-${s}-`) || hay.startsWith(`-${s}`) || hay.endsWith(`${s}-`)) {
      if (!cands.includes(s)) cands.push(s);
    }
  }
  return firstHit(cands, (slug) => {
    if (!BOSS_ICON_SLUGS.has(slug)) return null;
    const ext = BOSS_ICON_EXT[slug] ?? "png";
    return `/game/bosses/${slug}.${ext}`;
  });
}

export function activityIconPath(name: string): string | null {
  return firstHit(exactSlugCandidates(name), (slug) => {
    const rel = ACTIVITY_ICON_BY_SLUG[slug];
    return rel ? `/game/activities/${rel}` : null;
  });
}

export function upgradeIconPath(name: string): string | null {
  return firstHit(iconSlugCandidates(name), (slug) => {
    const rel = UPGRADE_ICON_BY_SLUG[slug];
    return rel ? `/game/upgrades/${rel}` : null;
  });
}

/**
 * Resolve a Data-route entity to a local icon path, or null.
 * Prefer correct empty well over a wrong related image.
 */
export function dataEntityIconPath(input: {
  name?: string | null;
  kind?: string | null;
  id?: string | null;
  skill?: string | null;
}): string | null {
  const id = input.id?.trim() ?? "";
  if (id.startsWith("item:") || id.startsWith("equipment:")) {
    return equipmentIconPath(id);
  }

  const name = (input.name ?? "").trim();
  const kind = (input.kind ?? "").toLowerCase();

  if (kind.includes("skill") || input.skill) {
    const skill = skillIconPath(input.skill || name);
    if (skill) return skill;
  }

  if (!name) return null;

  // Name-token archaeology only for skill fallback; kind alone must not force skill icon
  // (relic chains / settlement hubs tagged "Archaeology" would otherwise all show the skill).
  const archName = ARCH_ENTITY_RE.test(name);
  const archRelated = archName || ARCH_ENTITY_RE.test(kind);

  // Word-ish kind match only — "elite skilling" must not force bossish routing.
  const bossish =
    /\bboss(?:es|ing)?\b/.test(kind) ||
    /\bdungeon\b/.test(kind) ||
    /\bsanctum\b/.test(kind) ||
    /\bgate of\b/.test(kind) ||
    /\bgod wars\b/.test(kind) ||
    /\belite dungeon\b/.test(kind);
  if (bossish) {
    const boss = bossIconPath(name);
    if (boss) return boss;
    // Archaeology rows must not take scenery via bossish kinds (e.g. "gate" in kind text).
    if (!archRelated) {
      const act = activityIconPath(name);
      if (act) return act;
    }
  }

  // Inventory / unlock art first (square icons look right in wells).
  const up = upgradeIconPath(name);
  if (up) return up;

  // Skill name as title (e.g. Mining method rows). Alias → skill slug also lands here.
  const skill = skillIconPath(name);
  if (skill) return skill;

  // Archaeology name rows: exact dig-site / NPC activity, else skill — never kind-only.
  if (archName) {
    const actExact = activityIconPath(name);
    if (actExact) return actExact;
    return skillIconPath("archaeology");
  }

  // Place / activity only on exact match (avoid random location for item names).
  const act = activityIconPath(name);
  if (act) return act;

  // Boss only on exact / epithet match when not already tried.
  if (!bossish) {
    const boss = bossIconPath(name);
    if (boss) return boss;
  }

  // Equipment: exact/alias candidates only (EQUIPMENT_OK is closed — abstract package
  // slugs never hit). Allow any length so multi-word named items still resolve.
  for (const slug of exactSlugCandidates(name)) {
    const path = equipmentIconPath(slug);
    if (path) return path;
  }

  // Abstract multi-word packages without a real item/activity/boss hit stay empty.
  // Prefer null over weakly related skill/scenery (kind-only skill dumps are banned above).
  return null;
}
