/**
 * Content-row → upgrade unique-list resolution for /data Browse.
 * Pure (no React) so unit tests can pin boss → package mapping.
 */

import { contentRewardsSource } from "./dataContentPresentation";

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
  "Pale wisps near Draynor": "Pale energy",
  // Catalog content name is "Fort Forinthry" (not the long construction label).
  "Fort Forinthry": "Fort buildings · chapel · Slayer hub",
  "Fort Forinthry construction and Slayer hub": "Fort buildings · chapel · Slayer hub",
  "City of Um / Underworld": "Ritual site · City of Um",
  // Hermodic plates have no local inventory art — Deathdealer is the power-armour craft path.
  "Hermod, the Spirit of War": "Deathdealer robe armour",
};

/**
 * Explicit full reward lists when the upgrade package omits key uniques
 * (cape chains indexed separately, minigame path rows with prose-only detail).
 * Same short-circuit as CONTENT_ACCESS — icons resolve via presentContentRewards.
 * Cap-5 chip order for Zuk: weapon, ability, scripture, BiS cape, one style cape.
 */
export const CONTENT_REWARD_OVERRIDES: Record<string, string> = {
  // Main Zuk uniques + BiS igneous cape only (no +N from listing every style stone).
  "TzKal-Zuk": "Ek-ZekKil, Magma Tempest, Scripture of Ful, Igneous Kal-Zuk",
  "TzHaar Fight Cave": "Fire cape",
  "Fight Kiln": "TokHaar-Kal-Ket, TokHaar-Kal-Xil, TokHaar-Kal-Mej, TokHaar-Kal-Mor",
  // Catalog Unlocks essay is huge — keep the two things players need.
  "The Empty Throne Room": "Auto-cycles · unique rocks inside",
  "Empty Throne Room": "Auto-cycles · unique rocks inside",
  // Abilities + boots would overflow the 5-chip strip (+2).
  Raksha: "Greater Ricochet, Greater Chain, Divert, Fleeting boots, Laceration boots",
  // Full GWD2 weapon list is 7 items — keep five headline uniques.
  "Heart of Gielinor / God Wars Dungeon 2":
    "Dragon Rider lance, Wand of the Cywir elders, Shadow glaives, Blade of Avaryss, Anima core equipment",
  "Heart of Gielinor":
    "Dragon Rider lance, Wand of the Cywir elders, Shadow glaives, Blade of Avaryss, Anima core equipment",
  // No upgrade package in catalog — short honest label.
  "Kalphite Queen": "Dragon chainbody, Kalphite queen head, Dragon 2h sword",
  // ED4 — Vestments of havoc is the headline package players care about.
  "Zamorak, Lord of Chaos": "Vestments of havoc, Chaos witch equipment",
  "Zamorak, Lord of Chaos (Undercity)": "Vestments of havoc, Chaos witch equipment",
  // Necrotic altars — four runes + max RC rate (20 XP/ess Miasma · ~2.5k ess/h pouches).
  "Necromantic Rune Temple":
    "Spirit rune, Bone rune, Flesh rune, Miasma rune · Max ~50k XP/h at Miasma",
  "Necrotic altars":
    "Spirit rune, Bone rune, Flesh rune, Miasma rune · Max ~50k XP/h at Miasma",
  // Havenhythe bosses — packages were stubs without Unlocks lists.
  "Ivar, King of Bones": "Bonecrusher maul, Magic skull mask, Colossal bone",
  "Silverquill, the Dreadhog": "Silver spines, Sanguine spines",
  "Sanguine Crawler": "Vampyrism gloves, Tainted seed, Sanguine matter",
  // Forinthry bloodweed stack — patch is the gate; pot is the payoff.
  "Bloodweed & aggression potions":
    "Clean bloodweed, Searing ashes, Aggression potion · 82 Herb · 6 min/dose · 17×17 aggro",
  "Wilderness herb patch":
    "Clean bloodweed, Searing ashes, Aggression potion · 82 Herb · 6 min/dose · 17×17 aggro",

  // Forinthry majors — short reward chips, no essay.
  "Abyss Runecrafting": "Multi-altar rifts, Magical thread, Pouch repair",
  "Abyss entrance": "Multi-altar rifts, Magical thread, Pouch repair",
  "Edgeville resource dungeons": "Chaos druids, Hill giants, Herb spawns, Limpwurt roots",
  "Edgeville Dungeon resource dungeons": "Chaos druids, Hill giants, Herb spawns, Limpwurt roots",
  "Wilderness bloodwood trees": "Bakriminel bolt tips",
  "Black salamanders": "Black salamander, Dark onyx core",
  "Black salamanders (Boneyard Hunter)": "Black salamander, Dark onyx core",
  "Mage Arena": "God staves, Claws of Guthix",
  "Corporeal Beast":
    "Spirit shield, Holy elixir, Arcane sigil, Elysian sigil, Divine sigil, Spectral sigil",
  "The Shadow Reef (ED3)": "Eldritch crossbow",
  "Daemonheim Rewards shop": "Chaotics, Ruinous weapons, Scrolls, Cleaners",
  "Chaotic weapons":
    "Chaotic rapier, Off-hand chaotic rapier, Chaotic longsword, Off-hand chaotic longsword, Chaotic maul, Chaotic spear, Chaotic staff, Chaotic crossbow, Off-hand chaotic crossbow, Chaotic claw, Off-hand chaotic claw",
  "Chaotic equipment":
    "Chaotic rapier, Off-hand chaotic rapier, Chaotic longsword, Off-hand chaotic longsword, Chaotic maul, Chaotic spear, Chaotic staff, Chaotic crossbow, Off-hand chaotic crossbow, Chaotic claw, Off-hand chaotic claw",
  "Ruinous weapons":
    "Ruinous rapier, Off-hand ruinous rapier, Ruinous maul, Ruinous staff, Ruinous crossbow, Off-hand ruinous crossbow, Ruinous guard, Ruinous lantern",
  "Dark facets": "Dark Facet of Grace, Dark Facet of Luck, Dark Facet of Passage",
  "Brawling gloves": "Brawling gloves",
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
  "Liberation of Mazcab": "Achto armour, Raids uniques",
  "Het's Oasis":
    "Powder of burials, Powder of penance, Powder of pulverising, Powder of protection, Powder of item protection",
  "Agility Pyramid": "Agility XP, Menaphos reputation",
  "Agility Pyramid (Jaleustrophos)": "Agility XP, Menaphos reputation",
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
  "K'ril Tsutsaroth": "subjugation",
  "Commander Zilyana": "Godswords",
  "God Wars Dungeon 1": "God Wars Dungeon 1 equipment",
  "Bandos equipment": "Bandos equipment",
  "Armadyl equipment": "Armadyl equipment",
  "Subjugation equipment": "subjugation",
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
