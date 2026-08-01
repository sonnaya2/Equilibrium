import { critProbability } from "../core/critical";
import type { AbilityHit, AbilityResult, AbilitySpec } from "../pipeline/calculateAbility";
import { activateBerserk, BERSERK_DURATION_SECONDS } from "../styles/melee/bloodlust";
import { CHAOS_ROAR_DURATION_SECONDS, isMeleeAbility } from "../styles/melee/abilities";
import {
  FURY_CRIT_CHANCE_BONUS,
  GREATER_BARGE_ENDLESS_ASSAULT_IDLE_TICKS,
  GREATER_BARGE_ENDLESS_ASSAULT_WINDOW_SECONDS,
  GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS,
  greaterBargeIdleBand,
  METEOR_STRIKE_BASIC_ADREN_MULTIPLIER,
  METEOR_STRIKE_DURATION_SECONDS,
} from "../styles/melee/effects";
import { activateDeathsSwiftness } from "../styles/ranged/effects";
import {
  activateInstability,
  activateSunshine,
  instabilityActive,
  LIGHTNING_SURGE_TICK_DELAY,
} from "../styles/magic/effects";
import {
  activateSearingWinds,
  activateShadowImbued,
  deathsporeReady,
  extendShadowImbued,
  onRangedHit,
  shadowImbuedAdrenalinePerHit,
  spendDeathspore,
} from "../styles/ranged/onHit";
import {
  activateRunicCharge,
  animaCharged,
  consumeAnima,
} from "../styles/magic/runicCharge";
import { isMagicAbility } from "../styles/magic/abilities";
import {
  applyNecroOnCast,
  deathSkullsCooldownTicks,
  necroAdrenalineCost,
  necroCanCast,
  resolveNecromancyAbility,
} from "../styles/necromancy/effects";
import { COMMAND_REQUIRES_CONJURE } from "../styles/necromancy/conjures";
import type { CastAttempt, CastRecord } from "./contracts";
import { advanceTo } from "./clock";
import { scheduleSpiritTracks } from "./conjureScheduler";
import { resolveCastHit, resolveLightningSurge } from "./resolution";
import { scheduleEvent, type SimulationRuntime } from "./runtime";
import {
  clearCooldowns,
  gainAdrenaline,
  gainMeleeBloodlust,
  patchRanged,
  spendAdrenaline,
  startCooldown,
} from "./state";
import { GLOBAL_COOLDOWN_TICKS, secondsToTicks } from "./timeline";

const EMPTY_RESULT: AbilityResult = { hits: [], min: 0, max: 0, expected: 0, adrenalineDelta: 0 };

export function costOf(rt: SimulationRuntime, ability: AbilitySpec): number {
  if (ability.style === "necromancy") {
    return necroAdrenalineCost(ability, rt.state.necro, rt.state.tick);
  }
  const listed = ability.adrenaline?.cost ?? 0;
  return listed > 0 &&
    ability.style === "ranged" &&
    rt.input.ammo === "deathspore" &&
    deathsporeReady(rt.state.ranged.deathspore)
    ? 0
    : listed;
}

/**
 * One atomic cast transition: advance to the candidate tick, re-check
 * requirements/affordability against the advanced state (rejection leaves the
 * state otherwise untouched), resolve the empowered variant, start the
 * cooldown and occupancy, schedule hit events with provenance, then apply
 * immediate on-cast grants/windows. Style state transitions stay in their
 * style modules; this orchestrates them.
 */
export function performCast(
  rt: SimulationRuntime,
  ability: AbilitySpec,
  readyTick: number,
  auto: boolean,
): CastAttempt {
  const input = rt.input;
  const candidate = Math.max(readyTick, rt.state.tick);
  advanceTo(rt, candidate);

  // Requirements and affordability against the ADVANCED state — waiting may
  // have generated adrenaline or expired a lockout. A rejection mutates nothing
  // beyond the canonical time advance.
  if (
    isMagicAbility(ability) &&
    ability.requiresAnima &&
    !animaCharged(rt.state.magic, candidate)
  ) {
    return {
      ok: false,
      error: `${ability.id} requires an active Runic Charge at tick ${candidate}`,
    };
  }
  if (!necroCanCast(ability, rt.state.necro, rt.state.conjures, candidate)) {
    return {
      ok: false,
      error: `${ability.id} needs residual souls or an active conjure, ${rt.state.necro.residualSouls} souls available at tick ${candidate}`,
    };
  }
  const cost = costOf(rt, ability);
  if (cost > rt.state.adrenaline) {
    return {
      ok: false,
      error: `${ability.id} needs ${cost}% adrenaline, ${rt.state.adrenaline}% available at tick ${candidate}`,
    };
  }

  // Empowered variant resolution (and its resource reads) in this transition.
  const melee = isMeleeAbility(ability) ? ability : null;
  const bloodlustBand =
    melee?.bloodlustScale && rt.state.melee.stacks >= melee.bloodlustScale.threshold
      ? melee.bloodlustScale.band
      : null;
  let working: AbilitySpec = bloodlustBand
    ? { ...ability, hits: ability.hits.map((hit) => ({ ...hit, band: bloodlustBand })) }
    : ability;
  if (ability.style === "necromancy") {
    working = resolveNecromancyAbility(working, rt.state.necro, candidate);
  }
  const meleeIdleTicks =
    ability.style === "melee" && working.hits.length > 0 && rt.state.lastMeleeCastTick >= 0
      ? candidate - rt.state.lastMeleeCastTick
      : 0;
  if (ability.id === "greater_barge" && working.hits.length > 0) {
    working = {
      ...working,
      hits: working.hits.map((h) => ({
        ...h,
        band: greaterBargeIdleBand(h.band.minPct, h.band.maxPct, meleeIdleTicks),
      })),
    };
    if (meleeIdleTicks >= GREATER_BARGE_ENDLESS_ASSAULT_IDLE_TICKS) {
      rt.state = {
        ...rt.state,
        endlessAssaultUntilTick:
          candidate + secondsToTicks(GREATER_BARGE_ENDLESS_ASSAULT_WINDOW_SECONDS),
      };
    }
  }
  if (
    melee?.channelled &&
    working.hits.length > 0 &&
    rt.state.endlessAssaultUntilTick > 0 &&
    candidate < rt.state.endlessAssaultUntilTick
  ) {
    rt.state = { ...rt.state, endlessAssaultUntilTick: 0 };
  }

  // Cast-scope buffs this cast consumes (Chaos Roar empowerment, Fury crit
  // layers) — captured for the cast's events; windows below resolve at land tick.
  const chaosRoarActive =
    ability.style === "melee" &&
    working.hits.length > 0 &&
    rt.state.chaosRoarUntilTick > 0 &&
    candidate < rt.state.chaosRoarUntilTick;
  if (chaosRoarActive) rt.state = { ...rt.state, chaosRoarUntilTick: 0 };
  const furyCrit =
    ability.style === "melee" &&
    rt.state.greaterFuryCrit &&
    working.hits.some((h) => h.critEligible !== false);
  if (furyCrit) rt.state = { ...rt.state, greaterFuryCrit: false };
  const furyBonus =
    ability.style === "melee" &&
    rt.state.furyCritBonus &&
    working.hits.some((h) => h.critEligible !== false);
  if (furyBonus) rt.state = { ...rt.state, furyCritBonus: false };
  const critLayers = {
    ...input.crit,
    chance: input.crit.chance + (furyBonus ? FURY_CRIT_CHANCE_BONUS : 0),
    guaranteed: furyCrit || ability.guaranteedCrit || input.crit.guaranteed,
  };
  const baseMods =
    typeof input.modifiers === "function" ? input.modifiers(ability) : (input.modifiers ?? []);

  if (ability.cooldownSeconds) {
    const cdTicks =
      ability.id === "death_skulls"
        ? deathSkullsCooldownTicks(rt.state.necro, candidate)
        : secondsToTicks(ability.cooldownSeconds);
    rt.state = startCooldown(rt.state, ability.id, cdTicks);
  }

  const castSeq = rt.nextCastSeq++;
  const record: CastRecord = {
    tick: candidate,
    abilityId: ability.id,
    result: {
      hits: [],
      min: 0,
      max: 0,
      expected: 0,
      adrenalineDelta: (working.adrenaline?.gain ?? 0) - (working.adrenaline?.cost ?? 0),
    },
    adrenalineAfter: 0,
    ...(auto ? { auto: true as const } : {}),
  };
  rt.recordBySeq.set(castSeq, record);

  const isCommand = COMMAND_REQUIRES_CONJURE[ability.id] !== undefined;
  const hitSeqs: number[] = [];
  working.hits.forEach((hitSpec: AbilityHit, hitIndex: number) => {
    const seq = rt.nextSeq++;
    hitSeqs.push(seq);
    rt.queue.push({
      tick: candidate + (hitSpec.tickOffset ?? 0),
      seq,
      family: isCommand
        ? "command"
        : hitSpec.critEligible === false && (hitSpec.tickOffset ?? 0) > 0
          ? "dot"
          : "hit",
      abilityId: ability.id,
      sourceCast: castSeq,
      hitIndex,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      cancelOwner: castSeq,
      resolve: (at) =>
        resolveCastHit(rt, at, seq, hitSpec, ability, castSeq, critLayers, baseMods, chaosRoarActive),
    });
  });

  // Instability: Lightning Surge on Magic crits while the buff is active. The
  // granting cast's own hits predate the buff and never fire a surge (checked
  // here at cast time, before the grant below). Surge damage resolves at its
  // own land tick from the source hit's crit chance.
  if (
    ability.style === "magic" &&
    working.hits.length > 0 &&
    instabilityActive(rt.state.instability, candidate)
  ) {
    working.hits.forEach((hitSpec, hitIndex) => {
      if (hitSpec.critEligible === false) return;
      if (critProbability({ ...critLayers, eligible: true }) <= 0) return;
      const sourceSeq = hitSeqs[hitIndex]!;
      scheduleEvent(rt, {
        tick: candidate + (hitSpec.tickOffset ?? 0) + LIGHTNING_SURGE_TICK_DELAY,
        family: "proc",
        abilityId: ability.id,
        sourceCast: castSeq,
        hitIndex,
        attached: false,
        procEligible: false,
        recursionAllowed: false,
        cancelOwner: castSeq,
        resolve: (at) => resolveLightningSurge(rt, at, sourceSeq, castSeq, critLayers, baseMods),
      });
    });
  }

  // Immediate on-cast grants/windows in their sourced order.
  if (ability.adrenaline?.gain) {
    const isBasic = ability.category === "basic" || !!ability.autoAttack;
    const meteorBasic =
      ability.style === "melee" &&
      ability.category === "basic" &&
      rt.state.meteorStrikeUntilTick > 0 &&
      candidate < rt.state.meteorStrikeUntilTick;
    let gain = meteorBasic
      ? ability.adrenaline.gain * METEOR_STRIKE_BASIC_ADREN_MULTIPLIER
      : ability.adrenaline.gain;
    if (isBasic) {
      gain *= input.adrenaline?.basicGainMultiplier ?? 1;
      gain += input.adrenaline?.impatientExpectedExtra ?? 0;
    }
    rt.state = gainAdrenaline(rt.state, gain);
  }
  if (cost) {
    rt.state = spendAdrenaline(rt.state, cost);
    const relentlessChance = input.adrenaline?.relentlessRefundChance ?? 0;
    if (relentlessChance > 0) {
      rt.state = gainAdrenaline(rt.state, cost * relentlessChance);
    }
  }
  if (
    cost === 0 &&
    (ability.adrenaline?.cost ?? 0) > 0 &&
    ability.style === "ranged" &&
    input.ammo === "deathspore"
  ) {
    rt.state = patchRanged(rt.state, { deathspore: spendDeathspore(rt.state.ranged.deathspore) });
  }
  if (melee?.bloodlustGain) {
    rt.state = gainMeleeBloodlust(rt.state, melee.bloodlustGain);
  }

  if (ability.style === "necromancy") {
    const patch = applyNecroOnCast(rt.state.necro, ability, candidate, rt.state.conjures);
    rt.state = {
      ...rt.state,
      necro: patch.necro,
      ...(patch.conjures ? { conjures: patch.conjures } : {}),
    };
    if (patch.adrenalineBonus) rt.state = gainAdrenaline(rt.state, patch.adrenalineBonus);
    rt.state = clearCooldowns(rt.state, patch.clearCooldownIds);
    for (const spirit of rt.state.conjures.spirits) scheduleSpiritTracks(rt, spirit);
  }

  if (ability.stateEffect === "berserk") {
    rt.state = {
      ...rt.state,
      melee: activateBerserk(rt.state.melee),
      berserkUntilTick: candidate + secondsToTicks(BERSERK_DURATION_SECONDS),
    };
  } else if (ability.stateEffect === "deaths_swiftness") {
    rt.state = patchRanged(rt.state, {
      swiftness: activateDeathsSwiftness(candidate, false, input.plantedFeet === true),
    });
  } else if (ability.stateEffect === "greater_deaths_swiftness") {
    rt.state = patchRanged(rt.state, { swiftness: activateDeathsSwiftness(candidate, true) });
  } else if (ability.stateEffect === "shadow_imbued") {
    rt.state = patchRanged(rt.state, { shadowImbued: activateShadowImbued(candidate) });
  }
  if (ability.appliesEffect === "searing_winds") {
    rt.state = patchRanged(rt.state, { searingWinds: activateSearingWinds(candidate, castSeq) });
  }
  if (ability.appliesEffect === "sunshine" || ability.appliesEffect === "greater_sunshine") {
    const greater = ability.appliesEffect === "greater_sunshine";
    rt.state = {
      ...rt.state,
      sunshine: activateSunshine(candidate, greater, !greater && input.plantedFeet === true, castSeq),
    };
  }
  if (ability.appliesEffect === "instability") {
    rt.state = { ...rt.state, instability: activateInstability(candidate) };
  }
  if (ability.appliesEffect === "chaos_roar") {
    rt.state = {
      ...rt.state,
      chaosRoarUntilTick: candidate + secondsToTicks(CHAOS_ROAR_DURATION_SECONDS),
    };
  }
  if (ability.appliesEffect === "greater_fury") {
    rt.state = { ...rt.state, greaterFuryCrit: true };
  }
  if (ability.appliesEffect === "fury") {
    rt.state = { ...rt.state, furyCritBonus: true };
  }
  if (ability.appliesEffect === "meteor_strike") {
    rt.state = {
      ...rt.state,
      meteorStrikeUntilTick: candidate + secondsToTicks(METEOR_STRIKE_DURATION_SECONDS),
    };
  }
  if (
    ability.appliesEffect === "greater_flurry" &&
    rt.state.melee.berserk &&
    candidate < rt.state.berserkUntilTick
  ) {
    const extendTicks =
      working.hits.length * secondsToTicks(GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS);
    rt.state = { ...rt.state, berserkUntilTick: rt.state.berserkUntilTick + extendTicks };
  }

  if (ability.style === "melee" && working.hits.length > 0) {
    rt.state = { ...rt.state, lastMeleeCastTick: candidate };
  }

  if (ability.style === "ranged") {
    if (input.ammo === "deathspore") {
      rt.state = patchRanged(rt.state, {
        deathspore: onRangedHit(rt.state.ranged.deathspore, working.hits.length),
      });
    }
    if (ability.id === "shadow_tendrils") {
      rt.state = patchRanged(rt.state, {
        shadowImbued: extendShadowImbued(rt.state.ranged.shadowImbued, candidate),
      });
    }
    const perHit = shadowImbuedAdrenalinePerHit(rt.state.ranged.shadowImbued, candidate);
    if (perHit > 0 && working.hits.length > 0) {
      rt.state = gainAdrenaline(rt.state, perHit * working.hits.length);
    }
  }
  if (isMagicAbility(ability) && ability.requiresAnima) {
    rt.state = { ...rt.state, magic: consumeAnima(rt.state.magic) };
  }

  // Occupancy: the actor is busy through the channel (or one GCD). Advancing
  // through it lands this cast's due hits and the interval's passive generation.
  const occupancyTicks = ability.channelTicks ?? GLOBAL_COOLDOWN_TICKS;
  rt.endTick = Math.max(rt.endTick, candidate + occupancyTicks);
  advanceTo(rt, candidate + occupancyTicks);
  record.adrenalineAfter = rt.state.adrenaline;
  rt.casts.push(record);
  return { ok: true };
}

/** Off-GCD utility casts (Runic Charge): state-machine update and a cast record
 *  without consuming or advancing the global cooldown. */
export function performOffGcdCast(rt: SimulationRuntime, ability: AbilitySpec): void {
  rt.nextCastSeq++;
  if (ability.stateEffect === "runic_charge") {
    rt.state = { ...rt.state, magic: activateRunicCharge(rt.state.magic, rt.state.tick) };
  }
  rt.casts.push({
    tick: rt.state.tick,
    abilityId: ability.id,
    result: EMPTY_RESULT,
    adrenalineAfter: rt.state.adrenaline,
  });
  rt.endTick = Math.max(rt.endTick, rt.state.tick + 1);
}
