import type { ItemPassiveId } from "../../data/records";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { isMeleeAbility } from "../../styles/melee/abilities";
import { resolveIcyTempest, type IcyTempestOutcome } from "../../styles/melee/icyTempest";
import {
  necroAdrenalineCost,
  necroCanCast,
  residualSoulCapFor,
} from "../../styles/necromancy/effects";
import { deathsporeFreeCastActive } from "../../styles/ranged/onHit";
import type { ResolvedRangedAmmunitionProfile } from "../../styles/ranged/ammunitionProfile";
import { impatientProcChance, relentlessProcChance } from "../../shared/perks";
import {
  isWeaponSpecialAbility,
  resolveSpecialAttackAdrenalineCost,
} from "../../shared/ringOfVigour";
import type { AdrenalineRules } from "../simulation/contracts";
import type { CastRngPointId } from "../simulation/contracts";
import type { RotationState } from "../runtime/state";
import { blessingRule, type ResolvedLeagueRules } from "../../league/ruleset";
import { hasDamagingHits } from "./hitKind";
import {
  permanentAvailabilityBlock,
  resolveEquippedAbilityVariant,
  type WeaponConfiguration,
} from "./requirements";
import { activeSpellStacks, glacialTsunamiReduction } from "../../styles/magic/ancientSpells";

export {
  equipmentRecordPassiveIds,
  meetsEquipmentRequirement,
  meetsPassiveRequirement,
  meetsWeaponRequirement,
  missingPassiveMessage,
  passiveIdsFromEquipmentIds,
  permanentAvailabilityBlock,
  resolveAbilityCastAvailability,
  resolveEquippedAbilityId,
  resolveEquippedAbilityVariant,
  type AbilityAvailabilityOptions,
  type AbilityCastAvailability,
  type WeaponConfiguration,
} from "./requirements";

/** Peers sharing replacementGroup from a full ability index. */
export function groupPeersFromById(
  ability: AbilitySpec,
  byId: ReadonlyMap<string, AbilitySpec>,
): AbilitySpec[] {
  if (!ability.replacementGroup) return [];
  const out: AbilitySpec[] = [];
  for (const peer of byId.values()) {
    if (peer.replacementGroup === ability.replacementGroup) out.push(peer);
  }
  return out;
}

/**
 * Map base <-> equipped upgrade (Igneous 2-hit Overpower, etc.) then apply
 * permanent loadout gate with group peers so the base is superseded when upgraded.
 */
export function resolveCastAbility(
  ability: AbilitySpec,
  options: {
    byId?: ReadonlyMap<string, AbilitySpec>;
    weaponConfiguration?: WeaponConfiguration;
    equipmentIds?: readonly string[];
    passiveIds?: readonly ItemPassiveId[];
    activeWeapon?: { specialAttackId?: string | null };
    eofStoredSpecialId?: string | null;
    league?: ResolvedLeagueRules;
  } = {},
): { ability: AbilitySpec; block: string | null } {
  const resolved = resolveEquippedAbilityVariant(ability, {
    byId: options.byId,
    passiveIds: options.passiveIds,
    equipmentIds: options.equipmentIds,
  });
  const peers = options.byId ? groupPeersFromById(resolved, options.byId) : undefined;
  const block = permanentAvailabilityBlock(resolved, {
    weaponConfiguration: options.weaponConfiguration,
    equipmentIds: options.equipmentIds,
    passiveIds: options.passiveIds,
    activeWeapon: options.activeWeapon,
    eofStoredSpecialId: options.eofStoredSpecialId,
    groupPeers: peers,
    league: options.league,
  });
  return { ability: resolved, block };
}

/**
 * Cast legality rules. Each check takes the state and candidate tick the cast
 * would actually meet (not a stale pre-advance tick).
 */

/** Earliest tick a cast may begin: actor availability and the caller's readiness. */
export function candidateTick(state: RotationState, readyTick: number): number {
  return Math.max(readyTick, state.tick);
}

function avernicFree(state: RotationState, tick: number): boolean {
  return tick < (state.league?.avernicRampageUntilTick ?? 0);
}

/**
 * Listed adrenaline cost - the cast REQUIREMENT. A Deathspore free cast zeroes
 * the spend, not the requirement (wiki: "the player still needs the necessary
 * adrenaline to cast"). Icy Tempest stack reduction is spend-only; requirement
 * stays the special listed cost (Vigour-discounted when active).
 */
export function costOf(state: RotationState, ability: AbilitySpec, tick: number): number {
  let listed =
    ability.style === "necromancy"
      ? necroAdrenalineCost(ability, state.necromancy.resources, tick)
      : (ability.adrenaline?.cost ?? 0);
  if (ability.id === "tsunami" && listed > 0) {
    listed = Math.max(
      0,
      listed - glacialTsunamiReduction(activeSpellStacks(state.magic.glacialEmbrace, tick)),
    );
  }
  // Flow (Sonic Wave): flat adren-point reduction while open, never below zero.
  // Defence/Constitution/weapon specials never benefit.
  if (
    listed > 0 &&
    ability.style === "magic" &&
    !isWeaponSpecialAbility(ability) &&
    tick < state.magic.flowUntilTick
  ) {
    listed = Math.max(0, listed - state.magic.flowReduction);
  }
  // Ring of Vigour: weapon special requirement uses the same 10% resolver as spend.
  if (listed > 0 && isWeaponSpecialAbility(ability) && state.ringOfVigour) {
    listed = resolveSpecialAttackAdrenalineCost(listed, true);
  }
  return listed > 0 && avernicFree(state, tick) ? 0 : listed;
}

/**
 * Actual adrenaline spend at `tick`.
 * Deathspore zeros spend not requirement. Icy Tempest: stack reduction first,
 * then Vigour on the resolved spend (requirement stays costOf).
 */
export function spendOf(
  state: RotationState,
  ability: AbilitySpec,
  tick: number,
  ammunition?: ResolvedRangedAmmunitionProfile | null,
  icyTempestOutcome?: IcyTempestOutcome,
): number {
  // Concrete Icy Tempest casts must supply one discrete outcome.
  if (ability.id === "icy_tempest") {
    if (avernicFree(state, tick)) return 0;
    if (icyTempestOutcome !== undefined) return icyTempestOutcome.spend;
    const resolved = resolveIcyTempest(state.melee.primordialIce, tick, state.ringOfVigour);
    if (resolved.outcomes.length !== 1) {
      throw new Error("Icy Tempest mixed stack state requires a resolved outcome");
    }
    return resolved.outcomes[0]!.spend;
  }

  const cost = costOf(state, ability, tick);
  return cost > 0 &&
    ability.style === "ranged" &&
    ammunition?.projectile?.mechanicId === "deathspore" &&
    deathsporeFreeCastActive(state.ranged.deathspore, tick)
    ? 0
    : cost;
}

/**
 * Blocks that weaving basics can never clear (wrong weapon/equipment/passive,
 * or cost above the adrenaline cap). Temporary shortfalls (current adren,
 * cooldowns, sequence windows) are not reported here.
 */
export function permanentCastBlock(
  state: RotationState,
  ability: AbilitySpec,
  weaponConfiguration?: WeaponConfiguration,
  equipmentIds?: readonly string[],
  passiveIds?: readonly ItemPassiveId[],
  byId?: ReadonlyMap<string, AbilitySpec>,
  league?: ResolvedLeagueRules,
  activeWeapon?: { specialAttackId?: string | null },
  eofStoredSpecialId?: string | null,
): string | null {
  const peers = byId ? groupPeersFromById(ability, byId) : undefined;
  const loadoutBlock = permanentAvailabilityBlock(ability, {
    weaponConfiguration,
    equipmentIds,
    passiveIds,
    activeWeapon,
    eofStoredSpecialId,
    groupPeers: peers,
    league,
  });
  if (loadoutBlock !== null) return loadoutBlock;
  const cost = costOf(state, ability, state.tick);
  if (cost > state.adrenalineCap) {
    return `${ability.id} is unaffordable at tick ${state.tick}, even weaving basics`;
  }
  return null;
}

/**
 * Requirement/affordability check against the state at the candidate tick.
 * Returns the rejection text, or null when the cast is legal.
 * Callers should pass resolveEquippedAbilityVariant first (or use resolveCastAbility).
 * byId supplies group peers so a bare base ultimate is rejected as superseded.
 */
export function castRejection(
  state: RotationState,
  ability: AbilitySpec,
  candidate: number,
  weaponConfiguration?: WeaponConfiguration,
  equipmentIds?: readonly string[],
  passiveIds?: readonly ItemPassiveId[],
  byId?: ReadonlyMap<string, AbilitySpec>,
  league?: ResolvedLeagueRules,
  activeWeapon?: { specialAttackId?: string | null },
  eofStoredSpecialId?: string | null,
): string | null {
  const peers = byId ? groupPeersFromById(ability, byId) : undefined;
  const loadoutBlock = permanentAvailabilityBlock(ability, {
    weaponConfiguration,
    equipmentIds,
    passiveIds,
    activeWeapon,
    eofStoredSpecialId,
    groupPeers: peers,
    league,
  });
  if (loadoutBlock !== null) return loadoutBlock;
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

/** One state-changing RNG point a cast may have, with its sourced chance. */
export interface RngPoint {
  id: CastRngPointId;
  chance: number;
}

/**
 * A basic with Impatient rolls for +3 adrenaline; a spender with Relentless
 * (off lockout, actually spending) rolls for a full refund. Avernic Rampage
 * adds its own independent on-attack roll. Spectral Scythe 1-2 may roll a
 * residual soul when under cap.
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
  const isBasic = ability.category === "basic";
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
    !avernicFree(state, candidate) &&
    hasDamagingHits(ability.hits) &&
    avernic?.procChance !== undefined
  ) {
    points.push({ id: "avernic-rampage", chance: avernic.procChance });
  }
  // Spectral Scythe casts 1-2: 25% residual soul, state-changing when under cap.
  const soulChance = (ability as { soulChance?: number }).soulChance;
  if (
    soulChance != null &&
    soulChance > 0 &&
    (ability.id === "spectral_scythe" || ability.id === "spectral_scythe_2") &&
    state.necromancy.resources.residualSouls < residualSoulCapFor(state.necromancy.resources)
  ) {
    points.push({ id: "spectral_scythe_soul", chance: soulChance });
  }
  return points;
}
