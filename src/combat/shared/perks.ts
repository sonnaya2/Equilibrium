import { mulFloor } from "../core/rounding";
import type { CombatModifier, SourceReference } from "../types";

/**
 * Invention perks as staged modifiers / pure helpers.
 * Wiki-sourced damage-pipeline numbers only; adrenaline/duration/proc perks export formulas.
 * Ability-scoped perks close over the cast (CombatContext has no ability identity).
 */

const VERIFIED = "2026-07-26";

function wikiPerk(title: string, page: string): SourceReference {
  return {
    source: "runescape-wiki",
    url: `https://runescape.wiki/w/${page}`,
    title,
    verifiedAt: VERIFIED,
  };
}

/**
 * Equilibrium: R1 +8% ability damage, +2%/rank (R4 +14%). Blocks crits while equipped
 * (wiki also has 30s post-unequip; model is hard no-crit while active only).
 * https://runescape.wiki/w/Equilibrium
 */
export function equilibriumDamageBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`equilibriumDamageBonus: rank ${rank} outside 1-4`);
  }
  // Rank 1 = 8%; +2% per rank after that (not "6% + 2%*rank" in the UI sense).
  return 0.08 + 0.02 * (rank - 1);
}

export function equilibriumPerkModifier(rank: number): CombatModifier {
  const mult = 1 + equilibriumDamageBonus(rank);
  return {
    id: `perk:equilibrium:${rank}`,
    stage: "base",
    priority: 100,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: wikiPerk("Equilibrium (perk)", "Equilibrium"),
  };
}

/** While Equilibrium is equipped, critical strike chance is forced to 0. */
export function equilibriumBlocksCrits(rank: number): boolean {
  return Number.isInteger(rank) && rank >= 1;
}

/**
 * Eruptive: R1 +0.5% ability damage, +0.5%/rank (R4 +2%). Applies to AD-derived damage
 * (DoTs, poison, conjures, Aftershock, Crackling). https://runescape.wiki/w/Eruptive
 */
export function eruptiveDamageBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`eruptiveDamageBonus: rank ${rank} outside 1-4`);
  }
  return 0.005 + 0.005 * (rank - 1);
}

export function eruptivePerkModifier(rank: number): CombatModifier {
  const mult = 1 + eruptiveDamageBonus(rank);
  return {
    id: `perk:eruptive:${rank}`,
    stage: "base",
    priority: 100,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: wikiPerk("Eruptive (perk)", "Eruptive"),
  };
}

/**
 * Biting: R1 +2% crit chance, +2%/rank (lvl20: +2.2%/rank). Max R4; not on DoTs.
 * https://runescape.wiki/w/Biting
 */
export function bitingCritChanceBonus(rank: number, level20Gear = false): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`bitingCritChanceBonus: rank ${rank} outside 1-4`);
  }
  const perRank = level20Gear ? 0.022 : 0.02;
  return perRank + perRank * (rank - 1);
}

/**
 * Precise: newMin = min + rank x 0.015 x max. Max R6. Band-level, not a uniform mult.
 * https://runescape.wiki/w/Precise
 */
export function preciseMinHitAddition(maxDamage: number, rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 6) {
    throw new RangeError(`preciseMinHitAddition: rank ${rank} outside 1-6`);
  }
  if (!Number.isFinite(maxDamage) || maxDamage < 0) {
    throw new RangeError(`preciseMinHitAddition: bad maxDamage ${maxDamage}`);
  }
  return 0.015 * rank * maxDamage;
}

/** Ultimatums: rank 1 +4% ultimate damage; +1% per rank (R4 +7%). */
export function ultimatumsDamageBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`ultimatumsDamageBonus: rank ${rank} outside 1-4`);
  }
  return 0.04 + 0.01 * (rank - 1);
}

export function ultimatumsPerkModifier(rank: number, castCategory: string): CombatModifier {
  const mult = 1 + ultimatumsDamageBonus(rank);
  return {
    id: `perk:ultimatums:${rank}`,
    stage: "base",
    priority: 100,
    applies: () => castCategory === "ultimate",
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: wikiPerk("Ultimatums (perk)", "Ultimatums"),
  };
}

/** Engine and record ids both accepted (adapter uses either form). */
const LUNGING_ABILITY_IDS = new Set(["dismember", "melee:dismember", "combust", "magic:combust"]);

/** Lunging: Combust/Dismember rank 1 +13%; +3% per rank (R4 +22%). */
export function lungingDamageBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`lungingDamageBonus: rank ${rank} outside 1-4`);
  }
  return 0.13 + 0.03 * (rank - 1);
}

export function lungingPerkModifier(rank: number, abilityId: string): CombatModifier {
  const mult = 1 + lungingDamageBonus(rank);
  return {
    id: `perk:lunging:${rank}`,
    stage: "base",
    priority: 100,
    applies: () => LUNGING_ABILITY_IDS.has(abilityId),
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: wikiPerk("Lunging (perk)", "Lunging"),
  };
}

/** Energising: rank 1 +75 accuracy; +25 per rank (R4 +150). */
export function energisingAccuracyBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`energisingAccuracyBonus: rank ${rank} outside 1-4`);
  }
  return 75 + 25 * (rank - 1);
}

/** Undead / Demon / Dragon Slayer: +7% damage to matching race. Rankless. */
export const SLAYER_PERK_DAMAGE_BONUS = 0.07;

export function raceSlayerPerkModifier(
  kind: "undead" | "demon" | "dragon",
  targetMatches: boolean,
): CombatModifier {
  const page =
    kind === "undead"
      ? "Undead_Slayer"
      : kind === "demon"
        ? "Demon_Slayer_(perk)"
        : "Dragon_Slayer_(perk)";
  const title =
    kind === "undead"
      ? "Undead Slayer"
      : kind === "demon"
        ? "Demon Slayer (perk)"
        : "Dragon Slayer (perk)";
  return {
    id: `perk:${kind}-slayer`,
    stage: "base",
    priority: 100,
    applies: () => targetMatches,
    apply: (state) =>
      targetMatches
        ? { ...state, damage: mulFloor(state.damage, 1 + SLAYER_PERK_DAMAGE_BONUS) }
        : state,
    source: wikiPerk(title, page),
  };
}

/**
 * Ruthless: +0.5% damage per rank per kill stack, max 5 stacks, 20s (not on bleeds).
 * Max R3 -> 1.5%/stack -> 7.5% at 5. Caller supplies stacks. https://runescape.wiki/w/Ruthless
 */
export function ruthlessDamageBonus(rank: number, stacks: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 3) {
    throw new RangeError(`ruthlessDamageBonus: rank ${rank} outside 1-3`);
  }
  const s = Math.min(5, Math.max(0, Math.floor(stacks)));
  return 0.005 * rank * s;
}

export function ruthlessPerkModifier(rank: number, stacks: number): CombatModifier {
  const mult = 1 + ruthlessDamageBonus(rank, stacks);
  return {
    id: `perk:ruthless:${rank}:s${Math.min(5, Math.max(0, Math.floor(stacks)))}`,
    stage: "base",
    priority: 100,
    applies: () => stacks > 0,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: wikiPerk("Ruthless (perk)", "Ruthless"),
  };
}

/**
 * Genocidal: up to +4.9% on current Slayer task.
 * M = floor(5 x (1 - remaining/original) x 10) / 10 percent. Not on bleeds/burns.
 * https://runescape.wiki/w/Genocidal
 */
export function genocidalDamageBonus(remaining: number, original: number): number {
  if (!Number.isFinite(remaining) || !Number.isFinite(original) || original <= 0) {
    throw new RangeError(`genocidalDamageBonus: bad task size ${remaining}/${original}`);
  }
  const a = Math.min(Math.max(remaining, 0), original);
  return Math.floor(5 * (1 - a / original) * 10) / 10 / 100;
}

/** Crackling PvM zap: 50% ability damage x rank, 60s cooldown. Max rank 4. */
export function cracklingDamageFraction(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`cracklingDamageFraction: rank ${rank} outside 1-4`);
  }
  return 0.5 * rank;
}

export const CRACKLING_COOLDOWN_SECONDS = 60;

/**
 * Aftershock: after 50_000 damage, AoE 24-39.6% AD per rank in 0.4% steps; max R4, min 6s.
 * https://runescape.wiki/w/Aftershock
 */
export const AFTERSHOCK_DAMAGE_THRESHOLD = 50_000;
export const AFTERSHOCK_MIN_AD_FRACTION_PER_RANK = 0.24;
export const AFTERSHOCK_MAX_AD_FRACTION_PER_RANK = 0.396;
export const AFTERSHOCK_DAMAGE_STEP_PER_RANK = 0.004;
export const AFTERSHOCK_MIN_PROC_INTERVAL_SECONDS = 6;

/** Impatient: 9% chance per rank for basics to grant +3 adrenaline (base 9 -> 12). Max 4. */
export function impatientProcChance(rank: number, level20Gear = false): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`impatientProcChance: rank ${rank} outside 1-4`);
  }
  return (level20Gear ? 0.099 : 0.09) * rank;
}

export const IMPATIENT_EXTRA_ADRENALINE = 3;

/** Invigorating: basic-attack adrenaline x (1 + 0.05 x rank). Max 4. */
export function invigoratingAdrenalineMultiplier(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`invigoratingAdrenalineMultiplier: rank ${rank} outside 1-4`);
  }
  return 1 + 0.05 * rank;
}

/** Relentless: 1% chance per rank to refund adrenaline cost; 30s internal CD. Max rank 5. */
export function relentlessProcChance(rank: number, level20Gear = false): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 5) {
    throw new RangeError(`relentlessProcChance: rank ${rank} outside 1-5`);
  }
  return (level20Gear ? 0.011 : 0.01) * rank;
}

export const RELENTLESS_INTERNAL_CD_SECONDS = 30;

/**
 * EV adrenaline refund on one cast with positive cost. No 30s internal CD model
 * (like Impatient EV on every basic); overstates when costs fire more often than CD.
 * Rank 0 / non-positive cost => 0.
 */
export function expectedRelentlessRefund(cost: number, rank: number, level20Gear = false): number {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  if (!Number.isInteger(rank) || rank < 1 || rank > 5) return 0;
  return cost * relentlessProcChance(rank, level20Gear);
}

/** Planted Feet: Sunshine / Death's Swiftness duration x 1.25; loses periodic damage. Rankless. */
export const PLANTED_FEET_DURATION_MULT = 1.25;

/**
 * Caroming: Ricochet +4%/rank per hit; Chain secondary +5% + 5%/rank. Max std 3 / ancient 4.
 */
export function caromingRicochetBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`caromingRicochetBonus: rank ${rank} outside 1-4`);
  }
  return 0.04 * rank;
}

export function caromingChainSecondaryBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`caromingChainSecondaryBonus: rank ${rank} outside 1-4`);
  }
  return 0.05 + 0.05 * rank;
}

/**
 * Flanking: listed stuns lose stun; +40%/rank vs targets not facing the player.
 * Soul Strike, Backhand, Impact, Binding Shot. Max std 3 / ancient 4.
 */
export function flankingDamageBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > 4) {
    throw new RangeError(`flankingDamageBonus: rank ${rank} outside 1-4`);
  }
  return 0.4 * rank;
}

/**
 * Skillcape combat (wiki, modernisation 2026): Attack 120 +2% melee hit chance;
 * Strength 99 +3 Dismember hits; Strength 120 +3% bleed heal (heal not in sim yet).
 */
export const ATTACK_CAPE_MELEE_HIT_CHANCE = 0.02;
export const STRENGTH_CAPE_DISMEMBER_EXTRA_HITS = 3;
/** Strength master cape (120) bleed heal bonus. */
export const STRENGTH_CAPE_DISMEMBER_HEAL_BONUS = 0.03;
