import { allEngineSpecs, entryByEngineId, engineSpecs } from "../abilities/registry";
import { isObtainableInRegions } from "../data/availability";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { combatRevolutionBars } from "../data";
import { revoManagedSlots } from "../data/specs";
import { buildCandidatePool } from "./candidatePool";
import type { EvaluateFn, EvalMode, PoolAbility, SolveResult } from "./contracts";
import { evaluateRevolutionBar } from "./evaluate";
import { OBJECTIVE_HORIZON_TICKS } from "./objective";
import { solve } from "./solve";
import type { SerializableSolverRequest, SolverResultDTO } from "./worker/serializable";
import { requireSimBase } from "./worker/revive";
import type { SolveFn, SolveRuntimeOptions } from "./worker/solveTypes";
import type { SolverProgress } from "./worker/protocol";

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

  const exploreTicks = Math.max(
    10,
    request.exploreDurationTicks ?? Math.min(request.durationTicks, 100),
  );
  const fullTicks = Math.max(request.durationTicks, OBJECTIVE_HORIZON_TICKS);

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
  let bestScore = Number.NEGATIVE_INFINITY;
  let topPreview: string[] = [];

  const evaluate: EvaluateFn = ({ bar, mode }: { bar: readonly string[]; mode?: EvalMode }) => {
    if (options?.isCancelled?.() || options?.signal?.aborted) {
      return { score: Number.NEGATIVE_INFINITY, finite: false };
    }
    const useFull = mode === "full" || mode === "finalize";
    const durationTicks = useFull ? fullTicks : exploreTicks;
    evaluations += 1;

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
    }

    if (evaluations % 8 === 0 && options?.onProgress) {
      const progress: SolverProgress = {
        phase: useFull ? "finalize" : "explore",
        evaluations,
        uniqueCandidates: evaluations,
        bestScore: Number.isFinite(bestScore) ? bestScore : 0,
        windowDpms: Number.isFinite(bestScore) ? bestScore : 0,
        topBarPreview: topPreview,
        noImprovementCount: 0,
      };
      options.onProgress(progress);
    }

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

  // Pool for search uses PoolAbility surface (AbilitySpecs already work).
  const searchPool: PoolAbility[] = pool.ids.map((id) => {
    const a = pool.byId.get(id)!;
    return a;
  });

  if (options?.yieldSlice) await options.yieldSlice();

  const result: SolveResult = solve({
    pool: searchPool,
    sizeBounds: { min: request.minBarSize, max: request.maxBarSize },
    evaluate,
    tier: request.tier,
    seed: request.seed,
    authoredSeeds: authored,
    config: {
      profileId: request.profileId,
    },
  });

  if (options?.isCancelled?.() || options?.signal?.aborted) {
    throw new Error("solver cancelled");
  }

  // Exact final re-score of winner at full horizon (authoritative).
  const winnerBar = result.best.bar;
  const finalEval = evaluateRevolutionBar({
    bar: winnerBar,
    style: request.style,
    durationTicks: fullTicks,
    pool,
    sim: simCommon,
    profileId: request.profileId,
    customWeights: request.customWeights,
    includePartial: request.includePartial,
    size: { min: request.minBarSize, max: request.maxBarSize },
  });

  const score = finalEval.ok ? finalEval.score : result.best.robustScore;
  const dto: SolverResultDTO = {
    bar: [...winnerBar],
    score,
    windowDpms: score,
    evaluations: result.evaluationsUsed,
    uniqueCandidates: result.stats.uniqueBars ?? result.evaluationsUsed,
    seed: request.seed,
    profileId: request.profileId,
    tier: request.tier,
    durationTicks: fullTicks,
    proofLabel: result.proof,
    openingDpm: finalEval.metrics?.openingDpm ?? result.best.openingDpm,
    developedDpm: finalEval.metrics?.developedDpm ?? result.best.developedDpm,
    steadyDpm: finalEval.metrics?.steadyDpm ?? result.best.steadyDpm,
    summary: finalEval.summary
      ? {
          totalExpected: finalEval.summary.totalExpected ?? 0,
          dps: finalEval.summary.dps ?? 0,
          ticks: finalEval.summary.ticks ?? 0,
          ok: finalEval.summary.ok,
          error: finalEval.summary.error,
        }
      : undefined,
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
    proof: dto.proof,
  });

  return dto;
};

/** Host-side helper: resolve ability ids for a solved bar graphic. */
export function resolveSolvedBar(ids: readonly string[]): AbilitySpec[] {
  return resolveSpecs(ids);
}
