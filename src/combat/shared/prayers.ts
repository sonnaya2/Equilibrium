import type { CombatContext, CombatModifier, CombatStyle, SourceReference } from "../types";
import { mulFloor } from "../core/rounding";

/**
 * Damage-relevant prayer / Ancient Curse lines. Numbers from current wiki pages
 * (Turmoil family + Praesul upgrades), verified 2026-07-26.
 */

const VERIFIED = "2026-07-26";

export interface StyleCurseBoost {
  id: string;
  name: string;
  style: CombatStyle;
  prayerLevel: number;
  accuracyLevels: number;
  damageBonus: number;
  defenceLevels: number;
  source: SourceReference;
}

function wiki(page: string, title: string): SourceReference {
  return {
    source: "runescape-wiki",
    url: `https://runescape.wiki/w/${page}`,
    title,
    verifiedAt: VERIFIED,
  };
}

/** Turmoil line (95 Prayer): +10 levels accuracy/defence, +10% style damage. */
export const TURMOIL: StyleCurseBoost = {
  id: "turmoil",
  name: "Turmoil",
  style: "melee",
  prayerLevel: 95,
  accuracyLevels: 10,
  damageBonus: 0.1,
  defenceLevels: 10,
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
  source: wiki("Ruination", "Ruination"),
};

export const STYLE_CURSES: readonly StyleCurseBoost[] = [
  TURMOIL,
  ANGUISH,
  TORMENT,
  SORROW,
  MALEVOLENCE,
  DESOLATION,
  AFFLICTION,
  RUINATION,
];

export function styleCurseById(id: string): StyleCurseBoost | undefined {
  return STYLE_CURSES.find((c) => c.id === id);
}

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

export function prayerBoostedStyleLevel(baseLevel: number, curse: StyleCurseBoost | null | undefined): number {
  return baseLevel + (curse?.accuracyLevels ?? 0);
}
