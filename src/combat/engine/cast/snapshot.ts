import type { CritLayers } from "../../core/critical";
import type { CombatModifier } from "../../types";

/**
 * What a cast captured at cast time for its scheduled hits. Time-windowed
 * globals (Berserk, Swiftness, Sunshine) are NOT here — they read state at the
 * land tick. Next-hit buffs, empowerment, and Searing Winds eligibility are
 * cast-scope per their sourced mechanics, so they live in the snapshot.
 */
export interface CastSnapshot {
  /** Owning cast sequence — buff-granting casts exclude their own hits. */
  castSeq: number;
  critLayers: CritLayers;
  baseMods: CombatModifier[];
  /** Chaos Roar ×1.75: channels on the first hit only; non-channels on all hits. */
  chaosRoarActive: boolean;
  channelled: boolean;
  /** Greater Fury: first crit-eligible non-bleed hit is a guaranteed crit. */
  greaterFuryActive: boolean;
  /** Fury: first crit-eligible non-bleed hit gains +25% crit chance. */
  furyActive: boolean;
  firstEligibleHitIndex: number;
  /** Bloodlust missing-LP multiplier for Flurry / Greater Flurry (1 = none). */
  empowerMult: number;
  /** Searing Winds was active at cast — every hit carries the attached bonus. */
  searingWindsAtCast: boolean;
}
