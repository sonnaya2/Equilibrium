import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { isMeleeAbility } from "../../styles/melee/abilities";
import { necroAdrenalineCost, necroCanCast } from "../../styles/necromancy/effects";
import { deathsporeFreeCastActive } from "../../styles/ranged/onHit";
import { impatientProcChance, relentlessProcChance } from "../../shared/perks";
import type { AdrenalineRules } from "../simulation/contracts";
import type { CastRngPointId } from "../simulation/contracts";
import type { RotationState } from "../runtime/state";
import { blessingRule, hasBlessing, type ResolvedLeagueRules } from "../../league/ruleset";

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
  let listed =
    ability.style === "necromancy"
      ? necroAdrenalineCost(ability, state.necromancy.resources, tick)
      : (ability.adrenaline?.cost ?? 0);
  // Flow (Sonic Wave): a flat adrenaline-point reduction while the window is
  // open, never below zero. Defence/Constitution/specials never benefit.
  if (listed > 0 && ability.style === "magic" && tick < state.magic.flowUntilTick) {
    listed = Math.max(0, listed - state.magic.flowReduction);
  }
  return listed > 0 && tick < (state.league?.avernicRampageUntilTick ?? 0) ? 0 : listed;
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
  weaponConfiguration?: "twohand" | "dualwield" | "mainhand" | "shield" | "defender" | "necromancy",
  equipmentIds?: readonly string[],
): string | null {
  if (!meetsWeaponRequirement(ability, weaponConfiguration)) {
    const requirement =
      ability.weaponRequirement ??
      (ability.style === "necromancy" ? "death guard and conduit" : `${ability.style} weapon`);
    return `${ability.id} requires ${requirement}`;
  }
  if (!meetsEquipmentRequirement(ability, equipmentIds)) {
    return `${ability.id} requires an equipped Igneous cape`;
  }
  if (
    ability.id === "spectral_scythe_2" &&
    candidate >= state.necromancy.resources.spectralScythe2UntilTick
  ) {
    return `spectral_scythe_2 needs a live stage-1 sequence at tick ${candidate}`;
  }
  if (
    ability.id === "spectral_scythe_3" &&
    candidate >= state.necromancy.resources.spectralScythe3UntilTick
  ) {
    return `spectral_scythe_3 needs a live stage-2 sequence at tick ${candidate}`;
  }
  if (!necroCanCast(ability, state.necromancy.resources, state.necromancy.conjures, candidate)) {
    return `${ability.id} needs residual souls or an active conjure, ${state.necromancy.resources.residualSouls} souls available at tick ${candidate}`;
  }
  const recastOf = isMeleeAbility(ability) ? ability.recastOf : undefined;
  if (
    recastOf &&
    (state.melee.bleedChainNext !== ability.id || candidate >= state.melee.bleedChainUntilTick)
  ) {
    return `${ability.id} needs ${recastOf} cast within the last 40 ticks (chain ${
      state.melee.bleedChainNext ?? "none"
    } at tick ${candidate})`;
  }
  const cost = costOf(state, ability, candidate);
  if (cost > state.adrenaline) {
    return `${ability.id} needs ${cost}% adrenaline, ${state.adrenaline}% available at tick ${candidate}`;
  }
  return null;
}

/** Pure equipment-shape check shared by engine validation and ability pickers. */
export function meetsWeaponRequirement(
  ability: AbilitySpec,
  weaponConfiguration?: "twohand" | "dualwield" | "mainhand" | "shield" | "defender" | "necromancy",
): boolean {
  if (weaponConfiguration === undefined) return true;
  if (ability.style === "necromancy") return weaponConfiguration === "necromancy";
  if (weaponConfiguration === "necromancy") return false;
  if (ability.weaponRequirement === undefined) return true;
  if (ability.weaponRequirement === "death-guard-and-conduit") return false;
  if (weaponConfiguration === "defender") return ability.weaponRequirement === "dualwield";
  if (weaponConfiguration === "shield") return false;
  return weaponConfiguration === ability.weaponRequirement;
}

export function meetsEquipmentRequirement(
  ability: AbilitySpec,
  equipmentIds?: readonly string[],
): boolean {
  return (
    ability.requiredEquipmentAnyOf === undefined ||
    ability.requiredEquipmentAnyOf.some((id) => equipmentIds?.includes(id))
  );
}

/** One state-changing RNG point a cast may have, with its sourced chance. */
export interface RngPoint {
  id: CastRngPointId;
  chance: number;
}

/**
 * A basic with Impatient rolls for +3 adrenaline; a spender with Relentless
 * (off lockout, actually spending) rolls for a full refund. Avernic Rampage
 * adds its own independent on-attack roll.
 */
export function rngPointsFor(
  state: RotationState,
  ability: AbilitySpec,
  candidate: number,
  spend: number,
  rules?: AdrenalineRules,
  league?: ResolvedLeagueRules,
): RngPoint[] {
  const points: RngPoint[] = [];
  const isBasic = ability.category === "basic" || !!ability.autoAttack;
  if (isBasic && (ability.adrenaline?.gain ?? 0) > 0 && (rules?.impatientRank ?? 0) > 0) {
    points.push({
      id: "impatient",
      chance: impatientProcChance(rules!.impatientRank!, rules?.impatientLevel20),
    });
  }
  if ((rules?.relentlessRank ?? 0) > 0 && candidate >= state.relentlessUntilTick && spend > 0) {
    points.push({
      id: "relentless",
      chance: relentlessProcChance(rules!.relentlessRank!, rules?.relentlessLevel20),
    });
  }
  const avernic = blessingRule(league, "avernic-rampage");
  if (
    hasBlessing(league, "avernic-rampage") &&
    ability.hits.length > 0 &&
    avernic?.procChance !== undefined
  ) {
    points.push({ id: "avernic-rampage", chance: avernic.procChance });
  }
  return points;
}
