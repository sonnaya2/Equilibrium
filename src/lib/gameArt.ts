/**
 * Conventional paths to web-served game art. Art lands in public/game/<category>/
 * via scripts/publish-assets.mjs from the attributed assets/ manifest.
 */
import {
  ACTIVITY_ICON_BY_SLUG,
  BLESSING_ICON_SLUGS,
  BOSS_ICON_EXT,
  BOSS_ICON_SLUGS,
  EQUIPMENT_ICON_SLUGS,
  RELIC_ICON_SLUGS,
  SKILL_ICON_SLUGS,
  UPGRADE_ICON_BY_SLUG,
} from "./dataIconIndex";
import { decodeHtmlEntities } from "./htmlEntities";

/** Slugs with a verified local equipment inventory icon (no 404 wells). */
const EQUIPMENT_OK = EQUIPMENT_ICON_SLUGS;

export function gameIconPath(category: string, name: string): string {
  return `/game/${category}/${name}.webp`;
}

export const STYLE_ICON = {
  melee: "melee-abilities",
  ranged: "ranged-abilities",
  magic: "magic-abilities",
  necromancy: "necromancy-abilities",
} as const;

export const styleIconPath = (style: keyof typeof STYLE_ICON) =>
  gameIconPath("combat", STYLE_ICON[style]);

export const regionCrestPath = (regionId: string) => gameIconPath("regions", regionId);

/** Wiki World Map icon - global / multi-region task crest (CC BY-NC-SA 3.0). */
export const worldMapIconPath = () => "/game/leagues/world-map-icon.webp";

/**
 * Local equipment inventory icons (synced from the wiki, never hotlinked).
 * Path: public/game/combat/equipment/<id-without-item-prefix>.webp
 * Only returns a path when the slug is on disk (EQUIPMENT_ICON_SLUGS from art:index).
 */
export function equipmentIconPath(equipmentId: string): string | null {
  const slug = equipmentId.replace(/^(?:item|equipment|cross-region):/, "");
  const resolvedSlug = DATA_ICON_ALIASES[slug] ?? slug;
  if (!EQUIPMENT_OK.has(resolvedSlug)) return null;
  return `/game/combat/equipment/${resolvedSlug}.webp`;
}

/** Equipment-variant ability ids share base art (death-skulls.webp, not death-skulls-igneous.webp). */
const ABILITY_ICON_VARIANT_SUFFIX = /[_-]igneous$/i;

/**
 * Form suffixes that share the parent plate when a dedicated file is absent.
 * adaptive_strike_mh -> adaptive-strike.webp (2h/dw keep dedicated plates).
 */
const ABILITY_ICON_FORM_FALLBACK: Record<string, string> = {
  "adaptive-strike-mh": "adaptive-strike",
  // Engine id instability_lightning_surge → lightning-surge.webp (keyed Instability status art).
  "instability-lightning-surge": "lightning-surge",
};

/** Weapon specials use the native weapon icon in the ability palette. */
const WEAPON_SPECIAL_ICON_EQUIPMENT: Record<string, string> = {
  balance_by_force: "item:bow-of-the-last-guardian",
  claws_of_guthix: "item:guthix-staff",
  death_grasp: "item:death-guard-tier-70",
  igneous_showdown: "item:ek-zekkil",
  instability: "item:fractured-staff-of-armadyl",
  icy_tempest: "item:dark-shard-of-leng",
  ode_to_deceit: "item:ode-to-deceit",
  ode_of_devourer: "item:ode-to-deceit",
  // Roar of Awakening special (was wrongly wild-magic plate).
  soulfire: "item:roar-of-awakening",
};

/** Shared constitution-bar abilities live under abilities/constitution/. */
const CONSTITUTION_ABILITY_IDS = new Set(["sacrifice", "tuskas_wrath"]);
const DEFENCE_ABILITY_IDS = new Set(["bash", "preparation", "revenge", "debilitate"]);

/**
 * Local ability icons (synced from the wiki, never hotlinked).
 * Path: public/game/combat/abilities/<style>/<id-with-underscores-as-hyphens>.webp
 * Record ids may be `shared:sacrifice`; engine ids use underscores. Constitution
 * abilities ignore the bar style folder so Revo graphics hit public files.
 */
export function abilityIconPath(
  abilityId: string,
  style: keyof typeof STYLE_ICON | string,
): string {
  const bare = abilityId.includes(":") ? abilityId.slice(abilityId.indexOf(":") + 1) : abilityId;
  const withoutVariant = bare.replace(ABILITY_ICON_VARIANT_SUFFIX, "").toLowerCase();
  const weaponIcon = WEAPON_SPECIAL_ICON_EQUIPMENT[withoutVariant];
  if (weaponIcon) {
    const path = equipmentIconPath(weaponIcon);
    if (path) return path;
  }
  const lookupId = withoutVariant.replace(/-/g, "_");
  let slug = withoutVariant.replace(/_/g, "-");
  slug = ABILITY_ICON_FORM_FALLBACK[slug] ?? slug;
  const folder = DEFENCE_ABILITY_IDS.has(lookupId)
    ? "defence"
    : CONSTITUTION_ABILITY_IDS.has(lookupId) || style === "constitution"
      ? "constitution"
      : style in STYLE_ICON
        ? style
        : "melee";
  return `/game/combat/abilities/${folder}/${slug}.webp`;
}

/** Player-facing ability category chip. */
export function abilityCategoryLabel(
  category: "basic" | "enhanced" | "threshold" | "ultimate" | "utility" | string,
): string {
  return category;
}

// Data route resolvers - return null when unknown (prefer no icon over wrong).

/** Explicit name / label → published slug. Wrong icon is worse than none. */
const DATA_ICON_ALIASES: Record<string, string> = {
  "hydrix-bakriminel-bolts-e": "hydra-bakriminel-bolts-e",
  "abandoned mine salve shard mining": "salve-amulet-e",
  "salve amulet (e)": "salve-amulet-e",
  "salve amulet e": "salve-amulet-e",
  "salve amulet": "salve-amulet-e",
  abyss: "abyss",
  "abyss access": "abyss",
  "abyss entrance": "abyss",
  "abyss runecrafting": "abyss",
  "abyss runecrafting stack": "abyss",
  abomination: "abomination",
  amascut: "amascut",
  "amascut, the devourer": "amascut",
  // Gem → inventory, never the boss plate.
  "amascut's enchanted gem": "enchanted-gem",
  "amascuts enchanted gem": "enchanted-gem",
  "enchanted gem": "enchanted-gem",
  "abyssal link (the subtle blade)": "abyssal-link",
  "abyssal scourge": "abyssal-scourge",
  "abyssal beasts": "abyssal-beasts",
  "abyssal lords": "abyssal-lords",
  "ripper demons": "ripper-demons",
  revenants: "revenants",
  "jaws of the abyss": "jaws-of-the-abyss",
  glacors: "glacors",
  "acheron mammoths": "acheron-mammoths",
  "ice strykewyrms": "ice-strykewyrm",
  "lava strykewyrms": "lava-strykewyrm",
  "green dragons": "green-dragons",
  "chaos tunnels": "chaos-tunnels",
  "lesser demons": "lesser-demons",
  "edgeville dungeon combat": "edgeville-resource-dungeons",
  "rogues' castle safes": "rogues-castle",
  "rogues castle safes": "rogues-castle",
  helwyr: "helwyr",
  gregorovic: "gregorovic",
  "abyssal wand and abyssal orb": "abyssal-wand",
  "accidental fletching and firemaking": "accidental-fletching",
  "achto raids armour (mazcab)": "acht-primeval-robe-top",
  "achto raids armour residual (mazcab)": "acht-primeval-robe-top",
  "advanced gnome stronghold course": "advanced-gnome-stronghold-course",
  "advanced barbarian outpost agility": "agile-top",
  "advanced barbarian outpost course": "agile-top",
  airuts: "airuts",
  airut: "airuts",
  "fishing frenzy": "deep-sea-fishing",
  "deep sea fishing hub": "deep-sea-fishing",

  "phoenix lair": "phoenix-lair",
  phoenix: "phoenix",
  "phoenix quills": "phoenix-quill",
  "phoenix quill": "phoenix-quill",
  "phoenix eggling": "phoenix",
  "phoenix familiar path": "phoenix-quill",
  "tuska's wrath ability codex": "tuskas-wrath",
  "tuska's wrath": "tuskas-wrath",
  "tuska mask": "tuska-mask",
  "warpriest of tuska armour": "warpriest-of-tuska",
  "warpriest of tuska": "warpriest-of-tuska",
  "razorback gauntlets": "razorback-gauntlets",

  "advanced gold accumulator": "advanced-gold-accumulator",
  "advanced smithing autoheater": "advanced-smithing-autoheater",
  "agile legs": "agile-legs",
  "agile bottom": "agile-legs",
  "agile top": "agile-top",
  "book of char": "the-book-of-char",
  "book of char / char firemaking": "the-book-of-char",
  "the book of char": "the-book-of-char",
  "char's training cave": "pitch-can",
  "chars training cave": "pitch-can",
  "char firemaking": "the-book-of-char",
  "double firemaking xp (daily)": "the-book-of-char",
  "pitch can": "pitch-can",
  "agility arena ticket exchange (pirate jackie)": "agility-arena-ticket-exchange",
  "agility pyramid (jaleustrophos)": "agility-pyramid",
  "agility pyramid": "agility-pyramid",
  "al kharid": "al-kharid",
  "alchemical hydrix (brooch of the gods craft)": "alchemical-hydrix",
  "alchemical onyx (gote / lotd craft)": "alchemical-onyx",
  "alchemiser / mk. ii (invention guild machine)": "alchemiser",
  "all fired up → inferno adze reward chain": "inferno-adze",
  "all fired up beacons (ring of fire / flame gloves)": "ring-of-fire",

  "altar of inanna": "altar-of-inanna",
  "altar of zaros (senntisten temple prayer switch)": "prayer-altar",
  "always adze (seed of the charyou tree)": "always-adze",
  "ambassador (ed3)": "ambassador",
  "ambassador residual uniques": "ambassador",
  "amlodd district divination and summoning hub": "amlodd-clan",
  "amlodd summoning and divination hub": "amlodd-clan",
  "amlodd voice of seren summoning efficiency": "voice-of-seren",
  "amulet of glory": "amulet-of-glory",
  "amulet of zealots": "amulet-of-zealots",
  "anachronia agility codex pages (double surge / double escape)": "double-surge",
  "anachronia agility course": "anachronia-agility-course",
  "anachronia base camp": "anachronia-base-camp",
  "anachronia base camp building-by-building permanents": "anachronia-base-camp",
  "anachronia base camp structure tier rewards": "anachronia-base-camp",
  "anachronia base-camp spa pools": "anachronia-base-camp",
  "anachronia codex lectern": "double-surge",
  "anachronia codex lectern (double surge/escape)": "double-surge",
  "anachronia codex lectern (double surge / double escape)": "double-surge",
  "roar of osseous": "roar-of-osseous",
  "anachronia big game hunter": "big-game-hunter",
  "anachronia dinosaur farm": "anachronia-dinosaur-farm",
  "dinosaur farm animal buyers": "anachronia-dinosaur-farm",
  "anachronia dinosaur farm elder animal perks": "anachronia-dinosaur-farm",
  "anachronia dinosaur farm farmers' market (beans)": "anachronia-dinosaur-farm",
  "anachronia dinosaur farm gathered produce": "anachronia-dinosaur-farm",
  "anachronia has no area tasks diary reward": "anachronia",
  "anachronia overgrown idols": "woodcutting",
  "anachronia overgrown idols (woodcutting)": "woodcutting",
  "anachronia player lodge progression": "player-lodge",
  "anachronia slayer lodge progression": "slayer-lodge",
  "anachronia totems": "anachronia-totems",
  "anachronia totems (permanent multi-skill buffs)": "totem-of-vitality",
  "ancient components discovery (classic / historic / vintage / timeworn)": "historic-components",
  "ancient curses (the temple at senntisten)": "prayer",
  "ancient enhanced tools (enhanced hammer-tron / pyro-matic / rod-o-matic)":
    "enhanced-hammer-tron",
  "ancient invention": "ancient-invention",
  "ancient invention blueprints (howl's workshop)": "ancient-invention",
  "ancient summoning binding contracts": "binding-contract",
  "ancient weapon / armour / tool gizmo shells": "weapon-gizmo-shell",
  "anima core armour (gwd2 t80 power)": "anima-core-body-of-zaros",
  "antipoison totem": "antipoison-totem",
  "apex hide → masterwork ranged craft path": "apex-hide-body",
  "apex hide armour": "apex-hide-body",
  "apex hide armor": "apex-hide-body",
  "apex hide set": "apex-hide-body",
  "apex hide cowl": "apex-hide-cowl",
  "apex hide body": "apex-hide-body",
  "apex hide chaps": "apex-hide-chaps",
  "apex hide vambraces": "apex-hide-vambraces",
  "apex hide boots": "apex-hide-boots",
  "apex hide": "apex-hide-body",
  "apex hides": "apex-hide-body",
  araxxi: "araxxi",
  araxxor: "araxxor",
  "arch glacor": "arch-glacor",
  "arch-glacor": "arch-glacor",
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
  "archaeology guildmaster qualification permanent rewards": "archaeology",
  "archaeology research system": "archaeology-research",
  "archaeology research team permanent (guildmaster)": "archaeology-research",
  "arctic pine woodcutting (neitiznot)": "arctic-pine",
  ardougne: "ardougne",
  "ardougne cloak (ourania rune output)": "ardougne-cloak-4",
  "ardougne cloak 1-4": "ardougne-cloak-4",
  "ardougne cloak 1–4": "ardougne-cloak-4",
  "ardougne farming patches and manor farm access geography": "manor-farm",
  "area tasks (achievement diaries) skilling overview": "area-tasks",
  "armadyl equipment": "armadyl-chestplate",
  "armadyl equipment (gwd1 ranged power ladder)": "armadyl-chestplate",
  "armoured hide barricade perk": "armoured-hide",
  "artisan's outfit": "artisans",
  "artisan's workshop": "artisans-workshop",
  "artisans' workshop": "artisans-workshop",
  "artisans' workshop burial equipment hub": "artisans-workshop",
  "artisans' workshop burial smithing": "artisans-workshop",
  "ascension crossbows": "ascension-crossbow",
  "asgarnia runecrafting altars (mind, body, law)": "mind-altar",

  "astral altar": "astral-altar",
  "astral altar (lunar isle)": "astral-altar",
  "asuran arsenal heist": "asuran-arsenal",
  "attuned crystal weapon family": "attuned-crystal-bow",
  "augmentable gather tools research (pickaxe / hatchet / mattock)": "dragon-pickaxe",
  "austin's place and ritualist's outfit": "austins-place",
  "auto disassembler / mk. ii (invention guild machine)": "auto-disassembler",
  "auto-burn woodcutting paths (superheat form vs always adze vs partial outfit/adze)":
    "always-adze",
  "auto-sanctifier (dwarven tech prayer device)": "auto-sanctifier",
  "auto-screener v1.080": "auto-screener-v1080",
  autoheater: "autoheater",
  "automatic / optimised hide tanner (invention guild)": "optimised-hide-tanner",
  "ava's device chain (attractor / accumulator / alerter)": "avas-alerter",
  "azure skillchompas (rellekka hunter area)": "azure-skillchompas",
  "bait and switch (evil bob's catspaw)": "bait-and-switch",
  "bait and switch + always adze dual monolith skilling paths": "bait-and-switch",
  "bake pie (lunar)": "bake-pie",
  "bandos equipment": "bandos-chestplate",
  "bandos equipment (gwd1 melee power ladder)": "bandos-chestplate",
  "bandit camp shops": "bloodweed-seed",
  "barbarian outpost": "barbarian-outpost",
  "barbarian outpost agility course": "barbarian-outpost-agility-course",
  // BA major plate: minigame art if present, else Outpost activity plate (not agility course).
  "barbarian assault": "barbarian-assault",
  "barbarian training (otto multi-skill package)": "barbarian-training",
  barrows: "barrows",
  "barrows: rise of the six": "barrows-rise-of-the-six",
  "zorgoth's ring": "zorgoths-ring",
  "zorgoth's soul ring": "zorgoths-soul-ring",
  "ungael ritual site": "ungael-ritual",
  // Linza the Disgraced major: official boss plate (not cuirass inventory icon).
  "linza the disgraced": "linza-the-disgraced",
  "linza's equipment": "linzas-cuirass",
  "linza's helm": "linzas-helm",
  "linza's cuirass": "linzas-cuirass",
  "linza's greaves": "linzas-greaves",
  "linza's hammer": "linzas-hammer",
  "linza's shield": "linzas-shield",
  "base juju potion family (herblore habitat)": "juju-farming",
  "berserker's fury relic chain": "berserkers-fury",
  "big chinchompa private hunting grounds": "big-chinchompa",
  "big game hunter": "big-game-hunter",
  "big game hunter permanent unlock package": "big-game-hunter",
  "binding contract (ancient summoning) craft + bind loop": "binding-contract",
  "bird house": "bird-house",
  "bird houses": "bird-house",
  birdhouses: "bird-house",
  "black chinchompas": "black-chinchompa",
  "black ibis outfit": "black-ibis-outfit",
  "black mask": "black-mask",
  "black salamanders (boneyard hunter)": "black-salamanders",
  "black salamanders": "black-salamanders",
  "black stone arrows": "black-stone-arrow",
  "black stone arrows residual": "black-stone-arrow",
  "black stone dragon": "black-stone-dragon",
  "blacksmith's outfit": "blacksmiths-outfit",
  "blade of leng": "blade-of-leng",
  // Anachronia magic boots inventory (not blast-fusion-hammer / imcando stand-in).
  "blast diffusion / enhanced blast diffusion boots": "blast-diffusion-boots",
  "blast diffusion boots": "blast-diffusion-boots",
  "blast diffusion": "blast-diffusion-boots",
  "blast furnace": "blast-furnace",
  "blast furnace (keldagrim)": "blast-furnace",
  "blast fusion hammer": "imcando-pickaxe",
  "blessing of het relic (eye of het ii)": "eye-of-het",
  "blightbound crossbows": "blightbound-crossbow",
  "blood altar": "blood-altar",
  "blood altar runecrafting": "blood-altar",
  bonecrusher: "bonecrusher",
  "bonecrusher + demon horn necklace prayer stack": "bonecrusher",
  "bonecrusher auto-pickup upgrade (waiko / boni)": "bonecrusher",
  // Permanent-unlocks slug serves the inventory mask (not a full-body plate).
  "botanist's outfit": "botanists-outfit",
  "botanists outfit": "botanists-outfit",
  "botanist's workbench": "botanists-workbench",
  "bow of the last guardian": "bow-of-the-last-guardian",
  "bow of the last guardian (bolg)": "bow-of-the-last-guardian",
  "brimhaven agility arena": "brimhaven-agility-arena",
  "bush patch network (kandarin core)": "bush-patch",
  "cadarn magic/ranged and max guild hub": "max-guild",
  "call of the sea replacement bonuses": "call-of-the-sea",
  "calquat farming patch (tai bwo wannai)": "calquat-tree",
  "calquat farming patch": "calquat-tree",
  "calquat tree patch (tai bwo wannai)": "calquat-tree-patch",
  "calquat tree patch": "calquat-tree-patch",
  "ardougne farming patches and manor farm": "manor-farm",
  "fruit tree patch hubs": "fruit-tree-patch",
  "fruit tree patch hubs (kandarin core)": "fruit-tree-patch",
  "fruit tree patch": "fruit-tree-patch",
  "camdozaal sacred forge (ramarno)": "sacred-forge",
  catherby: "catherby",
  "catherby fishing and farming hub": "catherby",
  "certificates of qualification (poh display permanents)": "certificates-of-qualification",
  "champion's tackle box": "champions-tackle-box",
  "channeler's ring": "channelers-ring",
  "channeller's ring": "channelers-ring",
  "chaos elemental": "chaos-elemental",
  "chaotic equipment": "chaotic-rapier",
  "chaotic weapons": "chaotic-rapier",
  "chaotic grimoire": "chaotic-grimoire",
  "chaotic melee and ranged weapons": "chaotic-rapier",
  "charming imp": "charming-imp",
  "charming moths": "charming-moths",
  "charming moths / highweald charm training": "charming-moths",
  "charming moths / highweald charms": "charming-moths",
  "charming potion": "charming-potion",
  "chronicle attraction (seren skilling prayer)": "chronicle-attraction",
  "chronicle fragment utility (post-dailyscape permanent rules)": "chronicle-fragment",
  "chronotes currency economy (earn + spend sinks)": "chronotes",
  "city of senntisten": "city-of-senntisten",
  "city of um": "city-of-um",
  "city of um / underworld": "city-of-um",
  "city of um mushroom patch": "farming",
  "city of um ritual site and focus storage": "um-ritual-site",
  "city of um soul forge (ensoul production hub)": "portable-forge",
  "classic tzhaar obsidian weapons": "tzhaar",
  "clockwork box traps": "clockwork-box-trap",
  "cobalt skillchompa tree gnome stronghold catch site": "cobalt-skillchompa",
  "combat scrimshaw pocket package (pop)": "scrimshaw-of-cruelty",
  "commander zilyana": "commander-zilyana",
  "conservation of energy relic chain": "conservation-of-energy",
  "construction contracts (estate agents)": "plank-box",
  "constructor's outfit": "constructors-outfit",
  "contraband yak produce (jatizso)": "yak-hide",
  "cooking dual-brewery network (keldagrim + phasmatys)": "port-phasmatys",
  "corporeal beast": "corporeal-beast",
  "corporeal beast holy-elixir / spirit shield path": "divine-spirit-shield",
  "corporeal beast holy-elixir supply": "holy-elixir",
  "corrupted / full multi-style slayer helmet (all components)": "corrupted-slayer-helmet",
  "corrupted ore smelting loop": "corrupted-ore",
  "corrupted seren stone cleansing (hefin cathedral)": "corrupted-seren-stone",
  "crafteneering (not tzhaar)": "crafteneering",
  "crafting guild": "crafting-guild",
  "creeping ivy": "creeping-ivy",
  "cremation ability unlock": "sunspear-melee",
  "crimson skillchompas": "crimson-skillchompas",
  "crimson skillchompas (desert quarry hunter site)": "crimson-skillchompas",
  "crocodile tears desert heat immunity": "crocodile-tears",
  "crwys district woodcutting and farming hub": "crwys-clan",
  "crwys farming and woodcutting hub": "crwys-clan",
  "cryptbloom armour": "cryptbloom-body",
  "cryptbloom armour (t90 magic tank)": "cryptbloom-body",
  "cryptbloom top": "cryptbloom-body",
  "crystal equipment and prifddinas skilling content": "prifddinas",
  "crystal hammer": "crystal-hammer",
  "crystal hatchet": "crystal-hatchet",
  "crystal mask (seren skilling spell)": "crystal-mask",
  "crystal mask + light form thieving stack": "crystal-mask",
  "crystal mattock": "crystal-mattock",
  "crystal pickaxe": "crystal-pickaxe",
  "crystal sandstone": "crystal-sandstone",
  "crystal sandstone and crystal flasks": "crystal-sandstone",
  "crystal skillchompas (isafdar catch + pof produce)": "crystal-skillchompas",
  "crystal teleport seed tirannwn travel network": "crystal-teleport-seed",
  "crystal tinderbox": "crystal-tinderbox",
  "crystal tool and harmonic dust infrastructure": "harmonic-dust",
  "crystal tool seed acquisition + re-enchant": "crystal-tool-seed",
  "crystal tool siphon blueprint (waiko permanent)": "crystal-tool-siphon-blueprint",
  "crystal tools (dragon base + prifddinas conversion)": "crystal-pickaxe",
  "crystal tree farming (crystal acorns)": "crystal-tree",
  "crystal utility tools (chisel, knife, saw, binding rod)": "crystal-chisel",
  "crystallise (seren skilling spell)": "crystallise",
  "curly roots firemaking ceiling stack (jadinko + all fired up gear)": "curly-root",
  "custom-fit trimmed masterwork (elof / master crafter)": "trimmed-masterwork-platebody",
  // Peninsula / castle activity art only for pure DG floor labels - dig site majors use dig-site icon.
  daemonheim: "daemonheim-dig-site",
  "daemonheim area tasks passive rewards": "daemonheim",
  "daemonheim dig site": "daemonheim-dig-site",
  "misthalin wisp colonies": "divination",
  "wisps near draynor": "divination",
  "pale wisps near draynor": "divination",
  "varrock palace tree patch": "varrock-palace-tree-patch",
  "varrock tree patch": "varrock-palace-tree-patch",
  "tree patch": "tree-patch",
  "lumbridge hops patch": "lumbridge-hops-patch",
  "hops patch": "hops-patch",
  "draynor willow trees": "draynor-willow-trees",
  "draynor willows": "draynor-willow-trees",
  "um mushroom patch": "farming",
  "daemonheim dig site (dragonkin mini-site)": "daemonheim-dig-site",
  "daemonheim dungeoneering floors": "daemonheim",
  "daemonheim peninsula resource island": "daemonheim-peninsula",
  "daemonheim rewards shop (marmaros)": "daemonheim-rewards",
  "daemonheim rewards shop": "daemonheim-rewards",
  "daemonheim rewards": "daemonheim-rewards",
  "daemonheim divination": "daemonheim",
  "dark facets": "dark-onyx-core",
  "ice strykewyrm": "ice-strykewyrm",
  "lava strykewyrm": "lava-strykewyrm",
  soulgazers: "soulgazer",
  soulgazer: "soulgazer",
  "wilderness strykewyrms": "lava-strykewyrm",
  "bloodwood logs": "bloodwood-logs",
  "brawling gloves": "brawling-gloves-melee",
  "melee brawling gloves": "brawling-gloves-melee",
  "ranged brawling gloves": "brawling-gloves-ranged",
  "magic brawling gloves": "brawling-gloves-magic",
  "agility brawling gloves": "brawling-gloves-agility",
  "cooking brawling gloves": "brawling-gloves-cooking",
  "firemaking brawling gloves": "brawling-gloves-firemaking",
  "fishing brawling gloves": "brawling-gloves-fishing",
  "hunter brawling gloves": "brawling-gloves-hunter",
  "mining brawling gloves": "brawling-gloves-mining",
  "prayer brawling gloves": "brawling-gloves-prayer",
  "smithing brawling gloves": "brawling-gloves-smithing",
  "thieving brawling gloves": "brawling-gloves-thieving",
  "woodcutting brawling gloves": "brawling-gloves-woodcutting",
  "brawling gloves (melee)": "brawling-gloves-melee",
  "brawling gloves (ranged)": "brawling-gloves-ranged",
  "brawling gloves (magic)": "brawling-gloves-magic",
  "brawling gloves (agility)": "brawling-gloves-agility",
  "brawling gloves (cooking)": "brawling-gloves-cooking",
  "brawling gloves (firemaking)": "brawling-gloves-firemaking",
  "brawling gloves (fishing)": "brawling-gloves-fishing",
  "brawling gloves (hunter)": "brawling-gloves-hunter",
  "brawling gloves (mining)": "brawling-gloves-mining",
  "brawling gloves (prayer)": "brawling-gloves-prayer",
  "brawling gloves (smithing)": "brawling-gloves-smithing",
  "brawling gloves (thieving)": "brawling-gloves-thieving",
  "brawling gloves (woodcutting)": "brawling-gloves-woodcutting",
  "balarak's sash brush": "balaraks-sash-brush",
  "skeka's hypnowand": "skekas-hypnowand",
  "ruinous weapons": "ruinous-rapier",
  "daemonheim skilling reward infrastructure": "daemonheim-rewards",
  "dagannoth kings": "dagannoth-kings",
  "dalia's tree nursery eternal magic plots": "dalias-tree-nursery",
  "eternal magic trees": "eternal-magic-trees",
  "eternal magic tree": "eternal-magic-trees",
  "eternal magic logs": "eternal-magic-logs",
  "eternal magic log": "eternal-magic-logs",
  "eternal magic planks": "plank",
  "eternal planks": "plank",
  "dark facet of grace": "dark-facet-of-grace",
  "dark facet of luck": "dark-facet-of-luck",
  "dark facet of passage": "dark-facet-of-passage",
  "dark facet of grace (gote enchantment)": "dark-facet-of-grace",
  "dark facet of luck (tier-4 luck account permanent)": "dark-facet-of-luck",
  "dark facet of passage (passage of the abyss infinite charges)": "dark-facet-of-passage",
  "dark onyx core": "dark-onyx-core",
  "dark ice -> dark shard/sliver of leng": "dark-shard-of-leng",
  "dark ice → dark shard/sliver of leng": "dark-shard-of-leng",
  "dark onyx core source package": "dark-onyx-core",
  darkmeyer: "darkmeyer",
  "darkmeyer thieving": "ring-of-vitur",
  "deadliest catch skilling deposit boxes": "deadliest-catch",
  "death altar (temple of light runecrafting)": "death-altar",
  "death guard and skull lantern progression": "deathguard",
  "death guard and skull lantern residual progression": "deathguard",
  "death lotus equipment": "death-lotus-chestplate",
  "death note relic power": "death-note",
  "death ward relic chain": "death-ward",
  "deathdealer robe armour (necro power residual)": "deathdealer-robe-top",
  "deathdealer robe armour (necro power)": "deathdealer-robe-top",
  "deathless (koschei's death egg)": "deathless",
  "deathwarden / deathdealer armour": "deathdealer-robe-top",
  "deathwarden / deathdealer armour residual": "deathdealer-robe-top",
  "deathwarden robe armour": "deathwarden-robe-top",
  "deathwarden robe armour (necro tank residual)": "deathwarden-robe-top",
  "deathwarden robe armour (necro tank)": "deathwarden-robe-top",
  "decorated and exquisite urn craft (morytania)": "decorated-fishing-urn",
  "decorated and exquisite urn craft infrastructure": "exquisite-fishing-urn",
  "deep sea fishing": "deep-sea-fishing",
  "deep sea fishing hub methods": "deep-sea-fishing",
  "deep sea fishing hub methods and boosts": "deep-sea-fishing",
  "demon, dragon and undead slayer ability codices": "demon-slayer",
  "demonic skull (removed)": "demonic-skull",
  "deployable herb burner": "deployable-herb-burner",
  "desert amulet": "desert-amulet",
  "desert amulet 1-4": "desert-amulet-4",
  "desert amulet 1–4": "desert-amulet-4",
  "desert cactus farming patches": "cactus",
  "desert treasure": "desert-treasure",
  "dig site pendant": "dig-site-pendant",
  "dinosaur and plant slayer (laniakea / anachronia)": "laniakea",
  dive: "dive",
  "divine charge crafting loop (energy → charge pack / machines / gote fuel)": "divine-charge",
  "divine conversion (cres framework)": "divine-conversion",
  "divine rage prayer codex": "divine-rage-prayer-codex",
  "divine-o-matic vacuum": "divine-o-matic-vacuum",
  "diviner's outfit": "diviners-headwear",
  "dominion tower": "dominion-tower",
  "double escape": "double-escape",
  "double surge": "double-surge",
  "dracolich armour": "dracolich-hauberk",
  "dracolich armour (t90 ranged bow power)": "dracolich-hauberk",
  "draconic energy magic": "draconic-energy",
  "draconic energy magic residual": "draconic-energy",
  "dragon claws": "superior-dragon-claws",
  "dragon claws residual": "superior-dragon-claws",
  "dragon hatchet": "dragon-hatchet",
  "dragon mattock": "dragon-mattock",
  "dragon mattock (ancient caskets — general)": "dragon-mattock",
  "dragon mattock (big game hunter / ancient casket)": "dragon-mattock",
  "dragon pickaxe": "dragon-pickaxe",
  "dragon pickaxe (chaos battlefield / chaos giants)": "dragon-pickaxe",
  "dragon pickaxe (chaos dwarf battlefield / chaos giants)": "dragon-pickaxe",
  "dragonfire defender": "dragon-defender",
  // ED2 Major unlocks Name well: final boss plate (not dungeon scenery).
  "dragonkin laboratory": "black-stone-dragon",
  "dragonkin laboratory (ed2)": "black-stone-dragon",
  "dragonkin laboratory greater melee codices": "black-stone-dragon",
  "dragonkin laboratory upgrades": "black-stone-dragon",
  // GWD2 hub row - use a general from the dungeon family (no single "heart" plate).
  "heart of gielinor": "vindicta-gorvek",
  "heart of gielinor / god wars dungeon 2": "vindicta-gorvek",
  "god wars dungeon 2": "vindicta-gorvek",
  "dragonkin potion recipe fragments (orthen)": "orthen-dig-site",
  "draynor village skilling hub": "draynor-village",
  dreadnip: "dreadnip",
  dreadnips: "dreadnip",
  "dream mentor": "dream-mentor",
  "dream of iaia": "dream-of-iaia",
  "advance time": "dream-of-iaia",
  "drygore weapon set": "drygore-mace",
  "drygore weaponry": "drygore-weapons",
  "drygore weapons": "drygore-weapons",
  "dundee's crocodile upgrades": "dundees-crocodile-upgrades",
  "dwarven army axe": "dwarven-army-axe",
  "dwarven traders": "keldagrim",
  "eastfold farm (sheep and spinning)": "eastfold-farm",
  "eclipsed soul prayer codex": "eclipsed-soul-prayer-codex",
  ectofuntus: "ectofuntus",
  "ectofuntus and first age prayer outfit": "ectofuntus",
  "ectoplasmator (base)": "ectoplasmator",
  "effigy incubator": "effigy-incubator",
  "edgeville dungeon resource dungeons": "edgeville-dungeon",
  "edgeville resource dungeons": "edgeville-dungeon",
  "edgeville skilling and wilderness on-ramp hub": "edgeville",
  "ek-zekkil": "ek-zekkil",
  "ek-zekkil (zuk 2h melee)": "ek-zekkil",
  "elder divination outfit": "elder-divination-headwear",
  "elder divination outfit path (cache base + invention elite)": "elder-divination",
  "elder overload potion recipe (meilyr)": "elder-overload",
  "elder overload salve recipe (meilyr)": "elder-overload-salve-recipe",
  "elemental workshop": "elemental-workshop",
  "elite dracolich armour": "elite-dracolich-hauberk",
  "elite dracolich armour (t92 ranged bow power)": "elite-dracolich-hauberk",
  "elite fremennik combat rewards": "fremennik-sea-boots-4",
  "elite sirenic armour (t92 ranged power)": "elite-sirenic-hauberk",
  "elite tectonic robe armour": "elite-tectonic-robe-top",
  "elite tectonic robe armour (t92 magic power)": "elite-tectonic-robe-top",
  "elven clan worker pickpocketing": "elven-clan",
  "emberkeen / hailfire / flarefrost boots (t90 glacor upgrades)": "emberkeen-boots",
  "enhanced blast diffusion boots": "enhanced-blast-diffusion-boots",
  "empowered summoning obelisks": "summoning-obelisk",
  "empty divine charge + divine-o-matic manufacture": "empty-divine-charge",
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
  "eof hydrix component self-supply checklist": "uncut-hydrix",
  "equipment dissolver (permanent invention blueprint)": "equipment-dissolver",
  "equipment separator (recover gizmos intact)": "equipment-separator",
  "equipment siphon (item xp → invention xp loop)": "equipment-siphon",
  "essence of finality": "essence-of-finality",
  "essence of finality amulet": "essence-of-finality",
  "essence of finality amulet (neck bis chain)": "essence-of-finality",
  "essence of finality ornament kit (style bonus residual)": "essence-of-finality",
  "essence of finality ornament kit (style bonus)": "essence-of-finality",
  "essence of finality stored special attack": "essence-of-finality",
  "eternal birdhouse": "bird-house",
  "eternal magic birdhouse": "bird-house",
  "everlight archaeology": "everlight-dig-site",
  "everlight dig site": "everlight-dig-site",
  "everlight dig-site infrastructure": "everlight-dig-site",
  "explorer's ring 1-4": "explorers-ring-4",
  "explorer's ring 1–4": "explorers-ring-4",
  "explorer's ring 4": "explorers-ring-4",
  extinction: "extinction",
  "extreme invention potion boost path": "extreme-invention-potion",
  "extreme invention supply combo (guild + webbing + herblore)": "extreme-invention",
  "extreme prayer potion": "extreme-prayer-potion",
  // Permanent-unlocks slug serves the inventory mask (not a full-body plate).
  "factory outfit": "factory-outfit",
  "factory outfit (flash powder factory)": "factory-outfit",
  "falador farm": "falador-farm",
  "falador farm allotment / flower / herb patches": "falador-farm",
  "falador shield 1-4": "falador-shield-4",
  "falador shield 1–4": "falador-shield-4",
  "familiarisation triple-charm reward": "familiarisation",
  "family crest cooking and smelting gauntlets": "cooking-gauntlets",
  "fang of mohegan": "fang-of-mohegan",
  "farmer's market": "farmers-market",
  "farmer's outfit": "farmers-outfit",
  "farmers outfit": "farmers-outfit",
  "farmers market": "farmers-market",
  "farmers' market and master farmer outfit": "master-farmer",
  "feather of ma'at (shifting tombs supply)": "feather-of-maat",
  "fight cauldron obsidian armour": "obsidian-platebody",
  "fight cauldron obsidian armour progression": "obsidian-platebody",
  "obsidian armour": "obsidian-platebody",
  "fight kiln": "tokhaar-kal-ket",
  "fire cape": "fire-cape",
  "first age outfit": "first-age",
  "first age prayer outfit pieces": "first-age",
  "first necromancer equipment": "first-necromancer-robe-top",
  "first necromancer's equipment": "first-necromancer-robe-top",
  "first necromancer's equipment (rasial)": "first-necromancer-robe-top",
  // Piece names (wiki drop tables / set pages) → inventory equipment art
  "crown of the first necromancer": "first-necromancer-helm",
  "robe top of the first necromancer": "first-necromancer-body",
  "robe bottom of the first necromancer": "first-necromancer-legs",
  "hand wrap of the first necromancer": "first-necromancer-gloves",
  "foot wraps of the first necromancer": "first-necromancer-boots",
  "robes of the first necromancer set": "first-necromancer-body",
  "fish farming": "fish-farm",
  "fish flingers (isla anglerine d&d)": "fish-flingers",
  "fishing guild": "fishing-guild",
  "fishing guild membership and dsf access": "fishing-guild",
  "fishing outfit (fish flingers)": "fishing-outfit",
  "fishing rod-o-matic": "fishing-rod-o-matic",
  "fishing trawler (port khazard)": "fishing-trawler",
  "five-finger discount passive": "five-finger-discount",
  "flame gloves": "flame-gloves",
  "flash powder factory": "flash-powder-factory",
  "flash powder factory herblore outfits": "factory-outfit",
  "flash powder factory minigame and reward shop": "flash-powder-factory",
  "fletcher's outfit": "portable-fletcher",
  "flow state (soma)": "flow-state",
  "focus storage": "focus-storage",
  "focused siphoning passive": "focused-siphoning",
  "font of life relic (archaeology tutorial)": "font-of-life",
  "forinthry dungeon": "forinthry-dungeon",
  "karamja volcano resource dungeon": "karamja-volcano-resource-dungeon",
  "edimmu resource dungeon": "edimmu-resource-dungeon",
  "fort command centre global operations tier ladder densify": "fort-forinthry-command-centre",
  "fort forinthry": "fort-forinthry",
  "ham hideout pickpocketing and store rooms": "ham-hideout",
  "expansive essence pouch (70 essence, non-degrading)": "expansive-essence-pouch",
  "expansive essence pouch": "expansive-essence-pouch",
  "fort forinthry botanist's workbench": "botanists-workbench",
  "fort forinthry chapel": "fort-forinthry-chapel",
  "fort forinthry command centre": "fort-forinthry-command-centre",
  "fort forinthry construction and slayer hub": "fort-forinthry",
  "fort forinthry eternal reinforcement (105 construction training)": "fort-forinthry",
  "fort forinthry guardhouse": "fort-forinthry-guardhouse",
  "fort forinthry guardhouse and raptor slayer hub": "fort-forinthry-guardhouse",
  "fort guardhouse": "fort-forinthry-guardhouse",
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
  "fort town hall": "fort-forinthry-town-hall",
  "fort town hall rested xp conversion densify (aster)": "fort-forinthry-town-hall",
  "fort workshop invention remote management and power capacity": "fort-forinthry",
  "fractured staff of armadyl": "fractured-staff-of-armadyl",
  "fractured staff of armadyl components": "fractured-staff-of-armadyl",
  "fremennik sea boots": "fremennik-sea-boots",
  "fremennik sea boots 1-4": "fremennik-sea-boots-4",
  "fury of the small": "fury-of-the-small",
  "fury of the small relic chain": "fury-of-the-small",
  "fury shark outfit (elite fishing)": "fury-shark-outfit",
  "fuse rings to full slayer helmet": "full-slayer-helmet",
  "games necklace teleport package": "games-necklace",
  "garden of kharid": "farmers-outfit",
  "garden of kharid and sydekix's shop of balance": "farmers-outfit",
  "gate of elidinis": "gate-of-elidinis",
  "gem bag progression": "gem-bag",
  "gemstone armour": "gemstone-hauberk",
  "gemstone cavern (shilo underground)": "gemstone-cavern",
  "gemstone golem outfit": "gemstone-golem-outfit",
  "general graardor": "general-graardor",
  "ghostly sole": "ghostly-sole",
  "ghostly sole fishing": "ghostly-sole",
  "giant crayfish fishing": "raw-giant-crayfish",
  "giant crayfish fishing and cooking": "raw-giant-crayfish",
  "giant mole": "giant-mole",
  "giant oyster monthly d&d": "giant-oyster",
  "gizmo shells (weapon / armour / tool + ancient)": "weapon-gizmo-shell",
  "gleaming wisp colony": "gleaming-wisp-colony",
  "gnome glider transportation network": "gnome-glider",
  "gnome restaurant": "gnome-restaurant",
  "gnome restaurant and sous chef's outfit": "gnome-restaurant",
  "gnome stronghold agility course (basic + advanced)": "gnome-stronghold-agility-course",
  "god books base unlock (horror from the deep + pages)": "god-books",
  "god books base unlock (horror from the deep)": "god-books",
  "god wars dungeon": "god-wars-dungeon",
  "god wars dungeon 1": "god-wars-dungeon",
  "god wars dungeon 1 (+ nex)": "god-wars-dungeon",
  "god wars dungeon 1 equipment": "god-wars-dungeon-1-equipment",
  "god wars dungeon 2 (heart of gielinor)": "vindicta-gorvek",
  "god wars dungeon 2 weapon and anima-core progression": "anima-core-body-of-zaros",
  "godswords (gwd1 hilt + shard assembly)": "godswords",
  "gold accumulator": "gold-accumulator",
  "golden touch and unsullied": "golden-touch",
  "golem outfits": "gemstone-golem-outfit",
  "gote + dark facet of grace + ancient elven ritual shard sustain": "grace-of-the-elves",
  "gote gather + porter sustain checklist": "grace-of-the-elves",
  "glacor boots": "steadfast-boots",

  "greenfingers passive": "greenfingers",
  "grove wood-spirit / nest / geode wood-box storage": "wood-box",
  "guildmaster tony": "guildmaster-tony",
  "guildmaster tony's mattock": "guildmaster-tonys-mattock",
  "guthix staff": "guthix-staff",
  "guthix staff and claws of guthix access": "guthix-staff",
  "gwd2 anima core and mid-tier melee/ranged weapons": "anima-core-body-of-zaros",
  "h.a.m hideout": "ham-hideout",
  "h.a.m. hideout": "ham-hideout",
  "h.a.m. hideout pickpocketing and store rooms": "ham-hideout",
  "hall of memories": "hall-of-memories",
  "hall of memories divination training": "hall-of-memories",
  "ham hideout": "ham-hideout",
  "ham-hideout": "ham-hideout",
  "hammer-tron": "hammer-tron",
  "har-aken": "har-aken",
  "hard desert keris upgrade": "keris",
  "hardwood grove": "woodcutting",
  "hardwood grove teaks and mahoganies": "woodcutting",
  "harmonic dust economy (harps + ithell thieving)": "harmonic-dust",
  "harmony pillars (meilyr harmony moss)": "harmony-moss",
  "harmony moss": "harmony-moss",
  "hatchet of bloom and blight": "hatchet-of-bloom-and-blight",
  "hatchet of ember and glade": "hatchet-of-ember-and-glade",
  "hatchet progression checklist (dragon → imcando → crystal → ember and glade → bloom and blight)":
    "hatchet-of-ember-and-glade",
  // Prefer apex hide body inventory over activity plate for the major face.
  "havenhythe big game hunter": "apex-hide-body",
  "havenhythe birdhouses": "bird-house",
  "havenhythe canoe network": "canoe-station-havenhythe",
  "havenhythe empowered summoning obelisks (spirit plane connection)": "summoning-obelisk",
  "havenhythe has no area tasks diary reward": "havenhythe-has",
  "havenhythe hunter 110 progression": "hunter-cape",
  "havenhythe open-water fishing spots (beyond fish farm)": "raw-sailfish",
  // Outfit art (inventory) - course plates are fenced as scenery → skill glyph.
  "hefin agility course": "prifddinian-workers-outfit",
  "hefin agility": "prifddinian-workers-outfit",
  "hefin district agility and prayer hub": "hefin-clan",
  "hefin serenity posts (afk agility)": "serenity-posts",
  "hefin serenity posts": "serenity-posts",
  grenwalls: "grenwalls",
  grenwall: "grenwalls",
  "ancient elven ritual shard": "ancient-elven-ritual-shard",

  "crystal tools": "crystal-pickaxe",
  "crystal skillchompas": "crystal-skillchompas",
  "perfect juju potions": "perfect-juju",
  "skillcape shop": "skillcape-rack",
  "heightened senses relic chain": "heightened-senses",
  "herb bag progression": "herb-bag",

  "herb protector (invention farming device)": "herb-protector",
  herbicide: "herbicide",
  "herblore habitat": "herblore-habitat",
  "herby werby": "herby-werby",
  "herby werby / ranch out of time": "herby-werby",
  "herby werby herb bag skilling unlock": "herby-werby",
  hermod: "hermod",
  "hermod, the spirit of war": "hermod",
  "desert strykewyrm": "desert-strykewyrm",
  "het's oasis": "hets-oasis",
  "het's oasis agility course": "hets-oasis-agility-course",
  "het's oasis farming (flower bushes, cactus, honeycombs)": "hets-oasis",
  "het's oasis whirligigs and prayer powder production": "hets-oasis",
  "hets oasis": "hets-oasis",
  hexcrest: "hexcrest",
  "highweald / deserted mine mining access": "highweald",
  "highweald ruins mine (necrite / phasmatite / platinum / havensilver)": "highweald-ruins-mine",
  "necrite rocks, phasmatite rocks, platinum rocks and havensilver rock": "highweald-ruins-mine",
  "uncommon gem rocks": "wendlewick-deserted-mine",
  "hireable research team recruitment ladder": "archaeology-research",
  "hoardstalker ring": "hoardstalker-ring",
  "holy elixir supply": "holy-elixir",
  "holy overload potion": "holy-overload-potion",
  "holy scarab familiar": "holy-scarab-familiar",
  "hops patch network (entrana + run geography)": "hops-seed",
  "humidify (lunar)": "humidify",
  "hunter mark shop (irwinsson)": "quick-traps",
  "hunter's outfit": "hunters-outfit",
  "igneous cape progression": "igneous-kal-zuk",
  "imcando hatchet": "imcando-hatchet",
  "imcando mattock": "imcando-mattock",
  "imcando pickaxe": "imcando-pickaxe",
  "imcando pickaxe (lava flow mine / birthright path)": "imcando-pickaxe",
  "imcando tools family (pickaxe, hatchet, related craft pressure)": "imcando-pickaxe",
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
  "invention guild generators (simple / large / jumbo)": "simple-generator",
  "invention guild named machine room": "invention-guild",
  "invention machines (invention guild + fort workshop power)": "invention-machines",
  "invention skilling accumulators (mining / fishing / woodcutting)": "mining-accumulator",

  "invention skilling tools (hammer-tron / pyro-matic / fishing rod-o-matic)": "hammer-tron",
  "iorwerth slayer and utility district": "iorwerth-clan",
  "it belongs in a museum! (velucia meta collection log)": "velucia-museum",
  "ithell crystal singing bowl (tools, armour, weapons)": "ithell-clan",
  "ithell district crafting and construction hub": "ithell-clan",
  "ithell harmonium harps (harmonic dust)": "harmonium",
  "ithell harps": "harmonium",
  "ivar uniques": "ivar-uniques",
  "ivar, king of bones": "ivar",
  "ivar, king of bones uniques": "ivar-uniques",
  "jackalope familiar (archaeology soil bob)": "jackalope-familiar",
  "jackalope familiar": "jackalope-familiar",
  "jackalope hunting (antler tertiary)": "jackalope",
  jackalopes: "jackalope",
  "jackalopes (bis early-mid hunter method)": "jackalope",
  "jackalopes (bis early–mid hunter method)": "jackalope",
  "jadinko favour offering stone": "jadinko-favour",
  "jadinko lair": "jadinko-lair",
  "jadinko lair curly roots": "curly-root",
  "jatizso dungeon mine": "jatizso-dungeon-mine",
  "juju and perfect juju potions": "juju-farming",
  "juju farming potion": "juju-farming",
  "juju farming potion path (herblore habitat)": "juju-farming",
  "junk chance reduction research (ranks 1-9)": "junk-chance",
  "junk chance reduction research (ranks 1–9)": "junk-chance",
  "junk refiner (junk → refined components)": "junk-refiner",
  "k'ril tsutsaroth": "kril-tsutsaroth",
  "kalphite king": "kalphite-king",
  "kalphite queen": "kalphite-queen",
  "karambwan vessel fishing": "karambwan-vessel",
  "karamja gloves 1-4": "karamja-gloves-4",
  "karamja gloves skilling perks": "karamja-gloves-4",
  "karamja overgrown idols (gara-dul)": "overgrown-idol",
  "karamja overgrown idols": "overgrown-idol",
  "keldagrim brewery (laughing miner pub)": "laughing-miner-pub",
  "keldagrim dwarven hub": "keldagrim",
  "keldagrim dwarven traders": "keldagrim",
  "keldagrim dwarven traders and multi-step chests": "keldagrim",
  "kerapac the bound": "kerapac",
  "kerapac, the bound": "kerapac",
  "leng gloves": "leng-artefact",
  "leng artefact t90 glove upgrades (shared arch-glacor)": "leng-artefact",
  "enhanced kerapac's wrist wraps (t90 magic)": "enhanced-kerapacs-wrist-wraps",
  "enhanced kerapac's wrist wraps": "enhanced-kerapacs-wrist-wraps",
  "kezalam, the wanderer": "kezalam",
  "kharid-et dig site": "kharid-et-dig-site",
  "kharid-et dig-site progression": "kharid-et-dig-site",
  "king black dragon": "king-black-dragon",
  "king of beasts bomb-conservation perk": "king-of-beasts",
  "kree'arra": "kreearra",
  kreearra: "kreearra",
  "kril tsutsaroth": "kril-tsutsaroth",
  // Kandarin Slayer master - chathead (activities/kuradal), not dungeon map / ring.
  "kuradal (ancient cavern slayer master)": "kuradal",
  kuradal: "kuradal",
  // Legacy hub label: reward-column ring only (row is now "Kuradal").
  "kuradal's dungeon and ferocious ring hub": "ferocious-ring",
  // Manor Farm major: PoF hub art (not farming skill glyph / fenced landscape).
  "manor farm": "manor-farm",
  "ferocious ring": "ferocious-ring",
  "manor farm animal perks": "nopenopenope",
  // Kandarin packaging for Freneskae access - World Gate scenery, not Nightmare boss plate.
  "freneskae via world gate": "world-gate",
  "world gate": "world-gate",
  "nightmare creatures": "nightmare",
  muspah: "muspah",
  "rune dragons": "rune-dragon",
  "rune dragon": "rune-dragon",
  "kwuarm incense sticks": "kwuarm-incense-sticks",
  laniakea: "laniakea",
  "laniakea (anachronia highest standard slayer master)": "laniakea",
  "laniakea's spear": "laniakeas-spear",
  "large summoning obelisk production network": "summoning-obelisk",
  "lava flow mine": "lava-flow-mine",
  "lava flow mine skilling unlocks": "lava-flow-mine",
  "lava geyser imcando fragment path": "lava-geyser",
  "learn broad arrow / bolt fletching (300 slayer points)": "full-slayer-helmet",
  "learn quicker killing blows (400 slayer points)": "full-slayer-helmet",
  "learn to move souls in personal slayer dungeon (1,000 slayer points)": "slayer-codex",
  "legends' guild totem jewellery recharge": "legends-guild",
  // Boss plate = official wiki Legio Primus (File:Legio_Primus.png). Never monastery exterior.
  legiones: "legiones",
  "legiones (monastery of ascension)": "legiones",
  "monastery of ascension": "legiones",
  "order of ascension": "legiones",
  "leng artefact": "leng-artefact",
  "liberation of mazcab (beastmaster durzag / yakamaru)": "liberation-of-mazcab",
  "liberation of mazcab": "liberation-of-mazcab",
  yakamaru: "yakamaru",
  "mazcab emergency merchants": "mazcab-emergency-merchants",
  "goebie scavengers": "goebie-scavengers",
  "sunken pyramid / player-owned slayer dungeon": "sunken-pyramid",
  "sunken pyramid": "sunken-pyramid",
  // Suit inventory (skilling-outfits), not the Liquid Gold Nymph NPC plate.
  "golden mining suit": "golden-mining-suit",
  "liquid gold nymph golden mining suit path": "golden-mining-suit",
  "livid farm": "livid-farm",
  "livid farm lunar spell unlocks": "livid-farm",
  "living rock caverns": "living-rock-caverns",
  lorehound: "lorehound",
  "lorehound (pet)": "lorehound",
  "lorehound pet": "lorehound",
  "lost grove": "lost-grove",
  "luck of the dwarves": "luck-of-the-dwarves",
  "luck of the dwarves (ring + archaeology relic power)": "luck-of-the-dwarves",
  "lumberjack outfit": "lumberjack-outfit",
  "lumberjack replacement hatchet bonuses": "dragon-hatchet",
  "lumbridge early skilling hub": "lumbridge",
  "lunar diplomacy": "lunar-diplomacy",
  "lunar farming utility spells": "lunar-spellbook",
  "lunar island": "lunar-isle",
  "lunar isle": "lunar-isle",
  "lunar isle skilling hub": "lunar-isle",
  "lunar spellbook and lunar utility": "lunar-spellbook",
  "lunar spellbook unlock": "lunar-spellbook",
  "mage arena": "mage-arena",
  "mage of zamorak": "mage-of-zamorak",
  "mage of zamorak (abyss entrance)": "mage-of-zamorak",
  "mage training arena (bones to peaches + reward shop)": "mage-training-arena",
  "mage training arena": "mage-training-arena",
  "magic cape": "magic-cape",
  "magic cape residual": "magic-cape",
  "magic axe hut chest": "rune-hatchet",
  "magic golem outfit": "magic-golem-outfit",
  "magic imbue (lunar)": "magic-imbue",
  "magic stones (poh construction)": "magic-stones",
  "magical thread (abyss rc + wilderness diary rates)": "magical-thread",
  "make leather (lunar)": "make-leather",
  "malevolent armour": "malevolent-cuirass",
  "malevolent armour (t90 melee power craft)": "malevolent-cuirass",
  "malevolent armour and malevolent energy": "malevolent-cuirass",
  "managing miscellania": "managing-miscellania",
  "mandrith (wilderness slayer master)": "mandrith",
  "marble blocks (poh construction)": "marble-blocks",
  "marigold farm patch cluster": "marigold-farm",
  "master archaeologist's outfit": "master-archaeologists-outfit",
  "master archaeologist's outfit (guildmaster shop claim)": "master-archaeologists-outfit",
  "archaeology shop": "master-archaeologists-outfit",
  "archaeology guild shop and qualification upgrades": "master-archaeologists-outfit",
  "master camouflage outfit": "master-camouflage",
  "master constructor outfit": "master-constructors-outfit",
  "master constructor's outfit": "master-constructors-outfit",
  "master farmer outfit": "master-farmer",
  "master farmer outfit is not a desert unlock": "master-farmer",
  "master farmer seed pickpocketing (kandarin sites)": "master-farmer",
  "master farmer seed supply (farmers' market + pickpocket)": "master-farmer",
  "master runecrafter robes": "master-runecrafter",
  // master-runecrafter-robes permanent is inventory hat after green-screen fix
  "master thief's lockpick + stethoscope (toolbelt)": "master-thiefs-lockpick",
  "masterwork melee plate / glorious-bar smithing chain": "masterwork-platebody",
  "masterwork plate → orthen furnace core pressure stack": "orthen-furnace-core",
  "masterwork ranged armour": "masterwork-ranged-body",
  "masterwork ranged armour (anachronia + wildy + kandarin)": "masterwork-ranged-body",
  "masterwork ranged armour (havenhythe / anachronia material pressure)": "masterwork-ranged-body",
  "masterwork ranged armour material pressure (havenhythe/anachronia hunter)":
    "masterwork-ranged-body",
  "masterwork ranged armour materials": "masterwork-ranged-body",
  "material manuals (guild shop archaeology boost)": "material-manual",
  "mattock of time and space": "mattock-of-time-and-space",
  "mattock precision upgrade": "mattock-precision",
  "mattock precision upgrades": "mattock-precision",
  "mattock precision upgrades (guild shop permanent)": "mattock-precision",
  "mattock progression checklist (dragon → crystal / imcando → motas → tony)": "dragon-mattock",
  "mattock tier ladder (bronze through elder rune + specials)": "dragon-mattock",
  "max guild": "max-guild",
  "max guild teleport (free spell)": "max-guild",
  "mechanised siphon (auto equipment/crystal tool siphon)": "mechanised-siphon",
  "meilyr district herblore and dungeoneering hub": "meilyr-clan-district",
  "meilyr harmony pillars (harmony moss)": "harmony-pillars",
  "meilyr potion recipe page purchase": "meilyr-potion",
  "meilyr recipe shop and combination potions": "meilyr-recipe-shop",
  "meilyr recipe shop": "meilyr-recipe-shop",
  "memorial to guthix": "memorial-to-guthix",
  "memorial to guthix echo boons": "memorial-to-guthix",
  "memory dowser": "memory-dowser",
  menaphos: "menaphos",
  "menaphos city quests (reputation engine)": "menaphos-city-quests",
  "menaphos imperial acadia woodcutting": "menaphos-imperial",
  "menaphos merchant marketeers and stalls": "menaphos",
  "menaphos mineral deposits (worker + vip sandstone)": "sandstone",
  "menaphos port fish and local cook loop": "menaphos",
  "menaphos reputation and vip skilling area": "vip-skilling-area",
  "menaphos skilling hub (four districts)": "menaphos",
  "menaphos soul obelisks (daily reputation + rc/prayer)": "soul-altar",
  "mining guild": "mining",
  "mining guild metal-bank smithing loop": "mining",
  "mining guild resource dungeon": "mining-guild-resource-dungeon",
  miscellania: "managing-miscellania",
  "misthalin runecrafting altars (water, earth) and essence access": "water-altar",
  "modified blacksmith's helmet": "modified-blacksmiths-helmet",
  "modified botanist's mask": "modified-botanists-mask",
  "modified diviner's headwear": "modified-diviners-headwear",
  "modified farmer's hat": "modified-farmers-hat",
  "modified ritualist's mask": "modified-ritualists-mask",
  "modified shaman's headdress": "modified-shamans-headdress",
  "modified sous chef's toque": "modified-sous-chefs-toque",
  // monastery of ascension → legiones boss plate (see above); do not map to exterior dump.
  "moonrise archaeology activity": "moonrise-dig-site",
  "moonrise dig site": "moonrise-dig-site",
  "moonrise dig-site hub (collections & mysteries)": "moonrise-dig-site",
  "morvran (prifddinas slayer master)": "morvran",
  "morytania legs 1-4": "morytania-legs-4",
  "morytania legs 2": "morytania-legs-2",
  "morytania legs 3": "morytania-legs-3",

  "musa point banana plantation": "musa-point-banana-plantation",
  "musa point fishing dock and stiles": "stiles",
  "musa point free teaks": "musa-point",
  "museum donation bin": "museum-donation-bin",
  "museum donation bin (40% chronote overflow)": "museum-donation-bin",
  "mysterious monolith": "mysterious-monolith",
  "mysterious monolith energy + relic loadout ladder": "mysterious-monolith",
  "mysterious monolith relic power hub": "mysterious-monolith",
  "mysterious city": "mysterious-monolith",
  "nakatra, devourer eternal": "nakatra",
  "nardah elidinis statuette": "desert-amulet-4",
  "nature altar": "nature-altar",
  "nature's sentinel": "natures-sentinel",
  "nature's sentinel outfit": "natures-sentinel",
  "natures sentinel outfit": "natures-sentinel",
  "necklace of salamancy": "necklace-of-salamancy",
  "necromancy conjure unlocks": "conjure-undead-army",
  "necromantic rune temple": "necromantic-rune-temple",
  "neitiznot yak crafting and cooking loop": "yak",
  "neitiznot yaks": "yak",
  "new varrock achievements (varrock armour doubling)": "varrock-armour-4",
  nex: "nex",
  "nex aod": "nex-aod",
  "nex equipment": "nex",
  "nex t80 power armour (torva / pernix / virtus)": "torva-platebody",
  "nex t80 power armour residual (torva / pernix / virtus)": "torva-platebody",
  "nex tier-80 armour sets": "nex",
  "nex: angel of death": "nex-aod",
  "nex: angel of death (ed3)": "nex-aod",
  "nex: angel of death progression": "nex-aod",
  "nexus mod (abyssal gatestone)": "nexus-mod",
  "nightmare gauntlets": "nightmare-gauntlets",
  "nightmare gauntlets (ranged)": "nightmare-gauntlets",
  "nihil familiar progression": "blood-nihil",
  "nihil familiars": "blood-nihil",
  nihils: "blood-nihil",
  "nimble outfit (the pit agility xp set)": "nimble-outfit",
  "no fear meteor strike perk": "no-fear",
  "nopenopenope spider combat perk": "nopenopenope",
  "noxious scythe and noxious longbow": "noxious-scythe",
  "noxious weapons": "noxious-weapons",
  "npc contact (lunar)": "npc-contact",
  "occultist necromancy necklace chain": "occultists-ring",
  "occultist's ring": "occultists-ring",
  // Hollow Hill meat shop plate (not raw crayfish / random meat sprite).
  "old meats (hollow hill meat shop)": "old-meats",
  "old meats": "old-meats",
  // Amberfell mushroom shop, not the Meilyr recipe shop.
  "fern's finds": "ferns-finds",
  "ferns finds": "ferns-finds",
  "heather's crafting supplies": "ruby",
  "omni guard": "omni-guard",
  "one piercing note": "one-piercing-note",
  "oo'glog spa pools (as a first resort)": "ooglog-spa",
  "ore box tier upgrades": "ore-box",
  "orthen dig site": "orthen-teleportation-device",
  "orthen dig-site collections and mysteries": "orthen-dig-site",
  "orthen furnace core full skilling stack": "orthen-furnace-core",
  "orthen teleportation device network": "orthen-dig-site",
  "ourania altar (zmi)": "ourania-altar",
  "ourania runecrafting altar": "ourania-altar",
  "ourania runecrafting altar (zmi)": "ourania-runecrafting-altar",
  "ouroboros pouch": "ouroboros-pouch",
  "overload progression chain": "overload",
  "papa mambo's shop (herblore habitat)": "papa-mambos-shop",
  "partial potion producer / dx (invention guild)": "partial-potion-producer-dx",
  "passage of the abyss (compacted jewellery pocket)": "passage-of-the-abyss",
  penance: "penance",
  "penance aspect (ex-aura)": "penance-aspect",
  "penguin agility course (iceberg)": "penguin-agility-course",
  "perfect juju potion production path": "perfect-juju",
  "perfect juju potion recipe hub": "perfect-juju",
  "perfect plus potion recipe (daemonheim)": "perfect-plus-potion-recipe",
  "pernix armour": "pernix-body",
  "pest control": "pest-control",
  "pharm ecology (queen mab's moonstone)": "pharm-ecology",
  "pickaxe of earth and song": "pickaxe-of-earth-and-song",
  "pickaxe of life and death": "pickaxe-of-life-and-death",
  "pickaxe progression checklist (dragon → imcando → crystal → earth and song → life and death)":
    "pickaxe-of-earth-and-song",
  "pikkupstix summoning shop and large obelisk (taverley)": "taverley",
  "piscatoris fishing colony": "piscatoris-fishing-colony",
  "piscatoris hunter area": "piscatoris-hunter-area",
  "piscatoris monkfish colony (swan song unlock)": "raw-monkfish",
  "plague's end prifddinas unlock package": "plagues-end",
  "plank make (lunar)": "plank-make",
  "plank maker / high capacity plank maker (invention guild)": "high-capacity-plank-maker",
  "player owned farm": "master-farmer",
  "player-owned farm": "master-farmer",
  "player-owned farm / manor farm": "master-farmer",
  "player owned house portal towns and construction utilities": "house-portal",
  "player-owned farm breeding log tier-1 species perks": "master-farmer",
  "player-owned farm combat perk state": "master-farmer",
  "player-owned house aquarium and prawnbroker": "prawnbroker",
  "player-owned house portal towns and construction utilities": "house-portal",
  "pof farm totems + tier-2 dual-pen animal perks": "master-farmer",
  "manor farm (farming guild) and reputation rewards": "master-farmer",
  "poh gilded altar (chapel offering)": "gilded-altar",
  "poh portal towns": "house-portal",
  "poh portal towns and construction utilities": "house-portal",
  "pontifex observation ring": "pontifex-observation-ring",
  "port sarim": "port-sarim",
  "port sarim docks and skilling hub": "port-sarim",
  "player-owned port": "player-owned-port",
  "player-owned ports": "player-owned-port",
  "player-owned ports skilling rewards (asgarnia arc mapping)": "player-owned-ports",
  "portable brazier": "portable-brazier",
  "portable crafter": "portable-crafter",
  "portable deposit box": "portable-deposit-box",
  "portable fairy ring": "portable-fairy-ring",
  "portable fairy ring (invention)": "portable-fairy-ring",
  "portable fletcher": "portable-fletcher",
  "portable forge": "portable-forge",
  "portable obelisk": "portable-obelisk",
  "portable range": "portable-range",
  "portable sawmill": "portable-sawmill",
  "portable well": "portable-well",
  "portable workbench": "portable-workbench",
  "ports reward shop (boni waiko) permanent scrolls + trade-goods access": "waiko",
  "potion and crystal flask infrastructure": "crystal-flask",
  "pouch protector (threads of fate)": "pouch-protector",
  "powder of penance": "powder-of-penance",
  "powder of pulverising": "powder-of-pulverising",
  "praesul codex curses": "praesul-codex",
  "praesul codex style curses (malevolence / desolation / affliction / ruination)": "praesul-codex",
  "prayer training infrastructure stack (altars + powders + books)": "gilded-altar",
  "prayer-book switch network (zaros / fort / elven / war)": "god-books",
  "prehistoric potterington's 'accidental' fletching and firemaking": "accidental-fletching",
  prifddinas: "prifddinas",
  "prifddinas city access": "prifddinas",
  "prifddinas skilling hub": "prifddinas",
  "prifddinas spirit tree + glouron three-tree unlock": "prifddinas-spirit-tree",
  "prifddinas waterfall fishing": "waterfall-fishing",
  "prifddinas waterfall fishing depth (tiers, events, points)": "waterfall-fishing",
  "prifddinian worker's outfit": "prifddinian-workers-outfit",
  "prifddinian worker's outfit (hefin course)": "prifddinian-workers-outfit",
  "prifddinian workers outfit": "prifddinian-workers-outfit",
  "primal ore / high-level mining": "primal-ore",
  "primal ores (daemonheim peninsula mining)": "primal-ores",
  "primal ores": "primal-ores",
  "professor additional relic loadout (80k chronotes)": "chronotes",
  "puro-puro impetuous impulses (dragon implings)": "dragon-implings",
  "pyramid plunder": "pyramid-plunder",
  "pyramid plunder (jalsavrah / sophanem)": "pyramid-plunder",
  "pyramid plunder and black ibis outfit": "black-ibis-outfit",
  "pyro-matic": "pyro-matic",
  "queen black dragon": "queen-black-dragon",
  raksha: "raksha",
  "ranch out of time": "anachronia-dinosaur-farm",
  "ranch out of time (anachronia dinosaur farm)": "anachronia-dinosaur-farm",
  "ranger's workroom fletching save and xp densify": "rangers-workroom",
  "ranging guild": "ranging-guild",
  "rapid renewal": "rapid-renewal",
  "rasial, the first necromancer": "rasial",
  "reaper crew": "reaper-crew",
  "reaver's ring": "reavers-ring",
  "red sandstone": "red-sandstone",
  "red sandstone and potion flasks": "red-sandstone",
  "refined anima core armour (gwd2)": "refined-anima-core-body-of-zaros",
  "rellekka fremennik hub": "rellekka",
  "repair rune pouch (livid farm lunar)": "repair-rune-pouch",
  "research team size ladder (assistant → guildmaster)": "archaeology-research",
  "resource dungeon unlock map (dungeoneering permanent access)": "resource-dungeon",
  "rex matriarchs": "rex-matriarchs",
  rimmington: "rimmington",
  "rimmington construction supply loop": "rimmington",
  "ring of fire": "ring-of-fire",
  "ring of fortune": "ring-of-fortune",
  "ring of fortune (relic power)": "ring-of-fortune",
  "ring of kayazu": "ring-of-kayazu",
  "ring of kinship": "ring-of-kinship",
  "ring of vigour": "ring-of-vigour",
  "ring of vigour and passive conversion": "ring-of-vigour",
  "ring of vigour passive": "ring-of-vigour",
  "ring of vitur": "ring-of-vitur",
  "ring of wealth": "ring-of-wealth",
  "ring of wealth (relic power)": "ring-of-wealth",
  "ring of whispers": "ring-of-whispers",
  "ripper claws": "ripper-claws",
  "rise of the six": "rise-of-the-six",
  "rise of the six progression": "barrows-rise-of-the-six",
  "ritualist's outfit": "ritualists",
  "roar of awakening and ode to deceit": "roar-of-awakening",
  "roar of osseous (rex skeleton island buff)": "roar-of-osseous",
  "robes of subjugation (gwd1 magic power ladder)": "garb-of-subjugation",
  "robes of the first necromancer": "first-necromancer-body",
  "rod-o-matic": "fishing-rod-o-matic",
  "rogue equipment (flash powder factory rubble)": "rogue-equipment",
  "rogues' den banking, safes, and thieving hub": "rogues-den",
  "ruinous weapon family": "ruinous-rapier",
  "rune dragon boot-upgrade glands": "blast-diffusion-boots",
  "rune dragon boot-upgrade glands residual": "blast-diffusion-boots",
  "rune pouch craft ladder (large → grasping + expansive essence path)": "grasping-rune-pouch",
  "runecrafting essence pouches (small → massive)": "expansive-essence-pouch",
  runespan: "runespan",
  "runespan portals at wizards' tower": "runespan",
  "runespan reward shop and master runecrafter robes": "master-runecrafter-robes",
  "runic attuner": "runic-attuner",

  "salve amulet (base)": "salve-amulet",
  "sana's fyrtorch": "sanas-fyrtorch",
  // Sanctum major uses final-boss plate (Nakatra), not dungeon scenery screenshot.
  "sanctum of rebirth": "nakatra",
  "sanctum of rebirth uniques": "nakatra",
  "sanguine crawler": "sanguine-crawler",
  "sanguine crawler uniques": "sanguine-crawler-uniques",
  "saradomin godsword special (heal switch)": "saradomin-godsword",
  "saradomin godsword special residual (heal switch)": "saradomin-godsword",
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
  "seasinger (ports / arc)": "seasingers-robe-top",
  "seasinger residual (ports / arc)": "seasingers-robe-top",
  seedicide: "seedicide",
  "seedicide collector upgrade": "seedicide-collector-upgrade",
  "seer's headband": "seers-headband-4",
  "seer's headband 1-4": "seers-headband-4",
  "seers headband": "seers-headband-4",
  "seers village achievements and seer's headband": "seers-headband-4",
  "seers village combat achievement rewards": "seers-headband-4",
  // Headband inventory - multi-MB Seers plate is unreadable at 3rem.
  "seers village skilling hub": "seers-headband-4",
  "seers' village": "seers-headband-4",
  "seers' village achievements and seer's headband": "seers-headband-4",
  "seers' village achievements and seers headband": "seers-headband-4",
  "seers' village combat achievement rewards": "seers-headband-4",
  "seers' village skilling hub": "seers-headband-4",
  "seismic wand and singularity": "seismic-wand",
  "selene necromancy prayer and curse unlocks (city of um)": "selene",
  "senntisten dig site": "senntisten-dig-site",
  "seren skilling prayers package (the light within)": "the-light-within",
  "seren stones and corrupted ore": "seren-stones",
  "seren stones": "seren-stones",
  "shades of mort'ton cremation": "mortton",
  "shades of mort'ton": "mortton",
  "shade keys": "gold-key",
  "shade key": "gold-key",
  "bronze key": "bronze-key",
  "steel key": "steel-key",
  "black key": "black-key",
  "silver key": "silver-key",
  "gold key": "gold-key",
  "columbarium key": "columbarium-key",
  "columbarium keys": "columbarium-key",
  "shiny columbarium key": "shiny-columbarium-key",
  "shiny columbarium keys": "shiny-columbarium-key",
  "shadow glaives": "shadow-glaives",
  // ED3 Major unlocks Name well: Ambassador plate (not reef scenery).
  "shadow reef": "ambassador",
  "shadow reef (ed3)": "ambassador",
  "shadow reef progression": "ambassador",
  "shaman's outfit": "shamans-outfit",
  "shard of the lumberjack": "shard-of-the-lumberjack",
  "shattered worlds": "shattered-worlds",
  "shattered worlds permanent abilities": "shattered-worlds",
  "shifting tombs (menaphos supply and multi-skill xp)": "shifting-tombs",
  "shifting tombs": "shifting-tombs",
  "shilo village": "shilo-village",
  "shilo village gem mine and gemstone cavern": "shilo-village-underground-gem-mine",
  "shilo village underground gem mine": "shilo-village-underground-gem-mine",
  "shrine of inanna summoning": "altar-of-inanna",
  "shrine of inanna summoning hub": "altar-of-inanna",
  "shrine of the spirit wolves (blessings of the wolf shop)": "spirit-wolf-pouch",
  "signs of the porter (divination supply system)": "sign-of-the-porter",
  "silverhawk boots (agility xp from feathers/down)": "silverhawk-boots",
  "silverquill uniques": "silverquill-uniques",
  "silverquill, the dreadhog": "silverquill",
  "silverquill, the dreadhog uniques": "silverquill-uniques",
  "sirenic → elite sirenic armour": "sirenic-hauberk",
  "sirenic armour": "sirenic-hauberk",
  "sirenic armour (t90 ranged power craft)": "sirenic-hauberk",
  "skillcape rack (player lodge t3 passive perk)": "skillcape-rack",
  "skillchompa hunter and player-owned farm supply": "skillchompas",
  "skillchompa supply hub (wild + pof ladder)": "skillchompas",
  skillchompas: "skillchompas",
  "skilling scrimshaw craft package (player-owned port)": "scrimshaw-crafter",
  "skull sceptre": "skull-sceptre",
  "slayer codex": "slayer-codex",
  "slayer codex and sunken pyramid soul system": "slayer-codex",
  "slayer introspection (amascut's enchanted gem)": "slayer-introspection",
  "slayer lodge progression": "slayer-lodge",
  "slayer tower": "slayer-tower",
  "ghost hunter gear": "ghost-hunter-gear",
  cremation: "cremation",
  "smelting gauntlets": "smelting-gauntlets",
  "smithing autoheater": "smithing-autoheater",
  "smoking kills (full slayer points unlock)": "smoking-kills",
  "soil box + material storage capacity ladders": "archaeological-soil-box",
  "sojobo arc contracts hub (waiko)": "waiko-contracts",
  solak: "solak",
  "solak / lost grove rewards": "solak",
  sophanem: "sophanem",
  "sophanem plover birds and slayer support skilling": "sophanem",
  "sophanem plover birds": "sophanem",
  "sophanem plovers": "sophanem",
  "sophanem slayer dungeon": "sophanem-slayer-dungeon",
  "sophanem slayer dungeon / the magister": "magister",
  "corrupted creatures & soul devourers": "vital-spark",
  "corrupted creatures": "vital-spark",
  "soul altar (menaphos imperial)": "soul-altar",
  "soul supplies and city of um skilling shops": "soul-supplies",
  "sous chef's outfit": "sous-chefs-outfit",
  "sparkling wisp colony": "sparkling-wisp-colony",
  "spear of annihilation": "spear-of-annihilation",
  "spear of annihilation (base archaeology spear)": "spear-of-annihilation",
  "spectral lens": "spectral-lens",
  "spin flax (lunar)": "spin-flax",
  "spiny helmet, face mask, earmuffs, nose peg (shop pack)": "spiny-helmet",
  "spirit cape": "spirit-cape",
  "spirit cape passive": "spirit-cape",
  // Square plate from Charming moth render (spirit moths share the moth art).
  "spirit moths": "spirit-moths",
  "spirit moths (highweald charm supply)": "spirit-moths",
  "spirit shield + holy elixir / sigil densify": "divine-spirit-shield",
  "spirit tree network (tree gnome stronghold)": "spirit-tree",
  "spirit weaver (pastkeeper's tapestry)": "spirit-weaver",
  "spirit wolf pouch": "spirit-wolf-pouch",
  "spottier cape": "spottier-cape",
  "spottier cape (hunter weight-reduction cape)": "spottier-cape",
  "spring cleaner (invention drop cleaner)": "spring-cleaner",
  "spring cleaner 9001": "spring-cleaner-9001",
  "spring cleaner progression": "spring-cleaner",
  "staff of armadyl": "fractured-staff-of-armadyl",
  "staff of limitless family (elemental impetus craft)": "staff-of-limitless-fire",
  "statue of het (oasis skilling xp blessing)": "statue-of-het",
  "sticky fingers (andvaranaut)": "sticky-fingers",
  "stormguard citadel dig site": "stormguard-citadel-dig-site",
  "stormguard citadel dig site (armadylean)": "stormguard-citadel-dig-site",
  "string jewellery (lunar)": "string-jewellery",
  "subjugation equipment": "garb-of-subjugation",
  "summoning charm-conservation tools": "summoning-charm",
  "sumona (pollnivneach slayer master)": "sumona",
  "sunken pyramid fourth room (3,000 slayer points)": "sunken-pyramid",
  "sunspear vyre cremation multi-skill training": "sunspear-melee",
  "sunspear vyre prayer sustain": "sunspear-melee",
  "sunspear vyre prayer sustain (ex-aura)": "sunspear-melee",
  "sunspear vyre prayer-sustain progression": "sunspear-melee",
  "superglass make (lunar)": "superglass-make",
  "superheat form (seren prayer)": "superheat-form",
  "superior dragon claws (wilderness hilt upgrade)": "superior-dragon-claws",
  "supreme overload potion recipe (meilyr)": "supreme-overload",
  "tagga's corehammer": "taggas-corehammer",
  "tai bwo wannai cleanup and trading sticks": "trading-sticks",
  "tai bwo wannai cleanup": "trading-sticks",
  taverley: "taverley",
  "taverley / burthorpe early-mid skilling hub": "taverley",
  "taverley / burthorpe early–mid skilling hub": "taverley",
  "taverley dungeon": "taverley-dungeon",
  "tear of inanna / hungry like the wolf": "tear-of-inanna",
  "tear of inanna": "tear-of-inanna",
  "tectonic robe armour": "tectonic-robe-top",
  "tectonic robe armour (t90 magic power craft)": "tectonic-robe-top",
  "tetsu equipment": "tetsu-body",
  "telekinetic grind (lunar)": "telekinetic-grind",
  "telos the warden": "telos",
  "telos, the warden": "telos",
  "temple of aminishi": "temple-of-aminishi",
  "temple of aminishi (ed1)": "temple-of-aminishi",
  "temple trekking": "temple-trekking",
  "temple trekking construction dependency pointer": "temple-trekking",
  "temple trekking permanent reward package": "temple-trekking",
  "temple trekking skilling outfits": "temple-trekking",
  "tetracompass pieces": "tetracompass",
  "tetracompass pieces → ancient caskets → complete tomes": "tetracompass",
  "thaler skilling rewards hub (stanley limelight traders)": "thaler",
  "the abyss": "abyss",
  "the ambassador": "ambassador",

  // the-arc.webp is Archaeology skill art (wrong wiki hit); Waiko is the Arc hub plate.
  "the arc": "waiko",
  "the arc waiko reward shop (chime economy)": "chimes",
  "the barrows brothers": "barrows",
  "the dig site": "the-dig-site",
  // Prefer activity plate path via activityIconPath when permanent-unlock is a huge screenshot.
  "the empty throne room": "empty-throne-room",
  "empty throne room": "empty-throne-room",
  "the gate of elidinis": "gate-of-elidinis",
  "the light within": "the-light-within",
  "the lost grove": "lost-grove",
  "the magister": "magister",
  "the magister (combat uniques hub)": "magister",
  "the prodigal spender (all guild shop permanents)": "the-prodigal-spender",
  "the shadow reef": "ambassador",
  "the shadow reef (ed3)": "ambassador",
  "the shadow reef / ambassador (ed3)": "ambassador",
  "the temple at senntisten": "the-temple-at-senntisten",
  "the world wakes": "the-world-wakes",
  "thieves' guild (lumbridge)": "thieves-guild",
  "thieves' guild master thief tools": "thieves-guild",
  "tier 3 woodcutter's grove and imcando hatchet fragments": "imcando-hatchet",
  "time altar": "time-rune",
  "tirannwn combat achievement rewards": "tirannwn-quiver-4",
  "tirannwn quiver 1-4": "tirannwn-quiver-4",
  "tokhaar-kal capes": "tokhaar",
  "toolbelt attach: advanced gold accumulator": "advanced-gold-accumulator",
  "toolbelt attach: bonecrusher": "bonecrusher",
  "toolbelt attach: charming imp": "charming-imp",
  "toolbelt attach: herbicide": "herbicide",
  "toolbelt attach: seedicide": "seedicide",
  "torva armour and praesulic essence (melee)": "torva-platebody",
  "totem of summoning": "totem-of-summoning",
  "totem of vitality": "totem-of-vitality",
  "trader woes shrine bank chest": "trader-woes",
  "trahaearn district mining and smithing hub": "trahaearn-clan",
  "trahaearn mining and smithing hub": "trahaearn-clan",
  "tree gnome stronghold": "tree-gnome-stronghold",
  "trimmed / custom-fit trimmed masterwork melee armour": "trimmed-masterwork-platebody",
  "trimmed masterwork melee armour (t92)": "trimmed-masterwork-platebody",
  "troll invasion": "troll-invasion",
  "troll stronghold disease-free herb patch": "troll-stronghold",
  "turtling perk (tank gizmo)": "turtling",
  "turtling perk residual (tank gizmo)": "turtling",
  "tuska's wrath current acquisition": "tuskas-wrath",
  "twin furies": "twin-furies",
  "twisted bird skull necklace": "twisted-bird-skull-necklace",
  "tzhaar city": "tzhaar-city",
  "tzhaar city skilling hub": "tzhaar-city",
  "tzhaar fight cave": "tzhaar-fight-cave",
  "tzhaar-hur-lek ore and gem store (uncut onyx)": "uncut-onyx",
  "tzkal zuk": "tzkal-zuk",
  "tzkal-zuk": "tzkal-zuk",
  "tztok-jad": "tztok-jad",
  "underworld grimoire 1-4": "underworld-grimoire-1",
  "underworld grimoire skilling milestone ladder (ug1-4 densify)": "underworld-grimoire-1",
  "underworld grimoire skilling milestone ladder (ug1–4 densify)": "underworld-grimoire-1",
  "unexpected diplomacy": "unexpected-diplomacy",
  "unexpected diplomacy (seal of the praefectus praetorio)": "unexpected-diplomacy",
  ungael: "ungael",
  "ungael ritual site pressure": "ungael-ritual",
  "ungeal ritual site": "ungael-ritual",
  "urn enhancer (permanent invention device)": "urn-enhancer",
  vampyrism: "vampyrism-aspect",
  "vampyrism aspect": "vampyrism-aspect",
  "vampyrism aspect (ex-aura)": "vampyrism-aspect",
  "varrock armour 1-4": "varrock-armour-4",
  "varrock armour 1–4": "varrock-armour-4",
  "varrock dig site": "varrock-dig-site",
  "varrock dig site / early archaeology": "varrock-dig-site",
  "varrock lumber yard sawmill operator": "sawmill",
  "varrock museum kudos progression": "varrock-museum",
  "vault of hereditas": "vault-of-hereditas",
  "vault of hereditas heist": "vault-of-hereditas",
  "velucia museum archaeology collections": "velucia",
  "velucia museum collection chronote tiers (225% set bonus)": "velucia",
  "vermyx, brood mother": "vermyx",
  "vestments of havoc (t95 melee glass cannon)": "vestments-of-havoc-robe-top",
  vindicta: "vindicta-gorvek",
  "vindicta & gorvek": "vindicta-gorvek",
  "virtus equipment and praesulic essence": "virtus-robe-top",
  "virtus equipment and praesulic essence residual": "virtus-robe-top",
  "voice of seren district rotations": "seren-stones",
  "voice of seren": "seren-stones",
  "volcanic trapper outfit": "volcanic-trapper",
  vorago: "vorago",
  "vorago progression": "vorago",
  // Official vyrewatch plate (not 1-byte sunspear stubs).
  vyrewatch: "vyrewatch",
  "vyre combat and sunspear progression": "vyrewatch",
  "vyres / sunspear multi-skill training": "vyrewatch",
  sunspear: "sunspear",
  "waiko commodity sell permanent upgrades": "waiko",
  "waiko contracts-per-day permanent upgrades": "waiko-contracts",
  "waiko grill (permanent arc cooking station)": "waiko-grill",
  "waiko uncharted supplies permanent upgrades (cap + cost)": "uncharted-island-map",
  "wand / orb of the cywir elders": "wand-of-the-cywir-elders",
  "wand of the praesul and imperium core": "wand-of-the-praesul",
  "war's blessing 1-4 (combat mastery residual)": "wars-blessing-4",
  "war's blessing 1-4 (combat mastery)": "wars-blessing-4",
  "war's blessing combat mastery": "wars-blessing-4",
  "war's blessing combat mastery residual": "wars-blessing-4",
  "war's retreat": "wars-retreat-hub",
  "war's retreat combat hub": "wars-retreat-hub",
  "war's retreat combat hub residual": "wars-retreat-hub",
  "war's retreat hub amenities (bank / altar of war / grimoire host)": "altar-of-war",
  "warforge dig site (bandosian)": "warforge-dig-site",
  "warforge dig site (feldip hills archaeology)": "warforge-dig-site",
  "warforge dig site (not karamja)": "warforge-dig-site",
  "warforge dig site": "warforge-dig-site",
  "thalmund's forge": "warforge-dig-site",
  "thalmunds forge": "warforge-dig-site",
  "warped depths (daemonheim depths excavation)": "warped-depths",
  "warped gem": "warped-gem",
  "warped gorajan trailblazer outfit": "warped-gorajan",
  // Prefer defender inventory look over multi-MB guild plate for name wells.
  "warriors guild": "dragon-defender",
  "warriors' guild": "dragon-defender",
  safecracking: "safe",
  "safecracking route": "safe",
  safes: "safe",
  "asgarnia safecracking circuit": "safe",
  "wars retreat": "wars-retreat-hub",
  "wars retreat combat hub": "wars-retreat-hub",
  "waterbirth island": "waterbirth-island",
  "waterbirth island access": "waterbirth-island",
  "waterfall fishing": "waterfall-fishing",
  "waterfall fishing and fishing shop": "waterfall-fishing",
  "weapon poison+++": "weapon-poison",
  "well of souls": "well-of-souls",
  "well of souls talent infrastructure": "well-of-souls",
  "well of souls talent progression": "well-of-souls",
  "wendlewick deserted mine (clay and uncommon gems)": "wendlewick-deserted-mine",
  "wendlewick fish farm": "fish-farm",
  "wendlewick fish farm (havenhythe)": "fish-farm",
  "wendlewick limestone mine": "wendlewick-limestone-mine",
  "wendlewick lodestone": "wendlewick-lodestone",
  "wendlewick teleport (standard spellbook)": "wendlewick-teleport",
  "werewolf agility course": "werewolf-agility-course",
  "whale's maw campfire + deposit box permanent unlocks": "whales-maw",
  "wicked hood (runecrafting talisman storage + altar teleports)": "wicked-hood",
  "wilderness agility course": "wilderness-agility-course",
  "wilderness chaos altars (prayer offer)": "chaos-altar",
  "wilderness herb patch": "aggression-potion",
  "bloodweed & aggression potions": "aggression-potion",
  "bloodweed / aggression pots": "aggression-potion",
  "bloodweed and aggression potions": "aggression-potion",
  "wilderness slayer": "wilderness-slayer",
  "wilderness bloodwood trees": "wilderness-bloodwood",
  "bloodwood trees": "wilderness-bloodwood",
  "wilderness runite rocks (lava maze north)": "wilderness-runite",
  "wilderness sword 1-4": "wilderness-sword-4",
  "witchdoctor camo outfit": "witchdoctor-camo",
  "witchdoctor mask (habitat teleport)": "witchdoctor-mask",
  // permanent-unlocks/wizards-guild is a tiny landscape still flagged "guild" scenery -
  // Magic cape is the honest inventory mark for this major.
  "wizards' guild": "magic-cape",
  "wizards' guild (magic guild, yanille)": "magic-cape",
  "wizards' tower and runecrafting guild": "wizards-tower",
  "wood box tier upgrades": "eternal-magic-wood-box",
  "woodcutters grove": "imcando-hatchet",
  "woodcutters grove facility tiers": "imcando-hatchet",
  "woodcutters' grove": "imcando-hatchet",
  "woodcutters' grove facility tiers": "imcando-hatchet",
  "yak hide / pof babies": "yak",
  "yak hide and player-owned farm yak babies": "yak",
  "yak-hide armour": "yak-hide-armour",
  yanille: "yanille",
  "yanille multi-skill hub": "yanille",
  "zamorakian sliver enchantments": "zamorak",
  "zamorakian undercity ability codices": "zamorakian-undercity",
  zamorak: "zamorak",
  "zamorak, lord of chaos": "zamorak",
  "zamorak, lord of chaos (undercity)": "zamorak",
  "zemouregal & vorkath": "zemouregal-vorkath",
  "zemouregal & vorkath progression": "zemouregal-vorkath",
  "zemouregal and vorkath": "zemouregal-vorkath",
};

/** Normalize a free-text label to a kebab slug candidate. */
export function slugifyIconLabel(label: string): string {
  // Decode first - wiki titles like First Necromancer&#039;s equipment must
  // not become first-necromancer-and-039-s-equipment.
  return decodeHtmlEntities(label)
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
  const raw = decodeHtmlEntities(name).trim();
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

  // 3) Long containment only - never short generic tokens.
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

function firstHit(candidates: string[], lookup: (slug: string) => string | null): string | null {
  for (const slug of candidates) {
    const path = lookup(slug);
    if (path) return path;
  }
  return null;
}

/** Exact-only candidates (alias + full slug + first clause) - no containment. */
function exactSlugCandidates(name: string): string[] {
  const raw = decodeHtmlEntities(name).trim();
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
  // Split on clause punctuation only - do NOT break internal hyphens (Kharid-et).
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

/**
 * Skill icons only for exact skill names / aliases - never first-clause of a package
 * ("Anachronia Agility Course" must not become the Agility skill glyph).
 */
export function skillIconPath(skillIdOrName: string): string | null {
  const raw = skillIdOrName.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const alias = DATA_ICON_ALIASES[lower];
  if (alias && SKILL_ICON_SLUGS.has(alias)) return `/game/skills/${alias}.webp`;
  const slug = slugifyIconLabel(raw);
  if (SKILL_ICON_SLUGS.has(slug)) return `/game/skills/${slug}.webp`;
  return null;
}

/**
 * League Relic and Blessing plates, resolved by name.
 * Exact lookups against published public/game art - null until a record names
 * a published slug; never guess a match.
 */
export function relicIconPath(name: string): string | null {
  const slug = slugifyIconLabel(name.trim());
  return slug && RELIC_ICON_SLUGS.has(slug) ? `/game/relics/${slug}.webp` : null;
}

export function blessingIconPath(name: string): string | null {
  const slug = slugifyIconLabel(name.trim());
  return slug && BLESSING_ICON_SLUGS.has(slug) ? `/game/blessings/${slug}.webp` : null;
}

/** Exact / alias / epithet boss plate only - no long-string containment. */
function primaryBossIconPath(name: string): string | null {
  return firstHit(exactSlugCandidates(name), (slug) => {
    if (!BOSS_ICON_SLUGS.has(slug)) return null;
    const ext = BOSS_ICON_EXT[slug] ?? "webp";
    return `/game/bosses/${slug}.${ext}`;
  });
}

export function bossIconPath(name: string): string | null {
  // Exact first, then long boss-name containment (Kerapac progression → kerapac).
  const cands = exactSlugCandidates(name);
  const hay = `-${slugifyIconLabel(name)}-`;
  for (const s of CONTAIN_BOSS_SLUGS) {
    if (hay.includes(`-${s}-`) || hay.startsWith(`-${s}`) || hay.endsWith(`${s}-`)) {
      if (!cands.includes(s)) cands.push(s);
    }
  }
  return firstHit(cands, (slug) => {
    if (!BOSS_ICON_SLUGS.has(slug)) return null;
    const ext = BOSS_ICON_EXT[slug] ?? "webp";
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
  // Exact/alias only - containment lets short stubs (anachronia-base) steal longer hubs.
  return firstHit(exactSlugCandidates(name), (slug) => {
    // Monastery exterior dump; ResearchBrowser prefers upgradeIconPath before entity.
    if (slug === "legiones") return null;
    // the-arc.webp is Archaeology skill art (wrong wiki hit); Arc majors use Waiko /
    // uncharted-island-map via DATA_ICON_ALIASES + dataEntityIconPath.
    if (slug === "the-arc") return null;
    const rel = UPGRADE_ICON_BY_SLUG[slug];
    return rel ? `/game/upgrades/${rel}` : null;
  });
}

/**
 * permanent-unlocks slugs that are place/scenery screenshots (often multi-MB).
 * Never use these in the name-column well - skill glyph or empty is better.
 * Inventory-ish permanents (gloves, rings, spellbooks, tools, ores) stay allowed.
 */
const SCENERY_PERMANENT_UNLOCK_SLUGS = new Set([
  "abandoned-mine",
  "altar-of-inanna",
  "amberfell",
  "anachronia-base-camp",
  "anachronia-dinosaur-farm",
  "barbarian-outpost",
  "barbarian-outpost-agility-course",
  "big-chinchompa",
  "burthorpe",
  "crafting-guild",
  "eastfold-farm",
  "elven-clan",
  "fish-farm",
  "gemstone-cavern",
  "gnome-stronghold-agility-course",
  "hefin-agility-course",
  // Multi-MB place plates - never reward chips (keep inventory permanents allowed).
  "hets-oasis",
  "highweald",
  "highweald-ruins-mine",
  "hunter-mark-shop",
  "jatizso-dungeon-mine",
  "karamja-volcano-resource-dungeon",
  // Floor-plan map crop - never name-well or reward chip for Kuradal row.
  "kuradals-dungeon",
  // Monastery exterior under permanent-unlocks - boss plate is the creature art.
  "legiones",
  "liberation-of-mazcab",
  // manor-farm permanent plate allowed for Manor Farm major name well.
  "marigold-farm",
  "menaphos",
  "menaphos-imperial",
  "mort-myre",
  "mortton",
  "musa-point-banana-plantation",
  "nature-grotto",
  "penguin-agility-course",
  "piscatoris-fishing-colony",
  "piscatoris-hunter-area",
  "rellekka",
  "rimmington",
  "rogues-den",
  "seers-village",
  "shades-of-mortton",
  "soul-altar",
  "tai-bwo-wannai",
  "tai-bwo-wannai-cleanup",
  "the-empty-throne-room",
  "tzhaar",
  "tzhaar-city",
  "vip-skilling-area",
  "voice-of-seren",
  "wendlewick-deserted-mine",
  // wendlewick-fish-farm is a major unlock plate (reward chips) - not scenery dump.
  "werewolf-agility-course",
  "yanille",
  "catherby",
  "deep-sea-fishing",
  "fishing-guild",
  "ourania-altar",
  "ourania-runecrafting-altar",
  "livid-farm",
  "lunar-isle",
  "fruit-tree-patch",
]);

function permanentUnlockSlug(path: string): string | null {
  const m = path.match(/\/permanent-unlocks\/([^/]+)\.(?:png|jpg|jpeg|webp)$/i);
  return m?.[1]?.toLowerCase() ?? null;
}

/**
 * Multi-MB activity place plates that crop badly in name wells.
 * Prefer skill glyphs / inventory over these when skillHub matches;
 * also reject as a last resort so we never show a random landscape as an "icon".
 */
const SCENERY_ACTIVITY_SLUGS = new Set([
  "barbarian-outpost",
  "barbarian-outpost-agility-course",
  "catherby",
  "deep-sea-fishing",
  "fishing-guild",
  // Kuradal's Dungeon map plate - not NPC art (use activities/kuradal chathead for the master).
  "kuradals-dungeon",
  // manor-farm / player-owned-farm are intentional major name-well plates (not fenced).
  "ourania-altar",
  "ourania-runecrafting-altar",
  "piscatoris-fishing-colony",
  "piscatoris-hunter-area",
  "ranging-guild",
  "seers-village",
  "yanille",
  "livid-farm",
  "lunar-isle",
]);

function activitySlug(path: string): string | null {
  const m = path.match(/\/activities\/([^/]+)\.(?:png|jpg|jpeg|webp)$/i);
  return m?.[1]?.toLowerCase() ?? null;
}

export function isSceneryActivityPath(path: string): boolean {
  const slug = activitySlug(path);
  if (!slug) return false;
  if (SCENERY_ACTIVITY_SLUGS.has(slug)) return true;
  // Named farm hubs with published major plates (not generic "…-farm" scenery dumps).
  if (/^(?:manor-farm|player-owned-farm)$/i.test(slug)) return false;
  // Heuristic: bare place/course/guild activity dumps (not dig sites / named hubs with good plates).
  if (
    /(?:^|-)(course|area|farm|village|hub|colony|guild|outpost|stronghold)(?:-|$)/i.test(slug) &&
    !/(training|glider|restaurant|spirit-tree|dig-site|citadel|warforge|stormguard|hall-of|memorial|empty-throne|necromantic)/i.test(
      slug,
    )
  ) {
    return true;
  }
  return false;
}

/** True when upgrade path is a place/scenery permanent-unlock dump. */
export function isSceneryPermanentUnlock(path: string): boolean {
  const slug = permanentUnlockSlug(path);
  if (!slug) return false;
  if (SCENERY_PERMANENT_UNLOCK_SLUGS.has(slug)) return true;
  // Manor Farm / PoF / Wendlewick fish farm major plates allowed in name wells.
  if (/^(?:manor-farm|player-owned-farm|wendlewick-fish-farm)$/i.test(slug)) return false;
  // Heuristic: bare place photos (course/area/farm/patch…) without inventory tokens.
  // Do NOT blanket-ban "altar" - astral-altar inventory art is fine; Ourania is listed above.
  // "archaeology-guild-shop" / "ferocious-ring" must stay - not scenery.
  if (
    /(?:^|-)(course|area|farm|village|hub|cavern|colony|plantation|outpost|stronghold|cathedral|district|patch|fishing|catherby|yanille|seers|piscatoris|memorial|deep-sea)(?:-|$)/i.test(
      slug,
    ) &&
    !/(gloves|ring|spellbook|wand|brush|maul|mask|codex|cape|outfit|pickaxe|hatchet|seed|flask|potion|totem|ores?|facet|sword|spear|shield|torch|vessel|scroll|token|shop|trap|mark|headband|crossbow)/i.test(
      slug,
    )
  ) {
    return true;
  }
  // Bare "…-guild" place plates only (Crafting Guild), not "…-guild-shop".
  if (/(?:^|-)guild$/i.test(slug)) return true;
  return false;
}

/**
 * Map skill-hub / patch / course bags to a skill glyph path.
 * Used for major-unlock name wells; scenery is not a valid fallback.
 */
function skillHubIconFromBag(bag: string): string | null {
  const hit = (skill: string) => skillIconPath(skill);

  // Farming first - "crystal tree Farming" must not fall through to woodcutting.
  // Named "Manor Farm" hub keeps its own plate via DATA_ICON_ALIASES.
  if (
    !/\bmanor farm\b/i.test(bag) &&
    /\bfarming patch\b|\bfarming patches\b|\bfarm(?:ing)?\b.*\bpatch|\bpatch cluster\b|\ballotment\b|\bherb patch\b|\btree patch\b|\bhops patch\b|\bbush patch\b|\bmushroom patch\b|\bcactus patch\b|\bcalquat\b|\bflower patch\b|\bharmony pillar|\bcrystal tree\b|\bmarigold farm\b|\beastfold farm\b/i.test(
      bag,
    )
  ) {
    return hit("farming");
  }
  if (
    /\bagility course\b|\bserenity posts\b|\bagility arena\b|\bflash powder factory\b|\bstronghold course\b|\boutpost agility\b/i.test(
      bag,
    ) ||
    (/\bagility\b/i.test(bag) && /\bcourse\b/i.test(bag))
  ) {
    return hit("agility");
  }
  // Named masters keep portrait art via upgrade path - only abstract slayer rows use the skill.
  if (
    /\bslayer master\b/i.test(bag) &&
    !/\b(?:kuradal|morvran|sumona|duradel|laniakea|konar)\b/i.test(bag)
  ) {
    return hit("slayer");
  }
  // Box-trap / birdhouse inventory art is better when published - skill only for bare areas.
  if (
    /\bhunter area\b|\bhunter mark shop\b|\bcharming moths\b/i.test(bag) ||
    (/\bchin(?:chompa)?s?\b/i.test(bag) && !/\buniques?\b|\bequipment\b/i.test(bag))
  ) {
    return hit("hunter");
  }
  if (
    /\bmining\b|\bdungeon mine\b|\bdeserted mine\b|\bsandstone\b|\bgemstone cavern\b|\bgem rocks?\b|\bprimal ores\b/i.test(
      bag,
    ) &&
    !/mattock|pickaxe|armour|equipment/i.test(bag)
  ) {
    return hit("mining");
  }
  if (
    /\bfishing guild\b|\bfishing colony\b|\bdeep sea fishing\b|\bfish(?:ing)? dock\b|\bstiles\b|\bfish farms?\b|\bfish farming\b|\bkarambwan\b|\bcatherby\b.*\bfish|\bfish.*\bcatherby\b/i.test(
      bag,
    ) ||
    (/\bfishing\b/i.test(bag) &&
      !/\boutfit\b|\bfury shark\b|\bcape\b|\buniques?\b|\bequipment\b|\bcrossbow\b/i.test(bag))
  ) {
    return hit("fishing");
  }
  if (/\bthiev|\brogues'? den\b|\bpickpocket/i.test(bag)) {
    return hit("thieving");
  }
  if (/\bcrafting guild\b/i.test(bag)) {
    return hit("crafting");
  }
  if (/\branging guild\b|\branged guild\b/i.test(bag)) {
    return hit("ranged");
  }
  if (/\bwizards'? guild\b|\bmagic guild\b/i.test(bag)) {
    return hit("magic");
  }
  if (/\blunar (?:isle|island|spell)\b|\blivid farm\b/i.test(bag)) {
    return hit("magic");
  }
  // Named Blast Furnace keeps permanent-unlock inventory art; bare smithing furnaces use the skill glyph.
  if (/\bsmithing\b.*\bfurnace\b/i.test(bag) && !/\bblast furnace\b/i.test(bag)) {
    return hit("smithing");
  }
  if (
    /\bshades of mort|\bnature grotto\b|\baltar of nature\b|\bcremation\b/i.test(bag) &&
    !/\buniques?\b|\bequipment\b/i.test(bag)
  ) {
    return hit("prayer");
  }
  // Named Inanna shrine only - "Empowered Summoning obelisks" keeps inventory art.
  if (/\bshrine of inanna\b|\baltar of inanna\b/i.test(bag)) {
    return hit("summoning");
  }
  if (
    /\bdeath altar\b|\bnature altar\b|\bourania\b|\bzmi\b|\brunecrafting altar\b|\brunecraft/i.test(
      bag,
    )
  ) {
    return hit("runecrafting");
  }
  // Meilyr Recipe Shop place plate / permanent-unlock art - not the herblore skill glyph.
  if (
    /\bherblore\b|\bfungi bloom\b|\bcombination potions?\b/i.test(bag) &&
    !/\bmeilyr recipe shop\b/i.test(bag)
  ) {
    return hit("herblore");
  }
  if (/\baccidental fletching\b|\bfletching and firemaking\b/i.test(bag)) {
    return hit("fletching");
  }
  if (
    /\bwoodcutting\b|\bwillow\b|\bteak\b|\bmahogany\b|\barctic pine\b|\bovergrown idol|\bbanana plantation\b/i.test(
      bag,
    ) &&
    !/mattock|pickaxe/i.test(bag)
  ) {
    return hit("woodcutting");
  }
  if (/\bwisp colon|\bdivination\b.*wisp|\bwisp.*divination|\bgleaming wisp/i.test(bag)) {
    return hit("divination");
  }
  return null;
}

const ENTITY_ICON_OVERRIDES: Record<string, string> = {
  "citharede abbey": "/game/upgrades/skilling-production/illuminated-book-of-wisdom.webp",
  "custom-fit trimmed masterwork": "/game/upgrades/progression/trimmed-masterwork-platebody.webp",
  "elite dungeon 1": "/game/bosses/seiryu.webp",
  "het's oasis": "/game/upgrades/permanent-unlocks/powder-of-burials.webp",
  "kharid-et dig site": "/game/upgrades/permanent-unlocks/pontifex-observation-ring.webp",
  "liberation of mazcab": "/game/combat/equipment/achto-teralith-cuirass.webp",
  "mage training arena": "/game/upgrades/skilling-production/bones-to-peaches.webp",
  "mazcab emergency merchants": "/game/upgrades/permanent-unlocks/super-restore.webp",
  "meilyr recipe shop": "/game/activities/meilyr-recipe-shop.webp",
  "meilyr recipe shop and combination potions": "/game/activities/meilyr-recipe-shop.webp",
  // QBD uses /game/bosses/queen-black-dragon.webp via primaryBossIconPath; do not
  // override the row with dragon kiteshield (that stays a reward chip only).
  "ports armour": "/game/upgrades/progression/tetsu-body.webp",
  scrimshaws: "/game/combat/equipment/scrimshaw-of-cruelty.webp",
  "shilo village gem mine and gemstone cavern":
    "/game/upgrades/permanent-unlocks/shilo-village-underground-gem-mine.webp",
  "starbloom armour": "/game/upgrades/progression/starbloom-robes.webp",
  "uncommon gem rocks": "/game/upgrades/permanent-unlocks/wendlewick-deserted-mine.webp",
  whirligigs: "/game/upgrades/permanent-unlocks/crocodile-tears.webp",
};

const MEILYR_RECIPE_SHOP_ENTITY_IDS = new Set([
  "activity:content:meilyr-recipe-shop",
  "prifddinas:meilyr-recipe-shop",
]);

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
  if (MEILYR_RECIPE_SHOP_ENTITY_IDS.has(id)) {
    return "/game/activities/meilyr-recipe-shop.webp";
  }

  const name = decodeHtmlEntities(input.name ?? "").trim();
  const kind = decodeHtmlEntities(input.kind ?? "").toLowerCase();

  // Explicit skill field or a pure skill kind - not "skillcape" / "skilling outfit" packages.
  // Named places with a published activity plate still win (skill= must not steal Empty Throne
  // Room / Necromantic Rune Temple into mining.png / runecrafting.png). Pure skill titles
  // ("Mining") have no activity hit and keep the skill glyph.
  const pureSkillKind =
    Boolean(input.skill) ||
    (/^(skill|skills)\b/.test(kind) &&
      !/skillcape|skilling|outfit|infrastructure|package|codex/i.test(kind));
  if (pureSkillKind) {
    if (name) {
      const placePlate = activityIconPath(name);
      if (placePlate) return placePlate;
    }
    const skill = skillIconPath(input.skill || name);
    if (skill) return skill;
  }

  if (!name) return null;

  if (kind && ENTITY_ICON_OVERRIDES[name.toLowerCase()]) {
    return ENTITY_ICON_OVERRIDES[name.toLowerCase()]!;
  }

  // Name-token archaeology only for skill fallback; kind alone must not force skill icon
  // (relic chains / settlement hubs tagged "Archaeology" would otherwise all show the skill).
  const archName = ARCH_ENTITY_RE.test(name);
  const archRelated = archName || ARCH_ENTITY_RE.test(kind);

  // Official boss plates for known boss names (Kerapac / Arch-Glacor / Croesus / Zuk standard).
  // Primary = exact/alias/epithet only. Full-string aliases to inventory packs
  // ("Ivar uniques" → ivar-uniques, "Scripture of Amascut" → item) keep item art.
  const fullAlias = DATA_ICON_ALIASES[name.toLowerCase()];
  const primaryBoss = primaryBossIconPath(name);
  if (primaryBoss && (!fullAlias || BOSS_ICON_SLUGS.has(fullAlias))) {
    return primaryBoss;
  }

  // Word-ish kind match only - "elite skilling" must not force bossish routing.
  const bossish =
    /\bboss(?:es|ing)?\b/.test(kind) ||
    /\bdungeon\b/.test(kind) ||
    /\bsanctum\b/.test(kind) ||
    /\bgate of\b/.test(kind) ||
    /\bgod wars\b/.test(kind) ||
    /\belite dungeon\b/.test(kind);
  // Full alias to inventory (not a boss slug) beats bossish kind routing.
  // Prefer activity plate for place majors (Empty Throne / Rune Temple) over permanent
  // unlock screenshots. Multi-MB scenery activity (fish-farm, *course) stays fenced so
  // skillHub can pick a skill glyph later.
  if (fullAlias && !BOSS_ICON_SLUGS.has(fullAlias)) {
    // Prefer /combat/equipment inventory over /upgrades plates.
    const aliasEq = equipmentIconPath(fullAlias);
    if (aliasEq) return aliasEq;
    const aliasAct = activityIconPath(name);
    const aliasUp = upgradeIconPath(name);
    if (aliasUp && !aliasUp.includes("/permanent-unlocks/")) return aliasUp;
    if (aliasAct && !isSceneryActivityPath(aliasAct)) return aliasAct;
    if (aliasUp && !isSceneryPermanentUnlock(aliasUp)) return aliasUp;
  }

  // Bossish kinds: try full containment boss before scenery (Major unlocks Name column).
  // Skip when full alias already mapped away from boss art.
  if (bossish && (!fullAlias || BOSS_ICON_SLUGS.has(fullAlias))) {
    const boss = bossIconPath(name);
    if (boss) return boss;
    if (!archRelated) {
      const actBoss = activityIconPath(name);
      if (actBoss && !isSceneryActivityPath(actBoss)) return actBoss;
    }
  }

  // Inventory / progression first. Non-scenery place plates next (Empty Throne,
  // dig sites). Then skill glyphs for un-aliased courses / hubs / patches.
  const bag = `${kind} ${name}`;
  const act = activityIconPath(name);
  const up = upgradeIconPath(name);
  if (up && !up.includes("/permanent-unlocks/")) return up;
  if (act && !isSceneryActivityPath(act)) return act;

  const hubSkill = skillHubIconFromBag(bag);
  if (hubSkill) return hubSkill;

  if (up && !isSceneryPermanentUnlock(up)) return up;

  // Curated alias with only scenery-class place art left (Livid Farm, etc.):
  // better than an empty well once skill-hub declined.
  if (fullAlias) {
    if (act) return act;
    if (up) return up;
  }

  // Exact skill title only (e.g. row named "Mining").
  const skill = skillIconPath(name);
  if (skill) return skill;

  // Archaeology name rows: exact dig-site / NPC activity, else skill - never kind-only.
  if (archName) {
    return skillIconPath("archaeology");
  }

  // Package labels that contain a boss name ("Kerapac progression") after inventory misses.
  if (!bossish) {
    const boss = bossIconPath(name);
    if (boss) return boss;
  }

  // Equipment: exact/alias candidates only (EQUIPMENT_OK is closed - abstract package
  // slugs never hit). Allow any length so multi-word named items still resolve.
  for (const slug of exactSlugCandidates(name)) {
    const path = equipmentIconPath(slug);
    if (path) return path;
  }

  // Abstract multi-word packages without a real item/activity/boss hit stay empty.
  // Prefer null over weakly related skill/scenery (kind-only skill dumps are banned above).
  return null;
}
