import { finalizeAnalysis, graspGroupFromEffects } from "../analysis";
import type {
  StochasticExactness,
  StochasticFailureSummary,
  DamageEffectBreakdown,
  DamageEffectSourceBreakdown,
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
  TargetStatusSummary,
  TailMetrics,
} from "./contracts";
import {
  PLAYER_POISON_SUPPORT_NOTE,
  CINDERBANE_SUPPORT_NOTE,
  PLAYER_POISON_EFFECT_ID,
  resolvePoisonApplication,
} from "../../poison/mechanics";
import { hasBlessing } from "../../league/ruleset";
import {
  keepsAnalysisLedgers,
  keepsPerAbilityMap,
  keepsPresentationHistory,
  resolveDetailLevel,
} from "./contracts";
import { advanceTo } from "../runtime/clock";
import { cloneRuntime, type SimulationRuntime } from "../runtime/runtime";
import { activeTimedTargetStatus } from "../../target/timedStatus";
import { lastPlayerPoisonTick } from "../schedulers/playerPoisonState";
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
  "player-poison",
  "basic-attack",
  "auto-attack",
  "target-status",
  "other-modeled",
];

const EMPTY_ANALYSIS = {
  bySource: [] as { kind: DamageSourceKind; damage: number }[],
  byEffect: [] as DamageEffectBreakdown[],
  groups: [],
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
  const poison = rt.state.target.weaponPoison.poison;
  const toxin = rt.state.target.evolvingToxin;
  const poisonLive = poison.active && rt.state.tick < poison.expiresAtTick;
  const toxinLive = rt.state.tick < toxin.expiresAtTick;
  if (
    rt.input.targetPoisonImmune === true &&
    !hasBlessing(rt.input.league, "envenomed") &&
    !poisonLive &&
    !row
  ) {
    return undefined;
  }
  const cinderbane = rt.input.playerPoison?.cinderbane === true;
  const targetState = {
    decayIndex: poisonLive ? poison.decayIndex : 0,
    remainingTargetPoisonTicks: poisonLive ? Math.max(0, poison.expiresAtTick - rt.state.tick) : 0,
    bikStacks: toxinLive ? toxin.stacks : 0,
    bikRemainingTicks: toxinLive ? toxin.expiresAtTick - rt.state.tick : 0,
  };
  return {
    sourceLabel: poisonLive ? poison.sourceLabel : source.sourceLabel,
    effectiveTier: poisonLive ? poison.effectiveTier : source.effectiveTier,
    procChance: source.procChance,
    applicationAttempts: row?.expectedTriggerRolls ?? 0,
    successfulApplications: row?.expectedActivations ?? 0,
    separateHits: row?.expectedSeparateHits ?? 0,
    cinderbaneContinuationChance: cinderbane ? source.continuationChance : 0,
    cinderbaneContinuationAttempts: rt.analysis.playerPoisonContinuationAttempts,
    successfulCinderbaneContinuations: rt.analysis.playerPoisonContinuationActivations,
    minimumDamage: (row?.minimumDamage ?? 0) + (row?.bonusDamage ?? 0),
    expectedDamage: (row?.totalDamage ?? 0) + (row?.bonusDamage ?? 0),
    maximumDamage: (row?.maximumDamage ?? 0) + (row?.bonusDamage ?? 0),
    targetState,
    probabilityMass: 1,
    supportStatus: "partially-modeled",
    supportNote: cinderbane
      ? `${PLAYER_POISON_SUPPORT_NOTE} ${CINDERBANE_SUPPORT_NOTE}`
      : PLAYER_POISON_SUPPORT_NOTE,
  };
}

function buildTargetStatusSummary(rt: SimulationRuntime): TargetStatusSummary | undefined {
  const vitality = rt.state.target.vitality;
  const candidate = rt.state.target.deathMark;
  const status = activeTimedTargetStatus(candidate, rt.state.tick) ? candidate : undefined;
  if (!vitality && !status) return undefined;
  return {
    deathMark: {
      active: status !== undefined,
      ...(status ? { source: { ...status.source } } : {}),
      remainingTicks: status ? Math.max(0, status.expiresAtTick - rt.state.tick) : 0,
      ...(vitality
        ? {
            currentLifePoints: vitality.currentLifePoints,
            maximumLifePoints: vitality.maximumLifePoints,
          }
        : {}),
    },
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

function emptyFailure(primaryReason: string, failedWeight: number): StochasticFailureSummary {
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
  expectedLaneDps?: number;
}): DpsSummary {
  return {
    primary: args.primary,
    ratioOfExpectations: args.ratioOfExpectations,
    representativeDps: args.representativeDps,
    ...(args.expectedLaneDps !== undefined ? { expectedLaneDps: args.expectedLaneDps } : {}),
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
    for (;;) {
      const poisonTick = lastPlayerPoisonTick(rt);
      if (rt.queue.length === 0 && poisonTick < 0) break;
      advanceTo(rt, Math.max(rt.queue.maxTick(), poisonTick));
    }
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
    const preview = cloneRuntime(rt);
    Object.assign(preview, {
      input: { ...preview.input, horizonTicks: undefined },
      horizon: undefined,
      finalized: false,
    });
    for (;;) {
      const poisonTick = lastPlayerPoisonTick(preview);
      if (preview.queue.length === 0 && poisonTick < 0) break;
      advanceTo(preview, Math.max(preview.queue.maxTick(), poisonTick));
    }
    const totalIncludingTails = finiteOrZero(preview.totalExpected);
    tails = {
      inWindowExpectedDamage: expectedDamage,
      postWindowTailDamage: totalIncludingTails - expectedDamage,
      totalIncludingTails,
    };
  }

  const history: HistoryProvenance = {
    kind: "complete",
    historyWeight: 1,
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
  const targetStatus = buildTargetStatusSummary(rt);
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
    ...(targetStatus ? { targetStatus } : {}),
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

function combineTargetStatus(
  pool: readonly { weight: number; summary: RotationSummary }[],
  modal: RotationSummary,
): TargetStatusSummary | undefined {
  const marks = pool
    .map((part) => part.summary.targetStatus?.deathMark)
    .filter((mark): mark is NonNullable<typeof mark> => mark !== undefined);
  if (marks.length === 0) return undefined;
  const modalMark = modal.targetStatus?.deathMark;
  const sourceMark = marks.find((mark) => mark.source !== undefined);
  const base = modalMark ?? sourceMark ?? { active: false, remainingTicks: 0 };
  const hasCurrent = marks.some((mark) => mark.currentLifePoints !== undefined);
  const hasMaximum = marks.some((mark) => mark.maximumLifePoints !== undefined);
  return {
    deathMark: {
      ...base,
      expected: {
        activeProbability: poolMean(pool, (summary) =>
          summary.targetStatus?.deathMark?.active ? 1 : 0,
        ),
        remainingTicks: poolMean(
          pool,
          (summary) => summary.targetStatus?.deathMark?.remainingTicks ?? 0,
        ),
        ...(hasCurrent
          ? {
              currentLifePoints: poolMean(
                pool,
                (summary) => summary.targetStatus?.deathMark?.currentLifePoints ?? 0,
              ),
            }
          : {}),
        ...(hasMaximum
          ? {
              maximumLifePoints: poolMean(
                pool,
                (summary) => summary.targetStatus?.deathMark?.maximumLifePoints ?? 0,
              ),
            }
          : {}),
      },
    },
  };
}

function collectFailures(
  parts: readonly { weight: number; summary: RotationSummary }[],
): StochasticFailureSummary | undefined {
  const failed = parts.filter((p) => !p.summary.ok);
  if (failed.length === 0) return undefined;
  const failedWeight = failed.reduce((s, p) => s + p.weight, 0);
  const successful = parts.filter((p) => p.summary.ok);
  const successfulWeight = successful.reduce((s, p) => s + p.weight, 0);
  const byReason = new Map<string, number>();
  for (const part of failed) {
    const reason = part.summary.error ?? "lane failed";
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
    primaryReason: reasons[0]?.reason ?? "lane failed",
    reasons,
    ...(conditionalOnSuccessExpectedDamage !== undefined
      ? { conditionalOnSuccessExpectedDamage }
      : {}),
    ...(failedPathExpectedDamage !== undefined ? { failedPathExpectedDamage } : {}),
  };
}

export interface StochasticLane {
  weight: number;
  rt: SimulationRuntime;
  error?: string;
}

export function combineStochasticSummaries(
  lanes: readonly StochasticLane[],
  horizonTicks: number | undefined,
  options: SimulateOptions | undefined,
): RotationSummary {
  const terminalLanes = [...lanes];
  const stochastic = terminalLanes.length > 1;

  if (terminalLanes.length === 0) {
    const failure = emptyFailure("no lanes", 1);
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
        historyWeight: 0,
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

  const parts = terminalLanes.map((lane) => ({
    weight: lane.weight,
    summary: finish(lane.rt, lane.error, horizonTicks, options),
  }));
  // Fixed lanes always carry the complete unit mass.
  const rawMass = parts.reduce((sum, p) => sum + p.weight, 0);
  const failure = collectFailures(parts);
  const successful = parts.filter((p) => p.summary.ok);
  // Primary mix includes every lane. Failed mass never becomes successful.
  // Residual is unexpanded measure - never folded into a concrete survivor state.
  const mixPool = parts;
  const mixWeight = rawMass;

  const representativePool = successful.length > 0 ? successful : parts;
  const historyGroups = new Map<
    string,
    { weight: number; representative: (typeof representativePool)[number] }
  >();
  for (const part of representativePool) {
    const key = JSON.stringify([
      part.summary.ok,
      part.summary.error ?? "",
      part.summary.casts.map((cast) => [
        cast.tick,
        cast.abilityId,
        cast.actualSpend,
        cast.adrenalineAfter,
      ]),
      part.summary.events.map((event) => [
        event.tick,
        event.abilityId,
        event.family,
        event.damage.critical?.outcome ?? "expected",
      ]),
    ]);
    const existing = historyGroups.get(key);
    if (existing) existing.weight += part.weight;
    else historyGroups.set(key, { weight: part.weight, representative: part });
  }
  const representativeGroup = [...historyGroups.values()].reduce((best, group) =>
    group.weight > best.weight ? group : best,
  );
  const representative = representativeGroup.representative;
  const selectionReason: HistorySelectionReason =
    successful.length > 0 && failure !== undefined
      ? "most-common-successful-history"
      : "most-common-history";
  const modal = representative.summary;
  const fixedWindow = modal.metric.type === "fixed-window";
  const denomHorizon =
    fixedWindow && modal.horizonTicks !== undefined && modal.horizonTicks > 0
      ? modal.horizonTicks
      : undefined;

  // Conditional (weight-normalized over concrete) then known-mass = scale * conditional.
  const mix = (f: (s: RotationSummary) => number) => poolMean(mixPool, f);

  const safeResidual = 0;
  const concreteMass = rawMass;
  const hasResidual = false;
  const knownMassScale = 1;
  const toKnownMass = (conditional: number) => conditional * knownMassScale;

  const damageByTick: Record<number, number> = {};
  for (const key of new Set(mixPool.flatMap((p) => Object.keys(p.summary.damageByTick)))) {
    damageByTick[Number(key)] = toKnownMass(mix((s) => s.damageByTick[Number(key)] ?? 0));
  }

  // E[D|concrete] over expanded terminals (success + fail banked).
  const conditionalConcreteMean = mix((s) => s.damage.expectedDamage);
  const knownMassExpectedDamage = concreteMass * conditionalConcreteMean;
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
  const expectedLaneDps =
    !fixedWindow && mixPool.length > 1
      ? mix((s) => dpsFrom(s.damage.expectedDamage, s.duration.expectedTicks))
      : undefined;
  const representativeDps = dpsFrom(
    modal.damage.expectedDamage,
    modal.duration.representativeTicks,
  );

  const detail = resolveDetailLevel(terminalLanes[0]?.rt.detailLevel);
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
    | "expectedPlayerPoisonHits"
    | "bonusDamage"
    | "directDamage"
    | "dotDamage"
    | "criticalContribution"
    | "capLoss"
    | "minimumDamage"
    | "maximumDamage"
    | "analysisGroupActivations";
  // Count and damage fields are lane-weighted means.
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
            const hasMinimumDamage = mixPool.some((part) =>
              part.summary.analysis.byEffect.some(
                (effect) => effect.id === id && effect.minimumDamage !== undefined,
              ),
            );
            const hasMaximumDamage = mixPool.some((part) =>
              part.summary.analysis.byEffect.some(
                (effect) => effect.id === id && effect.maximumDamage !== undefined,
              ),
            );
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
            const sourceIds = new Set(
              mixPool.flatMap(
                (p) =>
                  p.summary.analysis.byEffect
                    .find((effect) => effect.id === id)
                    ?.sourceBreakdown?.map((source) => source.blessingId) ?? [],
              ),
            );
            const sourceBreakdown = [...sourceIds]
              .map((blessingId): DamageEffectSourceBreakdown => {
                const sourceValue = (
                  field: keyof Omit<
                    DamageEffectSourceBreakdown,
                    "blessingId" | "averagePerActivation"
                  >,
                ) =>
                  mix(
                    (summary) =>
                      summary.analysis.byEffect
                        .find((effect) => effect.id === id)
                        ?.sourceBreakdown?.find((source) => source.blessingId === blessingId)?.[
                        field
                      ] ?? 0,
                  );
                const sourceTotalConditional = sourceValue("totalDamage");
                const sourceActivations = sourceValue("expectedActivations");
                return {
                  blessingId,
                  totalDamage: toKnownMass(sourceTotalConditional),
                  directDamage: toKnownMass(sourceValue("directDamage")),
                  dotDamage: toKnownMass(sourceValue("dotDamage")),
                  criticalContribution: toKnownMass(sourceValue("criticalContribution")),
                  capLoss: toKnownMass(sourceValue("capLoss")),
                  expectedCasts: sourceValue("expectedCasts"),
                  expectedTriggerRolls: sourceValue("expectedTriggerRolls"),
                  expectedActivations: sourceActivations,
                  expectedSeparateHits: sourceValue("expectedSeparateHits"),
                  expectedAttachedComponents: sourceValue("expectedAttachedComponents"),
                  expectedPlayerPoisonHits: sourceValue("expectedPlayerPoisonHits"),
                  bonusDamage: toKnownMass(sourceValue("bonusDamage")),
                  averagePerActivation:
                    sourceActivations > 0 ? sourceTotalConditional / sourceActivations : 0,
                };
              })
              .filter((source) => source.totalDamage !== 0 || source.expectedActivations !== 0)
              .sort((a, b) => b.totalDamage - a.totalDamage);
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
              expectedPlayerPoisonHits: value("expectedPlayerPoisonHits"),
              bonusDamage: value("bonusDamage"),
              // Per-activation stays on conditional scale (mass does not change hit size).
              averagePerActivation:
                expectedActivations > 0 ? conditionalTotal / expectedActivations : 0,
              ...(sourceBreakdown.length > 0 ? { sourceBreakdown } : {}),
              directDamage: value("directDamage"),
              dotDamage: value("dotDamage"),
              criticalContribution: value("criticalContribution"),
              capLoss: value("capLoss"),
              ...(hasMinimumDamage ? { minimumDamage: value("minimumDamage") } : {}),
              ...(hasMaximumDamage ? { maximumDamage: value("maximumDamage") } : {}),
              ...(sample.analysisGroupId ? { analysisGroupId: sample.analysisGroupId } : {}),
              ...(sample.analysisGroupActivations !== undefined
                ? { analysisGroupActivations: value("analysisGroupActivations") }
                : {}),
            };
          })
          .sort((a, b) => b.totalDamage - a.totalDamage);
      })();

  const multiLane = parts.length > 1;
  const representativeWeight = representativeGroup.weight;
  const useRepresentativeHistory = stochastic || multiLane;
  const eventsReconcileWithWeightedTotals =
    !stochastic && parts.length === 1 && failure === undefined;
  const history: HistoryProvenance = useRepresentativeHistory
    ? {
        kind: "representative-sample-history",
        historyWeight: representativeWeight,
        ticks: representativeTicks,
        selectionReason,
        eventsReconcileWithWeightedTotals,
      }
    : {
        kind: "complete",
        historyWeight: 1,
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

  const usesExpectedDamageApproximation = terminalLanes.some(
    (lane) =>
      (lane.rt.input.procs?.aftershockRank ?? 0) > 0 ||
      ((lane.rt.input.targetMaximumLifePoints ?? 0) > 0 &&
        (lane.rt.input.equipmentEffects?.deathdealer?.applicationChance ?? 0) > 0),
  );
  // Aftershock and Death Mark threshold timing use expected damage.
  const resolvedExactness: StochasticExactness = usesExpectedDamageApproximation
    ? "approximated"
    : stochastic
      ? "estimated"
      : "exact";
  const totalsBasis: DamageTotalsBasis = hasResidual ? "known-mass-contribution" : "unit-mass";
  const eligibleForRanking =
    !hasResidual && (resolvedExactness === "exact" || resolvedExactness === "estimated") && ok;

  // One lane is exact when no supported RNG can change later state.
  // probabilityMass/concreteMass = expanded measure only.
  const rng: StochasticRngSummary | undefined =
    stochastic || multiLane || resolvedExactness !== "exact"
      ? {
          method: "deterministic-stratified-ensemble",
          lanes: parts.length,
          successfulLanes: successful.length,
          failedLanes: parts.filter((p) => !p.summary.ok).length,
          probabilityMass: rawMass,
          concreteMass: rawMass,
          residualWeight: safeResidual,
          totalsBasis,
          exactness: resolvedExactness,
          representative: {
            historyWeight: representativeWeight,
            ticks: representativeTicks,
            selectionReason,
            historyKind: "representative-sample-history",
            eventsReconcileWithWeightedTotals,
          },
          ...(failure !== undefined ? { failure, failedWeight: failure.failedWeight } : {}),
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
  const targetStatus = combineTargetStatus(mixPool, modal);
  const playerPoison =
    wantAnalysis && modal.playerPoison
      ? {
          ...modal.playerPoison,
          applicationAttempts: poisonRow?.expectedTriggerRolls ?? 0,
          successfulApplications: poisonRow?.expectedActivations ?? 0,
          separateHits: poisonRow?.expectedSeparateHits ?? 0,
          minimumDamage: (poisonRow?.minimumDamage ?? 0) + (poisonRow?.bonusDamage ?? 0),
          expectedDamage: (poisonRow?.totalDamage ?? 0) + (poisonRow?.bonusDamage ?? 0),
          maximumDamage: (poisonRow?.maximumDamage ?? 0) + (poisonRow?.bonusDamage ?? 0),
          cinderbaneContinuationAttempts: mix(
            (summary) => summary.playerPoison?.cinderbaneContinuationAttempts ?? 0,
          ),
          successfulCinderbaneContinuations: mix(
            (summary) => summary.playerPoison?.successfulCinderbaneContinuations ?? 0,
          ),
          ...(stochastic
            ? {
                expectedTargetState: {
                  decayIndex: mix((summary) => summary.playerPoison?.targetState.decayIndex ?? 0),
                  remainingTargetPoisonTicks: mix(
                    (summary) => summary.playerPoison?.targetState.remainingTargetPoisonTicks ?? 0,
                  ),
                  bikStacks: mix((summary) => summary.playerPoison?.targetState.bikStacks ?? 0),
                  bikRemainingTicks: mix(
                    (summary) => summary.playerPoison?.targetState.bikRemainingTicks ?? 0,
                  ),
                },
              }
            : {}),
          probabilityMass: 1,
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
      ...(expectedLaneDps !== undefined ? { expectedLaneDps: finiteOrZero(expectedLaneDps) } : {}),
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
          groups: graspGroupFromEffects(byEffect, safeExpected),
          directDamage: toKnownMass(mix((s) => s.analysis.directDamage)),
          dotDamage: toKnownMass(mix((s) => s.analysis.dotDamage)),
          criticalContribution: toKnownMass(mix((s) => s.analysis.criticalContribution)),
          capLoss: toKnownMass(mix((s) => s.analysis.capLoss)),
        }
      : EMPTY_ANALYSIS,
    ...(targetStatus ? { targetStatus } : {}),
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
