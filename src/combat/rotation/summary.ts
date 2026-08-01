import { expectedAftershockDamage, expectedCracklingDamage } from "../shared/perks";
import type { RotationSummary, SimulateOptions } from "./contracts";
import { advanceTo } from "./clock";
import type { SimulationRuntime } from "./runtime";
import { TICK_SECONDS } from "./timeline";

/**
 * Horizon completion and result assembly. With a horizon, only events landing
 * before it count (half-open [0, horizonTicks)) and DPS divides by the horizon;
 * without one, every scheduled event lands through the natural end and DPS
 * divides by the elapsed ticks. Crackling/Aftershock stay smoothed EV added at
 * completion — their proc counting uses landed-in-horizon ability damage and
 * their lumped land tick falls inside the window.
 */
export function finish(
  rt: SimulationRuntime,
  error?: string,
  horizonTicks?: number,
  options?: SimulateOptions,
): RotationSummary {
  const effectiveHorizon = horizonTicks ?? rt.horizon;
  if (effectiveHorizon != null && effectiveHorizon > 0) {
    advanceTo(rt, effectiveHorizon - 1);
    if (rt.state.tick < effectiveHorizon) rt.state = { ...rt.state, tick: effectiveHorizon };
  } else {
    // No horizon: land every scheduled event through the natural end.
    while (rt.queue.length > 0) advanceTo(rt, rt.queue.maxTick());
  }

  // Ability + spirit damage only — Aftershock thresholds on this, not on procs.
  const abilityExpected = rt.totalExpected;
  const denomTicks =
    effectiveHorizon != null && effectiveHorizon > 0 ? effectiveHorizon : rt.endTick;
  const seconds = denomTicks * TICK_SECONDS;

  // Crackling: continuous EV ≈ fraction * base * (H / 60). Mid-horizon tick for chart.
  const crackling = expectedCracklingDamage(
    rt.input.procs?.cracklingRank ?? 0,
    rt.input.base,
    seconds,
  );
  if (crackling > 0) {
    rt.totalExpected += crackling;
    rt.perAbility.crackling = (rt.perAbility.crackling ?? 0) + crackling;
    const landTick = Math.max(0, Math.floor(denomTicks / 2));
    rt.damageByTick[landTick] = (rt.damageByTick[landTick] ?? 0) + crackling;
  }
  // Aftershock: floor(abilityDmg/50k) capped by H/6s; hit = 0.318 * rank * base (PvM avg).
  const aftershock = expectedAftershockDamage(
    rt.input.procs?.aftershockRank ?? 0,
    rt.input.base,
    abilityExpected,
    seconds,
  );
  if (aftershock > 0) {
    rt.totalExpected += aftershock;
    rt.perAbility.aftershock = (rt.perAbility.aftershock ?? 0) + aftershock;
    const landTick = Math.max(0, Math.floor(denomTicks / 2));
    rt.damageByTick[landTick] = (rt.damageByTick[landTick] ?? 0) + aftershock;
  }

  let totalExpectedIncludingTails: number | undefined;
  if (options?.includeTails) {
    let tails = rt.totalExpected;
    for (const event of rt.queue.pending()) tails += event.resolve(event.tick).expected;
    totalExpectedIncludingTails = tails;
  }

  return {
    ok: error === undefined,
    error,
    casts: rt.casts,
    ticks: rt.endTick,
    ...(effectiveHorizon != null && effectiveHorizon > 0
      ? { horizonTicks: effectiveHorizon }
      : {}),
    totalMin: rt.totalMin,
    totalMax: rt.totalMax,
    totalExpected: rt.totalExpected,
    dps: seconds > 0 ? rt.totalExpected / seconds : 0,
    perAbility: rt.perAbility,
    damageByTick: rt.damageByTick,
    events: rt.events,
    ...(totalExpectedIncludingTails !== undefined ? { totalExpectedIncludingTails } : {}),
  };
}
