import type { CombatContext, CombatModifier, CombatStyle, SourceReference } from "../types";
import { mulFloor } from "../core/rounding";

/**
 * Damage-relevant prayers: standard book (Piety line) + Ancient Curses
 * (Turmoil family + Praesul). Numbers from prayer catalogue / wiki.
 */

const VERIFIED = "2026-07-26";
const VERIFIED_STANDARD = "2026-07-25";

export interface StyleCurseBoost {
  id: string;
  name: string;
  style: CombatStyle;
  prayerLevel: number;
  accuracyLevels: number;
  damageBonus: number;
  defenceLevels: number;
  /** standard = main prayer book; ancient = Ancient Curses (incl. Seren/Praesul line). */
  book: "standard" | "ancient";
  source: SourceReference;
}

function wiki(page: string, title: string, verifiedAt = VERIFIED): SourceReference {
  return {
    source: "runescape-wiki",
    url: `https://runescape.wiki/w/${page}`,
    title,
    verifiedAt,
  };
}

/** Standard book Knight Waves line: +8 accuracy / +8% damage / +8 defence. */
export const PIETY: StyleCurseBoost = {
  id: "piety",
  name: "Piety",
  style: "melee",
  prayerLevel: 70,
  accuracyLevels: 8,
  damageBonus: 0.08,
  defenceLevels: 8,
  book: "standard",
  source: wiki("Piety", "Piety", VERIFIED_STANDARD),
};

export const RIGOUR: StyleCurseBoost = {
  id: "rigour",
  name: "Rigour",
  style: "ranged",
  prayerLevel: 70,
  accuracyLevels: 8,
  damageBonus: 0.08,
  defenceLevels: 8,
  book: "standard",
  source: wiki("Rigour", "Rigour", VERIFIED_STANDARD),
};

export const AUGURY: StyleCurseBoost = {
  id: "augury",
  name: "Augury",
  style: "magic",
  prayerLevel: 70,
  accuracyLevels: 8,
  damageBonus: 0.08,
  defenceLevels: 8,
  book: "standard",
  source: wiki("Augury", "Augury", VERIFIED_STANDARD),
};

export const SANCTITY: StyleCurseBoost = {
  id: "sanctity",
  name: "Sanctity",
  style: "necromancy",
  prayerLevel: 70,
  accuracyLevels: 8,
  damageBonus: 0.08,
  defenceLevels: 8,
  book: "standard",
  source: wiki("Sanctity", "Sanctity", VERIFIED_STANDARD),
};

/** Turmoil line (95 Prayer): +10 levels accuracy/defence, +10% style damage. */
export const TURMOIL: StyleCurseBoost = {
  id: "turmoil",
  name: "Turmoil",
  style: "melee",
  prayerLevel: 95,
  accuracyLevels: 10,
  damageBonus: 0.1,
  defenceLevels: 10,
  book: "ancient",
  source: wiki("Turmoil", "Turmoil"),
};

export const ANGUISH: StyleCurseBoost = {
  id: "anguish",
  name: "Anguish",
  style: "ranged",
  prayerLevel: 95,
  accuracyLevels: 10,
  damageBonus: 0.1,
  defenceLevels: 10,
  book: "ancient",
  source: wiki("Anguish", "Anguish"),
};

export const TORMENT: StyleCurseBoost = {
  id: "torment",
  name: "Torment",
  style: "magic",
  prayerLevel: 95,
  accuracyLevels: 10,
  damageBonus: 0.1,
  defenceLevels: 10,
  book: "ancient",
  source: wiki("Torment", "Torment"),
};

export const SORROW: StyleCurseBoost = {
  id: "sorrow",
  name: "Sorrow",
  style: "necromancy",
  prayerLevel: 95,
  accuracyLevels: 10,
  damageBonus: 0.1,
  defenceLevels: 10,
  book: "ancient",
  source: wiki("Sorrow", "Sorrow"),
};

/** Praesul codex upgrades (99 Prayer): +12 / +12% / +12. */
export const MALEVOLENCE: StyleCurseBoost = {
  id: "malevolence",
  name: "Malevolence",
  style: "melee",
  prayerLevel: 99,
  accuracyLevels: 12,
  damageBonus: 0.12,
  defenceLevels: 12,
  book: "ancient",
  source: wiki("Malevolence", "Malevolence"),
};

export const DESOLATION: StyleCurseBoost = {
  id: "desolation",
  name: "Desolation",
  style: "ranged",
  prayerLevel: 99,
  accuracyLevels: 12,
  damageBonus: 0.12,
  defenceLevels: 12,
  book: "ancient",
  source: wiki("Desolation", "Desolation"),
};

export const AFFLICTION: StyleCurseBoost = {
  id: "affliction",
  name: "Affliction",
  style: "magic",
  prayerLevel: 99,
  accuracyLevels: 12,
  damageBonus: 0.12,
  defenceLevels: 12,
  book: "ancient",
  source: wiki("Affliction", "Affliction"),
};

export const RUINATION: StyleCurseBoost = {
  id: "ruination",
  name: "Ruination",
  style: "necromancy",
  prayerLevel: 99,
  accuracyLevels: 12,
  damageBonus: 0.12,
  defenceLevels: 12,
  book: "ancient",
  source: wiki("Ruination", "Ruination"),
};

/** All damage prayers the loadout can pick (standard + ancient). */
export const STYLE_CURSES: readonly StyleCurseBoost[] = [
  PIETY,
  RIGOUR,
  AUGURY,
  SANCTITY,
  TURMOIL,
  ANGUISH,
  TORMENT,
  SORROW,
  MALEVOLENCE,
  DESOLATION,
  AFFLICTION,
  RUINATION,
];

export const STANDARD_DAMAGE_PRAYERS: readonly StyleCurseBoost[] = [
  PIETY,
  RIGOUR,
  AUGURY,
  SANCTITY,
];

export function styleCurseById(id: string): StyleCurseBoost | undefined {
  return STYLE_CURSES.find((c) => c.id === id);
}

/** Alias: loadout field is still styleCurse; UI labels these as prayers. */
export const damagePrayerById = styleCurseById;

export function bestStyleCurse(style: CombatStyle): StyleCurseBoost {
  const matches = STYLE_CURSES.filter((c) => c.style === style);
  return matches.reduce((best, c) => (c.damageBonus > best.damageBonus ? c : best));
}

export function prayerDamageModifier(curse: StyleCurseBoost): CombatModifier {
  const mult = 1 + curse.damageBonus;
  return {
    id: `prayer:${curse.id}`,
    stage: "ability",
    priority: 10,
    applies: (context: CombatContext) => context.style === curse.style,
    apply: (state) => ({ damage: mulFloor(state.damage, mult) }),
    source: curse.source,
  };
}

export function prayerBoostedStyleLevel(
  baseLevel: number,
  curse: StyleCurseBoost | null | undefined,
): number {
  return baseLevel + (curse?.accuracyLevels ?? 0);
}
