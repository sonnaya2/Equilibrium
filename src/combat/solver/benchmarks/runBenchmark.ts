/**
 * Deterministic solver benchmark runner.
 * Quick mode: real engine evaluate + solveAsync with tiny budgets.
 * Full mode: production solveFromRequest (thorough tier budgets).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allEngineSpecs, entryByEngineId, engineSpecs } from "../../abilities/registry";
import { isObtainableInRegions } from "../../data/availability";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { buildCandidatePool } from "../candidatePool";
import type { EvaluateFn, EvalMode, PoolAbility, SolveResult } from "../contracts";
import { evaluateRevolutionBar } from "../evaluate";
import { remainingCandidates } from "../eligibility";
import { MIN_RANKABLE_HORIZON_TICKS } from "../objective";
import { configForTier, solveAsync, TIER_BUDGETS } from "../solve";
import { fingerprintSolveContext } from "../solutionStore";
import { solveFromRequest } from "../solveFromRequest";
import type { SerializableSolverRequest } from "../worker/serializable";
import { requireSimBase, reviveRevolutionBase } from "../worker/revive";
import {
  isHitPipelineProfilingEnabled,
  resetHitPipelineCounters,
  snapshotHitPipelineCounters,
  type HitPipelineCounters,
} from "../../profiling/hitPipeline";
import {
  isAllocationProfilingEnabled,
  resetAllocationCounters,
  snapshotAllocationCounters,
  type AllocationCounters,
} from "../../profiling/allocation";
import {
  getActiveSolverProfile,
  isSolverProfileEnabled,
  snapshotProfile,
  type SolverProfileSnapshot,
} from "../profiling/counters";
import { allCases, quickCases, type BenchCaseDef, type BenchCaseId } from "./cases";

export type BenchMode = "quick" | "full";

export interface BenchCaseResult {
  id: string;
  contextFingerprint: string;
  tier: string;
  seed: number;
  bounds: { min: number; max: number };
  winnerScore: number | null;
  evaluations: number;
  uniqueCandidates: number;
  durationMs: number;
  rankable: boolean;
  status: "ok" | "degraded" | "failed" | "error";
  proofLabel?: string;
  bar?: readonly string[];
  error?: string;
  /** Present when RS3_HIT_PROFILE=1 or setHitPipelineProfiling(true). */
  hitPipeline?: HitPipelineCounters;
  /** Present when RS3_ALLOC_PROFILE=1 or setAllocationProfiling(true). */
  allocation?: AllocationCounters;
  /** Present when SOLVER_PROFILE=1 (search / solveFromRequest counters). */
  solverProfile?: SolverProfileSnapshot;
}

export interface BenchReport {
  schemaVersion: 1;
  mode: BenchMode;
  generatedAt: string;
  totalDurationMs: number;
  cases: BenchCaseResult[];
}

/** Tiny search knobs - real evaluate, CI-friendly wall time. */
export const QUICK_SEARCH = {
  evaluationBudget: 28,
  beamWidth: 4,
  beamInsertAllPositions: true,
  evoPopulation: 0,
  evoGenerations: 0,
  evoElite: 0,
  lnsRounds: 0,
  lnsDestroyK: 2,
  annealSteps: 0,
  localIterations: 6,
  topK: 2,
  fullShortlistSize: 2,
  exhaustiveMax: 250,
} as const;

function poolAsSpecs(
  poolIds: readonly string[],
  byId: ReadonlyMap<string, PoolAbility>,
): AbilitySpec[] {
  const out: AbilitySpec[] = [];
  for (const id of poolIds) {
    const entry = byId.get(id);
    if (entry && "hits" in entry) out.push(entry as AbilitySpec);
    else {
      const spec = engineSpecs.get(id);
      if (spec) out.push(spec);
    }
  }
  return out;
}

function regionDenyList(
  style: AbilitySpec["style"],
  unlockedRegions: readonly string[],
  includeUnknown: boolean,
  disabled: ReadonlySet<string>,
): string[] {
  const deny: string[] = [...disabled];
  for (const spec of allEngineSpecs()) {
    if (spec.style !== style) continue;
    if (disabled.has(spec.id)) continue;
    const entry = entryByEngineId(spec.id);
    const unlock = entry?.unlock;
    const check = isObtainableInRegions(unlock, unlockedRegions, { includeUnknown });
    if (!check.obtainable) deny.push(spec.id);
  }
  return deny;
}

/**
 * Lightweight path: same evaluateRevolutionBar + solveAsync stack as production,
 * but evaluationBudget is caller-controlled (quick CI).
 */
async function solveWithBudget(
  request: SerializableSolverRequest,
  budget: number,
): Promise<{
  result: SolveResult;
  uniqueCandidates: number;
  evaluationBudget: number;
  fullTicks: number;
}> {
  const simBase = requireSimBase(request.loadout);
  const disabled = new Set(request.disabledAbilityIds ?? []);
  const deny = regionDenyList(
    request.style,
    request.unlockedRegions,
    request.includeUnknownAvailability === true,
    disabled,
  );
  const denySet = new Set(deny);
  const catalogue = allEngineSpecs();
  const passiveIds = simBase.equipmentEffects?.passiveIds;
  const revivedBase = reviveRevolutionBase(simBase);
  const league = revivedBase.league!;

  let pool = buildCandidatePool(catalogue, request.style, {
    includePartial: request.includePartial === true,
    deny: [...denySet],
    weaponConfiguration: simBase.weaponConfiguration,
    equipmentIds: simBase.equipmentIds,
    passiveIds,
    league,
  });

  if (request.permittedCategories?.length) {
    const allowCat = new Set(request.permittedCategories);
    const catDeny = pool.ids.filter((id) => {
      const a = pool.byId.get(id);
      return a?.category == null || !allowCat.has(a.category);
    });
    pool = buildCandidatePool(catalogue, request.style, {
      includePartial: request.includePartial === true,
      deny: [...denySet, ...catDeny],
      weaponConfiguration: simBase.weaponConfiguration,
      equipmentIds: simBase.equipmentIds,
      passiveIds,
      league,
    });
  }

  const poolSpecs = poolAsSpecs(pool.ids, pool.byId);
  const abilityMap = new Map(catalogue.map((a) => [a.id, a]));
  for (const a of poolSpecs) abilityMap.set(a.id, a);
  const abilities = [...abilityMap.values()];

  const exploreTicks = Math.max(10, request.exploreDurationTicks ?? 24);
  const fullTicks = Math.max(
    MIN_RANKABLE_HORIZON_TICKS,
    request.durationTicks > 0 ? request.durationTicks : MIN_RANKABLE_HORIZON_TICKS,
  );

  const simCommon = { ...revivedBase, abilities };

  let uniqueCandidates = 0;
  const seenBars = new Set<string>();

  const evaluate: EvaluateFn = ({ bar, mode }: { bar: readonly string[]; mode?: EvalMode }) => {
    const useFull = mode === "full" || mode === "finalize";
    const durationTicks = useFull ? fullTicks : exploreTicks;
    const key = bar.join("\0");
    if (!seenBars.has(key)) {
      seenBars.add(key);
      uniqueCandidates += 1;
    }
    // Match production search: score-only ranking (no presentation ledgers).
    // Leng full-analysis was the main quick-bench wall-time amplifier.
    const evaluation = evaluateRevolutionBar({
      bar,
      style: request.style,
      durationTicks,
      pool,
      sim: simCommon,
      profileId: request.profileId,
      customWeights: request.customWeights,
      includePartial: request.includePartial,
      size: { min: request.minBarSize, max: request.maxBarSize },
      detailLevel: "score-only",
    });
    if (!evaluation.ok) {
      return {
        score: Number.NEGATIVE_INFINITY,
        finite: false,
        mode: evaluation.mode,
        exploratory: evaluation.exploratory,
        validForFinalRanking: false,
        horizonTicks: evaluation.horizonTicks,
        failureReason: evaluation.failureReason ?? evaluation.reasons[0]?.message,
        objective: evaluation.objective,
      };
    }
    if (evaluation.exploratory || !evaluation.objective?.ok) {
      return {
        score: evaluation.score,
        finite: true,
        mode: evaluation.mode,
        exploratory: true,
        validForFinalRanking: false,
        horizonTicks: evaluation.horizonTicks,
      };
    }
    return {
      score: evaluation.score,
      finite: true,
      mode: "full" as const,
      exploratory: false,
      validForFinalRanking: true,
      horizonTicks: evaluation.horizonTicks,
      objective: evaluation.objective,
    };
  };

  const searchPool: PoolAbility[] = pool.ids.map((id) => pool.byId.get(id)!);
  const legalId = (id: string) => pool.byId.has(id) && !denySet.has(id);
  const fitSeed = (ids: readonly string[]): string[] | null => {
    const cleaned = ids.filter(legalId);
    if (cleaned.length < 2) return null;
    const built =
      cleaned.length > request.maxBarSize ? cleaned.slice(0, request.maxBarSize) : [...cleaned];
    if (built.length < request.minBarSize) {
      const remain = remainingCandidates(built, searchPool, pool.byId);
      for (const a of remain) {
        if (built.length >= request.minBarSize) break;
        if (remainingCandidates(built, [a], pool.byId).length) built.push(a.id);
      }
    }
    return built.length >= 2 ? built : null;
  };
  const authored = (request.authoredSeedBars ?? [])
    .map((s) => fitSeed(s.abilityIds))
    .filter((s): s is string[] => s != null);

  const evaluationBudget = Math.max(4, Math.floor(budget));
  const baseCfg = configForTier(request.tier, request.seed);
  const result = await solveAsync({
    pool: searchPool,
    sizeBounds: { min: request.minBarSize, max: request.maxBarSize },
    evaluate,
    tier: request.tier,
    seed: request.seed,
    authoredSeeds: authored,
    config: {
      ...baseCfg,
      ...QUICK_SEARCH,
      evaluationBudget,
      profileId: request.profileId,
      seed: request.seed,
      searchHorizonTicks: exploreTicks,
      fullHorizonTicks: fullTicks,
    },
  });

  return { result, uniqueCandidates, evaluationBudget, fullTicks };
}

function mapSolveStatus(result: SolveResult): BenchCaseResult["status"] {
  if (result.status === "ok") return "ok";
  if (result.status === "degraded") return "degraded";
  return "failed";
}

type ProfileExtras = {
  hitPipeline?: HitPipelineCounters;
  allocation?: AllocationCounters;
  solverProfile?: SolverProfileSnapshot;
};

function attachProfiles<T extends object>(row: T, extras: ProfileExtras = {}): T & ProfileExtras {
  let out: T & ProfileExtras = { ...row, ...extras };
  if (isHitPipelineProfilingEnabled()) {
    out = { ...out, hitPipeline: snapshotHitPipelineCounters() };
  }
  if (isAllocationProfilingEnabled()) {
    out = { ...out, allocation: snapshotAllocationCounters() };
  }
  if (extras.solverProfile == null && isSolverProfileEnabled()) {
    const active = getActiveSolverProfile();
    if (active?.enabled) out = { ...out, solverProfile: snapshotProfile(active) };
  }
  return out;
}

export async function runBenchCase(def: BenchCaseDef, mode: BenchMode): Promise<BenchCaseResult> {
  const request = def.build();
  const contextFingerprint = await fingerprintSolveContext(request);
  const t0 = performance.now();
  const bounds = { min: request.minBarSize, max: request.maxBarSize };
  if (isHitPipelineProfilingEnabled()) resetHitPipelineCounters();
  if (isAllocationProfilingEnabled()) resetAllocationCounters();

  try {
    if (mode === "full") {
      let solverProfile: SolverProfileSnapshot | undefined;
      const dto = await solveFromRequest(request, {
        onProfile: (snap) => {
          solverProfile = snap;
        },
      });
      const durationMs = Math.round(performance.now() - t0);
      const rankable =
        Number.isFinite(dto.score) &&
        (dto.durationTicks ?? 0) >= MIN_RANKABLE_HORIZON_TICKS &&
        dto.proofLabel !== "degraded-exploratory-fallback" &&
        dto.proofLabel !== "failed";
      return attachProfiles(
        {
          id: def.id,
          contextFingerprint,
          tier: dto.tier ?? request.tier,
          seed: request.seed,
          bounds,
          winnerScore: Number.isFinite(dto.score) ? dto.score : null,
          evaluations: dto.evaluations ?? 0,
          uniqueCandidates: dto.uniqueCandidates ?? 0,
          durationMs,
          rankable,
          status: dto.proofLabel === "failed" ? "failed" : rankable ? "ok" : "degraded",
          proofLabel: dto.proofLabel,
          bar: dto.bar,
        },
        solverProfile ? { solverProfile } : {},
      );
    }

    // quick: real evaluate, tiny budget (not full TIER_BUDGETS)
    const { result, uniqueCandidates, fullTicks } = await solveWithBudget(
      request,
      QUICK_SEARCH.evaluationBudget,
    );
    const durationMs = Math.round(performance.now() - t0);
    const winner = result.best;
    const score = winner && Number.isFinite(winner.robustScore) ? winner.robustScore : null;
    const rankable =
      winner != null &&
      winner.validForFinalRanking === true &&
      winner.mode === "full" &&
      score != null &&
      fullTicks >= MIN_RANKABLE_HORIZON_TICKS;

    return attachProfiles({
      id: def.id,
      contextFingerprint,
      tier: `quick@${QUICK_SEARCH.evaluationBudget}`,
      seed: request.seed,
      bounds,
      winnerScore: score,
      evaluations: result.totalEvaluations,
      uniqueCandidates: uniqueCandidates || result.stats.uniqueBars || result.totalEvaluations,
      durationMs,
      rankable,
      status: mapSolveStatus(result),
      proofLabel: result.proof,
      bar: winner?.bar,
    });
  } catch (err) {
    const durationMs = Math.round(performance.now() - t0);
    return attachProfiles({
      id: def.id,
      contextFingerprint,
      tier: mode === "quick" ? `quick@${QUICK_SEARCH.evaluationBudget}` : request.tier,
      seed: request.seed,
      bounds,
      winnerScore: null,
      evaluations: 0,
      uniqueCandidates: 0,
      durationMs,
      rankable: false,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface RunBenchmarkOptions {
  mode?: BenchMode;
  caseIds?: readonly BenchCaseId[];
  /** Write JSON report under reports/ (default true). */
  writeReport?: boolean;
  reportDir?: string;
}

export async function runBenchmark(options: RunBenchmarkOptions = {}): Promise<BenchReport> {
  const mode: BenchMode = options.mode ?? "quick";
  let defs: readonly BenchCaseDef[];
  if (options.caseIds?.length) {
    const byId = new Map(allCases().map((c) => [c.id, c]));
    defs = options.caseIds.map((id) => {
      const c = byId.get(id);
      if (!c) throw new Error(`unknown bench case: ${id}`);
      return c;
    });
  } else {
    defs = mode === "quick" ? quickCases() : allCases();
  }

  const t0 = performance.now();
  const cases: BenchCaseResult[] = [];
  for (const def of defs) {
    cases.push(await runBenchCase(def, mode));
  }
  const report: BenchReport = {
    schemaVersion: 1,
    mode,
    generatedAt: new Date().toISOString(),
    totalDurationMs: Math.round(performance.now() - t0),
    cases,
  };

  if (options.writeReport !== false) {
    const dir = options.reportDir ?? join(process.cwd(), "reports");
    mkdirSync(dir, { recursive: true });
    const name = mode === "quick" ? "solver-benchmark-quick.json" : "solver-benchmark-full.json";
    const path = join(dir, name);
    writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  return report;
}

export function formatReportSummary(report: BenchReport): string {
  const lines = [
    `solver-benchmark mode=${report.mode} totalMs=${report.totalDurationMs} cases=${report.cases.length}`,
    `thoroughBudget=${TIER_BUDGETS.thorough} quickBudget=${QUICK_SEARCH.evaluationBudget}`,
  ];
  for (const c of report.cases) {
    lines.push(
      [
        c.id.padEnd(26),
        c.status.padEnd(8),
        `score=${c.winnerScore == null ? "n/a" : c.winnerScore.toFixed(2)}`,
        `evals=${c.evaluations}`,
        `uniq=${c.uniqueCandidates}`,
        `ms=${c.durationMs}`,
        c.rankable ? "rankable" : "unrankable",
        c.error ? `err=${c.error.slice(0, 80)}` : "",
      ]
        .filter(Boolean)
        .join("  "),
    );
  }
  return lines.join("\n");
}

/** Resolve default report path (for scripts). */
export function defaultReportPath(
  mode: BenchMode,
  reportDir = join(process.cwd(), "reports"),
): string {
  return join(
    reportDir,
    mode === "quick" ? "solver-benchmark-quick.json" : "solver-benchmark-full.json",
  );
}
