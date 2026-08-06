import { finalizeAnalysis } from "../analysis";
import {
  appendWithIntermediateCap,
  branchCapsFromBudget,
  combineExactness,
  mergeAndCapBranches,
  snapshotRuntime,
  type Branch,
  type BranchExactness as EngineBranchExactness,
} from "./branch";
import { drainBranchToEnd } from "./landBranch";
import type {
  BranchExactness,
  BranchFailureSummary,
  DamageEffectBreakdown,
  DamageSourceKind,
  DamageTotalsBasis,
  DurationSummary,
  DpsSummary,
  HistoryProvenance,
  HistorySelectionReason,
  PlayerPoisonAnalysis,
  RotationSummary,
  SimulateOptions,
  StochasticRngSummary,
  TailMetrics,
} from "./contracts";
import { PLAYER_POISON_EFFECT_ID, resolvePoisonApplication } from "../../poison/mechanics";
import {
  keepsAnalysisLedgers,
  keepsPerAbilityMap,
  keepsPresentationHistory,
  resolveDetailLevel,
} from "./contracts";
import { advanceTo } from "../runtime/clock";
import type { SimulationRuntime } from "../runtime/runtime";
import { TICK_SECONDS } from "../../core/ticks";
import {
  finiteOrZero,
  PROB_TOLERANCE,
  RESIDUAL_FREE_TOLERANCE,
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
  "player-poison",
  "basic-attack",
  "auto-attack",
  "other-modeled",
];

const EMPTY_ANALYSIS = {
  bySource: [] as { kind: DamageSourceKind; damage: number }[],
  byEffect: [] as DamageEffectBreakdown[],
  directDamage: 0,
  dotDamage: 0,
  criticalContribution: 0,
  capLoss: 0,
};

/** Public analysis from engine-owned ledgers - never rescanned from events. */
function buildAnalysis(rt: SimulationRuntime) {
  if (!keepsAnalysisLedgers(rt.detailLevel)) return EMPTY_ANALYSIS;
  return finalizeAnalysis(rt.analysis, rt.totalExpected);
}

function buildPlayerPoisonAnalysis(
  rt: SimulationRuntime,
  analysis: ReturnType<typeof buildAnalysis>,
): PlayerPoisonAnalysis | undefined {
  if (!keepsAnalysisLedgers(rt.detailLevel)) return undefined;
  const source = resolvePoisonApplication(rt.input.playerPoison, 0);
  if (!source) return undefined;
  const row = analysis.byEffect.find((effect) => effect.id === PLAYER_POISON_EFFECT_ID);
  const poison = rt.state.target.weaponPoison;
  const toxin = rt.state.target.evolvingToxin;
  const poisonLive = poison.active && rt.state.tick < poison.expiresAtTick;
  const toxinLive = rt.state.tick < toxin.expiresAtTick;
  return {
    sourceLabel: poisonLive ? poison.sourceLabel : source.sourceLabel,
    effectiveTier: poisonLive ? poison.effectiveTier : source.effectiveTier,
    procChance: source.procChance,
    applicationAttempts: row?.expectedTriggerRolls ?? 0,
    successfulApplications: row?.expectedActivations ?? 0,
    separateHits: row?.expectedSeparateHits ?? 0,
    minimumDamage: row?.minimumDamage ?? 0,
    expectedDamage: row?.totalDamage ?? 0,
    maximumDamage: row?.maximumDamage ?? 0,
    decayIndex: poisonLive ? poison.decayIndex : 0,
    remainingTargetPoisonTicks: poisonLive ? Math.max(0, poison.expiresAtTick - rt.state.tick) : 0,
    bikStacks: toxinLive ? toxin.stacks : 0,
    bikRemainingTicks: toxinLive ? toxin.expiresAtTick - rt.state.tick : 0,
    probabilityMass: 1,
    residualMass: 0,
    supportStatus: "partially-modeled",
  };
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
 * Horizon completion + result assembly. With horizon: half-open [0, horizonTicks),
 * primary DPS / horizon. Without: natural end, primary DPS = E[D] / (elapsed * tickSeconds).
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

  const detail = resolveDetailLevel(rt.detailLevel);
  const presentHistory = keepsPresentationHistory(detail);
  const analysis = buildAnalysis(rt);
  const playerPoison = buildPlayerPoisonAnalysis(rt, analysis);
  return {
    ok: error === undefined,
    ...(error !== undefined ? { error } : {}),
    casts: presentHistory ? rt.casts : [],
    duration,
    ticks: pathTicks,
    ...(fixedWindow ? { horizonTicks: effectiveHorizon } : {}),
    damage: {
      expectedDamage,
      // Sole path carries full unit measure.
      scope: "unit-mass",
      knownMassExpectedDamage: expectedDamage,
      conditionalConcreteMean: expectedDamage,
      concreteMass: 1,
      residualMass: 0,
      eligibleForRanking: error === undefined,
      supportMinDamage: supportMin,
      supportMaxDamage: supportMax,
      expectedConditionalMin: conditionalMin,
      expectedConditionalMax: conditionalMax,
    },
    totalExpected: expectedDamage,
    totalHealed: finiteOrZero(rt.totalHealed),
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
    perAbility: keepsPerAbilityMap(detail) ? rt.perAbility : {},
    damageByTick: rt.damageByTick,
    events: presentHistory ? rt.events : [],
    history,
    analysis,
    ...(playerPoison ? { playerPoison } : {}),
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

function poolMean(
  pool: readonly { weight: number; summary: RotationSummary }[],
  f: (s: RotationSummary) => number,
): number {
  if (pool.length === 0) return 0;
  return weightedMean(pool.map((p) => ({ weight: p.weight, value: f(p.summary) })));
}

function collectFailures(
  parts: readonly { weight: number; summary: RotationSummary }[],
): BranchFailureSummary | undefined {
  const failed = parts.filter((p) => !p.summary.ok);
  if (failed.length === 0) return undefined;
  const failedWeight = failed.reduce((s, p) => s + p.weight, 0);
  const successful = parts.filter((p) => p.summary.ok);
  const successfulWeight = successful.reduce((s, p) => s + p.weight, 0);
  const byReason = new Map<string, number>();
  for (const part of failed) {
    const reason = part.summary.error ?? "branch failed";
    byReason.set(reason, (byReason.get(reason) ?? 0) + part.weight);
  }
  const reasons = [...byReason.entries()]
    .map(([reason, weight]) => ({ reason, weight }))
    .sort((a, b) => b.weight - a.weight);
  // Primary stays unconditional; success-only mean is diagnostic only.
  const conditionalOnSuccessExpectedDamage =
    successfulWeight > PROB_TOLERANCE
      ? poolMean(successful, (s) => s.damage.expectedDamage)
      : undefined;
  const failedPathExpectedDamage =
    failedWeight > PROB_TOLERANCE ? poolMean(failed, (s) => s.damage.expectedDamage) : undefined;
  return {
    failedWeight,
    successfulWeight,
    totalsScope: successfulWeight > PROB_TOLERANCE ? "unconditional-all-mass" : "none",
    primaryReason: reasons[0]?.reason ?? "branch failed",
    reasons,
    ...(conditionalOnSuccessExpectedDamage !== undefined
      ? { conditionalOnSuccessExpectedDamage }
      : {}),
    ...(failedPathExpectedDamage !== undefined ? { failedPathExpectedDamage } : {}),
  };
}

/**
 * Combine terminal equivalence classes.
 * residual ~ 0: expectedDamage / totalExpected = unit-mass EV; scope unit-mass.
 * residual > 0: expectedDamage / totalExpected = known-mass contribution
 * (concreteMass * E[D|concrete] = sum w_i D_i); scope known-mass-contribution.
 * Never expose E[D|concrete] as unit-mass EV. Never success-renormalize.
 * Residual is disclosed on rng, not zero-filled into a silent full EV.
 * Casts/events from highest-weight successful class (else highest-weight failure).
 */
export function combineBranchSummaries(
  branches: readonly Branch[],
  horizonTicks: number | undefined,
  options: SimulateOptions | undefined,
  sawBranching: boolean,
  residualWeight = 0,
  exactness: EngineBranchExactness = "exact",
): RotationSummary {
  const { maxLive, intermediateMax } = branchCapsFromBudget(options?.branchBudget);
  // Drain unlanded queue with Leng land forks before assembling terminal summaries.
  let residual = residualWeight;
  let exact: EngineBranchExactness = exactness;
  if (branches.some((branch) => (branch.rt.input.procs?.aftershockRank ?? 0) > 0)) {
    exact = combineExactness(exact, "bounded-approximation");
  }
  let forkedAtDrain = false;
  let drained: Branch[] = [];
  for (const branch of branches) {
    const set = drainBranchToEnd(branch, horizonTicks, maxLive, intermediateMax);
    residual += set.residualWeight;
    exact = combineExactness(exact, set.exactness);
    if (set.branches.length > 1) forkedAtDrain = true;
    const folded = appendWithIntermediateCap(drained, set.branches, maxLive);
    residual += folded.residualWeight;
    exact = combineExactness(exact, folded.exactness);
    drained = folded.branches;
  }
  const capped = mergeAndCapBranches(drained, maxLive);
  residual += capped.residualWeight;
  exact = combineExactness(exact, capped.exactness);
  const terminalBranches = capped.branches;
  const branching = sawBranching || forkedAtDrain || terminalBranches.length > 1;

  if (terminalBranches.length === 0) {
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
        scope: "unit-mass",
        knownMassExpectedDamage: 0,
        conditionalConcreteMean: 0,
        concreteMass: 0,
        residualMass: 0,
        eligibleForRanking: false,
        supportMinDamage: 0,
        supportMaxDamage: 0,
        expectedConditionalMin: 0,
        expectedConditionalMax: 0,
      },
      totalExpected: 0,
      totalHealed: 0,
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

  const parts = terminalBranches.map((branch) => ({
    weight: branch.weight,
    summary: finish(branch.rt, branch.error, horizonTicks, options),
  }));
  // Concrete terminal mass only; residual is disclosed separately (sum ~ 1).
  const rawMass = parts.reduce((sum, p) => sum + p.weight, 0);
  const failure = collectFailures(parts);
  const successful = parts.filter((p) => p.summary.ok);
  // Primary mix: every terminal branch. Failed mass never becomes successful.
  // Residual is unexpanded measure - never folded into a concrete survivor state.
  const mixPool = parts;
  const mixWeight = rawMass;

  // Representative history prefers successful class for display; failed mass
  // is never reclassified as success for ok / totalsScope.
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

  // Conditional (weight-normalized over concrete) then known-mass = scale * conditional.
  const mix = (f: (s: RotationSummary) => number) => poolMean(mixPool, f);

  const safeResidual = finiteOrZero(residual);
  const concreteMass = rawMass;
  const hasResidual = safeResidual > RESIDUAL_FREE_TOLERANCE;
  // Known-mass scale: multiply conditional means by concreteMass when residual remains.
  // residual ~ 0 => concreteMass ~ 1 => scale 1 leaves unit-mass EV.
  const knownMassScale = hasResidual ? concreteMass : 1;
  const toKnownMass = (conditional: number) => conditional * knownMassScale;

  const damageByTick: Record<number, number> = {};
  for (const key of new Set(mixPool.flatMap((p) => Object.keys(p.summary.damageByTick)))) {
    damageByTick[Number(key)] = toKnownMass(mix((s) => s.damageByTick[Number(key)] ?? 0));
  }

  // E[D|concrete] over expanded terminals (success + fail banked).
  const conditionalConcreteMean = mix((s) => s.damage.expectedDamage);
  // sum w_i D_i (known contribution only; residual unassigned).
  const knownMassExpectedDamage = concreteMass * conditionalConcreteMean;
  // residual ~ 0: unit-mass EV (= conditional when mass ~ 1).
  // residual > 0: known-mass contribution only - never put conditional into expectedDamage.
  const expectedDamage = hasResidual ? knownMassExpectedDamage : conditionalConcreteMean;
  const expectedConditionalMin = mix((s) => s.damage.expectedConditionalMin);
  const expectedConditionalMax = mix((s) => s.damage.expectedConditionalMax);
  const supportMinDamage = Math.min(...mixPool.map((p) => p.summary.damage.supportMinDamage));
  const supportMaxDamage = Math.max(...mixPool.map((p) => p.summary.damage.supportMaxDamage));

  // Duration: unconditional E[T] over concrete terminals; support + rep from same pool.
  const expectedTicks = mix((s) => s.duration.expectedTicks);
  const minimumTicks = Math.min(...mixPool.map((p) => p.summary.duration.minimumTicks));
  const maximumTicks = Math.max(...mixPool.map((p) => p.summary.duration.maximumTicks));
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

  // Detail level from any terminal runtime (all branches share the request flag).
  const detail = resolveDetailLevel(terminalBranches[0]?.rt.detailLevel);
  const wantAnalysis = keepsAnalysisLedgers(detail);
  const wantPerAbility = keepsPerAbilityMap(detail);
  const wantHistory = keepsPresentationHistory(detail);

  const bySource = !wantAnalysis
    ? []
    : SOURCE_KINDS.flatMap((kind) => {
        const damage = toKnownMass(
          mix((summary) => summary.analysis.bySource.find((row) => row.kind === kind)?.damage ?? 0),
        );
        return damage > 0 ? [{ kind, damage }] : [];
      }).sort((a, b) => b.damage - a.damage);

  type EffectNumericField =
    | "totalDamage"
    | "expectedCasts"
    | "expectedTriggerRolls"
    | "expectedActivations"
    | "expectedSeparateHits"
    | "expectedAttachedComponents"
    | "bonusDamage"
    | "directDamage"
    | "dotDamage"
    | "criticalContribution"
    | "capLoss"
    | "minimumDamage"
    | "maximumDamage";
  // Count fields stay conditional means; damage fields use known-mass scale with residual.
  const DAMAGE_EFFECT_FIELDS = new Set<EffectNumericField>([
    "totalDamage",
    "bonusDamage",
    "directDamage",
    "dotDamage",
    "criticalContribution",
    "capLoss",
    "minimumDamage",
    "maximumDamage",
  ]);
  const byEffect: DamageEffectBreakdown[] = !wantAnalysis
    ? []
    : (() => {
        const effectIds = new Set(
          mixPool.flatMap((p) => p.summary.analysis.byEffect.map((e) => e.id)),
        );
        return [...effectIds]
          .map((id) => {
            const sample = mixPool
              .flatMap((p) => p.summary.analysis.byEffect)
              .find((effect) => effect.id === id)!;
            const value = (field: EffectNumericField) => {
              const conditional = mix(
                (summary) => summary.analysis.byEffect.find((e) => e.id === id)?.[field] ?? 0,
              );
              return DAMAGE_EFFECT_FIELDS.has(field) ? toKnownMass(conditional) : conditional;
            };
            const conditionalTotal = mix(
              (summary) => summary.analysis.byEffect.find((e) => e.id === id)?.totalDamage ?? 0,
            );
            const totalDamage = toKnownMass(conditionalTotal);
            const expectedActivations = value("expectedActivations");
            return {
              id,
              kind: sample.kind,
              totalDamage,
              share: expectedDamage > 0 ? totalDamage / expectedDamage : 0,
              expectedCasts: value("expectedCasts"),
              expectedTriggerRolls: value("expectedTriggerRolls"),
              expectedActivations,
              expectedSeparateHits: value("expectedSeparateHits"),
              expectedAttachedComponents: value("expectedAttachedComponents"),
              bonusDamage: value("bonusDamage"),
              // Per-activation stays on conditional scale (mass does not change hit size).
              averagePerActivation:
                expectedActivations > 0 ? conditionalTotal / expectedActivations : 0,
              directDamage: value("directDamage"),
              dotDamage: value("dotDamage"),
              criticalContribution: value("criticalContribution"),
              capLoss: value("capLoss"),
              ...(sample.minimumDamage !== undefined
                ? { minimumDamage: value("minimumDamage") }
                : {}),
              ...(sample.maximumDamage !== undefined
                ? { maximumDamage: value("maximumDamage") }
                : {}),
            };
          })
          .sort((a, b) => b.totalDamage - a.totalDamage);
      })();

  const multiClass = parts.length > 1;
  // Absolute probability mass of the representative class (not share of concrete-only mass).
  const classWeight = representative.weight;
  const useRepresentativeHistory = branching || multiClass || residual > RESIDUAL_FREE_TOLERANCE;
  // Branching merges weight-mix ledgers with one event log: events are not a
  // safe rebuild source for weighted totals.
  const eventsReconcileWithWeightedTotals =
    !branching && parts.length === 1 && failure === undefined;
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
      inWindowExpectedDamage: toKnownMass(
        mix((s) => s.tails?.inWindowExpectedDamage ?? s.damage.expectedDamage),
      ),
      postWindowTailDamage: toKnownMass(mix((s) => s.tails?.postWindowTailDamage ?? 0)),
      totalIncludingTails: toKnownMass(
        mix((s) => s.tails?.totalIncludingTails ?? s.damage.expectedDamage),
      ),
    };
  }

  const ok = failure === undefined;
  const error = failure?.primaryReason;

  const resolvedExactness: BranchExactness =
    exact === "exact" || exact === "merged-exactly"
      ? safeResidual > RESIDUAL_FREE_TOLERANCE
        ? "approximated"
        : "exact"
      : "approximated";
  // residual > 0 => known-mass contribution primary; residual ~ 0 => unit-mass EV.
  const totalsBasis: DamageTotalsBasis = hasResidual ? "known-mass-contribution" : "unit-mass";
  const eligibleForRanking = !hasResidual && resolvedExactness === "exact" && ok;

  // Stochastic rng when branching, multi-terminal, or residual mass remains.
  // probabilityMass/concreteMass = expanded measure only.
  const rng: StochasticRngSummary | undefined =
    branching ||
    multiClass ||
    safeResidual > RESIDUAL_FREE_TOLERANCE ||
    resolvedExactness !== "exact"
      ? {
          method: "probability-weighted branching",
          terminalClasses: parts.length,
          successfulClasses: successful.length,
          failedClasses: parts.filter((p) => !p.summary.ok).length,
          probabilityMass: rawMass,
          concreteMass: rawMass,
          residualWeight: safeResidual,
          totalsBasis,
          exactness: resolvedExactness,
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
  const safeConditionalMean = finiteOrZero(conditionalConcreteMean);
  const safeKnownMass = finiteOrZero(knownMassExpectedDamage);
  const safeSupportMin = finiteOrZero(supportMinDamage);
  const safeSupportMax = finiteOrZero(supportMaxDamage);

  const perAbility: Record<string, number> = {};
  if (wantPerAbility) {
    for (const key of new Set(mixPool.flatMap((p) => Object.keys(p.summary.perAbility)))) {
      perAbility[key] = toKnownMass(mix((s) => s.perAbility[key] ?? 0));
    }
  }
  const poisonRow = byEffect.find((effect) => effect.id === PLAYER_POISON_EFFECT_ID);
  const playerPoison =
    wantAnalysis && modal.playerPoison
      ? {
          ...modal.playerPoison,
          applicationAttempts: poisonRow?.expectedTriggerRolls ?? 0,
          successfulApplications: poisonRow?.expectedActivations ?? 0,
          separateHits: poisonRow?.expectedSeparateHits ?? 0,
          minimumDamage: poisonRow?.minimumDamage ?? 0,
          expectedDamage: poisonRow?.totalDamage ?? 0,
          maximumDamage: poisonRow?.maximumDamage ?? 0,
          probabilityMass: rawMass,
          residualMass: safeResidual,
        }
      : undefined;

  return {
    ok,
    ...(error !== undefined ? { error } : {}),
    casts: wantHistory ? modal.casts : [],
    duration,
    ticks: expectedTicks,
    ...(denomHorizon !== undefined ? { horizonTicks: denomHorizon } : {}),
    damage: {
      expectedDamage: safeExpected,
      scope: totalsBasis,
      conditionalConcreteMean: safeConditionalMean,
      knownMassExpectedDamage: safeKnownMass,
      concreteMass: concreteMass,
      residualMass: safeResidual,
      eligibleForRanking,
      supportMinDamage: safeSupportMin,
      supportMaxDamage: safeSupportMax,
      expectedConditionalMin: finiteOrZero(expectedConditionalMin),
      expectedConditionalMax: finiteOrZero(expectedConditionalMax),
    },
    totalExpected: safeExpected,
    totalHealed: toKnownMass(mix((s) => s.totalHealed)),
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
    events: wantHistory ? modal.events : [],
    history,
    analysis: wantAnalysis
      ? {
          bySource,
          byEffect,
          directDamage: toKnownMass(mix((s) => s.analysis.directDamage)),
          dotDamage: toKnownMass(mix((s) => s.analysis.dotDamage)),
          criticalContribution: toKnownMass(mix((s) => s.analysis.criticalContribution)),
          capLoss: toKnownMass(mix((s) => s.analysis.capLoss)),
        }
      : EMPTY_ANALYSIS,
    ...(playerPoison ? { playerPoison } : {}),
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
