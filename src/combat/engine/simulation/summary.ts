import { expectedAftershockDamage, expectedCracklingDamage } from "../../shared/perks";
import type { Branch } from "./branch";
import type { RotationSummary, SimulateOptions } from "./contracts";
import { advanceTo } from "../runtime/clock";
import type { SimulationRuntime } from "../runtime/runtime";
import { TICK_SECONDS } from "../../core/ticks";

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
    for (const event of rt.queue.pending()) tails += event.resolve(rt, event.tick).damage.expected;
    totalExpectedIncludingTails = tails;
  }

  return {
    ok: error === undefined,
    error,
    casts: rt.casts,
    ticks: rt.endTick,
    ...(effectiveHorizon != null && effectiveHorizon > 0 ? { horizonTicks: effectiveHorizon } : {}),
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

/**
 * Combine finished branches into one summary: numeric totals are
 * branch-weighted means; `casts`/`events`/`ticks` show the modal
 * (highest-weight) trajectory. `rng` is attached only when branching actually
 * occurred, so deterministic runs keep their exact previous shape.
 */
export function combineBranchSummaries(
  branches: readonly Branch[],
  horizonTicks: number | undefined,
  options: SimulateOptions | undefined,
  sawBranching: boolean,
): RotationSummary {
  const parts = branches.map((branch) => ({
    weight: branch.weight,
    summary: finish(branch.rt, branch.error, horizonTicks, options),
  }));
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0) || 1;
  const mix = (f: (s: RotationSummary) => number) =>
    parts.reduce((sum, part) => sum + (part.weight * f(part.summary)) / totalWeight, 0);
  const modal = parts.reduce((a, b) => (b.weight > a.weight ? b : a)).summary;
  const failedWeight = parts.filter((part) => !part.summary.ok).reduce((s, p) => s + p.weight, 0);
  const error =
    modal.error ??
    parts.filter((part) => part.summary.error).sort((a, b) => b.weight - a.weight)[0]?.summary
      .error;

  const perAbility: Record<string, number> = {};
  for (const key of new Set(parts.flatMap((part) => Object.keys(part.summary.perAbility)))) {
    perAbility[key] = mix((s) => s.perAbility[key] ?? 0);
  }
  const damageByTick: Record<number, number> = {};
  for (const key of new Set(parts.flatMap((part) => Object.keys(part.summary.damageByTick)))) {
    damageByTick[Number(key)] = mix((s) => s.damageByTick[Number(key)] ?? 0);
  }

  return {
    ok: failedWeight === 0,
    ...(error !== undefined ? { error } : {}),
    casts: modal.casts,
    ticks: modal.ticks,
    ...(modal.horizonTicks !== undefined ? { horizonTicks: modal.horizonTicks } : {}),
    totalMin: mix((s) => s.totalMin),
    totalMax: mix((s) => s.totalMax),
    totalExpected: mix((s) => s.totalExpected),
    dps: mix((s) => s.dps),
    perAbility,
    damageByTick,
    events: modal.events,
    ...(modal.totalExpectedIncludingTails !== undefined
      ? { totalExpectedIncludingTails: mix((s) => s.totalExpectedIncludingTails ?? 0) }
      : {}),
    ...(sawBranching
      ? {
          rng: {
            method: "probability-weighted branching" as const,
            branches: parts.length,
            ...(failedWeight > 0 ? { failedWeight } : {}),
          },
        }
      : {}),
  };
}
