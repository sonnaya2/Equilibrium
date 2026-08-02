import { finalizeAnalysis } from "../analysis";
import { snapshotRuntime, type Branch } from "./branch";
import type {
  BranchFailureSummary,
  DamageEffectBreakdown,
  DamageSourceKind,
  DurationSummary,
  DpsSummary,
  HistoryProvenance,
  HistorySelectionReason,
  RotationSummary,
  SimulateOptions,
  StochasticRngSummary,
  TailMetrics,
} from "./contracts";
import { advanceTo } from "../runtime/clock";
import type { SimulationRuntime } from "../runtime/runtime";
import { TICK_SECONDS } from "../../core/ticks";
import {
  finiteOrZero,
  PROB_TOLERANCE,
  supportMaxFrom,
  supportMinFrom,
  weightedMean,
} from "./stats";

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

/** Public analysis from engine-owned ledgers — never rescanned from events. */
function buildAnalysis(rt: SimulationRuntime) {
  return finalizeAnalysis(rt.analysis, rt.totalExpected);
}

function pathSupportMin(rt: SimulationRuntime): number {
  return supportMinFrom(rt.totalMin, rt.analysis.supportMinOffset);
}

function pathSupportMax(rt: SimulationRuntime): number {
  return supportMaxFrom(rt.totalMax, rt.analysis.supportMaxOffset);
}

function dpsFrom(damage: number, ticks: number): number {
  return ticks > 0 ? damage / (ticks * TICK_SECONDS) : 0;
}

function emptyFailure(primaryReason: string, failedWeight: number): BranchFailureSummary {
  return {
    failedWeight,
    successfulWeight: 0,
    totalsScope: "none",
    primaryReason,
    reasons: failedWeight > 0 ? [{ reason: primaryReason, weight: failedWeight }] : [],
  };
}

function buildDuration(args: {
  kind: DurationSummary["kind"];
  expectedTicks: number;
  minimumTicks: number;
  maximumTicks: number;
  representativeTicks: number;
  fixedHorizonTicks?: number;
}): DurationSummary {
  return {
    kind: args.kind,
    expectedTicks: args.expectedTicks,
    minimumTicks: args.minimumTicks,
    maximumTicks: args.maximumTicks,
    representativeTicks: args.representativeTicks,
    ...(args.fixedHorizonTicks !== undefined ? { fixedHorizonTicks: args.fixedHorizonTicks } : {}),
  };
}

function buildDpsDetail(args: {
  primary: number;
  ratioOfExpectations: number;
  representativeDps: number;
  expectedBranchDps?: number;
}): DpsSummary {
  return {
    primary: args.primary,
    ratioOfExpectations: args.ratioOfExpectations,
    representativeDps: args.representativeDps,
    ...(args.expectedBranchDps !== undefined ? { expectedBranchDps: args.expectedBranchDps } : {}),
  };
}

/**
 * Horizon completion and result assembly. With a horizon, only events landing
 * before it count (half-open [0, horizonTicks)) and primary DPS divides by the
 * horizon; without one, every scheduled event lands through the natural end and
 * primary DPS uses E[D] / (elapsed × tickSeconds).
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
    while (rt.queue.length > 0) advanceTo(rt, rt.queue.maxTick());
  }

  const pathTicks = rt.endTick;
  const fixedWindow = effectiveHorizon != null && effectiveHorizon > 0;
  const denomTicks = fixedWindow ? effectiveHorizon : pathTicks;
  const expectedDamage = finiteOrZero(rt.totalExpected);
  const supportMin = finiteOrZero(pathSupportMin(rt));
  const supportMax = finiteOrZero(pathSupportMax(rt));
  const conditionalMin = finiteOrZero(rt.totalMin);
  const conditionalMax = finiteOrZero(rt.totalMax);
  const primaryDps = dpsFrom(expectedDamage, denomTicks);
  const pathDps = dpsFrom(expectedDamage, pathTicks);

  let tails: TailMetrics | undefined;
  if (options?.includeTails && fixedWindow) {
    const preview = snapshotRuntime(rt);
    Object.assign(preview, {
      input: { ...preview.input, horizonTicks: undefined },
      horizon: undefined,
      finalized: false,
    });
    while (preview.queue.length > 0) advanceTo(preview, preview.queue.maxTick());
    const totalIncludingTails = finiteOrZero(preview.totalExpected);
    tails = {
      inWindowExpectedDamage: expectedDamage,
      postWindowTailDamage: totalIncludingTails - expectedDamage,
      totalIncludingTails,
    };
  }

  const history: HistoryProvenance = {
    kind: "complete",
    classWeight: 1,
    ticks: pathTicks,
    selectionReason: "sole-terminal",
    // Failed sole paths still expose casts/events, but they are not a success ledger.
    eventsReconcileWithWeightedTotals: error === undefined,
  };

  const duration = buildDuration({
    kind: fixedWindow ? "fixed-window" : "deterministic",
    expectedTicks: pathTicks,
    minimumTicks: pathTicks,
    maximumTicks: pathTicks,
    representativeTicks: pathTicks,
    ...(fixedWindow ? { fixedHorizonTicks: effectiveHorizon } : {}),
  });

  const failure = error !== undefined ? emptyFailure(error, 1) : undefined;

  return {
    ok: error === undefined,
    ...(error !== undefined ? { error } : {}),
    casts: rt.casts,
    duration,
    ticks: pathTicks,
    ...(fixedWindow ? { horizonTicks: effectiveHorizon } : {}),
    damage: {
      expectedDamage,
      supportMinDamage: supportMin,
      supportMaxDamage: supportMax,
      expectedConditionalMin: conditionalMin,
      expectedConditionalMax: conditionalMax,
    },
    totalExpected: expectedDamage,
    totalMin: supportMin,
    totalMax: supportMax,
    dps: primaryDps,
    dpsDetail: buildDpsDetail({
      primary: primaryDps,
      ratioOfExpectations: pathDps,
      representativeDps: pathDps,
    }),
    metric: {
      type: fixedWindow ? "fixed-window" : "natural-completion",
      denominatorTicks: denomTicks,
      damageCounted: expectedDamage,
      tails: fixedWindow
        ? options?.includeTails
          ? "included-separately"
          : "excluded"
        : "included-in-natural-completion",
    },
    perAbility: rt.perAbility,
    damageByTick: rt.damageByTick,
    events: rt.events,
    history,
    analysis: buildAnalysis(rt),
    ...(tails !== undefined
      ? {
          tails,
          totalExpectedIncludingTails: tails.totalIncludingTails,
          postWindowTailDamage: tails.postWindowTailDamage,
        }
      : {}),
    ...(failure !== undefined ? { failure } : {}),
  };
}

function collectFailures(
  parts: readonly { weight: number; summary: RotationSummary }[],
): BranchFailureSummary | undefined {
  const failed = parts.filter((p) => !p.summary.ok);
  if (failed.length === 0) return undefined;
  const failedWeight = failed.reduce((s, p) => s + p.weight, 0);
  const successfulWeight = parts.reduce((s, p) => s + (p.summary.ok ? p.weight : 0), 0);
  const byReason = new Map<string, number>();
  for (const part of failed) {
    const reason = part.summary.error ?? "branch failed";
    byReason.set(reason, (byReason.get(reason) ?? 0) + part.weight);
  }
  const reasons = [...byReason.entries()]
    .map(([reason, weight]) => ({ reason, weight }))
    .sort((a, b) => b.weight - a.weight);
  return {
    failedWeight,
    successfulWeight,
    totalsScope: successfulWeight > PROB_TOLERANCE ? "successful-branches-renormalized" : "none",
    primaryReason: reasons[0]?.reason ?? "branch failed",
    reasons,
  };
}

/**
 * Combine terminal equivalence classes into one summary.
 *
 * Weighted damage, duration, and analysis come from successful branches only
 * (renormalized) when any branch fails. Casts/events come from the highest-weight
 * successful class when any succeed (else highest-weight failure) and are labeled
 * as representative history.
 */
export function combineBranchSummaries(
  branches: readonly Branch[],
  horizonTicks: number | undefined,
  options: SimulateOptions | undefined,
  sawBranching: boolean,
): RotationSummary {
  if (branches.length === 0) {
    const failure = emptyFailure("no branches", 1);
    return {
      ok: false,
      error: failure.primaryReason,
      casts: [],
      duration: buildDuration({
        kind: "deterministic",
        expectedTicks: 0,
        minimumTicks: 0,
        maximumTicks: 0,
        representativeTicks: 0,
      }),
      ticks: 0,
      damage: {
        expectedDamage: 0,
        supportMinDamage: 0,
        supportMaxDamage: 0,
        expectedConditionalMin: 0,
        expectedConditionalMax: 0,
      },
      totalExpected: 0,
      totalMin: 0,
      totalMax: 0,
      dps: 0,
      dpsDetail: buildDpsDetail({
        primary: 0,
        ratioOfExpectations: 0,
        representativeDps: 0,
      }),
      metric: {
        type: "natural-completion",
        denominatorTicks: 0,
        damageCounted: 0,
        tails: "included-in-natural-completion",
      },
      perAbility: {},
      damageByTick: {},
      events: [],
      history: {
        kind: "complete",
        classWeight: 0,
        ticks: 0,
        selectionReason: "sole-terminal",
        eventsReconcileWithWeightedTotals: false,
      },
      analysis: {
        bySource: [],
        byEffect: [],
        directDamage: 0,
        dotDamage: 0,
        criticalContribution: 0,
        capLoss: 0,
      },
      failure,
    };
  }

  const parts = branches.map((branch) => ({
    weight: branch.weight,
    summary: finish(branch.rt, branch.error, horizonTicks, options),
  }));
  const rawMass = parts.reduce((sum, p) => sum + p.weight, 0);
  const failure = collectFailures(parts);
  const successful = parts.filter((p) => p.summary.ok);
  const mixPool = successful.length > 0 ? successful : [];
  const mixWeight = mixPool.reduce((s, p) => s + p.weight, 0);

  // Representative history matches totals scope: successful pool when any
  // succeed, otherwise the failed set.
  const representativePool = successful.length > 0 ? successful : parts;
  const representative = representativePool.reduce((best, part) =>
    part.weight > best.weight ? part : best,
  );
  const selectionReason: HistorySelectionReason =
    successful.length > 0 && failure !== undefined
      ? "highest-successful-mass"
      : "highest-probability-mass";
  const modal = representative.summary;
  const fixedWindow = modal.metric.type === "fixed-window";
  const denomHorizon =
    fixedWindow && modal.horizonTicks !== undefined && modal.horizonTicks > 0
      ? modal.horizonTicks
      : undefined;

  const mix = (f: (s: RotationSummary) => number) =>
    mixWeight > 0
      ? weightedMean(mixPool.map((p) => ({ weight: p.weight, value: f(p.summary) })))
      : 0;

  const perAbility: Record<string, number> = {};
  for (const key of new Set(mixPool.flatMap((p) => Object.keys(p.summary.perAbility)))) {
    perAbility[key] = mix((s) => s.perAbility[key] ?? 0);
  }
  const damageByTick: Record<number, number> = {};
  for (const key of new Set(mixPool.flatMap((p) => Object.keys(p.summary.damageByTick)))) {
    damageByTick[Number(key)] = mix((s) => s.damageByTick[Number(key)] ?? 0);
  }

  const expectedDamage = mix((s) => s.damage.expectedDamage);
  const expectedConditionalMin = mix((s) => s.damage.expectedConditionalMin);
  const expectedConditionalMax = mix((s) => s.damage.expectedConditionalMax);
  const supportMinDamage =
    mixPool.length > 0 ? Math.min(...mixPool.map((p) => p.summary.damage.supportMinDamage)) : 0;
  const supportMaxDamage =
    mixPool.length > 0 ? Math.max(...mixPool.map((p) => p.summary.damage.supportMaxDamage)) : 0;

  // Expected duration is over the totals mix (successful only). Support min/max
  // and representative ticks share the history pool so rep ∈ [min, max] always —
  // including all-failed runs where expected is 0 but a failed path still has length.
  const durationSupportPool = mixPool.length > 0 ? mixPool : representativePool;
  const expectedTicks = mix((s) => s.duration.expectedTicks);
  const minimumTicks =
    durationSupportPool.length > 0
      ? Math.min(...durationSupportPool.map((p) => p.summary.duration.minimumTicks))
      : 0;
  const maximumTicks =
    durationSupportPool.length > 0
      ? Math.max(...durationSupportPool.map((p) => p.summary.duration.maximumTicks))
      : 0;
  const representativeTicks = modal.duration.representativeTicks;

  const denominatorTicks = denomHorizon ?? expectedTicks;
  const primaryDps = dpsFrom(expectedDamage, denominatorTicks);
  const ratioOfExpectations = dpsFrom(expectedDamage, expectedTicks);
  const expectedBranchDps =
    !fixedWindow && mixPool.length > 1
      ? mix((s) => dpsFrom(s.damage.expectedDamage, s.duration.expectedTicks))
      : undefined;
  const representativeDps = dpsFrom(
    modal.damage.expectedDamage,
    modal.duration.representativeTicks,
  );

  const bySource = SOURCE_KINDS.flatMap((kind) => {
    const damage = mix(
      (summary) => summary.analysis.bySource.find((row) => row.kind === kind)?.damage ?? 0,
    );
    return damage > 0 ? [{ kind, damage }] : [];
  }).sort((a, b) => b.damage - a.damage);

  const effectIds = new Set(mixPool.flatMap((p) => p.summary.analysis.byEffect.map((e) => e.id)));
  type EffectNumericField =
    | "totalDamage"
    | "casts"
    | "triggerRolls"
    | "expectedActivations"
    | "expectedSeparateHits"
    | "attachedComponents"
    | "bonusDamage"
    | "directDamage"
    | "dotDamage"
    | "criticalContribution"
    | "capLoss";
  const byEffect: DamageEffectBreakdown[] = [...effectIds]
    .map((id) => {
      const sample = mixPool
        .flatMap((p) => p.summary.analysis.byEffect)
        .find((effect) => effect.id === id)!;
      const value = (field: EffectNumericField) =>
        mix((summary) => summary.analysis.byEffect.find((e) => e.id === id)?.[field] ?? 0);
      const totalDamage = value("totalDamage");
      const expectedActivations = value("expectedActivations");
      return {
        id,
        kind: sample.kind,
        totalDamage,
        share: expectedDamage > 0 ? totalDamage / expectedDamage : 0,
        casts: value("casts"),
        triggerRolls: value("triggerRolls"),
        expectedActivations,
        expectedSeparateHits: value("expectedSeparateHits"),
        attachedComponents: value("attachedComponents"),
        bonusDamage: value("bonusDamage"),
        averagePerActivation: expectedActivations > 0 ? totalDamage / expectedActivations : 0,
        directDamage: value("directDamage"),
        dotDamage: value("dotDamage"),
        criticalContribution: value("criticalContribution"),
        capLoss: value("capLoss"),
      };
    })
    .sort((a, b) => b.totalDamage - a.totalDamage);

  const multiClass = parts.length > 1;
  const classWeight = rawMass > 0 ? representative.weight / rawMass : representative.weight;
  const useRepresentativeHistory = sawBranching || multiClass;
  // Intermediate merges weight-mix ledgers while keeping one event log, so any
  // branching run's events are never a safe rebuild source for weighted totals.
  const eventsReconcileWithWeightedTotals =
    !sawBranching && parts.length === 1 && failure === undefined;
  const history: HistoryProvenance = useRepresentativeHistory
    ? {
        kind: "representative-terminal-class",
        classWeight,
        ticks: representativeTicks,
        selectionReason,
        eventsReconcileWithWeightedTotals,
      }
    : {
        kind: "complete",
        classWeight: 1,
        ticks: representativeTicks,
        selectionReason: "sole-terminal",
        eventsReconcileWithWeightedTotals: failure === undefined,
      };

  const duration = buildDuration({
    kind: fixedWindow ? "fixed-window" : useRepresentativeHistory ? "stochastic" : "deterministic",
    expectedTicks,
    minimumTicks,
    maximumTicks,
    representativeTicks,
    ...(denomHorizon !== undefined ? { fixedHorizonTicks: denomHorizon } : {}),
  });

  let tails: TailMetrics | undefined;
  if (modal.tails !== undefined && mixWeight > 0) {
    tails = {
      inWindowExpectedDamage: mix(
        (s) => s.tails?.inWindowExpectedDamage ?? s.damage.expectedDamage,
      ),
      postWindowTailDamage: mix((s) => s.tails?.postWindowTailDamage ?? 0),
      totalIncludingTails: mix((s) => s.tails?.totalIncludingTails ?? s.damage.expectedDamage),
    };
  }

  const ok = failure === undefined && mixPool.length > 0;
  const error =
    failure?.primaryReason ??
    (mixPool.length === 0 ? (parts[0]?.summary.error ?? "all branches failed") : undefined);

  // Stochastic metadata only when branching occurred or multiple terminals remain.
  // Deterministic single-path failures stay on `failure` without rng noise.
  const rng: StochasticRngSummary | undefined =
    sawBranching || multiClass
      ? {
          method: "probability-weighted branching",
          terminalClasses: parts.length,
          successfulClasses: successful.length,
          failedClasses: parts.filter((p) => !p.summary.ok).length,
          probabilityMass: rawMass,
          representative: {
            classWeight,
            ticks: representativeTicks,
            selectionReason,
            historyKind: "representative-terminal-class",
            eventsReconcileWithWeightedTotals,
          },
          ...(failure !== undefined ? { failure, failedWeight: failure.failedWeight } : {}),
          representativeClassWeight: classWeight,
          representativeClassTicks: representativeTicks,
        }
      : undefined;

  // Numeric stability: zero out non-finite aggregates.
  const safeExpected = finiteOrZero(expectedDamage);
  const safeSupportMin = finiteOrZero(supportMinDamage);
  const safeSupportMax = finiteOrZero(supportMaxDamage);

  return {
    ok,
    ...(error !== undefined ? { error } : {}),
    casts: modal.casts,
    duration,
    ticks: expectedTicks,
    ...(denomHorizon !== undefined ? { horizonTicks: denomHorizon } : {}),
    damage: {
      expectedDamage: safeExpected,
      supportMinDamage: safeSupportMin,
      supportMaxDamage: safeSupportMax,
      expectedConditionalMin: finiteOrZero(expectedConditionalMin),
      expectedConditionalMax: finiteOrZero(expectedConditionalMax),
    },
    totalExpected: safeExpected,
    totalMin: safeSupportMin,
    totalMax: safeSupportMax,
    dps: finiteOrZero(primaryDps),
    dpsDetail: buildDpsDetail({
      primary: finiteOrZero(primaryDps),
      ratioOfExpectations: finiteOrZero(ratioOfExpectations),
      representativeDps: finiteOrZero(representativeDps),
      ...(expectedBranchDps !== undefined
        ? { expectedBranchDps: finiteOrZero(expectedBranchDps) }
        : {}),
    }),
    metric: {
      type: fixedWindow ? "fixed-window" : "natural-completion",
      denominatorTicks: denominatorTicks,
      damageCounted: safeExpected,
      tails: modal.metric.tails,
    },
    perAbility,
    damageByTick,
    events: modal.events,
    history,
    analysis: {
      bySource,
      byEffect,
      directDamage: mix((s) => s.analysis.directDamage),
      dotDamage: mix((s) => s.analysis.dotDamage),
      criticalContribution: mix((s) => s.analysis.criticalContribution),
      capLoss: mix((s) => s.analysis.capLoss),
    },
    ...(tails !== undefined
      ? {
          tails,
          totalExpectedIncludingTails: tails.totalIncludingTails,
          postWindowTailDamage: tails.postWindowTailDamage,
        }
      : {}),
    ...(rng !== undefined ? { rng } : {}),
    ...(failure !== undefined ? { failure } : {}),
  };
}
