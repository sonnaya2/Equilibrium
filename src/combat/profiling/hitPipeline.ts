/**
 * Measure-only counters for the hit-expectation hot path.
 * Off by default; enable with setHitPipelineProfiling(true) or RS3_HIT_PROFILE=1.
 * Does not change damage math.
 */

export interface HitPipelineCounters {
  /** orderModifiers / runPipeline sorts. */
  modifierSorts: number;
  /** Inclusive integer band rolls walked by exactMean. */
  integerBandPoints: number;
  /** calculateRawHitBand / calculateHit expectation entries. */
  hitExpectationCalls: number;
  /** min/max (and crit/uncapped bound) runPass probes outside the band loop. */
  endpointPasses: number;
  /** Ordered modifier programs evaluated. */
  modifierProgramEvaluations: number;
  /** Active modifier applications across evaluated programs. */
  modifierApplications: number;
}

const ZERO: HitPipelineCounters = {
  modifierSorts: 0,
  integerBandPoints: 0,
  hitExpectationCalls: 0,
  endpointPasses: 0,
  modifierProgramEvaluations: 0,
  modifierApplications: 0,
};

export const hitPipelineCounters: HitPipelineCounters = { ...ZERO };

let enabled = false;

function envWantsProfiling(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.RS3_HIT_PROFILE === "1";
}

enabled = envWantsProfiling();

export function isHitPipelineProfilingEnabled(): boolean {
  return enabled;
}

export function setHitPipelineProfiling(on: boolean): void {
  enabled = on;
}

export function resetHitPipelineCounters(): void {
  hitPipelineCounters.modifierSorts = 0;
  hitPipelineCounters.integerBandPoints = 0;
  hitPipelineCounters.hitExpectationCalls = 0;
  hitPipelineCounters.endpointPasses = 0;
  hitPipelineCounters.modifierProgramEvaluations = 0;
  hitPipelineCounters.modifierApplications = 0;
}

export function snapshotHitPipelineCounters(): HitPipelineCounters {
  return { ...hitPipelineCounters };
}

export function recordModifierSort(): void {
  if (!enabled) return;
  hitPipelineCounters.modifierSorts += 1;
}

export function recordIntegerBandPoints(n: number): void {
  if (!enabled) return;
  hitPipelineCounters.integerBandPoints += n;
}

export function recordHitExpectationCall(): void {
  if (!enabled) return;
  hitPipelineCounters.hitExpectationCalls += 1;
}

export function recordEndpointPass(n = 1): void {
  if (!enabled) return;
  hitPipelineCounters.endpointPasses += n;
}

export function recordModifierProgramEvaluation(applications: number): void {
  if (!enabled) return;
  hitPipelineCounters.modifierProgramEvaluations += 1;
  hitPipelineCounters.modifierApplications += applications;
}
