/**
 * /data Browse presentation helpers — pure, no React.
 * Type vs Location split, reward token icons, map deep links.
 * Never invent places; unpinned rows stay unlinked (no region-centroid fallback).
 */

import type { RegionId } from "@/league";
import { isRegionId } from "@/league";
import {
  dataEntityIconPath,
  equipmentIconPath,
  slugifyIconLabel,
  upgradeIconPath,
} from "@/lib/gameArt";
import { pinForHighlight } from "@/map/data/placeAnchors";
import {
  hasRewardIconAlias,
  resolveRewardIconLabel,
} from "@/lib/rewardIconAliases";

export const REWARD_ICON_CAP = 5;
/** Display clip for Rewards/access prose — icons always resolve from full source. */
export const REWARD_DISPLAY_MAX = 96;

/** Trailing noise stripped before resolve (label kept for tooltip). */
const TRAILING_NOISE =
  /\s+(?:components?|equipment|upgrades?|armour sets?|armor sets?|armours?|armors?|weapons?|sets?|materials?|path|ladder|residual)$/i;

/** Tokens that must never become reward chips. */
const TOKEN_NOISE =
  /^(?:including|plus|source|see|also|etc|unlocks|effects|level|t\d+|divination\s+\d|enhanced glove(?:s)?|glove path|materials?|components?|equipment|upgrades?|uniques?|progression|access|and more)$/i;

/** Closed skill / type tokens that must never become Location labels. */
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

/** kind → display Type when kind is purely taxonomic. */
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

/**
 * Normalize reward/access prose for tokenization.
 * Prefer **Unlocks:** (item lists) over **Effects:** (prose) when both exist.
 * Does **not** clip — callers clip display text separately.
 */
export function contentRewardsSource(text: string): string {
  let s = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s === "—") return "—";

  // Highest ROI: Unlocks lists beat Effects sentences (Bandos/Armadyl residuals).
  const unlocksHit = s.match(/(?:^|\s·\s)Unlocks:\s*([^·]+)/i);
  const effectsHit = s.match(/(?:^|\s·\s)Effects:\s*([^·]+)/i);
  if (unlocksHit?.[1]?.trim()) {
    s = unlocksHit[1].trim();
  } else if (effectsHit?.[1]?.trim()) {
    s = effectsHit[1].trim();
  } else if (s.includes(" · ")) {
    // No Unlocks/Effects label: prefer a middot clause that looks like a comma item list
    // (GWD2 "reputation prose · Dragon Rider lance, Cywir…").
    const parts = s.split(/\s·\s/).map((p) => p.trim()).filter(Boolean);
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

  // Drop trailing status / region-pressure clauses after a middot.
  const stop = s.search(
    /\s·\s(?:Region status|Region pressure|Confidence|Notes?|Working taxonomy|Hard |Soft )\b/i,
  );
  if (stop > 0) s = s.slice(0, stop).trim();

  s = s
    .replace(/\s*·?\s*Source:.*$/i, "")
    .replace(/^(?:Unlocks|Effects):\s*/i, "")
    // Telos-style "Location: Heart of Gielinor · Seren godbow, …"
    .replace(/^Location:\s*[^·,;]+(?:\s·\s)?/i, "")
    .trim();
  return s || "—";
}

/** Soft display clip for Rewards/access cell text (icons use full source). */
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

/**
 * Split reward/access prose into icon-resolvable labels.
 * Commas / middots / semicolons / pipes; " and " for short list style.
 * Refuses to explode long prose without list separators into garbage tokens.
 */
export function contentRewardTokens(text: string): string[] {
  const raw = contentRewardsSource(text);
  if (!raw || raw === "—") return [];

  const hasListSep = /[,;·|]/.test(raw) || /\s+and\s+/i.test(raw);
  // Long narrative without list separators → no icon spam (prefer empty chips).
  if (!hasListSep) {
    if (raw.length > 72 || raw.split(/\s+/).length > 10) return [];
    return cleanTokenParts([raw]);
  }

  // Prefer comma/middot splits; only use " and " on short list-like strings.
  const useAnd = raw.length <= 140 && (raw.match(/,/g) ?? []).length <= 6;
  const splitter = useAnd ? /\s*[,;·|]\s*|\s+and\s+/i : /\s*[,;·|]\s*/;
  const parts = raw
    .split(splitter)
    .map((part) =>
      part
        .replace(/\s+/g, " ")
        // "Leng artefact + dark nilas -> Blade of Leng / Off-hand" — keep rightmost product when arrowed.
        .replace(/^.*?(?:\u2192|->)\s*/, "")
        .replace(/^(?:including|plus|also)\s+/i, "")
        .replace(/\s+\([^)]*\)/g, "")
        .replace(/\s+\[[^\]]*\]/g, "")
        .trim(),
    )
    .filter((part) => part.length >= 3 && !/^\d/.test(part));

  return cleanTokenParts(parts);
}

/** Expand "Bandos helmet / chestplate / tassets" into separate short item labels. */
function expandSlashList(label: string): string[] {
  if (!label.includes(" / ")) return [label];
  const parts = label
    .split(" / ")
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  if (parts.length < 2) return [label];
  // Long prose with slashes (not armour pieces) — keep first segment only.
  if (parts.some((p) => p.split(/\s+/).length > 5) || parts.length > 8) {
    return [parts[0]!];
  }
  const head = parts[0]!;
  const headWords = head.split(/\s+/);
  // "Bandos helmet" → prefix "Bandos" for bare "chestplate" / "tassets".
  if (headWords.length >= 2) {
    const prefix = headWords.slice(0, -1).join(" ");
    return parts.map((p) =>
      p.toLowerCase().startsWith(prefix.toLowerCase()) ? p : `${prefix} ${p}`,
    );
  }
  return parts;
}

function cleanTokenParts(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const expanded = expandSlashList(part.replace(/\s+/g, " ").trim());
    for (const piece of expanded) {
      let label = piece.replace(/\s+/g, " ").trim();
      if (!label || label.length > 72) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      if (TOKEN_NOISE.test(key)) continue;
      // Drop pure noise after stripping "upgrades/components/…"
      const strippedKey = label.replace(TRAILING_NOISE, "").trim().toLowerCase();
      if (!strippedKey || TOKEN_NOISE.test(strippedKey)) continue;
      if (/^(?:level|t\d+)/i.test(label)) continue;
      // Pure prose clause (too many small words, no known reward alias).
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

/**
 * Resolve one reward token to a published icon path, or null.
 * Prefer explicit reward path aliases, then upgrade / equipment. Reject skill glyphs and scenery.
 */
export function resolveRewardIcon(label: string): string | null {
  const raw = label.replace(/\s+/g, " ").trim();
  if (!raw) return null;

  const attempts = [raw];
  const stripped = raw.replace(TRAILING_NOISE, "").trim();
  if (stripped && stripped.toLowerCase() !== raw.toLowerCase()) attempts.push(stripped);

  for (const attempt of attempts) {
    // Full-path alias map (inventory art only; equipment must be in EQUIPMENT_OK).
    const aliased = acceptRewardPath(resolveRewardIconLabel(attempt));
    if (aliased) return aliased;

    const up = upgradeIconPath(attempt);
    if (up && isStrictRewardPath(up)) return up;

    const equip = equipmentIconPath(slugifyIconLabel(attempt));
    if (equip) return equip;

    // Last resort: entity resolver, then reject weak skill/scenery hits.
    const entity = dataEntityIconPath({ name: attempt });
    if (entity && isStrictRewardPath(entity)) return entity;
  }
  return null;
}

/**
 * Accept a mapped path only when it is reward-safe.
 * Equipment paths must also exist in the closed EQUIPMENT_OK set (no 404 chips).
 */
function acceptRewardPath(src: string | null): string | null {
  if (!src || !isStrictRewardPath(src)) return null;
  const equipMatch = src.match(/^\/game\/combat\/equipment\/([^/]+)\.png$/i);
  if (equipMatch) {
    return equipmentIconPath(equipMatch[1]!) ? src : null;
  }
  return src;
}

/** Reward chips: inventory / upgrade art only — never skill caps or place scenery. */
function isStrictRewardPath(src: string): boolean {
  if (src.startsWith("/game/upgrades/")) return true;
  if (src.startsWith("/game/combat/equipment/")) return true;
  if (src.startsWith("/game/combat/abilities/")) return true;
  // Explicit combat utility icons sometimes live under combat/ without equipment/
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
  /** Full normalized reward source (unclipped). */
  sourceText: string;
  /** Clipped prose for the table cell. */
  displayText: string;
  tokens: string[];
  icons: { label: string; src: string }[];
  /** Count of successfully resolved icons beyond the display cap. Unresolved never inflate this. */
  overflowResolved: number;
  /** @deprecated alias of overflowResolved for older call sites */
  moreCount: number;
};

/**
 * Present reward/access prose as icons + overflow.
 * Pass the **full** (unclipped) reward text so the last unique is not truncated away.
 */
export function presentContentRewards(
  textFull: string,
  cap = REWARD_ICON_CAP,
  displayMax = REWARD_DISPLAY_MAX,
): PresentedContentRewards {
  const sourceText = contentRewardsSource(textFull);
  const displayText =
    sourceText === "—" ? "—" : clipRewardDisplay(sourceText, displayMax);
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
    moreCount: overflowResolved,
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
  // Boss epithets / comma names (Kerapac, the bound).
  if (/,\s*the\b/.test(name) || /\b(king|queen|beast|general|commander)\b/i.test(name)) {
    return "Boss";
  }
  return "Content";
}

/**
 * Split catalog `kind` into a short Type label and optional location hint text.
 * Location may still be refined via place anchors in resolveContentLocation.
 */
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

  // "Slayer/combat" style already covered; skill with extra words.
  if (SKILL_TYPES.has(lower.split(/[\s/]/)[0] ?? "")) {
    const skill = lower.split(/[\s/]/)[0]!;
    return { type: titleCaseWords(skill), locationHint: null };
  }

  // Mixed: "Elder God Wars Dungeon / skilling boss"
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
    // Both place-like: prefer name-based type, whole kind as location hint (left wins).
    return { type: inferTypeFromName(name), locationHint: left || raw };
  }

  // Place-like kind (contains dungeon/hub/place capital words) → location.
  if (
    /\b(dungeon|sanctum|falador|port sarim|grotworm|borehole|fort forinthry|city of um|underworld|brimhaven|wilderness|menaphos|prif|god wars|heart of gielinor|barrows|lost grove|monastery|lunar|keldagrim|anachronia|havenhythe)\b/i.test(
      raw,
    ) ||
    // Multi-word proper place without pure-type match.
    (/[A-Z]/.test(raw[0] ?? "") && raw.split(/\s+/).length >= 1 && !PURE_TYPE[lower])
  ) {
    // Single capitalized skill already handled. Place names:
    if (!SKILL_TYPES.has(lower) && !PURE_TYPE[lower]) {
      // Skill-looking single words already returned. Multiword / place:
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

/**
 * Resolve a content row to a map location. Only links when a real place anchor exists.
 */
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

/**
 * Training method location → map link when the place is anchored in the active region
 * (or a regionHint that is a valid RegionId).
 */
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

  // Show cleaned location text without inventing a pin.
  return {
    label: loc.replaceAll("_", " "),
    place: null,
    href: null,
  };
}

/** Display Type for a content row. */
export function contentTypeLabel(kind: string, name: string): string {
  return splitContentKind(kind, name).type;
}
