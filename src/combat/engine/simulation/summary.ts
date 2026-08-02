import { snapshotRuntime, type Branch } from "./branch";
import type {
  DamageEffectBreakdown,
  DamageSourceKind,
  RotationDamageAnalysis,
  RotationSummary,
  SimulateOptions,
} from "./contracts";
import { advanceTo } from "../runtime/clock";
import type { ResolvedEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import { TICK_SECONDS } from "../../core/ticks";

const SOURCE_KINDS: readonly DamageSourceKind[] = [
  "ability-direct",
  "ability-dot",
  "equipment-passive",
  "league-blessing",
  "perk",
  "conjure-or-familiar",
  "auto-attack",
  "other-modeled",
];

function sourceKind(rt: SimulationRuntime, event: ResolvedEvent): DamageSourceKind {
  if (event.blessingId) return "league-blessing";
  if (event.abilityId === "crackling" || event.abilityId === "aftershock") return "perk";
  if (event.abilityId === "abyssal_parasite") return "equipment-passive";
  if (event.family === "conjureAuto" || event.family === "command" || event.family === "poison") {
    return "conjure-or-familiar";
  }
  if (event.sourceCast >= 0 && rt.recordBySeq.get(event.sourceCast)?.auto) return "auto-attack";
  if (event.family === "dot") return "ability-dot";
  if (event.family === "hit") return "ability-direct";
  return "other-modeled";
}

function buildAnalysis(rt: SimulationRuntime): RotationDamageAnalysis {
  const sourceTotals = new Map<DamageSourceKind, number>();
  const effects = new Map<
    string,
    Omit<DamageEffectBreakdown, "share" | "applications" | "averagePerApplication"> & {
      applicationWeights: Map<string, number>;
    }
  >();

  for (const event of rt.events) {
    const kind = sourceKind(rt, event);
    sourceTotals.set(kind, (sourceTotals.get(kind) ?? 0) + event.damage.expected);
    const current = effects.get(event.abilityId) ?? {
      id: event.abilityId,
      kind,
      totalDamage: 0,
      damagingEvents: 0,
      directDamage: 0,
      dotDamage: 0,
      criticalContribution: 0,
      capLoss: 0,
      applicationWeights: new Map<string, number>(),
    };
    current.totalDamage += event.damage.expected;
    current.damagingEvents += 1;
    current.directDamage += event.family === "dot" ? 0 : event.damage.expected;
    current.dotDamage += event.family === "dot" ? event.damage.expected : 0;
    current.criticalContribution += event.damage.critical?.contribution ?? 0;
    current.capLoss += event.damage.capLoss ?? 0;
    const applicationKey =
      event.sourceCast >= 0 ? `cast:${event.sourceCast}` : `event:${event.seq}`;
    current.applicationWeights.set(
      applicationKey,
      Math.max(current.applicationWeights.get(applicationKey) ?? 0, event.expectedOccurrences ?? 1),
    );
    effects.set(event.abilityId, current);
  }

  return {
    bySource: SOURCE_KINDS.flatMap((kind) => {
      const damage = sourceTotals.get(kind) ?? 0;
      return damage > 0 ? [{ kind, damage }] : [];
    }).sort((a, b) => b.damage - a.damage),
    byEffect: [...effects.values()]
      .map(({ applicationWeights, ...effect }) => {
        const applications = [...applicationWeights.values()].reduce(
          (sum, value) => sum + value,
          0,
        );
        return {
          ...effect,
          share: rt.totalExpected > 0 ? effect.totalDamage / rt.totalExpected : 0,
          applications,
          averagePerApplication: applications > 0 ? effect.totalDamage / applications : 0,
        };
      })
      .sort((a, b) => b.totalDamage - a.totalDamage),
    directDamage: rt.events.reduce(
      (total, event) => total + (event.family === "dot" ? 0 : event.damage.expected),
      0,
    ),
    dotDamage: rt.events.reduce(
      (total, event) => total + (event.family === "dot" ? event.damage.expected : 0),
      0,
    ),
    criticalContribution: rt.events.reduce(
      (total, event) => total + (event.damage.critical?.contribution ?? 0),
      0,
    ),
    capLoss: rt.events.reduce((total, event) => total + (event.damage.capLoss ?? 0), 0),
  };
}

/**
 * Horizon completion and result assembly. With a horizon, only events landing
 * before it count (half-open [0, horizonTicks)) and DPS divides by the horizon;
 * without one, every scheduled event lands through the natural end and DPS
 * divides by the elapsed ticks.
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

  const denomTicks =
    effectiveHorizon != null && effectiveHorizon > 0 ? effectiveHorizon : rt.endTick;
  const seconds = denomTicks * TICK_SECONDS;

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
    analysis: buildAnalysis(rt),
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
  const bySource = SOURCE_KINDS.flatMap((kind) => {
    const damage = mix(
      (summary) => summary.analysis.bySource.find((row) => row.kind === kind)?.damage ?? 0,
    );
    return damage > 0 ? [{ kind, damage }] : [];
  }).sort((a, b) => b.damage - a.damage);
  const effectIds = new Set(
    parts.flatMap((part) => part.summary.analysis.byEffect.map((row) => row.id)),
  );
  const byEffect: DamageEffectBreakdown[] = [...effectIds]
    .map((id) => {
      const sample = parts
        .flatMap((part) => part.summary.analysis.byEffect)
        .find((effect) => effect.id === id)!;
      const value = (
        field: keyof Pick<
          DamageEffectBreakdown,
          | "totalDamage"
          | "applications"
          | "damagingEvents"
          | "directDamage"
          | "dotDamage"
          | "criticalContribution"
          | "capLoss"
        >,
      ) =>
        mix(
          (summary) => summary.analysis.byEffect.find((effect) => effect.id === id)?.[field] ?? 0,
        );
      const totalDamage = value("totalDamage");
      const applications = value("applications");
      return {
        id,
        kind: sample.kind,
        totalDamage,
        share: totalExpected > 0 ? totalDamage / totalExpected : 0,
        applications,
        damagingEvents: value("damagingEvents"),
        averagePerApplication: applications > 0 ? totalDamage / applications : 0,
        directDamage: value("directDamage"),
        dotDamage: value("dotDamage"),
        criticalContribution: value("criticalContribution"),
        capLoss: value("capLoss"),
      };
    })
    .sort((a, b) => b.totalDamage - a.totalDamage);

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
    analysis: {
      bySource,
      byEffect,
      directDamage: mix((summary) => summary.analysis.directDamage),
      dotDamage: mix((summary) => summary.analysis.dotDamage),
      criticalContribution: mix((summary) => summary.analysis.criticalContribution),
      capLoss: mix((summary) => summary.analysis.capLoss),
    },
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
