import { expectedAftershockDamage, expectedCracklingDamage } from "../../shared/perks";
import { snapshotRuntime, type Branch } from "./branch";
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
  if (rt.finalized) throw new Error("simulation runtime already finalized");
  rt.finalized = true;
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
  let postWindowTailDamage: number | undefined;
  if (options?.includeTails) {
    const preview = snapshotRuntime(rt);
    Object.assign(preview, {
      input: { ...preview.input, horizonTicks: undefined },
      horizon: undefined,
      finalized: false,
    });
    while (preview.queue.length > 0) advanceTo(preview, preview.queue.maxTick());
    totalExpectedIncludingTails = preview.totalExpected;
    postWindowTailDamage = preview.totalExpected - rt.totalExpected;
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
    metric: {
      type:
        effectiveHorizon != null && effectiveHorizon > 0 ? "fixed-window" : "natural-completion",
      denominatorTicks: denomTicks,
      damageCounted: rt.totalExpected,
      tails:
        effectiveHorizon != null && effectiveHorizon > 0
          ? options?.includeTails
            ? "included-separately"
            : "excluded"
          : "included-in-natural-completion",
    },
    perAbility: rt.perAbility,
    damageByTick: rt.damageByTick,
    events: rt.events,
    ...(totalExpectedIncludingTails !== undefined ? { totalExpectedIncludingTails } : {}),
    ...(postWindowTailDamage !== undefined ? { postWindowTailDamage } : {}),
  };
}

/**
 * Combine terminal equivalence classes into one summary. Casts and events use
 * one representative of the highest-weight class; numeric totals and duration
 * remain probability-weighted.
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
  const representative = parts.reduce((a, b) => (b.weight > a.weight ? b : a));
  const modal = representative.summary;
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

  const totalExpected = mix((s) => s.totalExpected);
  const ticks = mix((s) => s.ticks);
  const denominatorTicks =
    modal.metric.type === "fixed-window" ? modal.metric.denominatorTicks : ticks;

  return {
    ok: failedWeight === 0,
    ...(error !== undefined ? { error } : {}),
    casts: modal.casts,
    ticks,
    ...(modal.horizonTicks !== undefined ? { horizonTicks: modal.horizonTicks } : {}),
    totalMin: mix((s) => s.totalMin),
    totalMax: mix((s) => s.totalMax),
    totalExpected,
    dps: denominatorTicks > 0 ? totalExpected / (denominatorTicks * TICK_SECONDS) : 0,
    metric: {
      ...modal.metric,
      denominatorTicks,
      damageCounted: totalExpected,
    },
    perAbility,
    damageByTick,
    events: modal.events,
    ...(modal.totalExpectedIncludingTails !== undefined
      ? { totalExpectedIncludingTails: mix((s) => s.totalExpectedIncludingTails ?? 0) }
      : {}),
    ...(modal.postWindowTailDamage !== undefined
      ? { postWindowTailDamage: mix((s) => s.postWindowTailDamage ?? 0) }
      : {}),
    ...(sawBranching
      ? {
          rng: {
            method: "probability-weighted branching" as const,
            terminalClasses: parts.length,
            representativeClassWeight: representative.weight / totalWeight,
            representativeClassTicks: modal.ticks,
            ...(failedWeight > 0 ? { failedWeight } : {}),
          },
        }
      : {}),
  };
}
