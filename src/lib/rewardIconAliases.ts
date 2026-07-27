/**
 * Reward unique label → local inventory icon path for Major unlock chips.
 * Keys: lowercase trimmed tokens (as after contentRewardTokens).
 * Values: published paths under public/game/ only — never invent files.
 * Prefer square inventory art over boss plate photos.
 */

const prog = (slug: string) => `/game/upgrades/progression/${slug}.png`;
const codex = (slug: string) => `/game/upgrades/ability-codices/${slug}.png`;
const offhand = (slug: string) => `/game/upgrades/skilling-offhands/${slug}.png`;
const util = (slug: string) => `/game/upgrades/combat-utility/${slug}.png`;
const perm = (slug: string) => `/game/upgrades/permanent-unlocks/${slug}.png`;
const equip = (slug: string) => `/game/combat/equipment/${slug}.png`;
const rootUp = (slug: string) => `/game/upgrades/${slug}.png`;

/**
 * Explicit reward-token aliases. Keys must be unique (lowercase, trimmed).
 * Omit labels with no verified public/game asset.
 */
const skProd = (slug: string) => `/game/upgrades/skilling-production/${slug}.png`;

export const REWARD_ICON_BY_LABEL: Record<string, string> = {
  // --- Necrotic runes (Necromantic Rune Temple) ---
  "spirit rune": skProd("spirit-rune"),
  "bone rune": skProd("bone-rune"),
  "flesh rune": skProd("flesh-rune"),
  "miasma rune": skProd("miasma-rune"),

  // --- Bloodweed / aggression pots (Forinthry) ---
  "clean bloodweed": skProd("clean-bloodweed"),
  "grimy bloodweed": skProd("grimy-bloodweed"),
  "bloodweed seed": skProd("bloodweed-seed"),
  "bloodweed": skProd("clean-bloodweed"),
  "searing ashes": skProd("searing-ashes"),
  "aggression potion": skProd("aggression-potion"),
  "aggression potions": skProd("aggression-potion"),
  "aggression pot": skProd("aggression-potion"),

  // --- Havenhythe uniques ---
  "bonecrusher maul": perm("bonecrusher-maul"),
  "magic skull mask": perm("magic-skull-mask"),
  "colossal bone": perm("colossal-bone"),
  "colossal bones": perm("colossal-bone"),
  "silver spines": skProd("silver-spines"),
  "sanguine spines": skProd("sanguine-spines"),
  "vampyrism gloves": perm("vampyrism-gloves"),
  "tainted seed": perm("tainted-seed"),
  "sanguine matter": skProd("sanguine-matter"),

  // --- Kerapac ---
  "fractured staff of armadyl": prog("fractured-staff-of-armadyl"),
  "fractured staff of armadyl components": prog("fractured-staff-of-armadyl"),
  fsoa: prog("fractured-staff-of-armadyl"),
  "greater concentrated blast": codex("greater-concentrated-blast"),
  gconc: codex("greater-concentrated-blast"),
  "kerapac's wrist wraps": prog("kerapacs-wrist-wraps"),
  "kerapacs wrist wraps": prog("kerapacs-wrist-wraps"),
  "scripture of jas": prog("scripture-of-jas"),

  // --- Arch-Glacor / Leng ---
  "frozen core of leng": prog("frozen-core-of-leng"),
  "dark nilas": prog("dark-nilas"),
  "leng artefact": prog("leng-artefact"),
  "scripture of wen": prog("scripture-of-wen"),
  "dark shard of leng": prog("dark-shard-of-leng"),
  "dark sliver of leng": prog("dark-sliver-of-leng"),
  "blade of leng": prog("dark-shard-of-leng"),
  "off-hand blade of leng": prog("dark-sliver-of-leng"),
  "dark ice shard": equip("dark-ice-shard"),
  "dark ice sliver": equip("dark-ice-sliver"),

  // --- Croesus ---
  "cryptbloom armour": equip("cryptbloom-body"),
  cryptbloom: equip("cryptbloom-body"),
  "scripture of bik": prog("scripture-of-bik"),
  "sana's fyrtorch": offhand("sanas-fyrtorch"),
  "sanas fyrtorch": offhand("sanas-fyrtorch"),
  "tagga's corehammer": offhand("taggas-corehammer"),
  "taggas corehammer": offhand("taggas-corehammer"),
  "croesus foultorch": prog("croesus-foultorch"),
  "croesus sporehammer": prog("croesus-sporehammer"),

  // --- TzKal-Zuk ---
  "ek-zekkil": prog("ek-zekkil"),
  "ek zekkil": prog("ek-zekkil"),
  "magma tempest": codex("magma-tempest"),
  "scripture of ful": prog("scripture-of-ful"),
  "igneous kal-zuk": prog("igneous-kal-zuk"),
  "igneous kal zuk": prog("igneous-kal-zuk"),
  "igneous cape": prog("igneous-kal-zuk"),
  // Style + combined igneous (equipment inventory); BiS combined also under progression above
  "igneous kal-ket": equip("igneous-kal-ket"),
  "igneous kal ket": equip("igneous-kal-ket"),
  "igneous kal-mej": equip("igneous-kal-mej"),
  "igneous kal mej": equip("igneous-kal-mej"),
  "igneous kal-xil": equip("igneous-kal-xil"),
  "igneous kal xil": equip("igneous-kal-xil"),
  "igneous kal-mor": equip("igneous-kal-mor"),
  "igneous kal mor": equip("igneous-kal-mor"),

  // --- Rasial / First Necromancer ---
  "omni guard": prog("omni-guard"),
  "soulbound lantern": prog("soulbound-lantern"),
  "robes of the first necromancer": prog("first-necromancer-robe-top"),
  "first necromancer's equipment": prog("first-necromancer-robe-top"),
  "first necromancer equipment": prog("first-necromancer-robe-top"),
  "first necromancer robes": prog("first-necromancer-robe-top"),
  "first necromancers equipment": prog("first-necromancer-robe-top"),

  // --- Gate of Elidinis ---
  "eclipsed soul prayer codex": perm("eclipsed-soul-prayer-codex"),
  "eclipsed soul": codex("eclipsed-soul"),
  "memory dowser": prog("memory-dowser"),
  "runic attuner": prog("runic-attuner"),
  "scripture of elidinis": prog("scripture-of-elidinis"),

  // --- Sanctum of Rebirth / Nakatra ---
  "roar of awakening": prog("roar-of-awakening"),
  "ode to deceit": prog("ode-to-deceit"),
  "divine rage prayer codex": perm("divine-rage-prayer-codex"),
  "divine rage": codex("divine-rage"),
  "scripture of amascut": prog("scripture-of-amascut"),
  "shard of genesis essence": prog("shard-of-genesis-essence"),

  // --- Zemouregal & Vorkath ---
  "dracolich armour": prog("dracolich-hauberk"),
  "elite dracolich armour": prog("elite-dracolich-hauberk"),
  "invoke lord of bones": codex("invoke-lord-of-bones"),

  // --- GWD1 ---
  "bandos equipment": rootUp("bandos-chestplate"),
  "armadyl equipment": rootUp("armadyl-chestplate"),
  "subjugation equipment": rootUp("subjugation-robe-top"),
  "robes of subjugation": equip("garb-of-subjugation"),
  "godsword components": perm("godswords"),
  godswords: perm("godswords"),
  "armadyl godsword": equip("armadyl-godsword"),
  "bandos godsword": equip("bandos-godsword"),
  "saradomin godsword": prog("saradomin-godsword"),
  "zamorak godsword": equip("zamorak-godsword"),

  // --- Nex t80 ---
  torva: equip("torva-platebody"),
  "torva armour": equip("torva-platebody"),
  "torva set": equip("torva-platebody"),
  pernix: prog("pernix-body"),
  "pernix armour": prog("pernix-body"),
  "pernix set": prog("pernix-body"),
  virtus: prog("virtus-robe-top"),
  "virtus armour": prog("virtus-robe-top"),
  "virtus set": prog("virtus-robe-top"),
  "virtus equipment": prog("virtus-robe-top"),

  // --- Queen Black Dragon ---
  "royal crossbow": prog("royal-crossbow"),

  // --- Vorago ---
  "seismic wand": prog("seismic-wand"),
  "seismic singularity": prog("seismic-singularity"),
  "tectonic energy": prog("tectonic-energy"),
  "tectonic robe armour": prog("tectonic-robe-top"),
  "tectonic armour": prog("tectonic-robe-top"),

  // --- Nex: Angel of Death ---
  "wand of the praesul": prog("wand-of-the-praesul"),
  "wand of praesul": prog("wand-of-praesul"),
  "imperium core": prog("imperium-core"),
  "praesul codex": prog("praesul-codex"),

  // --- Dagannoth Kings ---
  "berserker ring": prog("berserker-ring"),
  "dragon hatchet": prog("dragon-hatchet"),
  "warrior ring": equip("warrior-ring"),
  "archers' ring": equip("archers-ring"),
  "archers ring": equip("archers-ring"),
  "seers' ring": equip("seers-ring"),
  "seers ring": equip("seers-ring"),

  // --- GWD2 / Heart of Gielinor ---
  "dragon rider lance": prog("dragon-rider-lance"),
  "wand of the cywir elders": prog("wand-of-the-cywir-elders"),
  "orb of the cywir elders": equip("orb-of-the-cywir-elders"),
  "shadow glaives": perm("shadow-glaives"),
  "shadow glaive": prog("shadow-glaive"),
  "blade of avaryss": equip("blade-of-avaryss"),
  "blade of nymora": equip("blade-of-nymora"),
  "anima core equipment": prog("anima-core-body-of-zaros"),
  "anima core armour": prog("anima-core-body-of-zaros"),

  // --- Telos ---
  "seren godbow": prog("seren-godbow"),
  "staff of sliske": prog("staff-of-sliske"),
  "zaros godsword": prog("zaros-godsword"),
  zgs: prog("zaros-godsword"),

  // --- Kalphite King ---
  "drygore weapons": perm("drygore-weapons"),
  "drygore mace": prog("drygore-mace"),
  "drygore longsword": equip("drygore-longsword"),
  "drygore rapier": equip("drygore-rapier"),

  // --- Amascut, the Devourer ---
  "devourer's guard": prog("devourers-guard"),
  "devourers guard": prog("devourers-guard"),
  "tumeken's light": prog("tumekens-light"),
  "tumekens light": prog("tumekens-light"),
  "tumeken's resplendence equipment": prog("tumekens-resplendence-robe-top"),
  "tumekens resplendence equipment": prog("tumekens-resplendence-robe-top"),
  "tumeken's resplendence": prog("tumekens-resplendence-robe-top"),

  // --- Araxxor / Araxxi ---
  "noxious scythe": prog("noxious-scythe"),
  "noxious staff": equip("noxious-staff"),
  "noxious longbow": prog("noxious-longbow"),
  "noxious weapons": perm("noxious-weapons"),
  "noxious weapon": perm("noxious-weapons"),
  "noxious weapon components": perm("noxious-weapons"),
  "noxious scythe components": prog("noxious-scythe"),
  "noxious staff components": equip("noxious-staff"),
  "noxious longbow components": prog("noxious-longbow"),

  // --- Solak / Lost Grove ---
  "blightbound crossbow": prog("blightbound-crossbow"),
  "off-hand blightbound crossbow": equip("off-hand-blightbound-crossbow"),
  "offhand blightbound crossbow": prog("offhand-blightbound-crossbow"),
  "erethdor's grimoire": prog("erethdors-grimoire"),
  "erethdors grimoire": prog("erethdors-grimoire"),
  "torn grimoire pages": prog("erethdors-grimoire"),

  // --- Raksha ---
  "greater ricochet": codex("greater-ricochet"),
  "greater chain": codex("greater-chain"),
  divert: codex("divert"),
  "fleeting boots": prog("fleeting-boots"),
  "laceration boots": prog("laceration-boots"),
  "blast diffusion boots": prog("blast-diffusion-boots"),
  "shadow spike": prog("shadow-spike"),
  "shadow spike upgrades to tier 90": prog("shadow-spike"),

  // --- Barrows: Rise of the Six ---
  "malevolent energy": prog("malevolent-energy"),
  "malevolent armour": prog("malevolent-cuirass"),
  "malevolent cuirass": prog("malevolent-cuirass"),

  // --- ED2 Dragonkin Laboratory ---
  "greater fury": codex("greater-fury"),
  "greater flurry": codex("greater-flurry"),
  "greater barge": codex("greater-barge"),
  "draconic energy": prog("draconic-energy"),

  // --- ED3 Shadow Reef ---
  "eldritch crossbow": prog("eldritch-crossbow"),
  "eldritch crossbow components": prog("eldritch-crossbow"),

  // --- Legiones / Monastery of Ascension ---
  "ascension crossbow": prog("ascension-crossbow"),
  "off-hand ascension crossbow": equip("off-hand-ascension-crossbow"),
  "ascension grips": equip("ascension-grips"),

  // --- Magister ---
  "gloves of passage": equip("gloves-of-passage"),
  "enhanced gloves of passage": equip("enhanced-gloves-of-passage"),

  // --- Access / materials (inventory or permanent-unlock art only) ---
  "pale energy": "/game/upgrades/skilling-production/pale-energy.png",
  monolith: perm("mysterious-monolith"),
  "mysterious monolith": perm("mysterious-monolith"),
  museum: perm("museum-donation-bin"),
  "museum donation bin": perm("museum-donation-bin"),
  "archaeology guild": perm("archaeology-guild-shop"),
  "archaeology guild shop": perm("archaeology-guild-shop"),
  "ritual site": perm("um-ritual-site"),
  "city of um": perm("um-ritual-site"),
  "deathdealer robe armour": equip("deathdealer-robe-top"),
  "necromancy power armour": equip("deathdealer-robe-top"),
  "deathdealer armour": equip("deathdealer-robe-top"),

  // --- GWD1 piece lists (slash expansion) ---
  "bandos helmet": equip("bandos-helmet"),
  "bandos chestplate": rootUp("bandos-chestplate"),
  "bandos tassets": equip("bandos-tassets"),
  "bandos gloves": equip("bandos-gloves"),
  "bandos boots": equip("bandos-boots"),
  "armadyl helmet": equip("armadyl-helmet"),
  "armadyl chestplate": rootUp("armadyl-chestplate"),
  "armadyl chainskirt": equip("armadyl-chainskirt"),
  "armadyl gloves": equip("armadyl-gloves"),
  "armadyl boots": equip("armadyl-boots"),
  "hood of subjugation": equip("hood-of-subjugation"),
  "garb of subjugation": equip("garb-of-subjugation"),
  "gown of subjugation": equip("gown-of-subjugation"),
  "gloves of subjugation": equip("gloves-of-subjugation"),
  "boots of subjugation": equip("boots-of-subjugation"),

  // --- Hermod: hermodic plate asset missing; power armour → deathdealer / deathwarden ---
  "deathwarden robe armour": prog("deathwarden-robe-top"),
  "deathwarden armour": prog("deathwarden-robe-top"),
  "deathwarden robes": prog("deathwarden-robe-top"),
  deathwarden: prog("deathwarden-robe-top"),
  deathdealer: equip("deathdealer-robe-top"),

  // --- Corporeal Beast ---
  "holy elixir": `/game/upgrades/skilling-production/holy-elixir.png`,
  "spirit shield": perm("spirit-shield"),
  "spectral spirit shield": equip("spectral-spirit-shield"),
  "arcane spirit shield": equip("arcane-spirit-shield"),
  "elysian spirit shield": equip("elysian-spirit-shield"),
  "divine spirit shield": equip("divine-spirit-shield"),
  // sigils: no inventory icons published — omit (wrong finished-shield art worse than none)

  // --- Rex Matriarchs / Osseous ---
  "skeka's hypnowand": offhand("skekas-hypnowand"),
  "skekas hypnowand": offhand("skekas-hypnowand"),
  "occultist's ring": equip("occultists-ring"),
  "occultists ring": equip("occultists-ring"),
  "champion's ring": util("champions-ring"),
  "champions ring": util("champions-ring"),
  "channeler's ring": util("channelers-ring"),
  "channelers ring": util("channelers-ring"),
  "reaver's ring": util("reavers-ring"),
  "reavers ring": util("reavers-ring"),
  "stalker's ring": util("stalkers-ring"),
  "stalkers ring": util("stalkers-ring"),

  // --- Anachronia (gemstone / terrasaur / totems / mattock / double surge) ---
  "dragon mattock": prog("dragon-mattock"),
  // inventory under upgrades/progression (equipment/ copies not published)
  "gemstone helm": prog("gemstone-helm"),
  "gemstone hauberk": prog("gemstone-hauberk"),
  // gemstone greaves/gauntlets/boots: no published inventory icons — omit
  "terrasaur maul components": prog("terrasaur-maul"),
  "anachronia totems": perm("anachronia-totem"),
  "anachronia totem": perm("anachronia-totem"),
  "totem of vitality": perm("totem-of-vitality"),
  "totem of summoning": perm("totem-of-summoning"),
  "anachronia codex": perm("anachronia-codex"),
  "codex lectern": perm("anachronia-codex"),
  // ability-codices/double-* art is mislabeled; use movement ability icons
  "double surge": "/game/combat/abilities/movement/surge.png",
  "double escape": "/game/combat/abilities/movement/escape.png",
  "double surge codex": "/game/combat/abilities/movement/surge.png",
  "double escape codex": "/game/combat/abilities/movement/escape.png",
  "imcando mattock": perm("imcando-mattock"),
  "crystal mattock": prog("crystal-mattock"),
  "gemstone golem outfit": prog("gemstone-golem-outfit"),

  // --- Fremennik / Lunar ---
  "lunar spellbook": perm("lunar-spellbook"),
  lunar: perm("lunar-spellbook"),

  // --- Desert drygore / khopesh pieces ---
  "off-hand drygore mace": equip("off-hand-drygore-mace"),
  "offhand drygore mace": equip("off-hand-drygore-mace"),
  "off-hand drygore longsword": equip("off-hand-drygore-longsword"),
  "offhand drygore longsword": equip("off-hand-drygore-longsword"),
  "off-hand drygore rapier": equip("off-hand-drygore-rapier"),
  "offhand drygore rapier": equip("off-hand-drygore-rapier"),
  "khopesh of the kharidian": equip("khopesh-of-the-kharidian"),
  "khopesh of tumeken": equip("khopesh-of-tumeken"),
  "khopesh of elidinis": equip("khopesh-of-elidinis"),
  "off-hand khopesh of the kharidian": equip("off-hand-khopesh-of-the-kharidian"),
  "offhand khopesh of the kharidian": equip("off-hand-khopesh-of-the-kharidian"),

  // --- GWD2 refined + style splits ---
  "refined anima core armour": prog("refined-anima-core-body-of-zaros"),
  "refined anima core equipment": prog("refined-anima-core-body-of-zaros"),
  "refined anima core": prog("refined-anima-core-body-of-zaros"),
  "anima core of zaros": equip("anima-core-body-of-zaros"),
  "anima core of zaros armour": equip("anima-core-body-of-zaros"),
  "anima core of zamorak": equip("anima-core-body-of-zamorak"),
  "anima core of zamorak armour": equip("anima-core-body-of-zamorak"),
  "anima core of seren": equip("anima-core-body-of-seren"),
  "anima core of seren armour": equip("anima-core-body-of-seren"),
  "anima core of sliske": equip("anima-core-body-of-sliske"),
  "anima core of sliske armour": equip("anima-core-body-of-sliske"),
  "off-hand shadow glaive": equip("off-hand-shadow-glaive"),
  "offhand shadow glaive": equip("off-hand-shadow-glaive"),

  // --- TokHaar-Kal (Fight Kiln) + Fire cape (Fight Cave) ---
  // Igneous style aliases live under TzKal-Zuk above (no dup keys).
  "tokhaar-kal-ket": equip("tokhaar-kal-ket"),
  "tokhaar kal-ket": equip("tokhaar-kal-ket"),
  "tokhaar kal ket": equip("tokhaar-kal-ket"),
  "tokhaar-kal-xil": equip("tokhaar-kal-xil"),
  "tokhaar kal-xil": equip("tokhaar-kal-xil"),
  "tokhaar kal xil": equip("tokhaar-kal-xil"),
  "tokhaar-kal-mej": equip("tokhaar-kal-mej"),
  "tokhaar kal-mej": equip("tokhaar-kal-mej"),
  "tokhaar kal mej": equip("tokhaar-kal-mej"),
  "tokhaar-kal-mor": equip("tokhaar-kal-mor"),
  "tokhaar kal-mor": equip("tokhaar-kal-mor"),
  "tokhaar kal mor": equip("tokhaar-kal-mor"),
  "tokhaar-kal": equip("tokhaar-kal-ket"),
  "tokhaar kal": equip("tokhaar-kal-ket"),
  "tokhaar-kal capes": equip("tokhaar-kal-ket"),
  "tokhaar kal capes": equip("tokhaar-kal-ket"),
  "fire cape": prog("fire-cape"),

  // --- QBD / nightmare ---
  "nightmare gauntlets": equip("nightmare-gauntlets"),
  "enhanced nightmare gauntlets": equip("enhanced-nightmare-gauntlets"),

  // --- Other high-profile combat uniques ---
  "hexhunter bow": equip("hexhunter-bow"),
  "cinderbane gloves": util("cinderbane-gloves"),
  "polypore staff": equip("polypore-staff"),
  "ganodermic armour": equip("ganodermic-poncho"),
  "ganodermic poncho": equip("ganodermic-poncho"),
  "terrasaur maul": prog("terrasaur-maul"),
  "bow of the last guardian": prog("bow-of-the-last-guardian"),
  "abyssal scourge": equip("abyssal-scourge"),
  "essence of finality": `/game/upgrades/permanent-equipment/essence-of-finality.png`,
  "amulet of souls": util("amulet-of-souls"),
  "reaper necklace": util("reaper-necklace"),
  "ring of death": util("ring-of-death"),
  "deathtouch bracelet": equip("deathtouch-bracelet"),
  "asylum surgeon's ring": util("asylum-surgeons-ring"),
  "asylum surgeons ring": util("asylum-surgeons-ring"),
  dreadnips: perm("dreadnip"),
  dreadnip: perm("dreadnip"),
  "sirenic armour": prog("sirenic-hauberk"),
  "elite sirenic armour": prog("elite-sirenic-hauberk"),
  "elite tectonic robe armour": prog("elite-tectonic-robe-top"),
  "elite tectonic armour": prog("elite-tectonic-robe-top"),
  "gemstone armour": prog("gemstone-hauberk"),
  "chaotic equipment": prog("chaotic-rapier"),
  "chaotic rapier": prog("chaotic-rapier"),
  "chaotic staff": equip("chaotic-staff"),
  "chaotic crossbow": equip("chaotic-crossbow"),
  "chaotic kiteshield": prog("chaotic-kiteshield"),
  "masuta's warspear": equip("masutas-warspear"),
  "masutas warspear": equip("masutas-warspear"),
  "laniakea's spear": equip("laniakeas-spear"),
  "laniakeas spear": equip("laniakeas-spear"),

  // --- Permanent unlocks / access tokens (honest inventory or unlock art) ---
  "artificer's measure": perm("artificers-measure"),
  "artificers measure": perm("artificers-measure"),
  "ferocious ring": perm("ferocious-ring"),
  "hexcrest": perm("hexcrest"),
  "focus sight": perm("focus-sight"),
  "luck of the dwarves": perm("luck-of-the-dwarves"),
  "always adze": perm("always-adze"),
  "slayer codex": perm("slayer-codex"),
};

/** Apostrophe-stripped key → path (when map only has the apostrophe form). */
const REWARD_ICON_NO_APOS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(REWARD_ICON_BY_LABEL)) {
    const na = k.replace(/['’]/g, "");
    if (na !== k && out[na] == null) out[na] = v;
  }
  return out;
})();

/** True when a label has an explicit reward alias. */
export function hasRewardIconAlias(label: string): boolean {
  return resolveRewardIconLabel(label) != null;
}

/** Resolve a single reward token to a published icon path, or null. */
export function resolveRewardIconLabel(label: string): string | null {
  const key = label.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  if (REWARD_ICON_BY_LABEL[key]) return REWARD_ICON_BY_LABEL[key]!;
  // Apostrophe-insensitive: label without ' matches keys with or without.
  const noApos = key.replace(/['’]/g, "");
  if (REWARD_ICON_BY_LABEL[noApos]) return REWARD_ICON_BY_LABEL[noApos]!;
  if (REWARD_ICON_NO_APOS[noApos]) return REWARD_ICON_NO_APOS[noApos]!;
  return null;
}
