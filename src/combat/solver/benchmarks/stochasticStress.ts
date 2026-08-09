import { evaluateRevolutionBar } from "../evaluate";
import { buildCandidatePoolForRequest, poolAsSpecs, regionDenyList } from "../requestContext";
import { requireSimBase, reviveRevolutionBase } from "../worker/revive";
import { caseById, type BenchCaseId } from "./cases";
import {
  resetAllocationCounters,
  setAllocationProfiling,
  snapshotAllocationCounters,
  type AllocationCounters,
} from "../../profiling/allocation";
import {
  resetHitPipelineCounters,
  setHitPipelineProfiling,
  snapshotHitPipelineCounters,
  type HitPipelineCounters,
} from "../../profiling/hitPipeline";
import type { EvalDetailLevel } from "../contracts";

export const STOCHASTIC_STRESS_CASES = [
  "league-blessings",
  "league-blessings-control",
  "league-poison-melee",
  "league-poison-melee-control",
  "league-poison-melee-aftershock",
  "league-avernic-delta",
  "league-avernic-delta-control",
  "league-necro-conjures",
  "league-necro-conjures-control",
  "league-light-ranged",
  "league-light-ranged-control",
  "league-aoe-magic",
  "league-aoe-magic-control",
] as const satisfies readonly BenchCaseId[];

export type StochasticStressCaseId = (typeof STOCHASTIC_STRESS_CASES)[number];

export const STOCHASTIC_STRESS_PROFILE_ONLY_CASES = [
  "league-poison-melee-aftershock",
] as const satisfies readonly StochasticStressCaseId[];

const STOCHASTIC_STRESS_SHORT_MEDIUM_CASES = [
  "league-blessings",
  "league-blessings-control",
] as const satisfies readonly StochasticStressCaseId[];

export const STOCHASTIC_STRESS_SCENARIOS = [
  { id: "short-score", horizonTicks: 30, detailLevel: "score-only" },
  { id: "short-full", horizonTicks: 30, detailLevel: "full-analysis" },
  { id: "medium-score", horizonTicks: 45, detailLevel: "score-only" },
  { id: "medium-full", horizonTicks: 45, detailLevel: "full-analysis" },
  { id: "long-score", horizonTicks: 60, detailLevel: "score-only" },
  { id: "long-full", horizonTicks: 60, detailLevel: "full-analysis" },
] as const satisfies readonly {
  id: string;
  horizonTicks: number;
  detailLevel: EvalDetailLevel;
}[];

export type StochasticStressScenarioId = (typeof STOCHASTIC_STRESS_SCENARIOS)[number]["id"];

export interface StochasticStressScenario {
  id: StochasticStressScenarioId;
  horizonTicks: number;
  detailLevel: EvalDetailLevel;
}

export interface StochasticStressResult {
  id: `${StochasticStressCaseId}:${StochasticStressScenarioId}`;
  caseId: StochasticStressCaseId;
  scenarioId: StochasticStressScenarioId;
  horizonTicks: number;
  detailLevel: EvalDetailLevel;
  releaseGate: boolean;
  durationMs: number;
  evaluationsPerSecond: number;
  ok: boolean;
  totalExpected: number;
  probabilityMass: number;
  residualWeight: number;
  failedWeight: number;
  exactness: string;
  lanes: number;
  playerPoisonExpectedDamage: number;
  playerPoisonHostExpectedDamage: number;
  rssBeforeBytes: number;
  rssAfterBytes: number;
  maxObservedRssBytes: number;
  heapUsedBeforeBytes: number;
  heapUsedAfterBytes: number;
  gcAvailable: boolean;
  allocation: AllocationCounters;
  hitPipeline: HitPipelineCounters;
}

export interface StochasticStressReport {
  schemaVersion: 3;
  runner: string;
  generatedAt: string;
  totalDurationMs: number;
  cases: StochasticStressResult[];
}

export function stochasticStressRunnerId(): string {
  const nodeMajor = process.versions.node.split(".")[0];
  return `${process.platform}-${process.arch}-node${nodeMajor}`;
}

function memoryUsage() {
  const memory = process.memoryUsage();
  return { rss: memory.rss, heapUsed: memory.heapUsed };
}

export async function runStochasticStressCase(
  caseId: StochasticStressCaseId,
  scenario: StochasticStressScenario,
): Promise<StochasticStressResult> {
  const request = caseById(caseId).build();
  const releaseGate = !STOCHASTIC_STRESS_PROFILE_ONLY_CASES.includes(
    caseId as (typeof STOCHASTIC_STRESS_PROFILE_ONLY_CASES)[number],
  );
  const simBase = requireSimBase(request.loadout);
  const disabled = new Set(request.disabledAbilityIds ?? []);
  const denySet = new Set(
    regionDenyList(
      request.style,
      request.unlockedRegions,
      request.includeUnknownAvailability === true,
      disabled,
    ),
  );
  const { catalogue, pool } = buildCandidatePoolForRequest(request, simBase, denySet);
  const poolSpecs = poolAsSpecs(pool.ids, pool.byId);
  const abilityMap = new Map(catalogue.map((ability) => [ability.id, ability]));
  for (const ability of poolSpecs) abilityMap.set(ability.id, ability);
  const bar = request.authoredSeedBars[0]?.abilityIds ?? [];
  const missing = bar.filter((abilityId) => !abilityMap.has(abilityId));
  if (missing.length > 0 || bar.length < request.minBarSize) {
    throw new Error(`${caseId} authored stress bar is not legal: ${missing.join(", ")}`);
  }

  setAllocationProfiling(true);
  setHitPipelineProfiling(true);
  resetAllocationCounters();
  resetHitPipelineCounters();
  const before = memoryUsage();
  const started = performance.now();
  try {
    const evaluation = evaluateRevolutionBar({
      bar,
      style: request.style,
      durationTicks: scenario.horizonTicks,
      pool,
      sim: {
        ...reviveRevolutionBase(simBase),
        abilities: [...abilityMap.values()],
      },
      profileId: request.profileId,
      customWeights: request.customWeights,
      includePartial: request.includePartial,
      size: { min: request.minBarSize, max: request.maxBarSize },
      incumbentBaseline: true,
      detailLevel: scenario.detailLevel,
    });
    const durationMs = performance.now() - started;
    const after = memoryUsage();
    const summary = evaluation.summary;
    if (!summary) throw new Error(`${caseId}:${scenario.id} produced no simulation summary`);
    if (process.env.SOLVER_STOCHASTIC_DIAGNOSTIC === "1") {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          { playerPoison: summary.playerPoison, effects: summary.analysis.byEffect },
          null,
          2,
        ),
      );
    }
    return {
      id: `${caseId}:${scenario.id}`,
      caseId,
      scenarioId: scenario.id,
      horizonTicks: scenario.horizonTicks,
      detailLevel: scenario.detailLevel,
      releaseGate,
      durationMs,
      evaluationsPerSecond: durationMs > 0 ? 1000 / durationMs : Number.POSITIVE_INFINITY,
      ok: evaluation.ok && summary.ok,
      totalExpected: summary.totalExpected,
      probabilityMass: summary.rng?.probabilityMass ?? 1,
      residualWeight: summary.rng?.residualWeight ?? 0,
      failedWeight: summary.rng?.failedWeight ?? 0,
      exactness: String(summary.rng?.exactness ?? "exact"),
      lanes: summary.rng?.lanes ?? 1,
      playerPoisonExpectedDamage: summary.playerPoison?.expectedDamage ?? 0,
      playerPoisonHostExpectedDamage:
        summary.analysis.byEffect.find((effect) => effect.id === "player_weapon_poison")
          ?.totalDamage ?? 0,
      rssBeforeBytes: before.rss,
      rssAfterBytes: after.rss,
      maxObservedRssBytes: Math.max(before.rss, after.rss),
      heapUsedBeforeBytes: before.heapUsed,
      heapUsedAfterBytes: after.heapUsed,
      gcAvailable: typeof (globalThis as { gc?: unknown }).gc === "function",
      allocation: snapshotAllocationCounters(),
      hitPipeline: snapshotHitPipelineCounters(),
    };
  } finally {
    setAllocationProfiling(false);
    setHitPipelineProfiling(false);
  }
}

export async function runStochasticStressSuite(
  caseIds: readonly StochasticStressCaseId[] = STOCHASTIC_STRESS_CASES,
  scenarios: readonly StochasticStressScenario[] = STOCHASTIC_STRESS_SCENARIOS,
): Promise<StochasticStressResult[]> {
  const results: StochasticStressResult[] = [];
  for (const caseId of caseIds) {
    const caseScenarios = STOCHASTIC_STRESS_PROFILE_ONLY_CASES.includes(
      caseId as (typeof STOCHASTIC_STRESS_PROFILE_ONLY_CASES)[number],
    )
      ? scenarios.filter(
          (scenario) => scenario.id === "short-score" || scenario.id === "short-full",
        )
      : STOCHASTIC_STRESS_SHORT_MEDIUM_CASES.includes(
            caseId as (typeof STOCHASTIC_STRESS_SHORT_MEDIUM_CASES)[number],
          )
        ? scenarios.filter(
            (scenario) => scenario.id !== "long-score" && scenario.id !== "long-full",
          )
        : scenarios;
    for (const scenario of caseScenarios) {
      results.push(await runStochasticStressCase(caseId, scenario));
    }
  }
  return results;
}

export async function runStochasticStressReport(
  caseIds: readonly StochasticStressCaseId[] = STOCHASTIC_STRESS_CASES,
  scenarios: readonly StochasticStressScenario[] = STOCHASTIC_STRESS_SCENARIOS,
): Promise<StochasticStressReport> {
  const started = performance.now();
  const cases = await runStochasticStressSuite(caseIds, scenarios);
  return {
    schemaVersion: 3,
    runner: stochasticStressRunnerId(),
    generatedAt: new Date().toISOString(),
    totalDurationMs: performance.now() - started,
    cases,
  };
}
