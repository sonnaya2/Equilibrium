import type { CritLayers } from "../core/critical";
import type { HitCapRule } from "../core/hitCaps";
import { mulFloor } from "../core/rounding";
import { MODERNISATION_PATCH_2, MODERNISATION_WIKI } from "../data/sources";
import {
  calculateAbility,
  type AbilityResult,
  type AbilitySpec,
} from "../pipeline/calculateAbility";
import { calculateHit } from "../pipeline/calculateHit";
import {
  activateBerserk,
  BERSERK_DAMAGE_MULTIPLIER,
  BERSERK_DURATION_SECONDS,
  endBerserk,
} from "../styles/melee/bloodlust";
import {
  CHAOS_ROAR_DAMAGE_MULTIPLIER,
  CHAOS_ROAR_DURATION_SECONDS,
  isMeleeAbility,
} from "../styles/melee/abilities";
import {
  FURY_CRIT_CHANCE_BONUS,
  GREATER_BARGE_ENDLESS_ASSAULT_IDLE_TICKS,
  GREATER_BARGE_ENDLESS_ASSAULT_WINDOW_SECONDS,
  GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS,
  greaterBargeIdleBand,
  METEOR_STRIKE_BASIC_ADREN_MULTIPLIER,
  METEOR_STRIKE_DURATION_SECONDS,
  METEOR_STRIKE_PASSIVE_ADREN_PER_TICK,
} from "../styles/melee/effects";
import { activateDeathsSwiftness, deathsSwiftnessMultiplier } from "../styles/ranged/effects";
import {
  activateInstability,
  activateSunshine,
  instabilityActive,
  LIGHTNING_SURGE_BAND,
  LIGHTNING_SURGE_TICK_DELAY,
  lightningSurgeExpected,
  sunshineActive,
  SUNSHINE_DAMAGE_MULTIPLIER,
  SUNSHINE_SOURCE,
} from "../styles/magic/effects";
import {
  activateSearingWinds,
  activateShadowImbued,
  deathsporeReady,
  extendShadowImbued,
  onRangedHit,
  searingWindsBonusPct,
  shadowImbuedAdrenalinePerHit,
  spendDeathspore,
} from "../styles/ranged/onHit";
import {
  activateRunicCharge,
  animaCharged,
  consumeAnima,
  runicChargeReady,
} from "../styles/magic/runicCharge";
import { isMagicAbility } from "../styles/magic/abilities";
import {
  applyNecroOnCast,
  deathSkullsCooldownTicks,
  necroAdrenalineCost,
  necroCanCast,
  resolveNecromancyAbility,
} from "../styles/necromancy/effects";
import {
  processSpiritAutos,
  SPIRIT_POISON_ABILITY_ID,
  type SpiritAutoEvent,
} from "../styles/necromancy/conjures";
import { expectedAftershockDamage, expectedCracklingDamage } from "../shared/perks";
import type { CombatContext, CombatModifier, SourceReference } from "../types";
import type { RotationAction } from "./actions";
import {
  clearCooldowns,
  firstLegalTick,
  gainAdrenaline,
  gainMeleeBloodlust,
  newRotationState,
  patchRanged,
  spendAdrenaline,
  startCooldown,
  type RotationState,
} from "./state";
import { GLOBAL_COOLDOWN_TICKS, secondsToTicks, TICK_SECONDS } from "./timeline";

export interface AdrenalineRules {
  basicGainMultiplier?: number;
  impatientExpectedExtra?: number;
  relentlessRefundChance?: number;
}

export interface ProcRules {
  cracklingRank?: number;
  aftershockRank?: number;
}

export interface SimulateInput {
  base: number;
  level: number;
  accuracy: number;
  crit: Omit<CritLayers, "eligible">;
  abilities: readonly AbilitySpec[];
  rotation: readonly RotationAction[];
  modifiers?: CombatModifier[] | ((ability: AbilitySpec) => CombatModifier[]);
  context?: CombatContext;
  cap?: HitCapRule;
  /** Puncture damage is outside the current model. */
  ammo?: "deathspore" | "splintering";
  /** Weave the style auto-attack through idle GCDs and adrenaline shortfalls. */
  autoWeave?: boolean;
  adrenaline?: AdrenalineRules;
  /**
   * Planted Feet: base Sunshine / Death's Swiftness duration ×1.25 (→ 63 ticks).
   * Does not apply to greater variants.
   */
  plantedFeet?: boolean;
  procs?: ProcRules;
  /**
   * Mult on conjure spirit *basic autos* only (not putrid poison, not commands).
   * First Necromancer set: firstNecromancerConjureDamageMult(pieces). Default 1.
   */
  conjureBasicDamageMult?: number;
}

export interface CastRecord {
  tick: number;
  abilityId: string;
  result: AbilityResult;
  adrenalineAfter: number;
  /** Woven basic-attack cast, not part of the queued rotation. */
  auto?: boolean;
}

export interface RotationSummary {
  ok: boolean;
  error?: string;
  casts: CastRecord[];
  /** Elapsed ticks: last cast's global cooldown, or the DoT tail if it outlasts it. */
  ticks: number;
  /**
   * Horizon the run was asked to fill (revolution duration). When set, `dps` is
   * totalExpected / (horizonTicks * tickSeconds) so a 60s revo reports 60s DPS.
   */
  horizonTicks?: number;
  totalMin: number;
  totalMax: number;
  totalExpected: number;
  dps: number;
  perAbility: Record<string, number>;
  /** Expected damage landing on each tick — DoT tails land on their sourced ticks. */
  damageByTick: Record<number, number>;
}

const EMPTY_RESULT: AbilityResult = { hits: [], min: 0, max: 0, expected: 0, adrenalineDelta: 0 };

/** Applies flat buffs at onCast so intermediate rounding follows stage order. */
function buffMultiplier(id: string, multiplier: number, source: SourceReference): CombatModifier {
  return {
    id,
    stage: "onCast",
    priority: 0,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
    source,
  };
}

export interface CastContext {
  getState(): RotationState;
  costOf(ability: AbilitySpec): number;
  firstLegalTick(abilityId: string): number;
  performCast(ability: AbilitySpec, readyTick: number, auto: boolean): void;
  /** Off-GCD utility casts (Runic Charge): state-machine update and a cast record
   *  without consuming or advancing the global cooldown. */
  performOffGcdCast(ability: AbilitySpec): void;
  finish(error?: string, horizonTicks?: number): RotationSummary;
  byId: Map<string, AbilitySpec>;
  basicByStyle: Map<AbilitySpec["style"], AbilitySpec>;
}

export function createCastContext(
  input: Omit<SimulateInput, "rotation" | "autoWeave">,
): CastContext {
  const byId = new Map(input.abilities.map((a) => [a.id, a]));
  const basicByStyle = new Map(
    input.abilities.filter((a) => a.autoAttack).map((a) => [a.style, a]),
  );
  const casts: CastRecord[] = [];
  const perAbility: Record<string, number> = {};
  const damageByTick: Record<number, number> = {};
  let state = newRotationState();
  let endTick = 0;
  let spiritMin = 0;
  let spiritMax = 0;
  let spiritExpected = 0;
  let spiritCursor = 0;

  function landSpiritEvents(events: SpiritAutoEvent[]): void {
    const setMult = input.conjureBasicDamageMult ?? 1;
    for (const ev of events) {
      // Spirit-internal mult (e.g. command windows) stays on the band.
      // First Necro set mult is post-hit damage so intermediate AD rounding
      // does not distort the exact +7%/piece ratio (wiki: conjure basics only).
      const hit = calculateHit({
        base: input.base,
        band: {
          minPct: ev.band.minPct * ev.mult,
          maxPct: ev.band.maxPct * ev.mult,
        },
        level: input.level,
        accuracy: input.accuracy,
        crit: { chance: 0, eligible: false },
        modifiers: typeof input.modifiers === "function" ? [] : (input.modifiers ?? []),
        context: input.context,
        cap: input.cap,
      });
      const scale = ev.abilityId === SPIRIT_POISON_ABILITY_ID ? 1 : setMult;
      const min = hit.min * scale;
      const max = hit.max * scale;
      const expected = hit.expected * scale;
      spiritMin += min;
      spiritMax += max;
      spiritExpected += expected;
      damageByTick[ev.tick] = (damageByTick[ev.tick] ?? 0) + expected;
      perAbility[ev.abilityId] = (perAbility[ev.abilityId] ?? 0) + expected;
      endTick = Math.max(endTick, ev.tick + 1);
    }
  }

  function advanceSpirits(toTick: number): void {
    if (toTick <= spiritCursor) return;
    const { state: next, events } = processSpiritAutos(state.conjures, spiritCursor, toTick);
    state = { ...state, conjures: next };
    landSpiritEvents(events);
    spiritCursor = toTick;
  }

  function finish(error?: string, horizonTicks?: number): RotationSummary {
    const spiritEnd = state.conjures.spirits.reduce(
      (m, s) => Math.max(m, s.untilTick + 3),
      spiritCursor,
    );
    if (spiritEnd > spiritCursor) advanceSpirits(spiritEnd);

    // Ability + spirit damage only — Aftershock thresholds on this, not on procs.
    const abilityExpected = casts.reduce((n, c) => n + c.result.expected, 0) + spiritExpected;
    const totalMin = casts.reduce((n, c) => n + c.result.min, 0) + spiritMin;
    const totalMax = casts.reduce((n, c) => n + c.result.max, 0) + spiritMax;
    const denomTicks = horizonTicks != null && horizonTicks > 0 ? horizonTicks : endTick;
    const seconds = denomTicks * TICK_SECONDS;

    let totalExpected = abilityExpected;
    // Crackling: continuous EV ≈ fraction * base * (H / 60). Mid-horizon tick for chart.
    const crackling = expectedCracklingDamage(input.procs?.cracklingRank ?? 0, input.base, seconds);
    if (crackling > 0) {
      totalExpected += crackling;
      perAbility.crackling = (perAbility.crackling ?? 0) + crackling;
      const landTick = Math.max(0, Math.floor(denomTicks / 2));
      damageByTick[landTick] = (damageByTick[landTick] ?? 0) + crackling;
    }
    // Aftershock: floor(abilityDmg/50k) capped by H/6s; hit = 0.318 * rank * base (PvM avg).
    const aftershock = expectedAftershockDamage(
      input.procs?.aftershockRank ?? 0,
      input.base,
      abilityExpected,
      seconds,
    );
    if (aftershock > 0) {
      totalExpected += aftershock;
      perAbility.aftershock = (perAbility.aftershock ?? 0) + aftershock;
      const landTick = Math.max(0, Math.floor(denomTicks / 2));
      damageByTick[landTick] = (damageByTick[landTick] ?? 0) + aftershock;
    }

    return {
      ok: error === undefined,
      error,
      casts,
      ticks: endTick,
      horizonTicks,
      totalMin,
      totalMax,
      totalExpected,
      dps: seconds > 0 ? totalExpected / seconds : 0,
      perAbility,
      damageByTick,
    };
  }

  function costOf(ability: AbilitySpec): number {
    if (ability.style === "necromancy") {
      return necroAdrenalineCost(ability, state.necro, state.tick);
    }
    const listed = ability.adrenaline?.cost ?? 0;
    return listed > 0 &&
      ability.style === "ranged" &&
      input.ammo === "deathspore" &&
      deathsporeReady(state.ranged.deathspore)
      ? 0
      : listed;
  }

  function grantMeteorPassive(fromTick: number, toTickExclusive: number): void {
    if (state.meteorStrikeUntilTick <= 0 || toTickExclusive <= fromTick) return;
    let gain = 0;
    const end = Math.min(toTickExclusive, state.meteorStrikeUntilTick);
    for (let t = fromTick; t < end; t++) gain += METEOR_STRIKE_PASSIVE_ADREN_PER_TICK;
    if (gain > 0) state = gainAdrenaline(state, gain);
  }

  function prepareCast(ability: AbilitySpec, readyTick: number): AbilitySpec {
    advanceSpirits(readyTick);
    grantMeteorPassive(state.tick, readyTick);
    state = { ...state, tick: readyTick };
    if (state.melee.berserk && readyTick >= state.berserkUntilTick) {
      state = { ...state, melee: endBerserk(state.melee), berserkUntilTick: 0 };
    }

    const melee = isMeleeAbility(ability) ? ability : null;
    const bloodlustBand =
      melee?.bloodlustScale && state.melee.stacks >= melee.bloodlustScale.threshold
        ? melee.bloodlustScale.band
        : null;
    let working: AbilitySpec = bloodlustBand
      ? {
          ...ability,
          hits: ability.hits.map((hit) => ({ ...hit, band: bloodlustBand })),
        }
      : ability;
    if (ability.style === "necromancy") {
      working = resolveNecromancyAbility(working, state.necro, readyTick);
    }

    const meleeIdleTicks =
      ability.style === "melee" && working.hits.length > 0 && state.lastMeleeCastTick >= 0
        ? readyTick - state.lastMeleeCastTick
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
        state = {
          ...state,
          endlessAssaultUntilTick:
            readyTick + secondsToTicks(GREATER_BARGE_ENDLESS_ASSAULT_WINDOW_SECONDS),
        };
      }
    }
    if (
      melee?.channelled &&
      working.hits.length > 0 &&
      state.endlessAssaultUntilTick > 0 &&
      readyTick < state.endlessAssaultUntilTick
    ) {
      state = { ...state, endlessAssaultUntilTick: 0 };
    }

    return working;
  }

  function calculateCastResult(
    ability: AbilitySpec,
    working: AbilitySpec,
    readyTick: number,
  ): { result: AbilityResult; working: AbilitySpec } {
    const baseMods =
      typeof input.modifiers === "function" ? input.modifiers(ability) : (input.modifiers ?? []);
    const modifiers = [...baseMods];
    const chaosRoarActive =
      ability.style === "melee" &&
      working.hits.length > 0 &&
      state.chaosRoarUntilTick > 0 &&
      readyTick < state.chaosRoarUntilTick;
    if (chaosRoarActive) {
      modifiers.push(
        buffMultiplier("buff:chaos_roar", CHAOS_ROAR_DAMAGE_MULTIPLIER, MODERNISATION_WIKI),
      );
      state = { ...state, chaosRoarUntilTick: 0 };
    }
    const furyCrit =
      ability.style === "melee" &&
      state.greaterFuryCrit &&
      working.hits.some((h) => h.critEligible !== false);
    if (furyCrit) {
      state = { ...state, greaterFuryCrit: false };
    }
    const furyBonus =
      ability.style === "melee" &&
      state.furyCritBonus &&
      working.hits.some((h) => h.critEligible !== false);
    if (furyBonus) {
      state = { ...state, furyCritBonus: false };
    }
    if (ability.style === "melee" && readyTick < state.berserkUntilTick) {
      modifiers.push(
        buffMultiplier("buff:berserk", BERSERK_DAMAGE_MULTIPLIER, MODERNISATION_PATCH_2),
      );
    }
    if (ability.style === "ranged") {
      const mult = deathsSwiftnessMultiplier(state.ranged.swiftness, readyTick);
      if (mult !== 1)
        modifiers.push(buffMultiplier("buff:deaths_swiftness", mult, MODERNISATION_WIKI));
      const bonusPct = searingWindsBonusPct(state.ranged.searingWinds, readyTick);
      if (bonusPct > 0 && working.hits.length > 0) {
        working = {
          ...working,
          hits: working.hits.flatMap((h) => [
            h,
            {
              band: { minPct: bonusPct, maxPct: bonusPct },
              critEligible: false,
              tickOffset: h.tickOffset,
            },
          ]),
        };
      }
    }
    if (ability.style === "magic" && sunshineActive(state.sunshine, readyTick)) {
      modifiers.push(buffMultiplier("buff:sunshine", SUNSHINE_DAMAGE_MULTIPLIER, SUNSHINE_SOURCE));
    }

    const critLayers = {
      ...input.crit,
      chance: input.crit.chance + (furyBonus ? FURY_CRIT_CHANCE_BONUS : 0),
      guaranteed: furyCrit || ability.guaranteedCrit || input.crit.guaranteed,
    };

    let result: AbilityResult =
      working.hits.length === 0
        ? EMPTY_RESULT
        : calculateAbility(working, {
            base: input.base,
            level: input.level,
            accuracy: input.accuracy,
            crit: critLayers,
            modifiers,
            context: input.context,
            cap: input.cap,
          });

    working.hits.forEach((hit, i) => {
      const landTick = readyTick + (hit.tickOffset ?? 0);
      damageByTick[landTick] = (damageByTick[landTick] ?? 0) + result.hits[i].expected;
      endTick = Math.max(endTick, landTick + 1);
    });

    // Lightning Surge fires only while the Instability buff is active (wiki) — the
    // granting cast's own hits predate the buff and never fire a surge.
    const procInstability =
      ability.style === "magic" &&
      working.hits.length > 0 &&
      instabilityActive(state.instability, readyTick);
    if (procInstability) {
      const surgeHit = calculateHit({
        base: input.base,
        band: LIGHTNING_SURGE_BAND,
        level: input.level,
        accuracy: input.accuracy,
        crit: { ...critLayers, eligible: true },
        modifiers,
        context: input.context,
        cap: input.cap,
      });
      let surgeTotal = 0;
      working.hits.forEach((hit, i) => {
        if (hit.critEligible === false) return;
        const contrib = lightningSurgeExpected(result.hits[i]?.critChance ?? 0, surgeHit.expected);
        if (contrib <= 0) return;
        const landTick = readyTick + (hit.tickOffset ?? 0) + LIGHTNING_SURGE_TICK_DELAY;
        damageByTick[landTick] = (damageByTick[landTick] ?? 0) + contrib;
        endTick = Math.max(endTick, landTick + 1);
        surgeTotal += contrib;
      });
      if (surgeTotal > 0) {
        result = { ...result, expected: result.expected + surgeTotal };
      }
    }

    return { result, working };
  }

  function applyCastState(ability: AbilitySpec, working: AbilitySpec, readyTick: number): void {
    const cost = costOf(ability);
    if (ability.adrenaline?.gain) {
      const isBasic = ability.category === "basic" || !!ability.autoAttack;
      const meteorBasic =
        ability.style === "melee" &&
        ability.category === "basic" &&
        state.meteorStrikeUntilTick > 0 &&
        readyTick < state.meteorStrikeUntilTick;
      let gain = meteorBasic
        ? ability.adrenaline.gain * METEOR_STRIKE_BASIC_ADREN_MULTIPLIER
        : ability.adrenaline.gain;
      if (isBasic) {
        gain *= input.adrenaline?.basicGainMultiplier ?? 1;
        gain += input.adrenaline?.impatientExpectedExtra ?? 0;
      }
      state = gainAdrenaline(state, gain);
    }
    if (cost) {
      state = spendAdrenaline(state, cost);
      const relentlessChance = input.adrenaline?.relentlessRefundChance ?? 0;
      if (relentlessChance > 0) {
        state = gainAdrenaline(state, cost * relentlessChance);
      }
    }
    if (
      cost === 0 &&
      (ability.adrenaline?.cost ?? 0) > 0 &&
      ability.style === "ranged" &&
      input.ammo === "deathspore"
    ) {
      state = patchRanged(state, { deathspore: spendDeathspore(state.ranged.deathspore) });
    }
    if (isMeleeAbility(ability) && ability.bloodlustGain) {
      state = gainMeleeBloodlust(state, ability.bloodlustGain);
    }
    if (ability.cooldownSeconds) {
      const cdTicks =
        ability.id === "death_skulls"
          ? deathSkullsCooldownTicks(state.necro, readyTick)
          : secondsToTicks(ability.cooldownSeconds);
      state = startCooldown(state, ability.id, cdTicks);
    }

    if (ability.style === "necromancy") {
      const patch = applyNecroOnCast(state.necro, ability, readyTick, state.conjures);
      state = {
        ...state,
        necro: patch.necro,
        ...(patch.conjures ? { conjures: patch.conjures } : {}),
      };
      if (patch.adrenalineBonus) state = gainAdrenaline(state, patch.adrenalineBonus);
      state = clearCooldowns(state, patch.clearCooldownIds);
    }

    if (ability.stateEffect === "berserk") {
      state = {
        ...state,
        melee: activateBerserk(state.melee),
        berserkUntilTick: readyTick + secondsToTicks(BERSERK_DURATION_SECONDS),
      };
    } else if (ability.stateEffect === "deaths_swiftness") {
      state = patchRanged(state, {
        swiftness: activateDeathsSwiftness(readyTick, false, input.plantedFeet === true),
      });
    } else if (ability.stateEffect === "greater_deaths_swiftness") {
      state = patchRanged(state, { swiftness: activateDeathsSwiftness(readyTick, true) });
    } else if (ability.stateEffect === "shadow_imbued") {
      state = patchRanged(state, { shadowImbued: activateShadowImbued(readyTick) });
    }
    if (ability.appliesEffect === "searing_winds") {
      state = patchRanged(state, { searingWinds: activateSearingWinds(readyTick) });
    }
    if (ability.appliesEffect === "sunshine" || ability.appliesEffect === "greater_sunshine") {
      const greater = ability.appliesEffect === "greater_sunshine";
      state = {
        ...state,
        sunshine: activateSunshine(readyTick, greater, !greater && input.plantedFeet === true),
      };
    }
    if (ability.appliesEffect === "instability") {
      state = { ...state, instability: activateInstability(readyTick) };
    }
    if (ability.appliesEffect === "chaos_roar") {
      state = {
        ...state,
        chaosRoarUntilTick: readyTick + secondsToTicks(CHAOS_ROAR_DURATION_SECONDS),
      };
    }
    if (ability.appliesEffect === "greater_fury") {
      state = { ...state, greaterFuryCrit: true };
    }
    if (ability.appliesEffect === "fury") {
      state = { ...state, furyCritBonus: true };
    }
    if (ability.appliesEffect === "meteor_strike") {
      state = {
        ...state,
        meteorStrikeUntilTick: readyTick + secondsToTicks(METEOR_STRIKE_DURATION_SECONDS),
      };
    }
    if (
      ability.appliesEffect === "greater_flurry" &&
      state.melee.berserk &&
      readyTick < state.berserkUntilTick
    ) {
      const extendTicks =
        working.hits.length * secondsToTicks(GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS);
      state = { ...state, berserkUntilTick: state.berserkUntilTick + extendTicks };
    }

    if (ability.style === "melee" && working.hits.length > 0) {
      state = { ...state, lastMeleeCastTick: readyTick };
    }

    if (ability.style === "ranged") {
      if (input.ammo === "deathspore") {
        state = patchRanged(state, {
          deathspore: onRangedHit(state.ranged.deathspore, working.hits.length),
        });
      }
      if (ability.id === "shadow_tendrils") {
        state = patchRanged(state, {
          shadowImbued: extendShadowImbued(state.ranged.shadowImbued, readyTick),
        });
      }
      const perHit = shadowImbuedAdrenalinePerHit(state.ranged.shadowImbued, readyTick);
      if (perHit > 0 && working.hits.length > 0) {
        state = gainAdrenaline(state, perHit * working.hits.length);
      }
    }
    if (isMagicAbility(ability) && ability.requiresAnima) {
      state = { ...state, magic: consumeAnima(state.magic) };
    }
  }

  function completeCast(
    ability: AbilitySpec,
    result: AbilityResult,
    readyTick: number,
    auto: boolean,
  ): void {
    const gcdEnd = readyTick + GLOBAL_COOLDOWN_TICKS;
    grantMeteorPassive(readyTick, gcdEnd);
    casts.push({
      tick: readyTick,
      abilityId: ability.id,
      result,
      adrenalineAfter: state.adrenaline,
      ...(auto ? { auto: true as const } : {}),
    });
    perAbility[ability.id] = (perAbility[ability.id] ?? 0) + result.expected;
    state = { ...state, tick: gcdEnd };
    advanceSpirits(gcdEnd);
    endTick = Math.max(endTick, state.tick);
  }

  function performCast(ability: AbilitySpec, readyTick: number, auto: boolean): void {
    const prepared = prepareCast(ability, readyTick);
    const { result, working } = calculateCastResult(ability, prepared, readyTick);
    applyCastState(ability, working, readyTick);
    completeCast(ability, result, readyTick, auto);
  }

  function performOffGcdCast(ability: AbilitySpec): void {
    if (ability.stateEffect === "runic_charge") {
      state = { ...state, magic: activateRunicCharge(state.magic, state.tick) };
    }
    casts.push({
      tick: state.tick,
      abilityId: ability.id,
      result: EMPTY_RESULT,
      adrenalineAfter: state.adrenaline,
    });
    endTick = Math.max(endTick, state.tick + 1);
  }

  return {
    getState: () => state,
    costOf,
    firstLegalTick: (abilityId) => firstLegalTick(state, abilityId),
    performCast,
    performOffGcdCast,
    finish,
    byId,
    basicByStyle,
  };
}

/** Deterministic expected-value run; unpayable casts return an error summary. */
export function simulate(input: SimulateInput): RotationSummary {
  const ctx = createCastContext(input);

  for (const action of input.rotation) {
    const ability = ctx.byId.get(action.abilityId);
    if (!ability) return ctx.finish(`unknown ability: ${action.abilityId}`);

    if (ability.stateEffect === "runic_charge") {
      if (!runicChargeReady(ctx.getState().magic, ctx.getState().tick)) {
        return ctx.finish(`runic_charge is on cooldown at tick ${ctx.getState().tick}`);
      }
      ctx.performOffGcdCast(ability);
      continue;
    }

    if (input.autoWeave) {
      const basic = ctx.basicByStyle.get(ability.style);
      let guard = 0;
      while (
        basic &&
        (ctx.firstLegalTick(ability.id) > ctx.getState().tick ||
          ctx.costOf(ability) > ctx.getState().adrenaline ||
          !necroCanCast(
            ability,
            ctx.getState().necro,
            ctx.getState().conjures,
            ctx.getState().tick,
          ))
      ) {
        if (++guard > 200)
          return ctx.finish(
            `${ability.id} is unaffordable at tick ${ctx.getState().tick}, even weaving basics`,
          );
        ctx.performCast(basic, ctx.getState().tick, true);
      }
    }

    const readyTick = ctx.firstLegalTick(ability.id);
    if (
      isMagicAbility(ability) &&
      ability.requiresAnima &&
      !animaCharged(ctx.getState().magic, readyTick)
    ) {
      return ctx.finish(`${ability.id} requires an active Runic Charge at tick ${readyTick}`);
    }
    if (!necroCanCast(ability, ctx.getState().necro, ctx.getState().conjures, readyTick)) {
      const souls = ctx.getState().necro.residualSouls;
      return ctx.finish(
        `${ability.id} needs residual souls or an active conjure, ${souls} souls available at tick ${readyTick}`,
      );
    }

    const cost = ctx.costOf(ability);
    if (cost > ctx.getState().adrenaline) {
      return ctx.finish(
        `${ability.id} needs ${cost}% adrenaline, ${ctx.getState().adrenaline}% available at tick ${readyTick}`,
      );
    }

    ctx.performCast(ability, readyTick, false);
  }

  return ctx.finish();
}
