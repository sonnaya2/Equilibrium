import { evaluateRevolutionBar } from "../evaluate";
import { buildCandidatePoolForRequest, poolAsSpecs, regionDenyList } from "../requestContext";
import { requireSimBase, reviveRevolutionBase } from "../worker/revive";
import { caseById, type BenchCaseId } from "./cases";
import {
  enableBranchProfiling,
  getBranchProfile,
  resetBranchProfile,
  type BranchProfile,
} from "../../engine/simulation/branch";
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

export const BRANCH_STRESS_CASES = [
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

export type BranchStressCaseId = (typeof BRANCH_STRESS_CASES)[number];

export const BRANCH_STRESS_PROFILE_ONLY_CASES = [
  "league-poison-melee-aftershock",
] as const satisfies readonly BranchStressCaseId[];

const BRANCH_STRESS_SHORT_MEDIUM_CASES = [
  "league-blessings",
  "league-blessings-control",
] as const satisfies readonly BranchStressCaseId[];

const RELEASE_LIVE_CAPS = [512, 1024, 2048, 4096, 8192] as const;
const ORACLE_LIVE_CAPS = [16_384] as const;

export const BRANCH_STRESS_SCENARIOS = [
  { id: "short-score", horizonTicks: 30, detailLevel: "score-only", oracle: false },
  { id: "short-full", horizonTicks: 30, detailLevel: "full-analysis", oracle: false },
  { id: "medium-score", horizonTicks: 45, detailLevel: "score-only", oracle: false },
  { id: "medium-full", horizonTicks: 45, detailLevel: "full-analysis", oracle: false },
  { id: "long-score", horizonTicks: 60, detailLevel: "score-only", oracle: false },
  { id: "long-full", horizonTicks: 60, detailLevel: "full-analysis", oracle: false },
  { id: "oracle-short", horizonTicks: 30, detailLevel: "score-only", oracle: true },
] as const satisfies readonly {
  id: string;
  horizonTicks: number;
  detailLevel: EvalDetailLevel;
  oracle: boolean;
}[];

export type BranchStressScenario = (typeof BRANCH_STRESS_SCENARIOS)[number];
export type BranchStressScenarioId = BranchStressScenario["id"];

export interface BranchStressResult {
  id: `${BranchStressCaseId}:${BranchStressScenarioId}`;
  caseId: BranchStressCaseId;
  scenarioId: BranchStressScenarioId;
  horizonTicks: number;
  detailLevel: EvalDetailLevel;
  oracle: boolean;
  releaseGate: boolean;
  durationMs: number;
  evaluationsPerSecond: number;
  ok: boolean;
  totalExpected: number;
  probabilityMass: number;
  residualWeight: number;
  failedWeight: number;
  exactness: string;
  attempts: number;
  finalLiveCap: number;
  rssBeforeBytes: number;
  rssAfterBytes: number;
  maxObservedRssBytes: number;
  heapUsedBeforeBytes: number;
  heapUsedAfterBytes: number;
  gcAvailable: boolean;
  branchProfile: BranchProfile;
  allocation: AllocationCounters;
  hitPipeline: HitPipelineCounters;
}

export interface BranchStressReport {
  schemaVersion: 2;
  runner: string;
  generatedAt: string;
  totalDurationMs: number;
  cases: BranchStressResult[];
}

export function branchStressRunnerId(): string {
  const nodeMajor = process.versions.node.split(".")[0];
  return `${process.platform}-${process.arch}-node${nodeMajor}`;
}

function memoryUsage() {
  const memory = process.memoryUsage();
  return { rss: memory.rss, heapUsed: memory.heapUsed };
}

export async function runBranchStressCase(
  caseId: BranchStressCaseId,
  scenario: BranchStressScenario,
): Promise<BranchStressResult> {
  const request = caseById(caseId).build();
  const releaseGate = !BRANCH_STRESS_PROFILE_ONLY_CASES.includes(
    caseId as (typeof BRANCH_STRESS_PROFILE_ONLY_CASES)[number],
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
  enableBranchProfiling(true);
  resetAllocationCounters();
  resetHitPipelineCounters();
  resetBranchProfile();
  const before = memoryUsage();
  const started = performance.now();
  try {
    const liveCaps = scenario.oracle ? ORACLE_LIVE_CAPS : RELEASE_LIVE_CAPS;
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
      branchFidelityMode: "full",
      branchFidelityOverrides: {
        full: {
          liveCaps,
          maximumResidualWeight: 1e-12,
          exactness: "exact-or-merged",
        },
      },
    });
    const durationMs = performance.now() - started;
    const after = memoryUsage();
    const summary = evaluation.summary;
    if (!summary) throw new Error(`${caseId}:${scenario.id} produced no simulation summary`);
    return {
      id: `${caseId}:${scenario.id}`,
      caseId,
      scenarioId: scenario.id,
      horizonTicks: scenario.horizonTicks,
      detailLevel: scenario.detailLevel,
      oracle: scenario.oracle,
      releaseGate,
      durationMs,
      evaluationsPerSecond: durationMs > 0 ? 1000 / durationMs : Number.POSITIVE_INFINITY,
      ok: evaluation.ok && summary.ok,
      totalExpected: summary.totalExpected,
      probabilityMass: summary.rng?.probabilityMass ?? 1,
      residualWeight: summary.rng?.residualWeight ?? 0,
      failedWeight: summary.rng?.failedWeight ?? 0,
      exactness: String(summary.rng?.exactness ?? "exact"),
      attempts: evaluation.branchFidelity?.attempts ?? 1,
      finalLiveCap: evaluation.branchFidelity?.finalBudget.maxLiveBranches ?? liveCaps[0],
      rssBeforeBytes: before.rss,
      rssAfterBytes: after.rss,
      maxObservedRssBytes: Math.max(before.rss, after.rss),
      heapUsedBeforeBytes: before.heapUsed,
      heapUsedAfterBytes: after.heapUsed,
      gcAvailable: typeof (globalThis as { gc?: unknown }).gc === "function",
      branchProfile: { ...getBranchProfile() },
      allocation: snapshotAllocationCounters(),
      hitPipeline: snapshotHitPipelineCounters(),
    };
  } finally {
    enableBranchProfiling(false);
    setAllocationProfiling(false);
    setHitPipelineProfiling(false);
  }
}

export async function runBranchStressSuite(
  caseIds: readonly BranchStressCaseId[] = BRANCH_STRESS_CASES,
  scenarios: readonly BranchStressScenario[] = BRANCH_STRESS_SCENARIOS,
): Promise<BranchStressResult[]> {
  const results: BranchStressResult[] = [];
  for (const caseId of caseIds) {
    const caseScenarios = BRANCH_STRESS_PROFILE_ONLY_CASES.includes(
      caseId as (typeof BRANCH_STRESS_PROFILE_ONLY_CASES)[number],
    )
      ? scenarios.filter(
          (scenario) => scenario.id === "short-score" || scenario.id === "short-full",
        )
      : BRANCH_STRESS_SHORT_MEDIUM_CASES.includes(
            caseId as (typeof BRANCH_STRESS_SHORT_MEDIUM_CASES)[number],
          )
        ? scenarios.filter(
            (scenario) => scenario.id !== "long-score" && scenario.id !== "long-full",
          )
        : scenarios;
    for (const scenario of caseScenarios) {
      results.push(await runBranchStressCase(caseId, scenario));
    }
  }
  return results;
}

export async function runBranchStressReport(
  caseIds: readonly BranchStressCaseId[] = BRANCH_STRESS_CASES,
  scenarios: readonly BranchStressScenario[] = BRANCH_STRESS_SCENARIOS,
): Promise<BranchStressReport> {
  const started = performance.now();
  const cases = await runBranchStressSuite(caseIds, scenarios);
  return {
    schemaVersion: 2,
    runner: branchStressRunnerId(),
    generatedAt: new Date().toISOString(),
    totalDurationMs: performance.now() - started,
    cases,
  };
}
