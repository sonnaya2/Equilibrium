import { allEngineSpecs, entryByEngineId, engineSpecs } from "../abilities/registry";
import { isObtainableInRegions } from "../data/availability";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { combatRevolutionBars } from "../data";
import { revoManagedSlots } from "../data/specs";
import { buildCandidatePool } from "./candidatePool";
import type { EvaluateFn, EvalMode, PoolAbility, SolveResult } from "./contracts";
import { evaluateRevolutionBar } from "./evaluate";
import { OBJECTIVE_HORIZON_TICKS } from "./objective";
import { solveAsync, TIER_BUDGETS, type SolvePhaseName } from "./solve";
import type { SerializableSolverRequest, SolverResultDTO } from "./worker/serializable";
import { requireSimBase } from "./worker/revive";
import type { SolveFn, SolveRuntimeOptions } from "./worker/solveTypes";
import type { SolverPhase, SolverProgress } from "./worker/protocol";

function resolveSpecs(ids: readonly string[]): AbilitySpec[] {
  const out: AbilitySpec[] = [];
  for (const id of ids) {
    const spec = engineSpecs.get(id);
    if (spec) out.push(spec);
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
    const check = isObtainableInRegions(unlock, unlockedRegions, {
      includeUnknown,
    });
    if (!check.obtainable) deny.push(spec.id);
  }
  return deny;
}

function authoredSeedsFromCatalogue(
  style: AbilitySpec["style"],
  deny: ReadonlySet<string>,
): string[][] {
  const seeds: string[][] = [];
  for (const bar of combatRevolutionBars.records) {
    if (bar.style !== style) continue;
    if (!bar.supported) continue;
    if (bar.target != null && bar.target !== "single") continue;
    const slots = revoManagedSlots(bar, engineSpecs);
    const ids = slots
      .filter((s) => s.modelledBy === "engine" && s.spec)
      .map((s) => s.spec!.id)
      .filter((id) => !deny.has(id));
    // Drop replacement conflicts: keep first occurrence.
    const seenGroups = new Set<string>();
    const cleaned: string[] = [];
    for (const id of ids) {
      const group = engineSpecs.get(id)?.replacementGroup;
      if (group) {
        if (seenGroups.has(group)) continue;
        seenGroups.add(group);
      }
      cleaned.push(id);
    }
    if (cleaned.length >= 2) seeds.push(cleaned);
  }
  return seeds;
}

function poolAsSpecs(poolIds: readonly string[], byId: ReadonlyMap<string, PoolAbility>): AbilitySpec[] {
  const out: AbilitySpec[] = [];
  for (const id of poolIds) {
    const entry = byId.get(id);
    // Candidate pool stores AbilitySpec instances when built from catalogue.
    if (entry && "hits" in entry) out.push(entry as AbilitySpec);
    else {
      const spec = engineSpecs.get(id);
      if (spec) out.push(spec);
    }
  }
  return out;
}

/**
 * Production entry: serializable request → real engine evaluations → ranked bars.
 * Used by the worker and main-thread fallback.
 */
export const solveFromRequest: SolveFn = async (
  request: SerializableSolverRequest,
  options?: SolveRuntimeOptions,
): Promise<SolverResultDTO> => {
  if (options?.isCancelled?.() || options?.signal?.aborted) {
    throw new Error("solver cancelled");
  }

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
  let pool = buildCandidatePool(catalogue, request.style, {
    includePartial: request.includePartial === true,
    deny: [...denySet],
    weaponConfiguration: simBase.weaponConfiguration,
    equipmentIds: simBase.equipmentIds,
  });

  // Category filter (optional) — rebuild pool rather than mutate.
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
    });
  }

  const poolSpecs = poolAsSpecs(pool.ids, pool.byId);
  const abilityMap = new Map(catalogue.map((a) => [a.id, a]));
  for (const a of poolSpecs) abilityMap.set(a.id, a);
  const abilities = [...abilityMap.values()];

  // Explore short (default 50 ticks ≈ 30s). Full robust score only at finalize.
  const exploreTicks = Math.max(
    10,
    request.exploreDurationTicks ?? Math.min(request.durationTicks, 50),
  );
  const fullTicks = Math.max(request.durationTicks, OBJECTIVE_HORIZON_TICKS);
  const evaluationBudget = TIER_BUDGETS[request.tier] ?? TIER_BUDGETS.thorough;

  const { reviveModifiers, reviveLeague } = await import("./worker/revive");
  const league = reviveLeague(simBase.league);
  const modifiers = reviveModifiers(simBase.modifierSources, league);

  const simCommon = {
    base: simBase.base,
    level: simBase.level,
    accuracy: simBase.accuracy,
    crit: simBase.crit,
    abilities,
    equipmentIds: simBase.equipmentIds,
    weaponConfiguration: simBase.weaponConfiguration,
    startingAdrenaline: simBase.startingAdrenaline,
    adrenaline: simBase.adrenaline,
    procs: simBase.procs,
    plantedFeet: simBase.plantedFeet,
    preciseRank: simBase.preciseRank,
    conjureBasicDamageMult: simBase.conjureBasicDamageMult,
    conjureDurationMult: simBase.conjureDurationMult,
    tumekensPieces: simBase.tumekensPieces,
    tumekensCritEnabled: simBase.tumekensCritEnabled,
    equipmentEffects: simBase.equipmentEffects,
    league,
    context: simBase.context,
    targetHpPercent: simBase.targetHpPercent,
    cap: simBase.cap,
    modifiers,
  };

  let evaluations = 0;
  let uniqueBars = 0;
  const seenBars = new Set<string>();
  let bestScore = Number.NEGATIVE_INFINITY;
  let topPreview: string[] = [];
  let currentPhase: SolverPhase = "seed";
  let noImprovement = 0;

  const mapPhase = (name: SolvePhaseName): SolverPhase => {
    if (name === "seed") return "seed";
    if (name === "finalize") return "finalize";
    if (name === "local" || name === "anneal" || name === "lns" || name === "evolutionary") {
      return "exploit";
    }
    return "explore";
  };

  const emitProgress = (force = false) => {
    if (!options?.onProgress) return;
    if (!force && evaluations % 2 !== 0) return;
    const ratio = Math.min(0.97, evaluations / Math.max(1, evaluationBudget + 8));
    const progress: SolverProgress = {
      phase: currentPhase,
      evaluations,
      uniqueCandidates: uniqueBars,
      bestScore: Number.isFinite(bestScore) ? bestScore : 0,
      windowDpms: Number.isFinite(bestScore) ? bestScore : 0,
      topBarPreview: topPreview,
      noImprovementCount: noImprovement,
      evaluationBudget,
      progressRatio: ratio,
    };
    options.onProgress(progress);
  };

  const evaluate: EvaluateFn = ({ bar, mode }: { bar: readonly string[]; mode?: EvalMode }) => {
    if (options?.isCancelled?.() || options?.signal?.aborted) {
      return { score: Number.NEGATIVE_INFINITY, finite: false };
    }
    const useFull = mode === "full" || mode === "finalize";
    const durationTicks = useFull ? fullTicks : exploreTicks;
    evaluations += 1;
    const key = bar.join("\0");
    if (!seenBars.has(key)) {
      seenBars.add(key);
      uniqueBars += 1;
    }

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
    });

    if (evaluation.ok && evaluation.score > bestScore) {
      bestScore = evaluation.score;
      topPreview = [...bar];
      noImprovement = 0;
    } else {
      noImprovement += 1;
    }

    if (useFull) currentPhase = "finalize";
    emitProgress();

    if (!evaluation.ok) {
      return { score: Number.NEGATIVE_INFINITY, finite: false };
    }

    return {
      score: evaluation.score,
      finite: true,
      objective: evaluation.objective?.ok
        ? evaluation.objective
        : {
            ok: true as const,
            robustScore: evaluation.score,
            minDpm: evaluation.score,
            weightedMean: evaluation.score,
            profileId: request.profileId,
            openingDpm: evaluation.metrics?.openingDpm ?? evaluation.score,
            developedDpm: evaluation.metrics?.developedDpm ?? evaluation.score,
            steadyDpm: evaluation.metrics?.steadyDpm ?? evaluation.score,
            weights: request.customWeights ?? {
              opening: 1,
              developed: 1,
              steady: 1,
              robustMean: 0.8,
              robustMin: 0.2,
            },
          },
    };
  };

  const authored = [
    ...authoredSeedsFromCatalogue(request.style, denySet),
    ...request.authoredSeedBars.map((s) =>
      s.abilityIds.filter((id) => pool.byId.has(id) && !denySet.has(id)),
    ),
    ...(request.userBar
      ? [request.userBar.filter((id) => pool.byId.has(id) && !denySet.has(id))]
      : []),
  ].filter((s) => s.length >= request.minBarSize);

  const searchPool: PoolAbility[] = pool.ids.map((id) => pool.byId.get(id)!);

  emitProgress(true);
  if (options?.yieldSlice) await options.yieldSlice();

  const result: SolveResult = await solveAsync(
    {
      pool: searchPool,
      sizeBounds: { min: request.minBarSize, max: request.maxBarSize },
      evaluate,
      tier: request.tier,
      seed: request.seed,
      authoredSeeds: authored,
      config: {
        profileId: request.profileId,
      },
    },
    {
      onPhase: (phase) => {
        currentPhase = mapPhase(phase);
        emitProgress(true);
      },
      onFinalizeStep: (info) => {
        currentPhase = "finalize";
        // Keep ratio under 1 until truly done so the track still animates.
        const ratio = 0.85 + 0.14 * (info.done / Math.max(1, info.total));
        options?.onProgress?.({
          phase: "finalize",
          evaluations,
          uniqueCandidates: uniqueBars,
          bestScore: Number.isFinite(bestScore) ? bestScore : 0,
          windowDpms: Number.isFinite(bestScore) ? bestScore : 0,
          topBarPreview: topPreview,
          noImprovementCount: noImprovement,
          evaluationBudget,
          progressRatio: Math.min(0.99, ratio),
        });
      },
      yieldSlice: async () => {
        emitProgress(true);
        if (options?.isCancelled?.() || options?.signal?.aborted) {
          throw new Error("solver cancelled");
        }
        if (options?.isPaused?.()) {
          while (options.isPaused?.() && !options?.isCancelled?.()) {
            await new Promise((r) => setTimeout(r, 16));
          }
        }
        // Double rAF-style yield: setTimeout(0) alone can still starve paint.
        await options?.yieldSlice?.();
        await new Promise((r) => setTimeout(r, 0));
      },
    },
  );

  if (options?.isCancelled?.() || options?.signal?.aborted) {
    throw new Error("solver cancelled");
  }

  // Finalize already full-rescored the shortlist — no second 300s winner sim.
  currentPhase = "finalize";
  emitProgress(true);
  const winnerBar = result.best.bar;
  const score = Number.isFinite(result.best.robustScore) ? result.best.robustScore : 0;
  const dto: SolverResultDTO = {
    bar: [...winnerBar],
    score,
    windowDpms: score,
    evaluations: result.evaluationsUsed,
    uniqueCandidates: uniqueBars || result.stats.uniqueBars || result.evaluationsUsed,
    seed: request.seed,
    profileId: request.profileId,
    tier: request.tier,
    durationTicks: fullTicks,
    proofLabel: result.proof,
    openingDpm: result.best.openingDpm,
    developedDpm: result.best.developedDpm,
    steadyDpm: result.best.steadyDpm,
    summary: undefined,
    proof: {
      label: result.proof,
      recheckScore: score,
      notes: [
        result.exhaustiveCompleted ? "exhaustive completed" : "heuristic search",
        `pool size ${pool.ids.length}`,
        `seed best ${result.seedBestScore}`,
      ],
    },
    top: result.top.map((t) => ({
      bar: [...t.bar],
      score: t.robustScore,
      fingerprint: t.fingerprint,
    })),
  };

  options?.onProgress?.({
    phase: "finalize",
    evaluations: result.evaluationsUsed,
    uniqueCandidates: dto.uniqueCandidates,
    bestScore: Number.isFinite(score) ? score : 0,
    windowDpms: Number.isFinite(score) ? score : 0,
    topBarPreview: [...winnerBar],
    noImprovementCount: 0,
    evaluationBudget,
    progressRatio: 1,
    proof: dto.proof,
  });

  return dto;
};

/** Host-side helper: resolve ability ids for a solved bar graphic. */
export function resolveSolvedBar(ids: readonly string[]): AbilitySpec[] {
  return resolveSpecs(ids);
}
