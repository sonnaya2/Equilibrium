"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import {
  ABSOLUTE_MAX_BAR_SIZE,
  agentBarLength,
  agentSearchRecipe,
  cancelOptimize,
  fingerprintSolveContext,
  lookupSolvedBar,
  MIN_SOLVER_BAR_SIZE,
  packSolverRequest,
  preferredAgentCount,
  rememberSolvedBar,
  runOptimize,
  seedBarsFromSolveCache,
  TIER_BUDGETS,
  type ObjectiveProfileId,
  type SolverProgress,
  type SolverResultDTO,
  type SolverSearchTier,
} from "@/combat/solver";
import { REGION_IDS, type BuildState } from "@/league";
import type { CalcStats } from "./loadoutStats";
import {
  loadBarLibrary,
  saveBarLibrary,
  withPermanentBar,
  withRecentBar,
  withoutRecentBar,
  withoutSavedBar,
  type RevoBarLibrary,
} from "./revoBarLibrary";
import { partialDtoFromProgress } from "./revoPanelFormat";
import type { Loadout } from "./useLoadout";

export type UseRevolutionSolverArgs = {
  stats: CalcStats;
  loadout: Loadout;
  build: BuildState;
  modelled: AbilitySpec[];
  onActiveBar: (ids: string[] | null) => void;
  onClearSimResult: () => void;
};

export function useRevolutionSolver({
  stats,
  loadout,
  build,
  modelled,
  onActiveBar,
  onClearSimResult,
}: UseRevolutionSolverArgs) {
  const [solverTier, setSolverTier] = useState<SolverSearchTier>("thorough");
  const [solverProfile, setSolverProfile] = useState<ObjectiveProfileId>("balanced");
  const [limitToRegions, setLimitToRegions] = useState(false);
  const [solving, setSolving] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [solverProgress, setSolverProgress] = useState<SolverProgress | null>(null);
  const [solverResult, setSolverResult] = useState<SolverResultDTO | null>(null);
  const [solverError, setSolverError] = useState<string | null>(null);
  const [bestPulse, setBestPulse] = useState(false);
  const [solverAgents, setSolverAgents] = useState(() => preferredAgentCount("thorough"));
  const [barLibrary, setBarLibrary] = useState<RevoBarLibrary>(() => ({
    version: 1,
    recents: [],
    saved: [],
  }));

  const cancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastBestRef = useRef(0);
  const solveGenRef = useRef(0);
  const latestProgressRef = useRef<SolverProgress | null>(null);

  useEffect(() => {
    setBarLibrary(loadBarLibrary());
  }, []);

  useEffect(() => {
    return () => {
      solveGenRef.current += 1;
      abortRef.current?.abort();
      cancelOptimize();
    };
  }, []);

  const applyDto = useCallback(
    (dto: SolverResultDTO, request: Parameters<typeof rememberSolvedBar>[0]) => {
      const bar = dto.bar?.length ? [...dto.bar] : [];
      if (bar.length === 0) {
        setSolverError("No legal bar");
        setSolverResult(dto);
      } else {
        setSolverError(null);
        setSolverResult(dto);
        onActiveBar(bar);
        onClearSimResult();
        rememberSolvedBar(request, dto);
        setBarLibrary((prev) => {
          const next = withRecentBar(prev, {
            bar,
            style: request.style,
            score: dto.score,
            profileId: dto.profileId ?? request.profileId,
            tier: request.tier,
          });
          saveBarLibrary(next);
          return next;
        });
      }
      let bestFullScore: number | undefined;
      if (Number.isFinite(dto.bestFullScore)) bestFullScore = dto.bestFullScore;
      else if (Number.isFinite(dto.score)) bestFullScore = dto.score;

      setSolverProgress({
        phase: "finalize",
        evaluations: dto.evaluations,
        uniqueCandidates: dto.uniqueCandidates,
        bestScore: Number.isFinite(dto.bestExploratoryScore) ? dto.bestExploratoryScore! : 0,
        ...(Number.isFinite(dto.bestExploratoryScore)
          ? { bestExploratoryScore: dto.bestExploratoryScore }
          : {}),
        ...(bestFullScore != null ? { bestFullScore } : {}),
        windowDpms: 0,
        topBarPreview: bar,
        noImprovementCount: 0,
        evaluationBudget: TIER_BUDGETS[solverTier],
        progressRatio: 1,
        evaluationMode: "finalize",
      });
    },
    [solverTier, onActiveBar, onClearSimResult],
  );

  const optimize = useCallback(async () => {
    cancelRef.current = false;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    const gen = ++solveGenRef.current;
    lastBestRef.current = 0;
    latestProgressRef.current = null;
    setSolving(true);
    setStopping(false);
    setSolverError(null);
    setSolverResult(null);
    setBestPulse(false);
    const agentsPlanned = preferredAgentCount(solverTier);
    setSolverAgents(agentsPlanned);
    const seedProgress: SolverProgress = {
      phase: "seed",
      evaluations: 0,
      uniqueCandidates: 0,
      bestScore: 0,
      windowDpms: 0,
      topBarPreview: [],
      noImprovementCount: 0,
      evaluationBudget: TIER_BUDGETS[solverTier],
      progressRatio: 0.02,
      agentCount: agentsPlanned,
      agents: Array.from({ length: agentsPlanned }, (_, i) => ({
        index: i,
        phase: "seed" as const,
        evaluations: 0,
        bestScore: 0,
        progressRatio: 0,
        finished: false,
        recipe: agentSearchRecipe(i, solverTier),
        barLength: agentBarLength(i),
      })),
    };
    latestProgressRef.current = seedProgress;
    setSolverProgress(seedProgress);
    try {
      const baseRequest = packSolverRequest({
        stats,
        loadout,
        build,
        style: loadout.style,
        tier: solverTier,
        profileId: solverProfile,
        maxBarSize: ABSOLUTE_MAX_BAR_SIZE,
        minBarSize: MIN_SOLVER_BAR_SIZE,
        userBar: modelled.map((m) => m.id),
        seed: 1,
        useBuildRegions: limitToRegions,
        unlockedRegions: limitToRegions ? undefined : [...REGION_IDS],
        includeUnknownAvailability: !limitToRegions,
      });
      const contextKey = await fingerprintSolveContext(baseRequest);
      const cached = lookupSolvedBar(contextKey);
      const cachedSeeds = seedBarsFromSolveCache(loadout.style, contextKey, MIN_SOLVER_BAR_SIZE);
      if (cached?.bar?.length) {
        lastBestRef.current = 0;
        const warm: SolverProgress = {
          phase: "seed",
          evaluations: 0,
          uniqueCandidates: cached.top?.length ?? 1,
          bestScore: 0,
          ...(Number.isFinite(cached.score) ? { bestFullScore: cached.score } : {}),
          windowDpms: 0,
          topBarPreview: [...cached.bar],
          noImprovementCount: 0,
          evaluationBudget: TIER_BUDGETS[solverTier],
          progressRatio: 0.08,
        };
        latestProgressRef.current = warm;
        setSolverProgress(warm);
      }
      const request = {
        ...baseRequest,
        authoredSeedBars: [
          ...baseRequest.authoredSeedBars,
          ...cachedSeeds.map((abilityIds, i) => ({
            id: `cached-${i}`,
            abilityIds,
            baseline: false as const,
          })),
        ],
      };
      const agents = agentsPlanned;
      const dto = await runOptimize(
        request,
        (progress) => {
          if (gen !== solveGenRef.current) return;
          if (cancelRef.current || abort.signal.aborted) return;
          latestProgressRef.current = progress;
          if (progress.bestScore > lastBestRef.current + 1e-6) {
            lastBestRef.current = progress.bestScore;
            setBestPulse(true);
            window.setTimeout(() => setBestPulse(false), 450);
          }
          setSolverProgress({ ...progress });
        },
        {
          isCancelled: () =>
            gen !== solveGenRef.current || cancelRef.current || abort.signal.aborted,
          signal: abort.signal,
          agents,
        },
      );
      if (gen !== solveGenRef.current) return;
      if (cancelRef.current || abort.signal.aborted) {
        const partial = latestProgressRef.current;
        if (partial?.topBarPreview?.length) {
          onActiveBar([...partial.topBarPreview]);
        }
        return;
      }
      applyDto(dto, request);
    } catch (err) {
      if (gen !== solveGenRef.current) return;
      const aborted =
        cancelRef.current ||
        abort.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error &&
          (err.name === "AbortError" ||
            err.message === "solver cancelled" ||
            err.message === "revolution solver cancelled"));

      const partial = latestProgressRef.current;
      if (aborted) {
        if (partial?.topBarPreview?.length) {
          onActiveBar([...partial.topBarPreview]);
          setSolverResult(
            partialDtoFromProgress(partial, solverProfile, solverTier, "stopped-early"),
          );
        }
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      if (partial?.topBarPreview?.length) {
        onActiveBar([...partial.topBarPreview]);
        setSolverResult(
          partialDtoFromProgress(partial, solverProfile, solverTier, "heuristic-best-found"),
        );
      }
      setSolverError(message || "Failed");
    } finally {
      if (gen === solveGenRef.current) {
        setSolving(false);
        setStopping(false);
        abortRef.current = null;
      }
    }
  }, [
    stats,
    loadout,
    build,
    solverTier,
    solverProfile,
    modelled,
    applyDto,
    limitToRegions,
    onActiveBar,
  ]);

  const cancelSolve = () => {
    // Do not bump solveGenRef — in-flight promise must still hit finally.
    cancelRef.current = true;
    abortRef.current?.abort();
    setStopping(true);
    cancelOptimize();
    const partial = latestProgressRef.current;
    if (partial?.topBarPreview?.length) {
      onActiveBar([...partial.topBarPreview]);
    }
  };

  const clearSolverUi = useCallback(() => {
    setSolverResult(null);
    setSolverError(null);
  }, []);

  const saveCurrentBar = (currentSaveBar: string[] | null, currentSaveScore: number | null) => {
    if (!currentSaveBar?.length || solving) return;
    setBarLibrary((prev) => {
      const next = withPermanentBar(prev, {
        bar: currentSaveBar,
        style: loadout.style,
        score: currentSaveScore,
        profileId: solverResult?.profileId ?? solverProfile,
        tier: solverTier,
      });
      saveBarLibrary(next);
      return next;
    });
  };

  const dropRecent = (id: string) => {
    setBarLibrary((prev) => {
      const next = withoutRecentBar(prev, id);
      saveBarLibrary(next);
      return next;
    });
  };

  const dropSaved = (id: string) => {
    setBarLibrary((prev) => {
      const next = withoutSavedBar(prev, id);
      saveBarLibrary(next);
      return next;
    });
  };

  return {
    solverTier,
    setSolverTier,
    solverProfile,
    setSolverProfile,
    limitToRegions,
    setLimitToRegions,
    solving,
    stopping,
    solverProgress,
    solverResult,
    solverError,
    bestPulse,
    solverAgents,
    setSolverAgents,
    barLibrary,
    optimize,
    cancelSolve,
    clearSolverUi,
    saveCurrentBar,
    dropRecent,
    dropSaved,
  };
}
