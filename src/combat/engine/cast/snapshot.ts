import type { CritLayers } from "../../core/critical";
import type { CombatModifier } from "../../types";
import type { BashDamageProfile } from "../../styles/shared/defenceAbilities";

/**
 * What a cast captured at cast time for its scheduled hits. Time-windowed
 * globals (Berserk, Swiftness, Sunshine) are NOT here - they read state at the
 * land tick. Next-hit buffs, empowerment, and Searing Winds are cast-scope.
 * Haunted is snapshotted for event identity; damage eligibility is land-time.
 */
export interface CastSnapshot {
  /** Owning cast sequence for event identity. */
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
  /** Searing Winds was active at cast - every hit carries the attached bonus. */
  searingWindsAtCast: boolean;
  /** Haunted active at cast (event identity / forensics; damage uses land-time). */
  hauntedAtCast: boolean;
  /** Cap AD snap when hauntedAtCast (forensics; live cap used at land). */
  hauntedCapAd: number;
  /** Enduring Ruin's next-attack additive bonus captured for every hit in this cast. */
  enduringRuinBonus: number;
  /** Resolved weapon state captured by this cast. */
  magicWeaponAtCast: boolean;
  surgingStormAtCast: boolean;
  /** Physical Ek-ZekKil passive ownership captured at cast time. */
  ashenVowAtCast: boolean;
  /** Repeat Showdown variant selected from the pre-cast Rival state. */
  igneousShowdownRepeat: boolean;
  /** Perfect Equilibrium passive ownership captured from the physical weapon. */
  perfectEquilibriumAtCast: boolean;
  /** Balance by Force crosses the pre-cast Perfect Equilibrium threshold. */
  perfectEquilibriumTrigger?: boolean;
  /** Wen Icy Precision damage and Damage Potential captured for this cast. */
  wenIcyPrecisionDamageAtCast: boolean;
  wenIcyPrecisionDamagePotentialAtCast: boolean;
  /** Song of Destruction cast-owned state and one-roll empowerment outcome. */
  songEmpowered: boolean;
  songConflagrateActive: boolean;
  songTwoPieceActive: boolean;
  songPreCastStacks: number;
  /** Kerapac wrist-wrap damage and timing were active for this Combust cast. */
  kerapacCombustActive: boolean;
  /**
   * Tuska's Wrath on-task empowered flat damage (100x Slayer, 15k cap).
   * Absent = off-task AD band path.
   */
  tuskasEmpoweredDamage?: number;
  bashDamage?: BashDamageProfile;
}
