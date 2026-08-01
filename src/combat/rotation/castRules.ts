import type { AbilitySpec } from "../pipeline/calculateAbility";
import { isMagicAbility } from "../styles/magic/abilities";
import { animaCharged } from "../styles/magic/runicCharge";
import { necroAdrenalineCost, necroCanCast } from "../styles/necromancy/effects";
import { deathsporeFreeCastActive } from "../styles/ranged/onHit";
import { impatientProcChance, relentlessProcChance } from "../shared/perks";
import type { AdrenalineRules } from "./contracts";
import type { RotationState } from "./state";

/**
 * Cast legality rules. Every function takes the explicit state and candidate
 * tick so a future cast is evaluated against the state it would actually meet —
 * never against a stale pre-advance tick.
 */

/** Earliest tick a cast may begin: actor availability and the caller's readiness. */
export function candidateTick(state: RotationState, readyTick: number): number {
  return Math.max(readyTick, state.tick);
}

/**
 * Listed adrenaline cost — the cast REQUIREMENT. A Deathspore free cast zeroes
 * the spend, not the requirement (wiki: "the player still needs the necessary
 * adrenaline in order to cast").
 */
export function costOf(state: RotationState, ability: AbilitySpec, tick: number): number {
  if (ability.style === "necromancy") {
    return necroAdrenalineCost(ability, state.necro, tick);
  }
  return ability.adrenaline?.cost ?? 0;
}

/** Actual adrenaline spend after a Deathspore free-cast buff, evaluated at `tick`. */
export function spendOf(
  state: RotationState,
  ability: AbilitySpec,
  tick: number,
  ammo?: "deathspore" | "splintering",
): number {
  const cost = costOf(state, ability, tick);
  return cost > 0 &&
    ability.style === "ranged" &&
    ammo === "deathspore" &&
    deathsporeFreeCastActive(state.ranged.deathspore, tick)
    ? 0
    : cost;
}

/**
 * Requirement/affordability check against the state at the candidate tick.
 * Returns the rejection text, or null when the cast is legal.
 */
export function castRejection(
  state: RotationState,
  ability: AbilitySpec,
  candidate: number,
): string | null {
  if (isMagicAbility(ability) && ability.requiresAnima && !animaCharged(state.magic, candidate)) {
    return `${ability.id} requires an active Runic Charge at tick ${candidate}`;
  }
  if (!necroCanCast(ability, state.necro, state.conjures, candidate)) {
    return `${ability.id} needs residual souls or an active conjure, ${state.necro.residualSouls} souls available at tick ${candidate}`;
  }
  const cost = costOf(state, ability, candidate);
  if (cost > state.adrenaline) {
    return `${ability.id} needs ${cost}% adrenaline, ${state.adrenaline}% available at tick ${candidate}`;
  }
  return null;
}

/** The one state-changing RNG point a cast may have, with its sourced chance. */
export interface RngPoint {
  kind: "impatient" | "relentless";
  chance: number;
}

/**
 * A basic with Impatient rolls for +3 adrenaline; a spender with Relentless
 * (off lockout, actually spending) rolls for a full refund. A basic never costs
 * adrenaline, so at most one point exists per cast.
 */
export function rngPointFor(
  state: RotationState,
  ability: AbilitySpec,
  candidate: number,
  spend: number,
  rules?: AdrenalineRules,
): RngPoint | null {
  const isBasic = ability.category === "basic" || !!ability.autoAttack;
  if (isBasic && (rules?.impatientRank ?? 0) > 0) {
    return {
      kind: "impatient",
      chance: impatientProcChance(rules!.impatientRank!, rules?.impatientLevel20),
    };
  }
  if ((rules?.relentlessRank ?? 0) > 0 && candidate >= state.relentlessUntilTick && spend > 0) {
    return {
      kind: "relentless",
      chance: relentlessProcChance(rules!.relentlessRank!, rules?.relentlessLevel20),
    };
  }
  return null;
}
