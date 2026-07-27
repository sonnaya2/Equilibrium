/**
 * Content-row → upgrade unique-list resolution for /data Browse.
 * Pure (no React) so unit tests can pin boss → package mapping.
 */

import {
  clipRewardDisplay,
  contentRewardsSource,
} from "./dataContentPresentation";

export type RewardUpgrade = { name: string; detail?: string | null };
export type RewardContentRow = { name: string; detail?: string | null };

/** Light wiki/display cleanup — not a full sanitizer. */
export function cleanRewardText(value: string): string {
  if (!value) return "";
  return value
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\[(?:edit|citation needed|source|note\s*\d*)\]/gi, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/(?:\s*·\s*){2,}/g, " · ")
    .trim();
}

/** Strip parenthetical / hub suffixes used when matching reward keys. */
export function contentRewardBaseName(value: string): string {
  return cleanRewardText(value)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\/\s*early Archaeology$/i, "")
    .replace(/\s+construction and Slayer hub$/i, "")
    .replace(/\s*\/\s*Underworld$/i, "")
    .replace(/\s+(?:Feldip Hills|Armadylean|Zamorakian|Dragonkin)\s+Archaeology$/i, "")
    .replace(/\s+Dig Site\s+(?:full mastery|mini-site)$/i, " Dig Site")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hubs with honest text-only access (no wrong inventory icons). */
export const CONTENT_ACCESS: Record<string, string> = {
  "Varrock Dig Site / early Archaeology":
    "Archaeology Guild shop · Mysterious monolith · Museum donation bin",
  "Pale wisps near Draynor": "Pale, bright, brilliant wisps",
  "Misthalin wisp colonies": "Pale, bright, brilliant wisps",
  "Wisps near Draynor": "Pale, bright, brilliant wisps",
  // Catalog content name is "Fort Forinthry" (not the long construction label).
  "Fort Forinthry": "Fort buildings · chapel · Slayer hub",
  "Fort Forinthry construction and Slayer hub": "Fort buildings · chapel · Slayer hub",
  "City of Um / Underworld": "Ritual site · City of Um",
  // Hermodic plates have no local inventory art — Deathdealer is the power-armour craft path.
  "Hermod, the Spirit of War": "Deathdealer robe armour",
  // GWD1 hub is approach only — Bandos/Armadyl/Subjugation/godswords live on boss rows.
  "God Wars Dungeon 1": "God camps · killcount · altar healing",
};

/**
 * Explicit full reward lists when the upgrade package omits key uniques
 * (cape chains indexed separately, minigame path rows with prose-only detail).
 * Same short-circuit as CONTENT_ACCESS — icons resolve via presentContentRewards.
 * Cap-5 chip order for Zuk: weapon, ability, scripture, BiS cape, one style cape.
 */
export const CONTENT_REWARD_OVERRIDES: Record<string, string> = {
  "Fort Forinthry Chapel": "Prayer altar",
  "H.A.M. Hideout pickpocketing and store rooms": "Clue scroll",
  "Expansive essence pouch (70 essence, non-degrading)": "Expansive essence pouch",
  // Main Zuk uniques + BiS igneous cape only (no +N from listing every style stone).
  "TzKal-Zuk": "Ek-ZekKil, Magma Tempest, Scripture of Ful, Igneous Kal-Zuk",
  "TzHaar Fight Cave": "Fire cape",
  "Fight Kiln": "TokHaar-Kal-Ket, TokHaar-Kal-Xil, TokHaar-Kal-Mej, TokHaar-Kal-Mor",
  // Catalog Unlocks essay is huge — keep the two things players need.
  // Empty Throne Room mine is dark animica only (not light — light is Anachronia Swamp mine).
  "The Empty Throne Room": "Manual Auto-cycle, Dark animica",
  "Empty Throne Room": "Manual Auto-cycle, Dark animica",
  // Infernal Source: Ancient Summoning pipeline + dig-site relics / tetras.
  "Infernal Source Dig Site":
    "Ancient Summoning, Binding contract, Tetracompass, Inspire Love, Slayer Introspection",
  "Infernal Source Dig Site (Zamorakian)":
    "Ancient Summoning, Binding contract, Tetracompass, Inspire Love, Slayer Introspection",
  // Abilities + boots would overflow the 5-chip strip (+2).
  Raksha: "Greater Ricochet, Divert, Fleeting boots, Laceration boots, Blast diffusion boots",
  // GWD1 K'ril: package Unlocks use "Hood / garb / … of subjugation" (suffix form) —
  // expandSlashList prefix path only handles "Bandos helmet / chestplate". Explicit pieces.
  "K'ril Tsutsaroth":
    "Hood of subjugation, Garb of subjugation, Gown of subjugation, Gloves of subjugation, Boots of subjugation",
  // Cap-5 GWD2 headline weapons (icons resolve; anima core deferred for chip space).
  "Heart of Gielinor / God Wars Dungeon 2":
    "Dragon Rider lance, Wand of the Cywir elders, Shadow glaives, Blade of Avaryss, Blade of Nymora",
  "Heart of Gielinor":
    "Dragon Rider lance, Wand of the Cywir elders, Shadow glaives, Blade of Avaryss, Blade of Nymora",
  // Zilyana uniques with published inventory icons (murmur/hiss/whisper have none).
  "Commander Zilyana":
    "Saradomin sword, Saradomin godsword, Armadyl crossbow, Off-hand Armadyl crossbow",
  // No upgrade package in catalog — short honest label.
  "Kalphite Queen": "Dragon chainbody, Kalphite queen head, Dragon 2h sword",
  // Giant Mole — claw/skin lack inventory art; dragon 2h is the chase unique with art.
  "Giant Mole": "Dragon 2h sword",
  // QBD — royal crossbow path + shared dragon uniques with local art.
  "Queen Black Dragon": "Royal crossbow, Dragon 2h sword, Dragon chainbody",
  // Legiones — dual ACB + grips.
  Legiones: "Ascension crossbow, Off-hand Ascension crossbow, Ascension grips",
  "Monastery of Ascension": "Ascension crossbow, Off-hand Ascension crossbow, Ascension grips",
  // ED3 — eldritch + black stone ammo. Hexhunter is Soulgazers (not Shadow Reef).
  "The Shadow Reef (ED3)": "Eldritch crossbow, Black stone arrow",
  "The Shadow Reef": "Eldritch crossbow, Black stone arrow",
  Soulgazers: "Hexhunter bow",
  "Soulgazer": "Hexhunter bow",
  "Wilderness strykewyrms": "Staff of light, Focus sight, Hexcrest",
  "Ice strykewyrm": "Staff of light",
  "Lava strykewyrm": "Lava strykewyrm",
  // Mazcab — one piece per Achto style (melee / mage / range).
  "Beastmaster Durzag":
    "Achto Teralith cuirass, Achto Primeval robe top, Achto Tempest body",
  Yakamaru: "Achto Teralith cuirass, Achto Primeval robe top, Achto Tempest body",
  "Liberation of Mazcab":
    "Achto Teralith cuirass, Achto Primeval robe top, Achto Tempest body",
  // Barrows brothers — five headline weapons.
  Barrows:
    "Ahrim's staff, Dharok's greataxe, Karil's crossbow, Torag's hammer, Verac's flail",
  // Slayer hubs / resource dungeons with resolvable chips.
  "Kuradal's Dungeon and ferocious ring hub": "Ferocious ring",
  "Polypore Dungeon (spore and stick resources)": "Polypore staff",
  "Rex Matriarchs": "Occultist's ring, Reaver's ring, Skeka's hypnowand",
  // Farming / woodcutting majors — avoid wrong upgrade binds.
  "Varrock Palace tree patch": "Tree patch",
  "Lumbridge hops patch": "Hops patch",
  "Draynor willow trees": "Willow trees",
  "City of Um mushroom patch": "Mushroom patch · disease-free with UG3",
  // ED4 uniques — Vestments, Bolg, Chaos Roar, Lost Knowledge codices (Greater Sun / GDS).
  "Zamorak, Lord of Chaos":
    "Vestments of havoc, Bow of the Last Guardian, Chaos Roar, Greater Sunshine, Greater Death's Swiftness",
  "Zamorak, Lord of Chaos (Undercity)":
    "Vestments of havoc, Bow of the Last Guardian, Chaos Roar, Greater Sunshine, Greater Death's Swiftness",
  // Necrotic altars — four runes + max RC rate (20 XP/ess Miasma · ~2.5k ess/h pouches).
  "Necromantic Rune Temple":
    "Spirit rune, Bone rune, Flesh rune, Miasma rune · Max ~50k XP/h at Miasma",
  "Necrotic altars":
    "Spirit rune, Bone rune, Flesh rune, Miasma rune · Max ~50k XP/h at Miasma",
  // Havenhythe bosses — packages were stubs without Unlocks lists.
  "Ivar, King of Bones": "Bonecrusher maul, Magic skull mask, Colossal bone",
  "Silverquill, the Dreadhog": "Silver spines, Sanguine spines",
  "Sanguine Crawler": "Vampyrism gloves, Tainted seed, Sanguine matter",
  // Forinthry bloodweed — pot row is the payoff; herb patch is the farm + core roll.
  "Bloodweed & aggression potions":
    "Clean bloodweed, Searing ashes, Aggression potion",
  "Wilderness herb patch": "Bloodweed seeds, Dark onyx core",

  // Forinthry majors — short reward chips, no essay.
  "Abyss Runecrafting": "Multi-altar rifts, Magical thread, Pouch repair",
  "Abyss entrance": "Multi-altar rifts, Magical thread, Pouch repair",
  "Edgeville resource dungeons": "Chaos druids, Hill giants, Herb spawns, Limpwurt roots",
  "Edgeville Dungeon resource dungeons": "Chaos druids, Hill giants, Herb spawns, Limpwurt roots",
  "Wilderness bloodwood trees": "Bloodwood logs, Bakriminel bolt tips, Dark onyx core",
  "Bloodwood trees": "Bloodwood logs, Bakriminel bolt tips, Dark onyx core",
  "Black salamanders": "Black salamander, Dark onyx core",
  "Black salamanders (Boneyard Hunter)": "Black salamander, Dark onyx core",
  "Mage Arena":
    "Guthix staff, Saradomin staff, Zamorak staff, Claws of Guthix, Divine Storm",
  "Wilderness Agility Course": "Dark onyx core, Portable obelisk, Obelisk shard",
  "Wilderness Slayer": "Wilderness assignments, Dark onyx core, Wilderness slayer chest",
  "Charming moths": "Gold charm, Green charm, Crimson charm, Blue charm",
  "Wilderness Chaos altars (Prayer Offer)": "Prayer Offer XP, Wilderness achievement bonus",
  "Chaos Altar": "Prayer Offer XP, Wilderness achievement bonus",

  // Resource / wildy dungeons — prefer resolvable chips over essay prose.
  "Forinthry Dungeon": "Resource dungeon",
  "Edimmu resource dungeon": "Crystal sandstone, Resource dungeon",

  // Hub / activity majors — short chips instead of Unlocks essays.
  "Invention Guild": "Workbenches, machines, blueprints, generators",
  Prifddinas: "Spirit trees ×3, crystal tools, clan districts, Max Guild",
  "Voice of Seren district rotations": "Hourly clan XP + skilling buffs",
  "Empowered Summoning obelisks": "Spirit Plane Connection XP / mat save",
  "Deep Sea Fishing Hub": "Frenzy, sailfish, swarm, Travelling Merchant",
  "Ithell harmonium harps (harmonic dust)": "Harmonic dust, crystal crafts",
  "Port Phasmatys": "Brewery vat, ecto-tokens, docks",
  Ectofuntus: "4× bury XP, ecto-tokens, First age outfit",
  "Harmony pillars (Meilyr harmony moss)": "Harmony moss per skill",
  Canifis: "Mushroom patch, Mazchna",
  "Ranging Guild": "Ranged shops, skillcape, tickets",
  "Port Sarim docks and skilling hub": "Player-owned port, The Arc, Ports portal",
  "Warriors' Guild": "Dragon defender",
  "Safecracking route": "Safecracking",
  "Warforge Dig Site (Bandosian)": "Imcando mattock, Inspire Awe, Endurance",
  "Warforge Dig Site": "Imcando mattock, Inspire Awe, Endurance",
  "Roar of Osseous (Rex skeleton island buff)": "Roar of Osseous",
  "Roar of Osseous": "Roar of Osseous",
  "Hall of Memories": "Memory jars, storage bot, Divination XP",
  "Wizards' Guild (Magic Guild, Yanille)": "Magic cape, Rune essence teleport",
  "Hefin serenity posts (AFK Agility)": "AFK Agility posts",
  "Kuradal (Ancient Cavern Slayer Master)": "Slayer points, personal dungeon",
  "Memorial to Guthix": "Engrams, echo buffs, prestige",
  "Stormguard Citadel Dig Site (Armadylean)":
    "Inspire Genius, Ancient Invention, Howl's workshop",
  "Stormguard Citadel Dig Site": "Inspire Genius, Ancient Invention, Howl's workshop",
  "Orthen Dig Site":
    "Orthen furnace core, Flow State, Death Note, Orthen teleportation device",
  "Amlodd Summoning and Divination hub": "Obelisk, shard shop, light rift",
  "Herblore Habitat": "Jadinko patches, vine herbs, Papa Mambo",
  "Burgh de Rott skilling hub": "Bank near Barrows / Shades / Tarn",
  "Rimmington Construction supply loop": "House portal, workbench, supplies",
  "Fishing Guild": "Bank, shark/lobster docks, shop",
  "Piscatoris Fishing Colony": "Monkfish, bank, range",
  "Seers' Village skilling hub": "Flax, yews, maples, bank",
  "Barbarian Outpost Agility Course": "Course + agile top",
  "Catherby fishing and farming hub": "Fishing spots, patches, bank",
  "Manor Farm (Farming Guild) and reputation rewards":
    "Master farmer outfit, Beans, Skillchompas, NopeNopeNope",
  "Player-Owned Farm / Manor Farm":
    "Master farmer outfit, Beans, NopeNopeNope, Skillchompas",
  "Manor Farm animal perks":
    "NopeNopeNope, Master farmer outfit, Beans, Skillchompas",
  "Falador farm allotment / flower / herb patches": "Allotment, flower, herb patches",
  "Troll Stronghold disease-free herb patch": "Disease-free herb patch",
  "Ardougne farming patches and Manor Farm": "Ardougne patches · Manor Farm access",
  "Fruit tree patch hubs": "Fruit tree patches",
  // Freneskae via Kandarin World Gate packaging.
  "Freneskae via World Gate": "Nightmare gauntlets, Muspah, Rune dragons",
  "Nightmare creatures": "Nightmare gauntlets",
  Muspah: "Muspah",
  "Rune dragons": "Rune dragons",
  "Calquat farming patch": "Calquat patch (only one)",
  "Desert cactus Farming patches": "Cactus patches",
  "Port Phasmatys farming patches": "Allotment / flower / herb",
  "Crystal tree Farming (crystal acorns)": "Crystal trees, acorns",
  "Mining Guild": "Mining Guild bank, rocks, resource dungeon",
  "Crafting Guild": "Pottery, furnace, tanner, bank",
  "Artisans' Workshop burial smithing": "Burial smithing XP",
  "Fort Forinthry": "Fort buildings · chapel · Slayer hub",
  "Varrock Dig Site / early Archaeology": "Guild, monolith, museum, dig site",
  "Archaeology Campus": "Guild shop, workbench, screening",
  "Archaeology shop":
    "Master archaeologist's outfit, Soil box, Material storage, Mattock precision, Archaeologist's tea",
  "Archaeology Guild Shop and qualification upgrades":
    "Master archaeologist's outfit, Soil box, Material storage, Mattock precision, Archaeologist's tea",
  "City of Um / Underworld": "Ritual site · Um services",
  "Wizards' Tower and Runecrafting Guild": "Runespan, essence, RC guild",
  "Fairy ring network (Zanaris)": "Fairy ring codes",
  "Woodcutters' Grove": "Trees, wood box, log piles",
  "Anachronia base camp": "Essential oils, Quick traps, Hunter Lodge",
  "Anachronia Agility Course": "Double Surge, Double Escape",
  "Anachronia Big Game Hunter": "Dragon mattock, Terrasaur maul, Quick traps",
  "Dream of Iaia": "Dream of Iaia stations",
  "Skillcape rack": "Skillcape rack",
  "Volcanic trapper outfit": "Volcanic trapper outfit",
  "Laniakea": "Highest standard Slayer master",
  "Time altar": "Time rune",
  "Max Guild": "Prif hub, portals, skillcape stand",
  "Hefin Agility Course": "Course, prayer bonus, serenity",
  "Morvran (Prifddinas Slayer Master)": "Slayer points, vip room",
  "TzHaar City skilling hub": "Banks, furnace, TokKul shops",
  "Musa Point fishing dock and Stiles": "Lobster/swordfish, note fish",
  "Shilo Village": "Gems, cart, Karamja gloves adjacency",
  "Nature altar": "Nature runes",
  "Gleaming wisp colony": "Gleaming wisps / energy",
  "Pyramid Plunder": "Thieving XP, sceptre",
  "Soul altar": "Soul runes",
  "Slayer Tower": "Abyssal scourge, Abyssal whip",
  "Darkmeyer": "Vyres, bank, shops",
  "Vyre combat and Sunspear progression": "Sunspear",
  "Vyres / Sunspear multi-skill training": "Sunspear",
  "Sunspear vyre cremation multi-skill training": "Sunspear",
  "Sunspear Vyre prayer sustain": "Sunspear",
  "Sunspear Vyre prayer sustain (ex-aura)": "Sunspear",
  "Werewolf Agility Course": "Werewolf Agility Course",
  "Abandoned Mine": "Salve shards, haunted mine",
  "Shades of Mort'ton": "Cremation, temples",
  "Temple Trekking": "Burgh rewards",
  "Managing Miscellania": "Daily kingdom resources",
  "Lunar Isle skilling hub": "Lunar spellbook, astral altar",
  "Livid Farm": "Lunar spell unlocks",
  "Astral altar": "Astral runes",
  "Blast Furnace (Keldagrim)": "Coal-free bars, bank chest",
  "Lava Flow Mine": "Golden mining suit",
  "Keldagrim dwarven hub": "Blast furnace, traders, brewery",
  "Rellekka Fremennik hub": "Bank, docks, market",
  "Neitiznot yak Crafting and Cooking loop": "Yak hide, meat, crafts",
  "Ungael ritual site": "Necromancy rituals",
  "Penguin Agility Course (Iceberg)": "Agility course",
  "Jatizso dungeon mine": "Resource dungeon",
  "Sparkling wisp colony": "Sparkling wisps / energy",
  "Arctic pine Woodcutting (Neitiznot)": "Arctic pine logs",
  "Anachronia overgrown idols": "WC XP, XP lamps on clear",
  "Hunter Mark Shop (Irwinsson)": "Quick traps, Hunter marks",
  "Anachronia totems": "Totem of Vitality, Totem of Treasure, Totem of Navigation",



  "Always Adze": "Always Adze",
  "Accidental Fletching and Firemaking": "Farm peninsula skilling",
  "Asuran Arsenal heist": "High Thieving heist XP",
  "Ranch Out of Time": "King of Beasts, No Fear, Armoured Hide, Beans",
  "Ranch Out of Time (Anachronia Dinosaur Farm)":
    "King of Beasts, No Fear, Armoured Hide, Beans",
  "Herby Werby": "Herb bag",
  "Big Game Hunter": "Dragon mattock, Terrasaur maul, Quick traps",
  "Laniakea (Anachronia highest standard Slayer Master)": "Laniakea's spear, Slayer points",
  "Dinosaur and plant Slayer (Laniakea / Anachronia)": "Dino / plant tasks",
  "Prehistoric Potterington's 'Accidental' Fletching and Firemaking":
    "Farm peninsula Fletching / Firemaking",
  "Corporeal Beast":
    "Spirit shield, Holy elixir, Arcane sigil, Elysian sigil, Divine sigil, Spectral sigil",
  "Daemonheim Rewards shop":
    "Ring of Vigour, Bonecrusher, Charming imp, Gem bag, Herbicide, Scroll of cleansing, Scroll of efficiency, Scroll of gathering, Scroll of life, Scroll of proficiency, Scroll of dexterity, Advanced smithing autoheater, Chaotics, Ruinous weapons",
  "Daemonheim Rewards shop (Marmaros)":
    "Ring of Vigour, Bonecrusher, Charming imp, Gem bag, Herbicide, Scroll of cleansing, Scroll of efficiency, Scroll of gathering, Scroll of life, Scroll of proficiency, Scroll of dexterity, Advanced smithing autoheater, Chaotics, Ruinous weapons",
  "Chaotic weapons":
    "Chaotic rapier, Off-hand chaotic rapier, Chaotic longsword, Off-hand chaotic longsword, Chaotic maul, Chaotic spear, Chaotic staff, Chaotic crossbow, Off-hand chaotic crossbow, Chaotic claw, Off-hand chaotic claw",
  "Chaotic equipment":
    "Chaotic rapier, Off-hand chaotic rapier, Chaotic longsword, Off-hand chaotic longsword, Chaotic maul, Chaotic spear, Chaotic staff, Chaotic crossbow, Off-hand chaotic crossbow, Chaotic claw, Off-hand chaotic claw",
  "Ruinous weapons":
    "Ruinous rapier, Off-hand ruinous rapier, Ruinous maul, Ruinous staff, Ruinous crossbow, Off-hand ruinous crossbow, Ruinous guard, Ruinous lantern",
  "Dark facets": "Dark Facet of Grace, Dark Facet of Luck, Dark Facet of Passage",
  // Every Wilderness brawling glove (no parentheses — tokeniser strips parentheticals).
  "Brawling gloves":
    "Melee brawling gloves, Ranged brawling gloves, Magic brawling gloves, Agility brawling gloves, Cooking brawling gloves, Firemaking brawling gloves, Fishing brawling gloves, Hunter brawling gloves, Mining brawling gloves, Prayer brawling gloves, Smithing brawling gloves, Thieving brawling gloves, Woodcutting brawling gloves",
  "Balarak's sash brush": "Balarak's sash brush",
  "Skeka's hypnowand": "Skeka's hypnowand",
  "Daemonheim Divination": "Time-Worn Memories, Scroll of gathering · Kandarin Memorial hub",
  "Primal ores": "Primal ores",
  "Daemonheim Dig Site": "Dragonkin collections, Aged journal, Balarak pieces",

  // —— Desert ——
  "Kalphite King":
    "Drygore rapier, Off-hand drygore rapier, Drygore longsword, Off-hand drygore longsword, Drygore mace, Off-hand drygore mace",
  "Sophanem Slayer Dungeon / The Magister":
    "Gloves of passage, Phylactery, Vital spark, Key to the Crossing",
  "The Magister": "Gloves of passage, Phylactery, Khopesh of Tumeken",
  "Corrupted creatures & soul devourers":
    "Vital spark, Key to the Crossing, Corrupted gem, Corrupted magic logs, Khopesh of the Kharidian",
  "Shifting Tombs":
    "Menaphos reputation, Feather of Ma'at, Camouflage fragments, Off-hand khopesh of the Kharidian",
  "Mazcab Emergency Merchants":
    "Super restore, Super attack, Super strength, Super defence, Super magic potion, Super ranging potion, Super necromancy, Cooked eeligator",
  "Goebie scavengers": "Teci, Burial charms, Cooked eeligator, Mazcab reroll tokens",
  "Sunken Pyramid / player-owned Slayer dungeon": "Slayer Codex",
  "Het's Oasis":
    "Powder of burials, Powder of penance, Powder of pulverising, Powder of protection, Powder of item protection",
  "Agility Pyramid": "Agility XP, Menaphos reputation",
  "Agility Pyramid (Jaleustrophos)": "Agility XP, Menaphos reputation",
  "Desert strykewyrm": "Focus sight",
  "Player-owned port":
    "Trade goods, Scrimshaws, Eastern lands voyages, Ports resources",
  Menaphos:
    "City quests, VIP area, Acadia trees, Marketeers, Port fishing, Soul altar",
  "Mage Training Arena": "Bones to Peaches, Infinity robes",
  "Mage Training Arena (bones to peaches + reward shop)":
    "Bones to Peaches, Infinity robes",
  "Citharede Abbey":
    "Illuminated Book of Law, Illuminated Book of War, Illuminated Book of Balance, Illuminated Book of Wisdom, Illuminated Book of Chaos",
  "Citharede Abbey illuminated god books":
    "Illuminated Book of Law, Illuminated Book of War, Illuminated Book of Balance, Illuminated Book of Wisdom, Illuminated Book of Chaos",

  // Remaining long hub essays — short chips.
  "Ourania Runecrafting Altar (ZMI)": "1.5× RC XP, random runes",
  "Ourania Runecrafting Altar": "1.5× RC XP, random runes",
  "Jadinko Favour offering stone": "Favour shop · seeds / fruits / outfits",
  "Nature Grotto altar of nature": "Prayer restore + boost",
  "Kharid-et Dig Site": "Venator digs, materials, caches",
  // Wilderness Slayer rewards defined earlier (dark onyx core + chest).
  "Everlight Dig Site":
    "Porcelain clay, Inspire Effort, Sticky Fingers, Heightened Senses, Tetracompass",
  "Jadinko Lair curly roots": "Curly roots WC + FM",
  "Corrupted ore smelting loop": "Corrupted ore smithing XP",
  "Death altar (Temple of Light Runecrafting)": "Death runes",
  "Artisans' Workshop": "Burial smithing, burial XP",
  "Tai Bwo Wannai Cleanup and trading sticks": "Trading sticks, Hardwood Grove fee",
  "Moonrise Dig Site": "Lv 52–88 digs, mysteries",
  "Shades of Mort'ton cremation": "Cremation XP, keys, temples",
  "Mort Myre fungi Bloom harvest": "Mort myre fungus, super energy",
  "Musa Point banana plantation": "Bananas, Luthas crates",
  "Musa Point free teaks": "Teak trees",
  "Hardwood Grove teaks and mahoganies": "Teaks / mahoganies (trading sticks)",
  "Karambwan vessel fishing": "Karambwan spots (DKP)",
  "Brimhaven Agility Arena": "Tickets, pirate's hooks path",
  "Karamja Volcano resource dungeon": "Resource dungeon",
  "Gemstone cavern (Shilo underground)": "Gem rocks",
  "Jadinko Lair": "Curly roots, jadinkos",
  "Calquat tree patch (Tai Bwo Wannai)": "Calquat patch (only one)",
  "Havenhythe Big Game Hunter": "Best Hunter XP route, new BGH",
  "Clockwork box traps": "Multi-catch box traps",
  "Masterwork Ranged Armour materials": "Apex hide → masterwork ranged",
  "Altar of Inanna": "Prayer restore, Summoning hub",
  "Amberfell village hub": "Bank, butcher, crafting shops",
  "Marigold Farm patch cluster": "Allotments, herb, flower",
  "Wendlewick fish farm": "Fish farm pools",
  "Eastfold Farm (sheep and spinning)": "Sheep, spinning wheel",
  "Havenhythe canoe network": "Four canoe stations",
  "Havenhythe birdhouses": "Birdhouse tiers to eternal magic",
  "Jackalopes (BIS early–mid Hunter method)": "Early–mid Hunter XP, antlers",
  "Charming moths / Highweald charm training": "Charms / moths for Summoning",
  "Shrine of Inanna Summoning": "Empowered obelisks",
  "Apex Hide Armour": "Ranged armour path",
  "Black chinchompas": "Chins without Wilderness",
  "Giant crayfish fishing": "High XP fish",
  "Open-water fishing spots": "Open water fish",
  "Highweald / Deserted Mine mining access": "Necrite / phasmatite rocks",
  "Spirit moths": "Summoning charms",
  "Hunter Lodge": "Hunter hub",
  "Dalia's Tree Nursery": "Tree farming",
  "Wendlewick Teleport / lodestone": "Wendlewick access",
  "Trader Woes": "Shop stock",
  "Old Meats": "Food supply",
  "Senntisten Dig Site": "Zarosian mini digs",
  "War's Retreat": "Boss portals, bank, altar",
  "Archaeology Campus and Varrock Dig Site hub": "Guild, dig site, museum",
  "Mysterious monolith": "Relic powers, energy",
  "Well of Souls": "Necromancy talents",
  "Fort Forinthry construction and Slayer hub": "Fort buildings · chapel · Slayer hub",
};

/**
 * Content row name → preferred upgrade name key (prefix / token).
 * Prefer exact clean packages: * uniques / equipment / progression / ability|boot upgrades.
 */
export const CONTENT_REWARD_KEYS: Record<string, string> = {
  // —— Misthalin / EGWD / Um ——
  "Sanctum of Rebirth": "Sanctum of Rebirth uniques",
  "Rasial, the First Necromancer": "First Necromancer's equipment",
  "The Gate of Elidinis": "Gate of Elidinis uniques",
  "Vermyx, Brood Mother": "Sanctum of Rebirth uniques",
  "Kezalam, the Wanderer": "Sanctum of Rebirth uniques",
  "Nakatra, Devourer Eternal": "Sanctum of Rebirth uniques",
  "Kerapac, the bound": "Kerapac progression",
  "Arch-Glacor": "Arch-Glacor progression",
  Croesus: "Croesus progression",
  "TzKal-Zuk": "TzKal-Zuk progression",
  "Zemouregal & Vorkath": "Zemouregal & Vorkath progression",
  "Zamorak, Lord of Chaos": "Zamorak, Lord of Chaos",
  "Zamorak, Lord of Chaos (Undercity)": "Zamorak, Lord of Chaos",

  // —— Asgarnia / GWD1 ——
  Nex: "Nex equipment",
  "Nex: Angel of Death": "Nex: Angel of Death progression",
  "Nex tier-80 armour sets": "Nex equipment",
  Vorago: "Vorago progression",
  "General Graardor": "Bandos equipment",
  "Kree'arra": "Armadyl equipment",
  "K'ril Tsutsaroth": "Robes of subjugation",
  // Prefer CONTENT_REWARD_OVERRIDES for Zilyana (sword + ACB pack); key is fallback only.
  "Commander Zilyana": "Saradomin godsword",
  "Bandos equipment": "Bandos equipment",
  "Armadyl equipment": "Armadyl equipment",
  "Subjugation equipment": "Robes of subjugation",
  "Queen Black Dragon": "Queen Black Dragon",
  "Temple of Aminishi (ED1)": "Temple of Aminishi",
  "Temple of Aminishi": "Temple of Aminishi",

  // —— Forinthry / ED / Corp ——
  "Dragonkin Laboratory (ED2)": "Dragonkin Laboratory",
  "Dragonkin Laboratory": "Dragonkin Laboratory",
  "The Shadow Reef (ED3)": "Eldritch crossbow",
  "The Shadow Reef": "Eldritch crossbow",
  "Corporeal Beast": "Spirit shield",
  "Corporeal Beast holy-elixir / spirit shield path": "Spirit shield",
  "Daemonheim Rewards shop (Marmaros)": "Chaotic equipment",
  "Daemonheim Rewards shop": "Chaotic equipment",
  "Chaotic weapons": "Chaotic equipment",
  "Ruinous weapons": "Ruinous",

  // —— Fremennik ——
  "Dagannoth Kings": "Dagannoth Kings uniques",

  // —— Kandarin ——
  Legiones: "Legiones",
  "Monastery of Ascension": "Legiones",
  Abomination: "Abomination progression",

  // —— Desert / GWD2 ——
  "Heart of Gielinor / God Wars Dungeon 2": "God Wars Dungeon 2",
  "Telos, the Warden": "Telos weapon progression",
  "Amascut, the Devourer": "Amascut, the Devourer progression",
  "Kalphite King": "Drygore",
  "Sophanem Slayer Dungeon / The Magister": "The Magister",
  "The Magister": "The Magister",
  "Liberation of Mazcab": "Achto",

  // —— Morytania ——
  "Araxxor / Araxxi": "Noxious weapons",
  "Barrows: Rise of the Six": "Rise of the Six progression",

  // —— Tirannwn ——
  Solak: "Solak",

  // —— Anachronia ——
  Raksha: "Raksha ability upgrades",
  // Rex Matriarchs: no single clean uniques package (hearts feed multi-region rings).

  // —— Havenhythe ——
  "Ivar, King of Bones": "Ivar, King of Bones uniques",
  "Silverquill, the Dreadhog": "Silverquill, the Dreadhog uniques",
  "Sanguine Crawler": "Sanguine Crawler uniques",

  // —— Karamja ——
  "TzHaar Fight Cave": "Fire cape",
  "Fight Kiln": "TokHaar-Kal capes",
};

/**
 * Extra chips appended only when primary package lookup is used (not OVERRIDES).
 * Prefer CONTENT_REWARD_OVERRIDES for full explicit lists (Zuk / Kiln / Cave).
 */
export const CONTENT_REWARD_APPEND: Record<string, string> = {};

/** Score upgrade detail for "looks like a unique/item list". Higher wins. */
export function upgradeListScore(name: string, detail: string): number {
  const n = name.toLowerCase();
  const d = detail.toLowerCase();
  let score = 0;
  // Exact clean progression/uniques packages win hard over residual essays.
  if (/^[^()]{3,50} progression$/i.test(name.trim())) score += 45;
  if (/\buniques?\b/.test(n)) score += 50;
  if (/\bequipment\b/.test(n) && !/ladder|residual|package/.test(n)) score += 30;
  if (/\bprogression\b/.test(n)) score += 15;
  if (/unlocks:\s*/i.test(detail)) score += 55;
  // Slash piece lists (Bandos helmet / chestplate / tassets) are item lists.
  if (/unlocks:\s*[^·]*\//i.test(detail)) score += 20;
  if ((detail.match(/,/g) ?? []).length >= 1) score += 15;
  if ((detail.match(/,/g) ?? []).length >= 3) score += 15;
  // Pure short comma list with no Effects wrapper = ideal.
  if (
    detail.length > 0 &&
    detail.length < 160 &&
    !/effects:/i.test(detail) &&
    (detail.match(/,/g) ?? []).length >= 2
  ) {
    score += 40;
  }
  // Short whole-detail list (no Unlocks: prefix needed).
  if (
    detail.length > 0 &&
    detail.length < 120 &&
    !/effects:/i.test(detail) &&
    !/working league|region pressure|densify|residual/i.test(d) &&
    ((detail.match(/,/g) ?? []).length >= 1 || /\/\s*\w+/.test(detail))
  ) {
    score += 20;
  }
  if (detail.length > 0 && detail.length < 160) score += 10;
  if (detail.length > 280) score -= 30;
  if (/effects:\s*/i.test(detail) && !/unlocks:\s*/i.test(detail)) score -= 25;
  if (/working league mapping|catalyst|unannounced|locality boundary/i.test(d)) score -= 80;
  if (/densify|residual|thin hub|working taxonomy|working misthalin/i.test(d)) score -= 35;
  if (/\bability upgrades\b|\bboot upgrades\b/i.test(n)) score += 25;
  if (/\bweapon progression\b|\bweapon and anima/i.test(n)) score += 15;
  return score;
}

/** Word-boundary-ish containment so short keys don't hit mid-token (nex ⊄ annex). */
function keyEmbeddedInName(nameLower: string, keyLower: string): boolean {
  if (keyLower.length < 4) return false;
  let from = 0;
  while (from <= nameLower.length) {
    const idx = nameLower.indexOf(keyLower, from);
    if (idx < 0) return false;
    const beforeOk = idx === 0 || /[\s,(/\-']/.test(nameLower[idx - 1]!);
    const afterIdx = idx + keyLower.length;
    const afterOk =
      afterIdx >= nameLower.length || /[\s,)(/\-':]/.test(nameLower[afterIdx]!);
    if (beforeOk && afterOk) return true;
    from = idx + 1;
  }
  return false;
}

function matchRank(nameLower: string, keyLower: string): number {
  if (!keyLower) return 0;
  if (nameLower === keyLower) return 100;
  if (nameLower.startsWith(keyLower)) return 70;
  // "Bandos equipment (GWD1…)" already covered by startsWith when key is "Bandos equipment".
  if (keyEmbeddedInName(nameLower, keyLower)) return 45;
  return 0;
}

function packageStem(keyLower: string): string {
  // Prefer first token; drop leading articles.
  const tokens = keyLower.split(/\s+/).filter(Boolean);
  const first = (tokens[0] ?? keyLower).replace(/,$/, "");
  if (/^(?:the|a|an)$/i.test(first) && tokens[1]) return tokens[1]!.replace(/,$/, "");
  return first;
}

/** True when name looks like a sibling package of the same boss stem (ability + boots). */
function isSiblingPackage(nameLower: string, stem: string): boolean {
  if (stem.length < 4 || !nameLower.startsWith(stem)) return false;
  return /\b(uniques?|equipment|progression|upgrades?|ability|boot|weapons?)\b/i.test(
    nameLower,
  );
}

/**
 * Subtitle under a content major name: prefer catalog `detail` prose; when empty
 * (common on majors), fall back to clipped rewards/access from contentRewardsFull.
 * Never invents text — returns "" when both detail and rewards are blank/"—".
 */
export function contentDetailOrRewards(
  row: RewardContentRow,
  upgrades: readonly RewardUpgrade[] = [],
): string {
  const detail = cleanRewardText(row.detail ?? "");
  if (detail) return detail;
  const source = contentRewardsSource(contentRewardsFull(row, upgrades));
  if (!source || source === "—") return "";
  return clipRewardDisplay(source);
}

/**
 * Full reward/access source (unclipped). Icons + display clip via presentContentRewards.
 * Merges multiple high-scoring upgrade packages (e.g. Raksha abilities + boots).
 */
export function contentRewardsFull(
  row: RewardContentRow,
  upgrades: readonly RewardUpgrade[],
): string {
  const baseName = contentRewardBaseName(row.name);
  const override =
    CONTENT_REWARD_OVERRIDES[row.name] ?? CONTENT_REWARD_OVERRIDES[baseName];
  if (override) return override;

  const access = CONTENT_ACCESS[row.name] ?? CONTENT_ACCESS[baseName];
  if (access) return access;

  const explicit =
    CONTENT_REWARD_KEYS[row.name] ?? CONTENT_REWARD_KEYS[baseName];
  const fallback = contentRewardBaseName(row.name)
    .replace(/^The\s+/i, "")
    .replace(/,.*/, "")
    .trim();
  const key = explicit ?? fallback;
  const keyLower = key.toLocaleLowerCase();
  const stem = packageStem(keyLower);
  const hasExplicit = Boolean(explicit);

  const matches = upgrades
    .map((candidate) => {
      const name = cleanRewardText(candidate.name);
      const detail = cleanRewardText(candidate.detail ?? "");
      const nameLower = name.toLocaleLowerCase();
      if (!detail) return null;

      let rank = matchRank(nameLower, keyLower);
      // Sibling packages under same boss stem (Raksha ability + boots).
      if (rank === 0 && isSiblingPackage(nameLower, stem)) {
        // With an explicit key, allow stem siblings; without, only package-shaped names.
        rank = hasExplicit ? 25 : 15;
      }
      // Fallback: try synthetic package suffixes when no explicit map.
      if (rank === 0 && !hasExplicit && fallback.length >= 4) {
        for (const suffix of [" progression", " uniques", " equipment", " upgrades"]) {
          const synth = `${fallback.toLocaleLowerCase()}${suffix}`;
          const r = matchRank(nameLower, synth);
          if (r > rank) rank = Math.min(r, 55);
        }
      }
      if (rank === 0) return null;

      let score = upgradeListScore(name, detail) + rank;
      // Explicit CONTENT_REWARD_KEYS / exact prefix beats residual stem hits.
      if (rank >= 70) {
        /* prefix / exact already strong */
      } else if (rank <= 25) {
        score -= 15; // stem-only / synthetic
      }
      // Never let residual prose win when Unlocks packages exist for the same stem.
      if (/densify|residual|thin hub|working taxonomy/i.test(detail) && rank < 70) {
        score -= 40;
      }
      return { name, detail, score, rank };
    })
    .filter(
      (x): x is { name: string; detail: string; score: number; rank: number } => x != null,
    )
    .sort((a, b) => b.score - a.score);

  if (matches.length) {
    // Prefer the highest-scoring package (short comma unique lists / Unlocks:).
    // Only merge sibling packages that are also list-like (Raksha ability + boots),
    // never residual prose rows — those pollute Effects extraction.
    const best = matches[0]!;
    // Drop low-quality sole hits that are residual essays with no list shape.
    if (
      best.score < 20 &&
      !/unlocks:/i.test(best.detail) &&
      (best.detail.match(/,/g) ?? []).length < 1
    ) {
      // fall through to row.detail
    } else {
      const picked: typeof matches = [best];
      for (const m of matches.slice(1)) {
        if (picked.length >= 3) break;
        const mName = m.name.toLocaleLowerCase();
        const sibling = isSiblingPackage(mName, stem);
        // Explicit-key bonus can put the primary package ~100pts above siblings
        // (Raksha ability vs boots) — still merge list-like stem siblings.
        if (m.score < 35) continue;
        if (!sibling && m.score < best.score - 20) continue;
        if (sibling && m.score < 40) continue;
        if (!mName.startsWith(stem) && m.rank < 45) continue;
        if ((m.detail.match(/,/g) ?? []).length < 1 && !/unlocks:/i.test(m.detail)) {
          continue;
        }
        if (/densify|residual|thin hub|working misthalin|working taxonomy/i.test(m.detail)) {
          continue;
        }
        picked.push(m);
      }
      // Normalize each package separately (Unlocks > Effects), then join pure lists.
      const lists: string[] = [];
      const seen = new Set<string>();
      for (const m of picked) {
        const src = contentRewardsSource(m.detail);
        if (!src || src === "—") continue;
        const sig = src.toLocaleLowerCase();
        if (seen.has(sig)) continue;
        seen.add(sig);
        lists.push(src);
      }
      if (lists.length) return withRewardAppend(row.name, lists.join(", "));
    }
  }

  const detail = cleanRewardText(row.detail ?? "");
  if (detail && !/(?:working league mapping|catalyst|unannounced|locality boundary)/i.test(detail)) {
    return withRewardAppend(row.name, detail);
  }
  return withRewardAppend(row.name, "—");
}

function withRewardAppend(rowName: string, base: string): string {
  const extra =
    CONTENT_REWARD_APPEND[rowName] ??
    CONTENT_REWARD_APPEND[contentRewardBaseName(rowName)];
  if (!extra) return base;
  if (!base || base === "—") return extra;
  // Dedupe tokens already present in the primary list.
  const have = new Set(
    base
      .toLowerCase()
      .split(/\s*[,;·]\s*/)
      .map((t) => t.trim())
      .filter(Boolean),
  );
  const add = extra
    .split(/\s*,\s*/)
    .map((t) => t.trim())
    .filter((t) => t && !have.has(t.toLowerCase()));
  if (!add.length) return base;
  return `${base}, ${add.join(", ")}`;
}

/**
 * Parent rows that own multi-boss unique packages (Sanctum, EGWD fronts…).
 * Place hubs (Lost Grove, City of Um) must NOT collapse their boss (Solak, Rasial).
 */
export function isMajorCollapseParent(parent: {
  name: string;
  kind?: string | null;
}): boolean {
  const k = `${parent.kind ?? ""} ${parent.name}`.toLowerCase();
  return (
    /\bboss(?:es|ing)?\b/.test(k) ||
    /\bdungeon\b/.test(k) ||
    /\bsanctum\b/.test(k) ||
    /\bgate of\b/.test(k) ||
    /\bgod wars\b/.test(k) ||
    /\belite dungeon\b/.test(k) ||
    /\bundercity\b/.test(k) ||
    /\bzamorakian\b/.test(k) ||
    /\bfront\b/.test(k)
  );
}

/**
 * Major unlocks list: hide sub-boss children of multi-boss packages that share
 * the same unique list (Vermyx under Sanctum). Keeps Solak under Tirannwn —
 * kind "The Lost Grove" must not hide the boss behind a place hub.
 */
export function majorContentRows<T extends { name: string; kind?: string | null }>(
  content: readonly T[],
  upgrades: readonly RewardUpgrade[],
): T[] {
  return content.filter(
    (row) =>
      !content.some((parent) => {
        if (parent === row) return false;
        if (!isMajorCollapseParent(parent)) return false;
        if (
          cleanRewardText(parent.name).toLowerCase() !==
          cleanRewardText(String(row.kind ?? "")).toLowerCase()
        ) {
          return false;
        }
        return (
          contentRewardsFull(parent, upgrades) === contentRewardsFull(row, upgrades)
        );
      }),
  );
}
