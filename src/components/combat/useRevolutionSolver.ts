"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import {
  agentBarLength,
  agentSearchRecipe,
  cancelOptimize,
  clampSolverBarSizes,
  fingerprintSolveContext,
  lookupSolvedBar,
  packSolverRequest,
  preferredAgentCount,
  rememberSolvedBar,
  runOptimize,
  seedBarsFromSolveCache,
  solveContextPayload,
  TIER_BUDGETS,
  type ObjectiveProfileId,
  type SerializableSolverRequest,
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
import {
  barBoundsFromPreset,
  DEFAULT_BAR_SIZE_PRESET,
  isLiveSolverSession,
  settlementActionForSolve,
  stoppedPreviewFromProgress,
  type BarSizePresetId,
  type SolverStoppedPreview,
} from "./revoPanelFormat";
import { solverSnapshotFromUi } from "./solverSnapshot";
import type { Loadout } from "./useLoadout";

export type UseRevolutionSolverArgs = {
  stats: CalcStats;
  loadout: Loadout;
  build: BuildState;
  modelled: AbilitySpec[];
  onActiveBar: (ids: string[] | null) => void;
  onClearSimResult: () => void;
};

type MaterialSolveInputs = {
  stats: CalcStats;
  loadout: Loadout;
  build: BuildState;
  modelled: AbilitySpec[];
  solverTier: SolverSearchTier;
  solverProfile: ObjectiveProfileId;
  limitToRegions: boolean;
  barSizePreset: BarSizePresetId;
};

function packFromMaterial(
  m: MaterialSolveInputs,
  opts?: { seed?: number; now?: number },
): SerializableSolverRequest {
  const bounds = barBoundsFromPreset(m.barSizePreset);
  return packSolverRequest({
    snapshot: solverSnapshotFromUi(m.stats, m.loadout),
    style: m.loadout.style,
    build: m.build,
    tier: m.solverTier,
    profileId: m.solverProfile,
    minBarSize: bounds.minBarSize,
    maxBarSize: bounds.maxBarSize,
    userBar: m.modelled.map((x) => x.id),
    seed: opts?.seed ?? 1,
    now: opts?.now,
    useBuildRegions: m.limitToRegions,
    unlockedRegions: m.limitToRegions ? undefined : [...REGION_IDS],
    includeUnknownAvailability: !m.limitToRegions,
  });
}

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
  const [barSizePreset, setBarSizePreset] = useState<BarSizePresetId>(DEFAULT_BAR_SIZE_PRESET);
  const [solving, setSolving] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [solverProgress, setSolverProgress] = useState<SolverProgress | null>(null);
  /** Completed final result only — never built from mid-run progress. */
  const [solverResult, setSolverResult] = useState<SolverResultDTO | null>(null);
  /** Cancel/error best-so-far — facts only, not a SolverResultDTO. */
  const [stoppedPreview, setStoppedPreview] = useState<SolverStoppedPreview | null>(null);
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
  const sessionIdentityRef = useRef<string | null>(null);
  const sessionNowRef = useRef<number>(0);
  const materialRef = useRef<MaterialSolveInputs>({
    stats,
    loadout,
    build,
    modelled,
    solverTier,
    solverProfile,
    limitToRegions,
    barSizePreset,
  });

  materialRef.current = {
    stats,
    loadout,
    build,
    modelled,
    solverTier,
    solverProfile,
    limitToRegions,
    barSizePreset,
  };

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

  const liveIdentity = useCallback((): string => {
    const req = packFromMaterial(materialRef.current, {
      seed: 1,
      now: sessionNowRef.current || undefined,
    });
    return solveContextPayload(req);
  }, []);

  const sessionIsLive = useCallback(
    (gen: number): boolean => {
      const identity = sessionIdentityRef.current;
      if (identity == null) return false;
      return isLiveSolverSession({
        sessionGen: gen,
        currentGen: solveGenRef.current,
        sessionIdentity: identity,
        currentIdentity: liveIdentity(),
        cancelled: cancelRef.current,
      });
    },
    [liveIdentity],
  );

  /** Final DTO only: apply bar, verified cache, verified recent. */
  const applyFinalDto = useCallback(
    (dto: SolverResultDTO, request: SerializableSolverRequest) => {
      const bar = dto.bar?.length ? [...dto.bar] : [];
      setStoppedPreview(null);
      if (bar.length === 0) {
        setSolverError("No legal bar");
        setSolverResult(dto);
      } else {
        setSolverError(null);
        setSolverResult(dto);
        onActiveBar(bar);
        onClearSimResult();
        void rememberSolvedBar(request, dto);
        setBarLibrary((prev) => {
          const next = withRecentBar(prev, {
            bar,
            style: request.style,
            score: dto.score,
            profileId: dto.profileId ?? request.profileId,
            tier: request.tier,
            verified: true,
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

  const publishStoppedPreview = useCallback(
    (partial: SolverProgress | null, reason: SolverStoppedPreview["reason"]) => {
      if (!partial?.topBarPreview?.length) return;
      const preview = stoppedPreviewFromProgress(
        partial,
        solverProfile,
        solverTier,
        reason,
      );
      if (!preview) return;
      setStoppedPreview(preview);
      setSolverResult(null);
      onActiveBar([...preview.bar]);
    },
    [onActiveBar, solverProfile, solverTier],
  );

  const optimize = useCallback(async () => {
    cancelRef.current = false;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    const gen = ++solveGenRef.current;
    lastBestRef.current = 0;
    latestProgressRef.current = null;
    sessionIdentityRef.current = null;
    setSolving(true);
    setStopping(false);
    setSolverError(null);
    setSolverResult(null);
    setStoppedPreview(null);
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
      const sessionNow = Date.now();
      sessionNowRef.current = sessionNow;
      const material = materialRef.current;
      const baseRequest = packFromMaterial(material, { seed: 1, now: sessionNow });
      sessionIdentityRef.current = solveContextPayload(baseRequest);

      const cacheKey = await fingerprintSolveContext(baseRequest);
      const cached = lookupSolvedBar(cacheKey);
      const bounds = clampSolverBarSizes(
        barBoundsFromPreset(material.barSizePreset).minBarSize,
        barBoundsFromPreset(material.barSizePreset).maxBarSize,
      );
      const cachedSeeds = seedBarsFromSolveCache(loadout.style, cacheKey, bounds.minBarSize);
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
          if (!sessionIsLive(gen)) return;
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
      const settle = settlementActionForSolve({
        sessionGen: gen,
        currentGen: solveGenRef.current,
        sessionIdentity: sessionIdentityRef.current ?? "",
        currentIdentity: liveIdentity(),
        cancelled: cancelRef.current || abort.signal.aborted,
        hasFinalDto: true,
      });
      if (settle === "ignore") return;
      if (settle === "stopped-preview") {
        // Cancellation: no final DTO, no verified cache / recent.
        publishStoppedPreview(latestProgressRef.current, "stopped-early");
        return;
      }
      applyFinalDto(dto, request);
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
        publishStoppedPreview(partial, "stopped-early");
        return;
      }

      // Error path: optional non-final preview only; never a fake SolverResultDTO.
      // Identity may have drifted — still allow preview if gen matches.
      if (gen === solveGenRef.current) {
        publishStoppedPreview(partial, "error");
        const message = err instanceof Error ? err.message : String(err);
        setSolverError(message || "Failed");
      }
    } finally {
      if (gen === solveGenRef.current) {
        setSolving(false);
        setStopping(false);
        abortRef.current = null;
      }
    }
  }, [loadout.style, solverTier, applyFinalDto, sessionIsLive, publishStoppedPreview, liveIdentity]);

  const cancelSolve = () => {
    // Do not bump solveGenRef — in-flight promise must still hit finally.
    cancelRef.current = true;
    abortRef.current?.abort();
    setStopping(true);
    cancelOptimize();
    // Immediate bar preview from known progress; no final DTO / verified writes.
    const partial = latestProgressRef.current;
    if (partial?.topBarPreview?.length) {
      onActiveBar([...partial.topBarPreview]);
    }
  };

  const clearSolverUi = useCallback(() => {
    setSolverResult(null);
    setStoppedPreview(null);
    setSolverError(null);
  }, []);

  const saveCurrentBar = (
    currentSaveBar: string[] | null,
    currentSaveScore: number | null,
    opts?: { verified?: boolean },
  ) => {
    if (!currentSaveBar?.length || solving) return;
    const verified = opts?.verified === true;
    setBarLibrary((prev) => {
      const next = withPermanentBar(prev, {
        bar: currentSaveBar,
        style: loadout.style,
        score: currentSaveScore,
        profileId: solverResult?.profileId ?? stoppedPreview?.profileId ?? solverProfile,
        tier: solverResult?.tier ?? stoppedPreview?.tier ?? solverTier,
        verified,
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
    barSizePreset,
    setBarSizePreset,
    solving,
    stopping,
    solverProgress,
    solverResult,
    stoppedPreview,
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

/** Test seam: pack material inputs the same way optimize does. */
export function packSolverRequestFromUi(input: MaterialSolveInputs & { now?: number }) {
  return packFromMaterial(input, { seed: 1, now: input.now });
}
