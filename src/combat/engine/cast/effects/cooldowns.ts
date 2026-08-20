import { secondsToTicks } from "../../../core/ticks";
import { BERSERK_OVERPOWER_COOLDOWN_SECONDS } from "../../../styles/melee/bloodlust";
import { deathSkullsCooldownTicks } from "../../../styles/necromancy/effects";
import {
  clearCooldowns,
  consumeCharge,
  maxChargesFor,
  startCooldown,
  type RotationState,
} from "../../runtime/state";
import type { CastEffectContext } from "./context";
import { effectiveCooldownTicks } from "../../../league/ruleset";

function baseCooldownTicks(fx: CastEffectContext): number {
  const { rt, ability, working, candidate } = fx;
  const cdKey = ability.cooldownGroup ?? ability.replacementGroup ?? ability.id;
  const deathSkullsKey = ability.replacementGroup ?? ability.id;
  if (deathSkullsKey === "death_skulls") {
    return deathSkullsCooldownTicks(rt.state.necromancy.resources, candidate);
  }
  if (cdKey === "overpower" && rt.state.melee.berserkUntilTick > candidate) {
    return secondsToTicks(BERSERK_OVERPOWER_COOLDOWN_SECONDS);
  }
  // working may rewrite CD (Tuska on-task 120s); fall back to catalogue ability.
  const seconds = working.cooldownSeconds ?? ability.cooldownSeconds!;
  return secondsToTicks(seconds);
}

/**
 * Cooldown clocks for one cast. Sourced variations: Death Skulls under Living Death
 * (17 ticks); Overpower under Berserk (9s); Tuska empowered 120s via working.
 * Charged abilities consume a charge instead of writing cooldowns[key]
 * (would block the second charge).
 */
export function applyCastCooldown(fx: CastEffectContext): void {
  const { rt, ability, working, candidate } = fx;
  if (fx.prepared.snap.songEmpowered) return;
  if (!(working.cooldownSeconds ?? ability.cooldownSeconds)) return;
  const cdKey = ability.cooldownGroup ?? ability.replacementGroup ?? ability.id;
  const ticks = effectiveCooldownTicks(baseCooldownTicks(fx), rt.input.league);
  const max = maxChargesFor(ability, rt.input.level);
  if (max > 0) {
    rt.state = consumeCharge(rt.state, cdKey, ticks, candidate);
    return;
  }
  rt.state = startCooldown(rt.state, cdKey, ticks);
}

/** Reduce a single-slot cooldown, floored at floorTick (Snipe / Hurricane CDR). */
export function reduceCooldown(
  state: RotationState,
  key: string,
  ticks: number,
  floorTick: number,
): RotationState {
  const ready = state.cooldowns[key];
  if (ready === undefined || ready <= floorTick) return state;
  return {
    ...state,
    cooldowns: { ...state.cooldowns, [key]: Math.max(floorTick, ready - ticks) },
  };
}

export function reduceActiveCooldowns(
  state: RotationState,
  ticks: number,
  floorTick: number,
  excludedKeys: readonly string[] = [],
): RotationState {
  if (ticks <= 0) return state;
  const excluded = new Set(excludedKeys);
  let changed = false;
  const cooldowns = { ...state.cooldowns };
  for (const [key, ready] of Object.entries(cooldowns)) {
    if (excluded.has(key) || ready <= floorTick) continue;
    const next = Math.max(floorTick, ready - ticks);
    if (next === ready) continue;
    cooldowns[key] = next;
    changed = true;
  }
  const charges = { ...state.charges };
  for (const [key, recovering] of Object.entries(charges)) {
    if (excluded.has(key)) continue;
    const next = recovering
      .map((ready) => (ready > floorTick ? Math.max(floorTick, ready - ticks) : ready))
      .sort((a, b) => a - b);
    if (next.some((ready, index) => ready !== recovering[index])) {
      charges[key] = next;
      changed = true;
    }
  }
  return changed ? { ...state, cooldowns, charges } : state;
}

/** Cooldown resets granted by a cast (Living Death clears ToD and Death Skulls). */
export function resetCooldowns(fx: CastEffectContext, ids: readonly string[]): void {
  fx.rt.state = clearCooldowns(fx.rt.state, ids);
}

/**
 * Start a cooldown on an ability other than the one being cast - conjuring a
 * skeleton locks its command ability out for a sourced initial window.
 */
export function startLinkedCooldown(fx: CastEffectContext, id: string, untilTick: number): void {
  fx.rt.state = {
    ...fx.rt.state,
    cooldowns: { ...fx.rt.state.cooldowns, [id]: untilTick },
  };
}
