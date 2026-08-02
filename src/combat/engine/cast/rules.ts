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

type WeaponConfiguration =
  | "twohand"
  | "dualwield"
  | "mainhand"
  | "shield"
  | "defender"
  | "necromancy";

function weaponRequirementMessage(ability: AbilitySpec): string {
  const requirement =
    ability.weaponRequirement === "conduit"
      ? "a conduit"
      : ability.weaponRequirement === "death-guard-and-conduit"
        ? "death guard and conduit"
        : (ability.weaponRequirement ??
          (ability.style === "necromancy" ? "a necromancy weapon" : `${ability.style} weapon`));
  return `${ability.id} requires ${requirement}`;
}

/**
 * Blocks that weaving basics can never clear (wrong weapon/equipment, or cost
 * above the adrenaline cap). Temporary shortfalls (current adren, cooldowns,
 * sequence windows) are not reported here.
 */
export function permanentCastBlock(
  state: RotationState,
  ability: AbilitySpec,
  weaponConfiguration?: WeaponConfiguration,
  equipmentIds?: readonly string[],
): string | null {
  if (!meetsWeaponRequirement(ability, weaponConfiguration)) {
    return weaponRequirementMessage(ability);
  }
  if (!meetsEquipmentRequirement(ability, equipmentIds)) {
    return `${ability.id} requires an equipped Igneous cape`;
  }
  const cost = costOf(state, ability, state.tick);
  if (cost > state.adrenalineCap) {
    return `${ability.id} is unaffordable at tick ${state.tick}, even weaving basics`;
  }
  return null;
}

/**
 * Requirement/affordability check against the state at the candidate tick.
 * Returns the rejection text, or null when the cast is legal.
 */
export function castRejection(
  state: RotationState,
  ability: AbilitySpec,
  candidate: number,
  weaponConfiguration?: WeaponConfiguration,
  equipmentIds?: readonly string[],
): string | null {
  if (!meetsWeaponRequirement(ability, weaponConfiguration)) {
    return weaponRequirementMessage(ability);
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

/**
 * Pure equipment-shape check shared by engine validation and ability pickers.
 *
 * Necromancy (wiki — Conjuration / Necromancy abilities):
 * - necrotic basics/enhanced/ultimates need a siphon (main hand); they still
 *   cast with a shield or defender in the off-hand
 * - conjures need a conduit (off-hand); shield/defender dual is not enough
 * - loadout reports `"necromancy"` only when a conduit is available (equipped
 *   conduit, or empty off-hand with the dual-hand tier sliders)
 *
 * Melee only has 1H / dual / 2H gates among non-necro styles:
 * - dualwield req: offensive OH or defender (not shield, empty OH, or 2H alone)
 * - twohand req: two-handed only
 * - defender counts as dual-wield OH; pure shield does not
 *
 * Ranged and Magic: no dual/2H cast gates (wiki 22 Jul 2024 Magic weapon-type
 * requirements removed; ranged never had them). Stale dualwield/twohand tags on
 * those styles are ignored.
 */
export function meetsWeaponRequirement(
  ability: AbilitySpec,
  weaponConfiguration?: "twohand" | "dualwield" | "mainhand" | "shield" | "defender" | "necromancy",
): boolean {
  if (weaponConfiguration === undefined) return true;

  // --- Necromancy: conduit / siphon rules (unchanged) ---
  if (ability.style === "necromancy") {
    const req = ability.weaponRequirement;
    // Conjures (and any explicit dual-necro gate) need siphon + conduit.
    if (req === "conduit" || req === "death-guard-and-conduit") {
      return weaponConfiguration === "necromancy";
    }
    // Other necro abilities: any necro main-hand shape, including shield tanking.
    return (
      weaponConfiguration === "necromancy" ||
      weaponConfiguration === "mainhand" ||
      weaponConfiguration === "shield" ||
      weaponConfiguration === "defender"
    );
  }

  if (weaponConfiguration === "necromancy") return false;

  const req = ability.weaponRequirement;
  // Necro-only requirement tags never apply to other styles.
  if (req === "conduit" || req === "death-guard-and-conduit") return false;
  if (req === undefined) return true;

  // Ranged + Magic: wiki — no weapon-type cast gates for dual / 2H.
  if (ability.style === "ranged" || ability.style === "magic") return true;

  // Melee only:
  if (req === "dualwield") {
    // Offensive OH or defender (not shield, not empty, not 2H alone).
    return weaponConfiguration === "dualwield" || weaponConfiguration === "defender";
  }
  if (req === "twohand") {
    return weaponConfiguration === "twohand";
  }
  if (req === "mainhand") {
    // 1H shape: mainhand, dual, defender, or shield (all have a main hand).
    // Necromancy already rejected above.
    return weaponConfiguration !== "twohand";
  }
  return weaponConfiguration === req;
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
