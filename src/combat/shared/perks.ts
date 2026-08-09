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
 * Equilibrium: R1 +8% ability damage, +2%/rank (R4 +14%, Archive R8 +22%).
 * Blocks crits while equipped (wiki also has 30s post-unequip; model is hard
 * no-crit while active only). Formula domain allows Power Archive ranks.
 * https://runescape.wiki/w/Equilibrium
 * https://runescape.wiki/w/Power_Archive
 */
export const EQUILIBRIUM_FORMULA_MAX_RANK = 8;

export function equilibriumDamageBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > EQUILIBRIUM_FORMULA_MAX_RANK) {
    throw new RangeError(
      `equilibriumDamageBonus: rank ${rank} outside 1-${EQUILIBRIUM_FORMULA_MAX_RANK}`,
    );
  }
  // Rank 1 = 8%; +2% per rank (wiki table: 6% + 2%*rank).
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
 * Eruptive: +0.5% ability damage per rank (R4 +2%, Archive R8 +4%).
 * Formerly named Equilibrium (pre-2024). Distinct from the modern Equilibrium perk.
 * Applies to AD-derived damage (DoTs, poison, conjures, Aftershock, Crackling).
 * https://runescape.wiki/w/Eruptive
 * https://runescape.wiki/w/Power_Archive
 */
export const ERUPTIVE_FORMULA_MAX_RANK = 8;

export function eruptiveDamageBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > ERUPTIVE_FORMULA_MAX_RANK) {
    throw new RangeError(
      `eruptiveDamageBonus: rank ${rank} outside 1-${ERUPTIVE_FORMULA_MAX_RANK}`,
    );
  }
  return 0.005 * rank;
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
 * Biting: +2% crit chance per rank (lvl20: +2.2%/rank). Archive R8 +16%.
 * https://runescape.wiki/w/Biting
 * https://runescape.wiki/w/Power_Archive
 */
export const BITING_FORMULA_MAX_RANK = 8;

export function bitingCritChanceBonus(rank: number, level20Gear = false): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > BITING_FORMULA_MAX_RANK) {
    throw new RangeError(
      `bitingCritChanceBonus: rank ${rank} outside 1-${BITING_FORMULA_MAX_RANK}`,
    );
  }
  const perRank = level20Gear ? 0.022 : 0.02;
  return perRank * rank;
}

/**
 * Precise: newMin = min + rank x 0.015 x max. Stored max 6; Archive effective to 12.
 * Band-level, not a uniform mult.
 * https://runescape.wiki/w/Precise
 * https://runescape.wiki/w/Power_Archive
 */
export const PRECISE_FORMULA_MAX_RANK = 12;

export function preciseMinHitAddition(maxDamage: number, rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > PRECISE_FORMULA_MAX_RANK) {
    throw new RangeError(
      `preciseMinHitAddition: rank ${rank} outside 1-${PRECISE_FORMULA_MAX_RANK}`,
    );
  }
  if (!Number.isFinite(maxDamage) || maxDamage < 0) {
    throw new RangeError(`preciseMinHitAddition: bad maxDamage ${maxDamage}`);
  }
  return 0.015 * rank * maxDamage;
}

/** Ultimatums: rank 1 +4% ultimate damage; +1% per rank (R4 +7%, Archive R8 +11%). */
export const ULTIMATUMS_FORMULA_MAX_RANK = 8;

export function ultimatumsDamageBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > ULTIMATUMS_FORMULA_MAX_RANK) {
    throw new RangeError(
      `ultimatumsDamageBonus: rank ${rank} outside 1-${ULTIMATUMS_FORMULA_MAX_RANK}`,
    );
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

/** Lunging: Combust/Dismember rank 1 +13%; +3% per rank (R4 +22%, Archive R8 +34%). */
export const LUNGING_FORMULA_MAX_RANK = 8;

export function lungingDamageBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > LUNGING_FORMULA_MAX_RANK) {
    throw new RangeError(
      `lungingDamageBonus: rank ${rank} outside 1-${LUNGING_FORMULA_MAX_RANK}`,
    );
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

/**
 * Energising: rank 1 +75 accuracy; +25 per rank (R4 +150, Archive R8 +250).
 * https://runescape.wiki/w/Energising
 * https://runescape.wiki/w/Power_Archive
 */
export const ENERGISING_FORMULA_MAX_RANK = 8;

export function energisingAccuracyBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > ENERGISING_FORMULA_MAX_RANK) {
    throw new RangeError(
      `energisingAccuracyBonus: rank ${rank} outside 1-${ENERGISING_FORMULA_MAX_RANK}`,
    );
  }
  return 50 + 25 * rank;
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
 * Stored max R3; Archive effective R6. Caller supplies stacks (default 0).
 * https://runescape.wiki/w/Ruthless
 * https://runescape.wiki/w/Power_Archive
 */
export const RUTHLESS_FORMULA_MAX_RANK = 6;
export const RUTHLESS_MAX_STACKS = 5;

export function ruthlessDamageBonus(rank: number, stacks: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > RUTHLESS_FORMULA_MAX_RANK) {
    throw new RangeError(
      `ruthlessDamageBonus: rank ${rank} outside 1-${RUTHLESS_FORMULA_MAX_RANK}`,
    );
  }
  const s = Math.min(RUTHLESS_MAX_STACKS, Math.max(0, Math.floor(stacks)));
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

/** Crackling PvM zap: 50% ability damage x rank, 60s cooldown. Archive effective to R8. */
export const CRACKLING_FORMULA_MAX_RANK = 8;

export function cracklingDamageFraction(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > CRACKLING_FORMULA_MAX_RANK) {
    throw new RangeError(
      `cracklingDamageFraction: rank ${rank} outside 1-${CRACKLING_FORMULA_MAX_RANK}`,
    );
  }
  return 0.5 * rank;
}

export const CRACKLING_COOLDOWN_SECONDS = 60;

/**
 * Aftershock: after 50_000 damage, AoE 24-39.6% AD per rank in 0.4% steps; min 6s.
 * Stored max R4; Archive effective to R8 (320% max band).
 * https://runescape.wiki/w/Aftershock
 * https://runescape.wiki/w/Power_Archive
 */
export const AFTERSHOCK_DAMAGE_THRESHOLD = 50_000;
export const AFTERSHOCK_MIN_AD_FRACTION_PER_RANK = 0.24;
export const AFTERSHOCK_MAX_AD_FRACTION_PER_RANK = 0.396;
export const AFTERSHOCK_DAMAGE_STEP_PER_RANK = 0.004;
export const AFTERSHOCK_MIN_PROC_INTERVAL_SECONDS = 6;
export const AFTERSHOCK_FORMULA_MAX_RANK = 8;

/** Impatient: 9% chance per rank for basics to grant +3 adrenaline. Archive to R8. */
export const IMPATIENT_FORMULA_MAX_RANK = 8;

export function impatientProcChance(rank: number, level20Gear = false): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > IMPATIENT_FORMULA_MAX_RANK) {
    throw new RangeError(
      `impatientProcChance: rank ${rank} outside 1-${IMPATIENT_FORMULA_MAX_RANK}`,
    );
  }
  return (level20Gear ? 0.099 : 0.09) * rank;
}

export const IMPATIENT_EXTRA_ADRENALINE = 3;

/** Invigorating: basic-attack adrenaline x (1 + 0.05 x rank). Archive to R8. */
export const INVIGORATING_FORMULA_MAX_RANK = 8;

export function invigoratingAdrenalineMultiplier(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > INVIGORATING_FORMULA_MAX_RANK) {
    throw new RangeError(
      `invigoratingAdrenalineMultiplier: rank ${rank} outside 1-${INVIGORATING_FORMULA_MAX_RANK}`,
    );
  }
  return 1 + 0.05 * rank;
}

/** Relentless: 1% chance per rank to refund adrenaline cost; 30s CD. Archive to R10. */
export const RELENTLESS_FORMULA_MAX_RANK = 10;

export function relentlessProcChance(rank: number, level20Gear = false): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > RELENTLESS_FORMULA_MAX_RANK) {
    throw new RangeError(
      `relentlessProcChance: rank ${rank} outside 1-${RELENTLESS_FORMULA_MAX_RANK}`,
    );
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
  if (!Number.isInteger(rank) || rank < 1 || rank > RELENTLESS_FORMULA_MAX_RANK) return 0;
  return cost * relentlessProcChance(rank, level20Gear);
}

/** Planted Feet: Sunshine / Death's Swiftness duration x 1.25; loses periodic damage. Rankless. */
export const PLANTED_FEET_DURATION_MULT = 1.25;

/**
 * Caroming: Ricochet +4%/rank per hit; Chain secondary +5% + 5%/rank.
 * Archive effective to R8.
 */
export const CAROMING_FORMULA_MAX_RANK = 8;

export function caromingRicochetBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > CAROMING_FORMULA_MAX_RANK) {
    throw new RangeError(
      `caromingRicochetBonus: rank ${rank} outside 1-${CAROMING_FORMULA_MAX_RANK}`,
    );
  }
  return 0.04 * rank;
}

export function caromingChainSecondaryBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > CAROMING_FORMULA_MAX_RANK) {
    throw new RangeError(
      `caromingChainSecondaryBonus: rank ${rank} outside 1-${CAROMING_FORMULA_MAX_RANK}`,
    );
  }
  return 0.05 + 0.05 * rank;
}

/**
 * Flanking: listed stuns lose stun; +40%/rank vs targets not facing the player.
 * Soul Strike, Backhand, Impact, Binding Shot. Archive to R8.
 */
export const FLANKING_FORMULA_MAX_RANK = 8;

export function flankingDamageBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > FLANKING_FORMULA_MAX_RANK) {
    throw new RangeError(
      `flankingDamageBonus: rank ${rank} outside 1-${FLANKING_FORMULA_MAX_RANK}`,
    );
  }
  return 0.4 * rank;
}

/**
 * Shield Bashing: Debilitate damage +15% per rank (R4 +60% base game text;
 * Power Archive R6 +90%, R8 +120% => 15%/rank).
 * https://runescape.wiki/w/Shield_Bashing
 * https://runescape.wiki/w/Power_Archive
 */
export const SHIELD_BASHING_FORMULA_MAX_RANK = 8;

export function shieldBashingDamageBonus(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > SHIELD_BASHING_FORMULA_MAX_RANK) {
    throw new RangeError(
      `shieldBashingDamageBonus: rank ${rank} outside 1-${SHIELD_BASHING_FORMULA_MAX_RANK}`,
    );
  }
  return 0.15 * rank;
}

const SHIELD_BASHING_ABILITY_IDS = new Set([
  "debilitate",
  "melee:debilitate",
  "constitution:debilitate",
  "defence:debilitate",
]);

export function shieldBashingPerkModifier(
  rank: number,
  abilityId: string,
): CombatModifier {
  const mult = 1 + shieldBashingDamageBonus(rank);
  return {
    id: `perk:shield-bashing:${rank}`,
    stage: "base",
    priority: 100,
    applies: () =>
      SHIELD_BASHING_ABILITY_IDS.has(abilityId) || abilityId.endsWith(":debilitate"),
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: wikiPerk("Shield Bashing", "Shield_Bashing"),
  };
}

const FLANKING_ABILITY_IDS = new Set([
  "soul-strike",
  "backhand",
  "impact",
  "binding-shot",
  "melee:backhand",
  "magic:impact",
  "ranged:binding-shot",
  "necromancy:soul-strike",
]);

export function flankingPerkModifier(rank: number, abilityId: string): CombatModifier {
  const mult = 1 + flankingDamageBonus(rank);
  const eligible =
    FLANKING_ABILITY_IDS.has(abilityId) ||
    abilityId.endsWith(":soul-strike") ||
    abilityId.endsWith(":backhand") ||
    abilityId.endsWith(":impact") ||
    abilityId.endsWith(":binding-shot");
  return {
    id: `perk:flanking:${rank}`,
    stage: "base",
    priority: 100,
    applies: () => eligible,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: wikiPerk("Flanking", "Flanking"),
  };
}

/**
 * Spendthrift: rank% chance to deal rank% extra damage (coins cost out of scope).
 * EV multiplier = 1 + (rank/100)^2 when treated as independent roll.
 * Archive effective to R12.
 * https://runescape.wiki/w/Spendthrift
 * https://runescape.wiki/w/Power_Archive
 */
export const SPENDTHRIFT_FORMULA_MAX_RANK = 12;

export function spendthriftProcChance(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > SPENDTHRIFT_FORMULA_MAX_RANK) {
    throw new RangeError(
      `spendthriftProcChance: rank ${rank} outside 1-${SPENDTHRIFT_FORMULA_MAX_RANK}`,
    );
  }
  return rank / 100;
}

export function spendthriftExtraDamageFraction(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > SPENDTHRIFT_FORMULA_MAX_RANK) {
    throw new RangeError(
      `spendthriftExtraDamageFraction: rank ${rank} outside 1-${SPENDTHRIFT_FORMULA_MAX_RANK}`,
    );
  }
  return rank / 100;
}

/** Expected damage multiplier if Spendthrift only affects the hitsplat EV. */
export function spendthriftExpectedDamageMultiplier(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1) return 1;
  const p = spendthriftProcChance(rank);
  const extra = spendthriftExtraDamageFraction(rank);
  return 1 + p * extra;
}

export function spendthriftPerkModifier(rank: number): CombatModifier {
  const mult = spendthriftExpectedDamageMultiplier(rank);
  return {
    id: `perk:spendthrift:${rank}`,
    stage: "postHit",
    priority: 50,
    applies: () => mult > 1,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: wikiPerk("Spendthrift", "Spendthrift"),
  };
}

/**
 * Skillcape combat (wiki, modernisation 2026): Attack 120 +2% melee hit chance;
 * Strength 99 +3 Dismember hits; Strength 120 +3% bleed heal (heal not in sim yet).
 */
export const ATTACK_CAPE_MELEE_HIT_CHANCE = 0.02;
export const STRENGTH_CAPE_DISMEMBER_EXTRA_HITS = 3;
/** Strength master cape (120) bleed heal bonus. */
export const STRENGTH_CAPE_DISMEMBER_HEAL_BONUS = 0.03;
