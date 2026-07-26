import {
  AMASCUT_MASTERIES_WIKI_2025_09_29,
  MASTERWORK_WEAPONS_WIKI_2025_05_27,
} from "../data/sources";
import type { EquipmentBonuses, EquipmentSlot } from "../data/records";
import type { SourceReference } from "../types";

/**
 * Equipment set effects with sourced current numbers. Per-item combat stats live on
 * EquipmentRecord.bonuses (wiki-sourced where filled). Weapon tier still drives base
 * AD and playerAccuracy; do not add weapon Accuracy ratings into playerAccuracy or
 * you double-count the tier curve.
 *
 * Style damage on armour / accessories is not folded into base AD either — ability
 * damage stays level+tier driven (wiki weapon Damage is the face of that tier).
 *
 * Set crit bonuses feed CritLayers.chance, not the modifier pipeline.
 */

/** Slots whose Accuracy rating is already encoded by playerAccuracy(level, weaponTier). */
export const WEAPON_ACCURACY_SLOTS: ReadonlySet<EquipmentSlot> = new Set([
  "mainhand",
  "offhand",
  "twohand",
]);

export function isWeaponAccuracySlot(slot: string | null | undefined): boolean {
  return slot != null && WEAPON_ACCURACY_SLOTS.has(slot as EquipmentSlot);
}

export interface SetEffect {
  id: string;
  pieces: number;
  critChanceBonus: number;
  source: SourceReference;
}

function setCritChance(id: string, pieces: number, perPiece: number, source: SourceReference): SetEffect {
  if (!Number.isInteger(pieces) || pieces < 0 || pieces > 5) {
    throw new RangeError(`${id}: bad piece count ${pieces}`);
  }
  return { id, pieces, critChanceBonus: pieces * perPiece, source };
}

/** Tectonic armour: +1% crit chance per piece; elite tectonic +2% per piece (27 May 2025). */
export const tectonicSet = (pieces: number, elite = false) =>
  setCritChance(elite ? "elite_tectonic" : "tectonic", pieces, elite ? 0.02 : 0.01, MASTERWORK_WEAPONS_WIKI_2025_05_27);

/** Tumeken's resplendence set(3): +1.5% crit chance per piece, only while inside Sunshine
 *  (29 Sep 2025 rebalance — this is the current form, not the old DoT boost). */
export function tumekensSunshineSet(pieces: number, insideSunshine: boolean): SetEffect {
  const effect = setCritChance("tumekens_resplendence", pieces, 0.015, AMASCUT_MASTERIES_WIKI_2025_09_29);
  return insideSunshine ? effect : { ...effect, critChanceBonus: 0 };
}

/** Sum numeric damage/accuracy from equipped piece bonus bags (display totals). */
export function sumEquipmentBonuses(pieces: Iterable<EquipmentBonuses | undefined>): {
  damage: number;
  accuracy: number;
} {
  let damage = 0;
  let accuracy = 0;
  for (const b of pieces) {
    if (!b) continue;
    if (b.damage != null && Number.isFinite(b.damage)) damage += b.damage;
    if (b.accuracy != null && Number.isFinite(b.accuracy)) accuracy += b.accuracy;
  }
  return { damage, accuracy };
}

/**
 * Flat accuracy from non-weapon pieces only (rings, amulets, cape, gloves, armour, …).
 * Pieces without a known slot are skipped so unscoped legacy weapon pins cannot
 * leak a full wiki Accuracy rating into hit chance.
 */
export function sumNonWeaponAccuracy(
  pieces: Iterable<{ slot?: string | null; bonuses?: EquipmentBonuses | null } | null | undefined>,
): number {
  let accuracy = 0;
  for (const p of pieces) {
    if (!p || p.slot == null || isWeaponAccuracySlot(p.slot)) continue;
    const a = p.bonuses?.accuracy;
    if (a != null && Number.isFinite(a)) accuracy += a;
  }
  return accuracy;
}
