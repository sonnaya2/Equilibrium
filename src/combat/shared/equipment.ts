import {
  AMASCUT_MASTERIES_WIKI_2025_09_29,
  MASTERWORK_WEAPONS_WIKI_2025_05_27,
} from "../data/sources";
import type { SourceReference } from "../types";

/**
 * Equipment set effects with sourced current numbers. Item stat bonuses (post 9 Mar
 * 2026 rebalance) are still unsourced per item — bonuses in data/combat/equipment.json
 * stay empty until a source lands, so there is nothing to aggregate yet.
 *
 * These feed the crit layer (CritLayers.chance / damageBonus), not the modifier
 * pipeline: crit chance and crit damage are their own layers by design.
 */

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
