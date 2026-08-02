import { allEngineSpecs, entryByEngineId, engineSpecs } from "../abilities/registry";
import { isObtainableInRegions } from "../data/availability";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { combatRevolutionBars } from "../data";
import { revoManagedSlots } from "../data/specs";
import { buildCandidatePool } from "./candidatePool";
import type { EvaluateFn, EvalMode, PoolAbility, SolveResult } from "./contracts";
import { evaluateRevolutionBar } from "./evaluate";
import { secondsToTicks } from "../core/ticks";
import { MIN_RANKABLE_HORIZON_TICKS } from "./objective";
import {
  configPatchForRecipe,
  solveAsync,
  TIER_BUDGETS,
  TIER_HORIZON_SECONDS,
  type SolvePhaseName,
  type SolverAgentRecipe,
} from "./solve";
import { MIN_SOLVER_BAR_SIZE } from "./solutionStore";
import { remainingCandidates } from "./eligibility";
import { readEvalMemo, writeEvalMemo } from "./evalMemo";
import { fingerprintEvaluationKey, stableStringify } from "./fingerprint";
import { OBJECTIVE_VERSION } from "./contracts";
import type { SerializableSolverRequest, SolverResultDTO } from "./worker/serializable";
import { requireSimBase } from "./worker/revive";
import type { SolveFn, SolveRuntimeOptions } from "./worker/solveTypes";
import type { SolverPhase, SolverProgress } from "./worker/protocol";
import { BIG_BONED_OUTGOING_ASSUMPTIONS } from "../league/ruleset";

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

function poolAsSpecs(
  poolIds: readonly string[],
  byId: ReadonlyMap<string, PoolAbility>,
): AbilitySpec[] {
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
    const err = new Error("solver cancelled");
    err.name = "AbortError";
    throw err;
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
  const passiveIds = simBase.equipmentEffects?.passiveIds;
  let pool = buildCandidatePool(catalogue, request.style, {
    includePartial: request.includePartial === true,
    deny: [...denySet],
    weaponConfiguration: simBase.weaponConfiguration,
    equipmentIds: simBase.equipmentIds,
    passiveIds,
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
      passiveIds,
    });
  }

  const poolSpecs = poolAsSpecs(pool.ids, pool.byId);
  const abilityMap = new Map(catalogue.map((a) => [a.id, a]));
  for (const a of poolSpecs) abilityMap.set(a.id, a);
  const abilities = [...abilityMap.values()];

  // Explore short; finalize uses tier full horizon (thorough ≈ 30s, not 300s).
  const tierHorizons = TIER_HORIZON_SECONDS[request.tier] ?? TIER_HORIZON_SECONDS.thorough;
  const exploreTicks = Math.max(
    10,
    request.exploreDurationTicks ??
      Math.min(request.durationTicks, secondsToTicks(tierHorizons.exploreSeconds)),
  );
  const fullTicks = Math.max(
    MIN_RANKABLE_HORIZON_TICKS,
    request.durationTicks > 0 ? request.durationTicks : secondsToTicks(tierHorizons.fullSeconds),
  );
  const baseBudget = TIER_BUDGETS[request.tier] ?? TIER_BUDGETS.thorough;
  // lenScale = (maxBarSize / MIN_SOLVER_BAR_SIZE) ** 1.2; floor 1.0 so length-5 keeps base budget.
  const lenScale = Math.max(1, (request.maxBarSize / MIN_SOLVER_BAR_SIZE) ** 1.2);
  const evaluationBudget = Math.round(baseBudget * lenScale);

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
    strengthCape99: simBase.strengthCape99,
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
  let searchEvaluations = 0;
  let fullEvaluations = 0;
  let uniqueBars = 0;
  const seenBars = new Set<string>();
  /** Separate scales — never one "best score" that changes units mid-run. */
  let bestExploratoryScore = Number.NEGATIVE_INFINITY;
  let bestFullScore = Number.NEGATIVE_INFINITY;
  let topPreview: string[] = [];
  /** Candidate currently in evaluate() — drives the cycling strip, not best-so-far. */
  let activePreview: string[] = [];
  let currentPhase: SolverPhase = "seed";
  let noImprovement = 0;
  // Search fill stops short of full so "Final scoring" still has track room.
  // Finalize maps the remaining share — never clobber with evals/budget alone.
  const SEARCH_SHARE = 0.82;
  let finalizeDone = 0;
  let finalizeTotal = 0;
  let finalizeActive = false;
  let scoringLabel: string | undefined;
  let scoringBarPreview: readonly string[] | undefined;
  /** Full-horizon scores reused from the worker/main eval memo (no new sim). */
  let fullMemoHits = 0;

  const throwCancelled = (): never => {
    const err = new Error("solver cancelled");
    err.name = "AbortError";
    throw err;
  };

  const mapPhase = (name: SolvePhaseName): SolverPhase => {
    switch (name) {
      case "seed":
        return "seed";
      case "finalize":
        return "finalize";
      case "local":
      case "anneal":
      case "lns":
      case "evolutionary":
        return "exploit";
      default:
        return "explore";
    }
  };

  const progressRatioNow = (): number => {
    if (finalizeActive) {
      // Hold at search ceiling until the first finalize step reports a real total.
      if (finalizeTotal <= 0) return SEARCH_SHARE;
      // 0.82 → 0.995 across finalize steps; 1.0 only when the run completes.
      return Math.min(
        0.995,
        SEARCH_SHARE + (0.995 - SEARCH_SHARE) * (finalizeDone / finalizeTotal),
      );
    }
    // Leave a visible tail even when the search budget is spent.
    const searchT = Math.min(1, evaluations / Math.max(1, evaluationBudget));
    return Math.min(SEARCH_SHARE * 0.98, SEARCH_SHARE * searchT);
  };

  const emitProgress = (force = false) => {
    if (!options?.onProgress) return;
    if (!force && evaluations % 2 !== 0) return;
    // bestScore is ALWAYS exploratory DPM — never unit-switch to full robust mid-run.
    const exploratory = Number.isFinite(bestExploratoryScore)
      ? bestExploratoryScore
      : Number.NEGATIVE_INFINITY;
    const full = Number.isFinite(bestFullScore) ? bestFullScore : Number.NEGATIVE_INFINITY;
    const progress: SolverProgress = {
      phase: currentPhase,
      evaluations,
      uniqueCandidates: uniqueBars,
      bestScore: Number.isFinite(exploratory) ? exploratory : 0,
      ...(Number.isFinite(exploratory) ? { bestExploratoryScore: exploratory } : {}),
      ...(Number.isFinite(full) ? { bestFullScore: full } : {}),
      searchEvaluations,
      fullEvaluations,
      evaluationMode: currentPhase === "finalize" ? "finalize" : "search",
      // Never stuff robust score into windowDpms — real windows live on the result DTO.
      windowDpms: 0,
      topBarPreview: topPreview,
      ...(activePreview.length ? { activeBarPreview: activePreview } : {}),
      noImprovementCount: noImprovement,
      evaluationBudget,
      progressRatio: progressRatioNow(),
      proof: {
        notes: [
          `bestExploratory=${Number.isFinite(exploratory) ? exploratory : "none"}`,
          `bestFull=${Number.isFinite(full) ? full : "none"}`,
          `phase=${currentPhase}`,
          `searchEvaluations=${searchEvaluations}`,
          `fullEvaluations=${fullEvaluations}`,
        ],
      },
      ...(fullMemoHits > 0 ? { fullMemoHits } : {}),
      ...(finalizeActive && finalizeTotal > 0
        ? {
            finalizeStep: finalizeDone,
            finalizeTotal,
            ...(scoringLabel ? { scoringLabel } : {}),
            ...(scoringBarPreview?.length ? { scoringBarPreview } : {}),
          }
        : {}),
    };
    options.onProgress(progress);
  };

  // Loadout/context slice for process-local eval memo (re-Optimize warms).
  const memoContext = stableStringify({
    style: request.style,
    profileId: request.profileId,
    customWeights: request.customWeights ?? null,
    includePartial: request.includePartial === true,
    base: simBase.base,
    level: simBase.level,
    accuracy: simBase.accuracy,
    crit: simBase.crit,
    weaponConfiguration: simBase.weaponConfiguration,
    equipmentIds: simBase.equipmentIds,
    startingAdrenaline: simBase.startingAdrenaline,
    plantedFeet: simBase.plantedFeet === true,
    strengthCape99: simBase.strengthCape99 === true,
    preciseRank: simBase.preciseRank ?? 0,
    leagueIds: simBase.league.blessingIds,
    ruleset: simBase.league.ruleset,
    targetHp: simBase.targetHpPercent ?? null,
  });

  const evaluate: EvaluateFn = ({ bar, mode }: { bar: readonly string[]; mode?: EvalMode }) => {
    if (options?.isCancelled?.() || options?.signal?.aborted) {
      return { score: Number.NEGATIVE_INFINITY, finite: false };
    }
    // Track the bar under test so the UI strip can cycle. Best-so-far
    // (topPreview) only moves when a candidate beats the incumbent.
    const nextActive = [...bar];
    const activeChanged =
      nextActive.length !== activePreview.length ||
      nextActive.some((id, i) => id !== activePreview[i]);
    activePreview = nextActive;
    const useFull = mode === "full" || mode === "finalize";
    const durationTicks = useFull ? fullTicks : exploreTicks;
    const scoreMode = useFull ? "full" : "search";
    const memoKey = fingerprintEvaluationKey({
      bar,
      mode: scoreMode,
      horizonTicks: durationTicks,
      profileId: request.profileId,
      customWeights: request.customWeights,
      context: memoContext,
      objectiveVersion: OBJECTIVE_VERSION,
    });
    const memoHit = readEvalMemo(memoKey);
    if (memoHit) {
      // Count as evaluation for progress honesty but skip the heavy sim.
      evaluations += 1;
      if (useFull) {
        fullEvaluations += 1;
        fullMemoHits += 1;
      } else {
        searchEvaluations += 1;
      }
      const key = bar.join("\0");
      if (!seenBars.has(key)) {
        seenBars.add(key);
        uniqueBars += 1;
      }
      if (memoHit.finite && memoHit.score > bestExploratoryScore && scoreMode === "search") {
        bestExploratoryScore = memoHit.score;
        if (!finalizeActive) topPreview = [...bar];
      }
      if (
        memoHit.finite &&
        memoHit.validForFinalRanking &&
        scoreMode === "full" &&
        memoHit.score > bestFullScore
      ) {
        bestFullScore = memoHit.score;
        topPreview = [...bar];
      }
      // Do not flip phase to finalize on a memo hit alone — only the finalize
      // hook owns that (avoids a one-frame "scoring" flash on warm re-runs).
      // Force emit when the strip candidate changes so the UI keeps cycling.
      emitProgress(activeChanged);
      return memoHit;
    }

    evaluations += 1;
    if (useFull) fullEvaluations += 1;
    else searchEvaluations += 1;
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

    if (evaluation.ok) {
      if (evaluation.mode === "full" && evaluation.validForFinalRanking) {
        if (evaluation.score > bestFullScore) {
          bestFullScore = evaluation.score;
          topPreview = [...bar];
          noImprovement = 0;
        } else {
          noImprovement += 1;
        }
      } else if (evaluation.exploratory) {
        if (evaluation.score > bestExploratoryScore) {
          bestExploratoryScore = evaluation.score;
          if (!finalizeActive) topPreview = [...bar];
          noImprovement = 0;
        } else {
          noImprovement += 1;
        }
      } else {
        noImprovement += 1;
      }
    } else {
      noImprovement += 1;
    }

    // Force paint when the under-test bar changes; else keep every-2 throttle.
    emitProgress(activeChanged);

    if (!evaluation.ok) {
      return {
        score: Number.NEGATIVE_INFINITY,
        finite: false,
        mode: evaluation.mode,
        exploratory: evaluation.exploratory,
        validForFinalRanking: false,
        horizonTicks: evaluation.horizonTicks,
        failureReason: evaluation.failureReason ?? evaluation.reasons[0]?.message,
        // Preserve failed robust objective when present (never synthesize success).
        objective: evaluation.objective,
      };
    }

    // Exploratory successes carry no synthetic robust objective windows.
    if (evaluation.exploratory || !evaluation.objective?.ok) {
      const out = {
        score: evaluation.score,
        finite: true as const,
        mode: evaluation.mode,
        exploratory: true as const,
        validForFinalRanking: false as const,
        horizonTicks: evaluation.horizonTicks,
        // objective omitted on purpose — scalar exploratory DPM only
      };
      writeEvalMemo(memoKey, out);
      return out;
    }

    const out = {
      score: evaluation.score,
      finite: true as const,
      mode: "full" as const,
      exploratory: false as const,
      validForFinalRanking: true as const,
      horizonTicks: evaluation.horizonTicks,
      objective: evaluation.objective,
    };
    writeEvalMemo(memoKey, out);
    return out;
  };

  // Pool-legal only (weapon/region denylist already applied to the pool).
  const legalId = (id: string) => pool.byId.has(id) && !denySet.has(id);
  const searchPool: PoolAbility[] = pool.ids.map((id) => pool.byId.get(id)!);
  // Fit wiki/user seeds into the agent ladder band: truncate > max; pad < min.
  const fitSeed = (ids: readonly string[]): string[] | null => {
    const cleaned = ids.filter(legalId);
    if (cleaned.length < 2) return null;
    let built =
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
  const authored = [
    ...authoredSeedsFromCatalogue(request.style, denySet),
    ...request.authoredSeedBars.map((s) => s.abilityIds),
    ...(request.userBar ? [request.userBar] : []),
  ]
    .map(fitSeed)
    .filter((s): s is string[] => s != null && s.length >= 2);

  emitProgress(true);
  if (options?.yieldSlice) await options.yieldSlice();

  const recipe: SolverAgentRecipe = request.agentRecipe ?? "default";
  const recipePatch = configPatchForRecipe(request.tier, recipe);

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
        ...recipePatch,
        evaluationBudget,
      },
    },
    {
      onPhase: (phase) => {
        currentPhase = mapPhase(phase);
        if (phase === "finalize") finalizeActive = true;
        emitProgress(true);
      },
      onFinalizeStep: (info) => {
        currentPhase = "finalize";
        finalizeActive = true;
        finalizeDone = info.done;
        finalizeTotal = Math.max(1, info.total);
        scoringLabel = info.label;
        scoringBarPreview = info.bar;
        if (info.bar?.length) activePreview = [...info.bar];
        emitProgress(true);
      },
      isCancelled: () => options?.isCancelled?.() === true || options?.signal?.aborted === true,
      yieldSlice: async () => {
        emitProgress(true);
        if (options?.isCancelled?.() || options?.signal?.aborted) {
          throwCancelled();
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
    throwCancelled();
  }

  // Finalize already full-rescored the shortlist — no second 300s winner sim.
  currentPhase = "finalize";
  emitProgress(true);
  const hasBigBoned = simBase.league.blessingIds.includes("big-boned");
  const bigBonedAssumptions = hasBigBoned ? [...BIG_BONED_OUTGOING_ASSUMPTIONS] : undefined;
  const bigBonedNotes = hasBigBoned ? ([...BIG_BONED_OUTGOING_ASSUMPTIONS] as const) : [];

  // No fabricated empty-bar / zero-score "success" DTO.
  if (result.status === "failed" || result.best == null) {
    throw new Error(
      [
        "solver failed: no valid candidate",
        `proof=${result.proof}`,
        `searchEvaluations=${result.searchEvaluations}`,
        `fullEvaluations=${result.fullEvaluations}`,
        `bestExploratory=${result.bestExploratoryScore}`,
        `bestFull=${result.bestFullScore}`,
      ].join("; "),
    );
  }

  const winner = result.best;
  const winnerBar = [...winner.bar];
  const fullWinner = winner.validForFinalRanking === true && winner.mode === "full";
  const score = Number.isFinite(winner.robustScore) ? winner.robustScore : Number.NEGATIVE_INFINITY;
  if (!Number.isFinite(score)) {
    throw new Error(`solver failed: non-finite winner score (proof=${result.proof})`);
  }

  const proofNotes = [
    `status=${result.status}`,
    `proof=${result.proof}`,
    result.exhaustiveCompleted
      ? "search-objective exhaustive completed (does not prove full-objective global optimum alone)"
      : "heuristic search",
    `pool size ${pool.ids.length}`,
    `searchEvaluations ${result.searchEvaluations}/${result.searchBudget}`,
    `fullEvaluations ${result.fullEvaluations}`,
    `totalEvaluations ${result.totalEvaluations}`,
    `bestExploratory ${result.bestExploratoryScore}`,
    `bestFull ${result.bestFullScore}`,
    `validFullCandidates ${result.validFullCandidateCount}`,
    `seed best exploratory ${result.seedBestScore}`,
    ...bigBonedNotes,
  ];

  // Honest windows only — never copy robust score into windowDpms.
  // Full winners from production evaluate carry measured window DPMs (may be 0).
  const hasRealWindows =
    fullWinner &&
    !winner.exploratory &&
    Number.isFinite(winner.openingDpm) &&
    Number.isFinite(winner.developedDpm) &&
    Number.isFinite(winner.steadyDpm);

  const exploratoryOut = Number.isFinite(result.bestExploratoryScore)
    ? result.bestExploratoryScore
    : undefined;
  const fullOut = Number.isFinite(result.bestFullScore) ? result.bestFullScore : undefined;

  const dto: SolverResultDTO = {
    bar: winnerBar,
    score,
    // Required DTO field: 0 when no honest window aggregate (do not stuff score).
    windowDpms: 0,
    evaluations: result.totalEvaluations,
    uniqueCandidates: uniqueBars || result.stats.uniqueBars || result.totalEvaluations,
    seed: request.seed,
    profileId: request.profileId,
    tier: request.tier,
    durationTicks: fullTicks,
    proofLabel: result.proof,
    ...(exploratoryOut != null ? { bestExploratoryScore: exploratoryOut } : {}),
    ...(fullOut != null ? { bestFullScore: fullOut } : {}),
    openingDpm: hasRealWindows ? winner.openingDpm : undefined,
    developedDpm: hasRealWindows ? winner.developedDpm : undefined,
    steadyDpm: hasRealWindows ? winner.steadyDpm : undefined,
    assumptions: bigBonedAssumptions,
    // summary left unset unless an independent sim is run — never fabricate.
    proof: {
      label: result.proof,
      // recheckScore omitted — a copy of the chosen score is not a recheck.
      notes: proofNotes,
    },
    top: result.top.map((t) => ({
      bar: [...t.bar],
      score: t.robustScore,
      fingerprint: t.fingerprint,
    })),
  };

  options?.onProgress?.({
    phase: "finalize",
    evaluations: result.totalEvaluations,
    uniqueCandidates: dto.uniqueCandidates,
    // Keep bestScore on exploratory scale for the whole run.
    bestScore: exploratoryOut ?? 0,
    ...(exploratoryOut != null ? { bestExploratoryScore: exploratoryOut } : {}),
    ...(fullOut != null ? { bestFullScore: fullOut } : {}),
    searchEvaluations: result.searchEvaluations,
    fullEvaluations: result.fullEvaluations,
    evaluationMode: "finalize",
    windowDpms: 0,
    topBarPreview: winnerBar,
    noImprovementCount: 0,
    evaluationBudget,
    progressRatio: 1,
    proof: {
      ...dto.proof,
      notes: [
        ...(dto.proof?.notes ?? []),
        `bestExploratory=${result.bestExploratoryScore}`,
        `bestFull=${result.bestFullScore}`,
      ],
    },
  });

  return dto;
};

/** Host-side helper: resolve ability ids for a solved bar graphic. */
export function resolveSolvedBar(ids: readonly string[]): AbilitySpec[] {
  return resolveSpecs(ids);
}
