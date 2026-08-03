import type { RegionId } from "@/league";
import { isRegionId } from "@/league";
import {
  dataEntityIconPath,
  equipmentIconPath,
  isSceneryPermanentUnlock,
  slugifyIconLabel,
  upgradeIconPath,
} from "@/lib/gameArt";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { pinForHighlight } from "@/map/data/placeAnchors";
import { hasRewardIconAlias, resolveRewardIconLabel } from "@/lib/rewardIconAliases";

/** Allows the complete 13-piece brawling-glove set plus overflow. */
export const REWARD_ICON_CAP = 14;
export const REWARD_DISPLAY_MAX = 240;

const TRAILING_NOISE =
  /\s+(?:ability codices?|prayer codices?|components?|equipment|upgrades?|armour sets?|armor sets?|armours?|armors?|weapons?|sets?|materials?|path|ladder|residual|drops?|table|uniques?)$/i;

const TOKEN_NOISE =
  /^(?:including|plus|source|see|also|etc|unlocks|effects|level|t\d+|divination\s+\d|enhanced glove(?:s)?|glove path|materials?|components?|equipment|upgrades?|uniques?|progression|access|and more)$/i;

const SKILL_TYPES = new Set([
  "agility",
  "archaeology",
  "construction",
  "cooking",
  "crafting",
  "divination",
  "dungeoneering",
  "farming",
  "firemaking",
  "fishing",
  "fletching",
  "herblore",
  "hunter",
  "invention",
  "magic",
  "mining",
  "necromancy",
  "prayer",
  "ranged",
  "runecrafting",
  "slayer",
  "smithing",
  "strength",
  "summoning",
  "thieving",
  "woodcutting",
]);

const PURE_TYPE: Record<string, string> = {
  boss: "Boss",
  bossing: "Boss",
  "boss dungeon": "Dungeon",
  "bossing hub": "Boss hub",
  upgrade: "Upgrade",
  skilling: "Skilling",
  combat: "Combat",
  "combat/slayer": "Combat / Slayer",
  "slayer/bossing": "Slayer / Boss",
  "slayer/combat": "Slayer / Combat",
  progression: "Progression",
  "slayer master": "Slayer master",
  "weekly herblore activity": "Herblore",
  "player-owned farm expansion": "Farming",
  "passive multi-skill xp stations": "Skilling",
  "passive kingdom resource supply": "Kingdom",
  "kingdom island": "Kingdom",
  "runecrafting altar method": "Runecrafting",
  "lunar spell produce-point activity": "Magic",
  "lunar spellbook and skilling hub": "Magic hub",
  "necromancy ritual site pressure": "Necromancy",
  "yak hide / pof species source": "Farming",
  "archaeology dig site": "Archaeology",
  "regional base camp hub": "Hub",
  "city/skilling hub": "Hub",
  "high-level hub": "Hub",
  "construction / slayer hub": "Hub",
  "thieving / mining hub": "Hub",
};

export function mapPlaceHref(regionId: RegionId, place: string): string {
  return `/map#region=${regionId}&place=${encodeURIComponent(place)}`;
}

export function mapRegionHref(regionId: RegionId): string {
  return `/map#region=${regionId}`;
}

export function contentRewardsSource(text: string): string {
  let s = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s === "—") return "—";

  const unlocksHit = s.match(/(?:^|\s·\s)Unlocks:\s*([^·]+)/i);
  const effectsHit = s.match(/(?:^|\s·\s)Effects:\s*([^·]+)/i);
  if (unlocksHit?.[1]?.trim()) {
    s = unlocksHit[1].trim();
  } else if (effectsHit?.[1]?.trim()) {
    s = effectsHit[1].trim();
  } else if (s.includes(" · ")) {
    const parts = s
      .split(/\s·\s/)
      .map((p) => p.trim())
      .filter(Boolean);
    const listish = [...parts]
      .reverse()
      .find(
        (p) =>
          /[,;]/.test(p) &&
          p.length <= 200 &&
          p.split(/[,;]/).length >= 2 &&
          !/reputation|drop rates|working taxonomy|densify|residual/i.test(p),
      );
    if (listish) s = listish;
  }

  const stop = s.search(
    /\s·\s(?:Region status|Region pressure|Confidence|Notes?|Working taxonomy|Hard |Soft )\b/i,
  );
  if (stop > 0) s = s.slice(0, stop).trim();

  s = s
    .replace(/\s*·?\s*Source:.*$/i, "")
    .replace(/^(?:Unlocks|Effects):\s*/i, "")
    .replace(/^Location:\s*[^·,;]+(?:\s·\s)?/i, "")
    .trim();
  return s || "—";
}

export function clipRewardDisplay(text: string, max = REWARD_DISPLAY_MAX): string {
  const s = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s === "—") return s || "—";
  if (s.length <= max) return s;
  const ellipsis = "...";
  const budget = Math.max(8, max - ellipsis.length);
  const cut = s.slice(0, budget);
  const sp = cut.lastIndexOf(" ");
  const base = (sp > budget * 0.55 ? cut.slice(0, sp) : cut).trimEnd();
  return `${base}${ellipsis}`;
}

export function contentRewardTokens(text: string): string[] {
  const raw = contentRewardsSource(text);
  if (!raw || raw === "—") return [];

  const hasListSep = /[,;·|]/.test(raw) || /\s+and\s+/i.test(raw);
  if (!hasListSep) {
    if (raw.length > 72 || raw.split(/\s+/).length > 10) return [];
    return cleanTokenParts([raw]);
  }

  const useAnd = raw.length <= 140 && (raw.match(/,/g) ?? []).length <= 6;
  const splitter = useAnd ? /\s*[,;·|]\s*|\s+and\s+/i : /\s*[,;·|]\s*/;
  const parts = raw
    .split(splitter)
    .map((part) =>
      part
        .replace(/\s+/g, " ")
        // "Leng artefact + dark nilas -> Blade of Leng / Off-hand" - keep rightmost product when arrowed.
        .replace(/^.*?(?:\u2192|->)\s*/, "")
        .replace(/^(?:including|plus|also)\s+/i, "")
        .replace(/\s+\([^)]*\)/g, "")
        .replace(/\s+\[[^\]]*\]/g, "")
        .trim(),
    )
    .filter((part) => part.length >= 3 && !/^\d/.test(part));

  return cleanTokenParts(parts);
}

function expandSlashList(label: string): string[] {
  if (!label.includes(" / ")) return [label];
  const parts = label
    .split(" / ")
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  if (parts.length < 2) return [label];
  if (parts.some((p) => p.split(/\s+/).length > 5) || parts.length > 8) {
    return [parts[0]!];
  }
  const head = parts[0]!;
  const headWords = head.split(/\s+/);
  if (headWords.length >= 2) {
    const prefix = headWords.slice(0, -1).join(" ");
    return parts.map((p) =>
      p.toLowerCase().startsWith(prefix.toLowerCase()) ? p : `${prefix} ${p}`,
    );
  }
  const last = parts[parts.length - 1]!;
  const ofSuffix = last.match(/\s+(of\s+\S+(?:\s+\S+)?)$/i);
  if (ofSuffix) {
    const suffix = ofSuffix[1]!;
    return parts.map((p) => (/\sof\s/i.test(p) ? p : `${p} ${suffix}`));
  }
  return parts;
}

function cleanTokenParts(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const expanded = expandSlashList(part.replace(/\s+/g, " ").trim());
    for (const piece of expanded) {
      const label = piece.replace(/\s+/g, " ").trim();
      if (!label || label.length > 72) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      if (TOKEN_NOISE.test(key)) continue;
      const strippedKey = label.replace(TRAILING_NOISE, "").trim().toLowerCase();
      if (!strippedKey || TOKEN_NOISE.test(strippedKey)) continue;
      if (/^(?:level|t\d+)/i.test(label)) continue;
      if (
        label.split(/\s+/).length >= 8 &&
        !hasRewardIconAlias(key) &&
        !hasRewardIconAlias(strippedKey)
      ) {
        continue;
      }
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}

export function resolveRewardIcon(label: string): string | null {
  const raw = label.replace(/\s+/g, " ").trim();
  if (!raw) return null;

  const attempts: string[] = [raw];
  const push = (s: string) => {
    const t = s.replace(/\s+/g, " ").trim();
    if (!t) return;
    if (attempts.some((a) => a.toLowerCase() === t.toLowerCase())) return;
    attempts.push(t);
  };
  // Wiki drop tables use "Extreme attack (1)" / "Weapon poison+++ (1)".
  push(raw.replace(/\s*\(\d+\)\s*$/g, ""));
  const stripped = raw.replace(TRAILING_NOISE, "").trim();
  push(stripped);
  push(stripped.replace(/\s*\(\d+\)\s*$/g, ""));

  // Aliases before slug fallbacks so "Weapon poison+++ (1)" hits +++ art, not weapon-poison.
  for (const attempt of attempts) {
    const aliased = acceptRewardPath(resolveRewardIconLabel(attempt));
    if (aliased) return aliased;
  }

  for (const attempt of attempts) {
    // Prefer /combat/equipment inventory over /upgrades plates.
    const equip = equipmentIconPath(slugifyIconLabel(attempt));
    if (equip) return equip;

    const up = upgradeIconPath(attempt);
    if (up && isStrictRewardPath(up)) return up;

    const entity = dataEntityIconPath({ name: attempt });
    if (entity && isStrictRewardPath(entity)) return entity;
  }
  return null;
}

function acceptRewardPath(src: string | null): string | null {
  if (!src) return null;
  // Explicit REWARD_ICON_BY_LABEL may point at boss plates (Muspah creature).
  // Do not open /game/bosses/ for entity fallback - that turns "Hermodic plates" into Hermod.
  if (src.startsWith("/game/bosses/")) return src;
  if (!isStrictRewardPath(src)) return null;
  const equipMatch = src.match(/^\/game\/combat\/equipment\/([^/]+)\.png$/i);
  if (equipMatch) {
    return equipmentIconPath(equipMatch[1]!) ? src : null;
  }
  return src;
}

function isStrictRewardPath(src: string): boolean {
  if (isSceneryPermanentUnlock(src)) return false;
  if (src.startsWith("/game/upgrades/")) return true;
  if (src.startsWith("/game/combat/equipment/")) return true;
  if (src.startsWith("/game/combat/abilities/")) return true;
  if (src.startsWith("/game/combat/") && !src.includes("/abilities/")) return true;
  return false;
}

export function contentRewardIcons(
  tokens: string[],
  cap = REWARD_ICON_CAP,
): { label: string; src: string }[] {
  const out: { label: string; src: string }[] = [];
  const seenSrc = new Set<string>();
  const limit = cap === Number.MAX_SAFE_INTEGER ? tokens.length : Math.max(0, cap);
  for (const label of tokens) {
    if (out.length >= limit) break;
    const src = resolveRewardIcon(label);
    if (!src || seenSrc.has(src)) continue;
    seenSrc.add(src);
    out.push({ label, src });
  }
  return out;
}

export type PresentedContentRewards = {
  sourceText: string;
  displayText: string;
  tokens: string[];
  icons: { label: string; src: string }[];
  overflowResolved: number;
};

export function presentContentRewards(
  textFull: string,
  cap = REWARD_ICON_CAP,
  displayMax = REWARD_DISPLAY_MAX,
): PresentedContentRewards {
  const sourceText = contentRewardsSource(textFull);
  const displayText = sourceText === "—" ? "—" : clipRewardDisplay(sourceText, displayMax);
  const tokens = contentRewardTokens(sourceText);
  const resolved = contentRewardIcons(tokens, Number.MAX_SAFE_INTEGER);
  const limit = Math.max(0, cap);
  const icons = resolved.slice(0, limit);
  const overflowResolved = Math.max(0, resolved.length - icons.length);
  return {
    sourceText,
    displayText,
    tokens,
    icons,
    overflowResolved,
  };
}

function titleCaseWords(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferTypeFromName(name: string): string {
  const n = name.toLowerCase();
  if (/\b(equipment|armour|armor|weapons?|uniques|materials)\b/.test(n)) return "Upgrade";
  if (/\b(course|wisps?|farming|fishing|hunter|dig site|altar|ritual)\b/.test(n)) return "Skilling";
  if (/\b(slayer master|master)\b/.test(n)) return "Slayer";
  if (/\b(dungeon|sanctum|gate of|elite)\b/.test(n)) return "Dungeon";
  if (/,\s*the\b/.test(name) || /\b(king|queen|beast|general|commander)\b/i.test(name)) {
    return "Boss";
  }
  return "Content";
}

export function splitContentKind(
  kind: string,
  name = "",
): { type: string; locationHint: string | null } {
  const raw = kind.trim();
  if (!raw) return { type: inferTypeFromName(name), locationHint: null };

  const lower = raw.toLowerCase();
  if (PURE_TYPE[lower]) return { type: PURE_TYPE[lower], locationHint: null };

  if (SKILL_TYPES.has(lower)) {
    return { type: titleCaseWords(raw), locationHint: null };
  }

  if (SKILL_TYPES.has(lower.split(/[\s/]/)[0] ?? "")) {
    const skill = lower.split(/[\s/]/)[0]!;
    return { type: titleCaseWords(skill), locationHint: null };
  }

  if (raw.includes("/")) {
    const [left, right] = raw.split("/").map((s) => s.trim());
    const leftL = left.toLowerCase();
    const rightL = (right ?? "").toLowerCase();
    if (PURE_TYPE[rightL] || /boss|skilling|combat|slayer|access/.test(rightL)) {
      const type =
        PURE_TYPE[rightL] ??
        (/skilling boss/.test(rightL)
          ? "Skilling boss"
          : /boss/.test(rightL)
            ? "Boss"
            : /access/.test(rightL)
              ? "Access"
              : titleCaseWords(right));
      return { type, locationHint: left || null };
    }
    if (PURE_TYPE[leftL] || SKILL_TYPES.has(leftL)) {
      return {
        type: PURE_TYPE[leftL] ?? titleCaseWords(left),
        locationHint: right || null,
      };
    }
    return { type: inferTypeFromName(name), locationHint: left || raw };
  }

  if (
    /\b(dungeon|sanctum|falador|port sarim|grotworm|borehole|fort forinthry|city of um|underworld|brimhaven|wilderness|menaphos|prif|god wars|heart of gielinor|barrows|lost grove|monastery|lunar|keldagrim|anachronia|havenhythe)\b/i.test(
      raw,
    ) ||
    (/[A-Z]/.test(raw[0] ?? "") && raw.split(/\s+/).length >= 1 && !PURE_TYPE[lower])
  ) {
    if (!SKILL_TYPES.has(lower) && !PURE_TYPE[lower]) {
      if (raw.split(/\s+/).length >= 1) {
        return { type: inferTypeFromName(name), locationHint: raw };
      }
    }
  }

  return { type: titleCaseWords(raw), locationHint: null };
}

export type ContentLocation = {
  label: string | null;
  place: string | null;
  href: string | null;
};

export function resolveContentLocation(
  regionId: RegionId,
  name: string,
  kind: string,
): ContentLocation {
  const { locationHint } = splitContentKind(kind, name);

  const pin =
    pinForHighlight(regionId, name) ??
    pinForHighlight(regionId, kind) ??
    (locationHint ? pinForHighlight(regionId, locationHint) : null);

  if (pin) {
    return {
      label: pin.area,
      place: pin.area,
      href: mapPlaceHref(regionId, pin.area),
    };
  }

  if (locationHint) {
    const hintLower = locationHint.toLowerCase();
    if (PURE_TYPE[hintLower] || SKILL_TYPES.has(hintLower)) {
      return { label: null, place: null, href: null };
    }
    return {
      label: titleCaseWords(locationHint),
      place: null,
      href: null,
    };
  }

  return { label: null, place: null, href: null };
}

export function resolveTrainingLocation(
  regionId: RegionId,
  location: string,
  regionHints: string[] = [],
): ContentLocation {
  const loc = location.trim();
  if (!loc || loc === "—") return { label: null, place: null, href: null };

  const candidates: RegionId[] = [regionId];
  for (const hint of regionHints) {
    const id = hint.trim().toLowerCase();
    if (isRegionId(id) && !candidates.includes(id)) candidates.push(id);
  }

  for (const id of candidates) {
    const pin = pinForHighlight(id, loc);
    if (pin) {
      return {
        label: pin.area,
        place: pin.area,
        href: mapPlaceHref(id, pin.area),
      };
    }
  }

  return {
    label: loc.replaceAll("_", " "),
    place: null,
    href: null,
  };
}

export function contentTypeLabel(kind: string, name: string): string {
  return splitContentKind(kind, name).type;
}

function cleanInterestText(value: string): string {
  return decodeHtmlEntities(String(value ?? ""))
    .replace(/\u00a0/g, " ")
    .replace(/\[(?:edit|citation needed|source|note\s*\d*)\]/gi, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/(?:\s*·\s*){2,}/g, " · ")
    .trim();
}

export function presentInterestName(value: string): string {
  const raw = cleanInterestText(value).replace(/\s+/g, " ").trim();
  if (!raw) return "";

  if (/^Misthalin Runecrafting altars\b/i.test(raw)) return "Water & Earth altars";
  if (/^Asgarnia Runecrafting altars\b/i.test(raw)) return "Mind, Body & Law altars";
  if (/^Entrana Law altar\b/i.test(raw)) return "Law altar (Entrana)";
  if (/^Blood altar Runecrafting$/i.test(raw)) return "Blood altar";
  if (/^Death altar\b/i.test(raw)) return "Death altar";
  if (/^Ourania Runecrafting Altar\b/i.test(raw)) return "Ourania altar (ZMI)";
  if (/^Astral altar\b/i.test(raw)) return "Astral altar";
  if (/^Soul altar\b/i.test(raw)) return "Soul altar";
  if (/^Necromantic Rune Temple$/i.test(raw)) return "Necrotic altars";
  if (/^Runecrafting essence pouches\b/i.test(raw)) return "Essence pouches";
  if (/^Abyss Runecrafting stack$/i.test(raw)) return "Abyss Runecrafting";

  if (/^Ardougne farming patches\b/i.test(raw)) return "Ardougne farm patches";
  if (/^Highweald\s*\/\s*Deserted Mine mining access$/i.test(raw)) return "Highweald mines";
  if (/^The Arc skilling destinations\b/i.test(raw)) return "The Arc islands";
  if (/^Safecracking route$/i.test(raw)) return "Safes";
  if (/^Asgarnia safecracking circuit$/i.test(raw)) return "Safes";
  if (/^Player-owned ports skilling rewards\b/i.test(raw)) {
    return "Ports skilling rewards";
  }

  if (/^Decorated and exquisite urn craft infrastructure$/i.test(raw)) {
    return "Urn crafting";
  }
  if (/^Spirit shield \+ holy elixir \/ sigil densify$/i.test(raw)) {
    return "Spirit shields";
  }
  if (/^Games necklace teleport package$/i.test(raw)) return "Games necklace";
  if (/^Plague's End Prifddinas unlock package$/i.test(raw)) return "Plague's End";
  if (/^Seren skilling prayers package\b/i.test(raw)) return "Seren prayers";
  if (/^Allotment patch hub package$/i.test(raw)) return "Allotment patches";
  if (/^Harmony pillars\b/i.test(raw)) return "Harmony moss";
  if (/^Seren stones and corrupted ore$/i.test(raw)) return "Seren stones";
  if (/^Ithell harmonium harps\b/i.test(raw)) return "Ithell harps";
  if (/^Meilyr Recipe Shop and combination potions$/i.test(raw)) {
    return "Meilyr Recipe Shop";
  }
  if (/^Waterfall Fishing and Fishing Shop$/i.test(raw)) return "Waterfall Fishing";
  if (/^Crystal skillchompas\b/i.test(raw)) return "Crystal skillchompas";
  if (/^Perfect juju potion production path$/i.test(raw)) return "Perfect juju potions";
  if (/^Prifddinian worker's outfit\b/i.test(raw)) return "Prifddinian worker's outfit";
  if (/^Hefin Agility Course$/i.test(raw)) return "Hefin Agility Course";
  if (/^Skillcape shop$/i.test(raw)) return "Skillcape shop";

  if (/^Soul Supplies\b/i.test(raw)) return "Soul Supplies";
  if (/^City of Um ritual site\b/i.test(raw)) return "Um ritual site";
  if (/^Selene Necromancy\b/i.test(raw)) return "Selene prayers";
  if (/^Underworld Grimoire\b/i.test(raw)) return "Underworld Grimoire";
  if (/^Velucia museum\b/i.test(raw)) return "Velucia collections";
  if (/^Varrock Lumber Yard\b/i.test(raw)) return "Varrock sawmill";
  if (/^Kerapac Magic\b/i.test(raw)) return "Kerapac magic";
  if (/^Conservation of Energy\b/i.test(raw)) return "Conservation of Energy";
  if (/^Death Ward relic chain$/i.test(raw)) return "Death Ward";
  if (/^Fury of the Small relic chain$/i.test(raw)) return "Fury of the Small";
  if (/^Leng artefact T90 glove\b/i.test(raw)) return "Leng gloves";
  if (/^Deathwarden\b/i.test(raw) && /Deathdealer/i.test(raw)) return "Deathwarden / Deathdealer";
  if (/^Zamorak,\s*Lord of Chaos\b/i.test(raw)) return "Zamorak, Lord of Chaos";
  if (/^Slayer helmet \(craft/i.test(raw)) return "Slayer helmet";
  if (/^Ring of slaying\b/i.test(raw)) return "Ring of slaying";
  if (/^Full slayer helmet\b/i.test(raw)) return "Full slayer helmet";
  if (/^Wizards' Tower\b/i.test(raw)) return "Wizards' Tower";
  if (/^Woodcutters?' Grove\b/i.test(raw)) return "Woodcutters' Grove";
  if (/^Tier 3 Woodcutter's Grove\b/i.test(raw)) return "Woodcutters' Grove";
  if (/^Havenhythe canoe network$/i.test(raw)) return "Canoe network";
  if (/^Bloodweed\s*&\s*aggression potions$/i.test(raw)) return "Bloodweed / aggression pots";
  if (/^Wilderness herb patch$/i.test(raw)) return "Bloodweed / aggression pots";
  if (/^Abyss Runecrafting$/i.test(raw) || /^Abyss entrance$/i.test(raw))
    return "Abyss Runecrafting";
  if (/^Edgeville (Dungeon )?resource dungeons$/i.test(raw)) return "Edgeville resource dungeons";
  if (/^Black salamanders\b/i.test(raw)) return "Black salamanders";
  if (/^Daemonheim Rewards shop\b/i.test(raw)) return "Daemonheim Rewards";
  if (/^Chaotic weapons$/i.test(raw) || /^Chaotic equipment$/i.test(raw)) return "Chaotic weapons";
  if (/^Ruinous weapons$/i.test(raw)) return "Ruinous weapons";
  if (/^Dark facets$/i.test(raw)) return "Dark facets";
  if (/^Daemonheim Divination$/i.test(raw)) return "Daemonheim Divination";
  if (/^Primal ores?$/i.test(raw)) return "Primal ores";
  if (/^Wilderness bloodwood trees$/i.test(raw)) return "Bloodwood trees";
  if (/^Abandoned Mine salve shard mining$/i.test(raw)) return "Salve amulet (e)";
  if (/^Ring of Vigour and passive conversion$/i.test(raw)) return "Ring of Vigour";
  if (/^Ring of Vigour passive$/i.test(raw)) return "RoV passive";
  if (/^Ring of Vigour$/i.test(raw)) return "Ring of Vigour";
  if (/^Sophanem Slayer Dungeon\s*\/\s*The Magister$/i.test(raw)) return "The Magister";
  if (/^Corrupted creatures\s*&\s*soul devourers$/i.test(raw)) {
    return "Corrupted creatures";
  }
  if (/^Liberation of Mazcab$/i.test(raw)) return "Liberation of Mazcab";
  if (/^Agility Pyramid\b/i.test(raw)) return "Agility Pyramid";
  if (/^Het's Oasis\b/i.test(raw)) return "Het's Oasis";
  if (/^Mazcab Emergency Merchants$/i.test(raw)) return "Mazcab potion shop";
  if (/^Goebie scavengers$/i.test(raw)) return "Goebie scavengers";
  if (/^Sunken Pyramid\b/i.test(raw)) return "Sunken Pyramid";
  if (/^Beastmaster Durzag$/i.test(raw)) return "Beastmaster Durzag";
  if (/^Yakamaru$/i.test(raw)) return "Yakamaru";
  if (/^Vampyrism Aspect$/i.test(raw)) return "Vampyrism Aspect";
  if (/^Desert strykewyrm$/i.test(raw)) return "Desert strykewyrm";
  if (/^Sophanem plover birds\b/i.test(raw)) return "Sophanem plovers";
  if (/^Citharede Abbey\b/i.test(raw)) return "Citharede Abbey";
  if (/^Volcanic trapper outfit\b/i.test(raw)) return "Volcanic trapper";
  if (/^Player-owned port$/i.test(raw)) return "Player-owned port";
  if (/^Player-owned ports\b/i.test(raw)) return "Player-owned port";
  if (/^Mage Training Arena\b/i.test(raw)) return "Mage Training Arena";
  if (/^Menaphos$/i.test(raw)) return "Menaphos";
  if (/^Menaphos\b/i.test(raw) && /hub|reputation|VIP|district/i.test(raw)) {
    return "Menaphos";
  }

  const name = raw
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+progression$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) return "";

  if (/^Binding contract\b/i.test(name)) return "Ancient Summoning";
  if (/^Master thief's lockpick \+ stethoscope\b/i.test(name)) return "Master thief's tools";
  if (/^Ava's device chain$/i.test(name)) return "Ava's devices";
  if (/^Research team size ladder\b/i.test(name)) return "Research team upgrades";
  if (/^Prayer training infrastructure stack$/i.test(name)) return "Prayer training";
  if (/^War's Retreat hub amenities$/i.test(name)) return "War's Retreat";

  if (/^Chronotes currency economy\b/i.test(name)) return "Chronotes";
  if (/^Archaeology (Guild )?shop\b/i.test(name)) {
    return "Archaeology shop";
  }
  if (/^Archaeology Guild Shop and qualification upgrades$/i.test(name)) {
    return "Archaeology shop";
  }
  if (/^Archaeology Guild qualifications Intern\s*[→-]\s*Professor$/i.test(name)) {
    return "Guild qualifications";
  }
  if (/^Archaeology collectors and collection system$/i.test(name)) return "Collectors";
  if (/^Collectors Assemble\b/i.test(name)) return "Collectors Assemble";
  if (/^Hireable research team recruitment ladder$/i.test(name)) return "Research team";
  if (/^Archaeology research system$/i.test(name)) return "Archaeology research";
  if (/^Archaeology research team permanent\b/i.test(name)) return "Research team";
  if (/^Mysterious monolith\b/i.test(name)) return "Mysterious monolith";
  if (/^Professor additional relic loadout\b/i.test(name)) return "Extra relic loadout";
  if (/^Mattock precision upgrades\b/i.test(name)) return "Mattock precision";
  if (/^Tetracompass pieces\b/i.test(name)) return "Tetracompass";
  if (/^Museum donation bin\b/i.test(name)) return "Museum donation bin";
  if (/^Archaeology Campus and Varrock Dig Site hub$/i.test(name)) return "Archaeology Campus";
  if (/^Screening station\b/i.test(name)) return "Screening station";
  if (/^Archaeologist's workbench\b/i.test(name)) return "Archaeologist's workbench";
  if (/^Spear of Annihilation\b/i.test(name)) return "Spear of Annihilation";
  if (/^Font of Life relic\b/i.test(name)) return "Font of Life";
  if (/^Guildmaster Tony's mattock$/i.test(name)) return "Guildmaster Tony's mattock";
  if (/^Master archaeologist's outfit\b/i.test(name)) return "Master archaeologist outfit";
  if (/^Archaeologist's outfit$/i.test(name)) return "Archaeologist's outfit";
  if (/^High-value collector first-time permanent rewards$/i.test(name)) {
    return "Collector rewards";
  }
  if (/^Warforge Dig Site\b/i.test(name)) return "Warforge Dig Site";
  if (/^Thalmund'?s Forge\b/i.test(name)) return "Thalmund's Forge";
  if (/^Nex:\s*Angel of Death\b/i.test(name)) return "Nex: Angel of Death";
  if (/^Angel of Death\b/i.test(name)) return "Nex: Angel of Death";
  if (/^Stormguard Citadel Dig Site\b/i.test(name)) return "Stormguard Dig Site";
  if (/^Infernal Source Dig Site\b/i.test(name)) return "Infernal Source Dig Site";
  if (/^Senntisten Dig Site$/i.test(name)) return "Senntisten Dig Site";
  if (/^Imcando tools family\b/i.test(name)) return "Imcando tools";
  if (/^Dragon mattock\b/i.test(name)) return "Dragon mattock";
  if (/^Mattock of Time and Space$/i.test(name)) return "Mattock of Time and Space";
  if (/^It Belongs in a Museum!/i.test(name)) return "Museum log";
  if (/^Archaeology culture Expert titles$/i.test(name)) return "Expert titles";

  if (/^Edgeville\b/i.test(name) && /wilderness|on-ramp|skilling/i.test(name)) {
    return "Edgeville";
  }
  if (/^Port Sarim\b/i.test(name) && /dock|skilling/i.test(name)) return "Port Sarim";
  if (/^Taverley\b/i.test(name) && /Burthorpe/i.test(name)) return "Taverley / Burthorpe";
  if (/^Menaphos\b/i.test(name) && /skilling|district/i.test(name)) return "Menaphos";
  if (/^Lumbridge\b/i.test(name) && /skilling|early/i.test(name)) return "Lumbridge";
  if (/^Draynor Village\b/i.test(name) && /skilling|hub/i.test(name)) return "Draynor Village";
  if (/^Seers' Village\b/i.test(name) && /skilling|hub/i.test(name)) return "Seers' Village";
  if (/^Burgh de Rott\b/i.test(name) && /skilling|hub/i.test(name)) return "Burgh de Rott";
  if (/^Port Phasmatys\b/i.test(name) && /skilling|hub/i.test(name)) return "Port Phasmatys";
  if (/^Lunar Isle\b/i.test(name) && /skilling|hub/i.test(name)) return "Lunar Isle";
  if (/^TzHaar City\b/i.test(name) && /skilling|hub/i.test(name)) return "TzHaar City";
  if (/^Prifddinas\b/i.test(name) && /skilling|hub/i.test(name)) return "Prifddinas";
  if (/^Yanille\b/i.test(name) && /multi-skill|hub/i.test(name)) return "Yanille";
  if (/^Rellekka\b/i.test(name) && /Fremennik|hub/i.test(name)) return "Rellekka";
  if (/^Keldagrim\b/i.test(name) && /dwarven|hub/i.test(name)) return "Keldagrim";
  if (/^Amberfell\b/i.test(name) && /hub|village/i.test(name)) return "Amberfell";
  if (/^Catherby\b/i.test(name) && /fishing|farming|hub/i.test(name)) return "Catherby";
  if (/^Deep Sea Fishing hub\b/i.test(name)) {
    return /methods|boosts/i.test(name) ? "Deep Sea Fishing methods" : "Deep Sea Fishing";
  }
  if (/^Fort Forinthry Guardhouse\b/i.test(name)) return "Fort Guardhouse";
  if (/^Fort Forinthry Kitchen\b/i.test(name)) return "Fort Kitchen";
  if (/^Fort Forinthry Town Hall\b/i.test(name)) return "Fort Town Hall";

  return name
    .replace(
      /\s+(?:unique-collection ladder|currency economy|follow-on chain|densify|residual|ladder|package|infrastructure|permanent|family)$/i,
      "",
    )
    .replace(/\s+and essence access$/i, "")
    .replace(/\s+access geography$/i, "")
    .replace(/\s+and island skilling access$/i, "")
    .replace(/\s+Runecrafting geography$/i, "")
    .replace(/\s+access$/i, "")
    .replace(/\s+pressure stack$/i, "")
    .replace(/\s+stack$/i, "")
    .replace(/\s+network$/i, "")
    .replace(/\s+circuit$/i, "")
    .replace(/\s+overview$/i, "")
    .replace(/(?<=\baltar)\s+Runecrafting$/i, "")
    .replace(/\s+skilling and Wilderness on-ramp hub$/i, "")
    .replace(/\s+docks and skilling hub$/i, "")
    .replace(/\s+early[–\-]?mid skilling hub$/i, "")
    .replace(/\s+early skilling hub$/i, "")
    .replace(/\s+skilling hub$/i, "")
    .replace(/\s+multi-skill hub$/i, "")
    .replace(/\s+production hub$/i, "")
    .replace(/\s+on-ramp hub$/i, "")
    .replace(/\s+skilling boss hub$/i, "")
    .replace(/\s+hub amenities$/i, "")
    .replace(/\s+hubs$/i, "")
    .replace(/\s+hub$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function presentInterestMeta(value: string, maxLen = 48): string {
  let s = cleanInterestText(value);
  if (!s) return "";

  const lower = s.toLowerCase();
  const exact: Record<string, string> = {
    "regional multi-skill bank and production hub": "Bank and production",
    "regional multi-skill transport and shop infrastructure": "Docks and shops",
    "regional multi-skill settlement infrastructure": "Settlement",
    "regional starter multi-skill infrastructure": "Starter town",
    "regional city bank, furnace, and tokkul shop infrastructure": "Bank, furnace, TokKul",
    "coastal skilling hub": "Coastal skilling",
    "district skilling hub infrastructure residual": "District hub",
    "district skilling hub infrastructure": "District hub",
    "district skilling and utility hub": "District hub",
    "district mining/smithing infrastructure": "Mining and Smithing",
    "fishing activity and shop hub": "Fishing hub",
    "fishing activity method bundle": "Fishing methods",
    "passive multi-skill xp stations": "Passive XP stations",
    "regional summoning production hub pointer": "Summoning hub",
    "herblore perfect-juju production hub": "Perfect juju recipes",
    "fort bank, construction tiers, and rested xp": "Bank, tiers, rested XP",
    "fort construction building infrastructure": "Construction hub",
    "rested experience and fort bank infrastructure": "Rested XP",
    "cooking infrastructure and range hub": "Cooking",
    "slayer infrastructure": "Slayer",
    "runecrafting geography": "Runecrafting",
    "runecrafting altar infrastructure": "Runecrafting",
    "runecrafting altar and island infrastructure": "Runecrafting",
    "runecrafting altar and lunar spellbook switch": "Runecrafting",
    "runecrafting altar and catalytic supply": "Runecrafting",
    "regional runecrafting altar infrastructure": "Runecrafting",
    "runecrafting altar infrastructure for necrotic runes": "Runecrafting",
    "runecrafting access infrastructure": "Runecrafting",
    "runecrafting access and efficiency stack": "Runecrafting",
    "runecrafting guild and portal infrastructure": "Runecrafting",
    "permanent multi-region rc essence-storage ladder": "Essence storage",
    "permanent endgame rc essence-storage pouch": "Essence storage",
    "regional boss bis drop source": "Boss uniques",
    "regional boss bis drop source residual": "Boss uniques",
    "permanent adrenaline combat progression": "Adrenaline",
    "daemonheim ring": "Daemonheim ring",
    "account passive": "Account passive",
    "aura overhaul — ancient magicks combat aspect": "Ancient Magicks Aspect",
    "permanent slayer rewards buy unlock — personal dungeon capacity": "Slayer dungeon",
    "permanent slayer rewards learn unlock — dungeon layout qol": "Slayer dungeon",
    "slayer permanent utility and reputation": "Slayer utility",
    "hunter activity and slayer supply adjacency": "Hunter",
    "ports voyage economy and eastern lands gate": "Ports",
    "magic utility minigame and permanent unlock shop": "Magic minigame",
    "permanent menaphos reputation and supply activity": "Menaphos",
    "woodcutting activity and reputation supply": "Woodcutting",
    "thieving activity and summoning utility": "Thieving",
    "fishing and cooking supply infrastructure": "Fishing",
    "regional reputation skilling unlocks": "Reputation",
    "permanent desert agility infrastructure": "Agility",
    "farming activity and pof supply infrastructure": "Farming",
    "hunter and prayer training supply": "Hunter / Prayer",
    "permanent prayer crafting upgrade infrastructure": "Prayer / Crafting",
    "hunter elite skilling outfit": "Hunter elite outfit",
    "invention guild machine infrastructure": "Invention machines",
    "achievement diary acquisition frame": "Diary rewards",
    "construction teleport and housing infrastructure": "POH",
    "invention production infrastructure": "Invention",
    "farming patch network infrastructure": "Farming patches",
    "farming patch infrastructure": "Farming patches",
    "prayer training infrastructure": "Prayer training",
    "permanent multi-skill urn production package": "Urn production",
    "multi-region elite skilling outfit portfolio package": "Elite outfits",
    "permanent multi-style slayer helmet ladder": "Slayer helm",
    "permanent infinite-rune staff craft ladder": "Rune staff",
    "cooking brewery infrastructure": "Brewery",
    "fishing permanent perk infrastructure": "Fishing perks",
    "regional mining infrastructure": "Mining",
    "regional mining infrastructure residual": "Mining",
    "necromancy ritual geography": "Necromancy",
    "magic guild infrastructure and rune-essence logistics": "Magic Guild",
    "necromancy supply shops": "Necromancy shops",
    "necromancy ritual infrastructure": "Rituals",
    "prayer unlock infrastructure": "Prayer",
    "underworld achievement skilling utility pocket": "Underworld diary",
    "underworld achievement skilling breakpoint densify": "Underworld diary",
    "construction plank production infrastructure": "Sawmill",
    "archaeology museum chronote progression checklist": "Museum",
    "archaeology collector and chronote infrastructure": "Museum",
    "archaeology museum collection-log infrastructure": "Museum",
    "magic ability codex gloves and scripture": "Magic uniques",
    "combat archaeology relic cross-region chain": "Archaeology relic",
    "combat archaeology and invention relic cross-region chain": "Archaeology relic",
    "style glove t90 upgrade hub": "T90 gloves",
    "style glove t90 upgrade hub residual": "T90 gloves",
    "necromancy crafted armour progression": "Necro armour",
    "necromancy crafted armour residual progression": "Necro armour",
    "quest-challenge combat equipment": "Quest reward",
    "quest-challenge equipment unlock": "Quest reward",
    "permanent prayer unlock scroll (daemonheim rewards)": "Prayer unlock",
    "permanent slayer equipment unlock": "Slayer",
    "permanent slayer teleport jewellery unlock": "Slayer",
    "permanent slayer teleport jewellery equipment": "Slayer",
    "woodcutting tool progression": "Woodcutting",
    "woodcutting hub infrastructure": "Woodcutting",
    "permanent regional travel infrastructure": "Travel",
  };
  if (exact[lower]) return exact[lower];

  s = s
    .replace(/\bfollow-on chain\b/gi, "")
    .replace(/\bacquisition frame\b/gi, "")
    .replace(/\bbis drop source\b/gi, "")
    .replace(/\bcross-region\b/gi, "")
    .replace(/\bfollow-on\b/gi, "")
    .replace(/\b(?:regional|permanent|global|explicit|working|canonical)\b/gi, "")
    .replace(
      /\b(?:infrastructure|package|residual|pointer|densify|taxonomy|geography|portfolio|checklist)\b/gi,
      "",
    )
    .replace(/\bmulti-skill\b/gi, "")
    .replace(/\bskilling hub\b/gi, "skilling")
    .replace(/\bproduction hub\b/gi, "production")
    .replace(/\bhub\b/gi, "")
    .replace(/\s*[,;·]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .trim();

  if (!s) return "Skilling";

  s = s.charAt(0).toUpperCase() + s.slice(1);

  if (s.length <= maxLen) return s;
  const ellipsis = "...";
  const budget = Math.max(8, maxLen - ellipsis.length);
  const cut = s.slice(0, budget);
  const sp = cut.lastIndexOf(" ");
  const base = (sp > budget * 0.55 ? cut.slice(0, sp) : cut).trimEnd();
  return `${base}${ellipsis}`;
}
