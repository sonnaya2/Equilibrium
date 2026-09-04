"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import {
  cancelOptimize,
  clampSolverBarSizes,
  fingerprintSolveContext,
  isPresentableSolverResult,
  isVerifiedCacheableResult,
  lookupSolvedBar,
  minimumConstrainedBarSizeForRequest,
  packSolverRequest,
  planWorkers,
  preferredAgentCount,
  rememberSolvedBar,
  noteSolverHost,
  runOptimize,
  seedBarsFromSolveCache,
  solveContextPayload,
  TIER_BUDGETS,
  type ObjectiveProfileId,
  type SerializableSolverRequest,
  type SolverProgress,
  type SolverResultDTO,
  type SolverSearchTier,
  type WorkerPlan,
} from "@/combat/solver";
import { isSerializableSimBase } from "@/combat/solver/worker/serializable";
import { REGION_IDS, type BuildState } from "@/league";
import type { ResolvedCombatModel } from "@/combat/model";
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
import { ensureNecroConjuresOnBarIds } from "./revoBarResolve";
import {
  APPLY_FINAL_STAMP_REJECT_MESSAGE,
  barBoundsFromPreset,
  DEFAULT_BAR_SIZE_PRESET,
  isCompletedResultStale,
  isLiveSolverSession,
  isNoValidatedUpgradeError,
  mayApplyFinalDtoStamp,
  mayPublishStoppedPreview,
  maySaveVerified,
  recentLibraryVerifiedFields,
  settlementActionForCatch,
  settlementActionForSolve,
  shouldAdoptSolverResultBar,
  stoppedPreviewFromProgress,
  type BarSizePresetId,
  type SolverStoppedPreview,
} from "./revoPanelFormat";
import type { Loadout } from "./useLoadout";
import {
  pruneSolverAbilityRules,
  setSolverAbilityRule as applySolverAbilityRule,
  type SolverAbilityRule,
  type SolverAbilityRules,
} from "./solverAbilityRules";

/** Build initial SolverProgress agent strip from a worker plan. */
export function seedProgressFromPlan(plan: WorkerPlan, tier: SolverSearchTier): SolverProgress {
  return {
    phase: "seed",
    evaluations: 0,
    uniqueCandidates: 0,
    bestScore: 0,
    windowDpms: 0,
    topBarPreview: [],
    noImprovementCount: 0,
    evaluationBudget: TIER_BUDGETS[tier],
    progressRatio: 0.02,
    agentCount: plan.agentCount,
    agents: plan.assignments.map((a) => ({
      index: a.agentIndex,
      phase: "seed" as const,
      evaluations: 0,
      bestScore: 0,
      progressRatio: 0,
      finished: false,
      recipe: a.recipe,
      barLength: a.targetLength,
    })),
  };
}

/**
 * Coalesce high-frequency progress into one UI paint per animation frame.
 * Callers always own latestProgressRef; this only schedules setState.
 */
export function createProgressRafGate(
  onFrame: (progress: SolverProgress) => void,
  hooks: {
    raf?: (cb: FrameRequestCallback) => number;
    caf?: (id: number) => void;
  } = {},
): {
  push: (progress: SolverProgress) => void;
  /** Apply any coalesced frame immediately (settle before final UI). */
  flush: () => void;
  /** Drop scheduled frame without painting (final DTO / stopped owns setState). */
  cancel: () => void;
} {
  const rafFn =
    hooks.raf ??
    ((cb: FrameRequestCallback) =>
      typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : 0);
  const cafFn =
    hooks.caf ??
    ((id: number) => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
    });
  let pending: SolverProgress | null = null;
  let id: number | null = null;
  return {
    push(progress) {
      pending = progress;
      if (id != null) return;
      id = rafFn(() => {
        id = null;
        const p = pending;
        pending = null;
        if (p != null) onFrame(p);
      });
    },
    flush() {
      if (id != null) {
        cafFn(id);
        id = null;
      }
      const p = pending;
      pending = null;
      if (p != null) onFrame(p);
    },
    cancel() {
      if (id != null) {
        cafFn(id);
        id = null;
      }
      pending = null;
    },
  };
}

export type UseRevolutionSolverArgs = {
  /** Display / library only; not used for combat field packing. */
  stats: CalcStats;
  loadout: Loadout;
  /** Host-resolved combat model; sole source of sim fields for packing. */
  combatModel: ResolvedCombatModel;
  build: BuildState;
  modelled: AbilitySpec[];
  solverAbilities: AbilitySpec[];
  onActiveBar: (ids: string[] | null) => void;
  onClearSimResult: () => void;
  /** Controlled Limit-to-regions (parent owns persistence). */
  limitToRegions: boolean;
  setLimitToRegions: (value: boolean) => void;
};

type MaterialSolveInputs = {
  combatModel: ResolvedCombatModel;
  loadout: Loadout;
  build: BuildState;
  modelled: AbilitySpec[];
  solverTier: SolverSearchTier;
  solverProfile: ObjectiveProfileId;
  limitToRegions: boolean;
  barSizePreset: BarSizePresetId;
  lockedAbilityIds?: readonly string[];
  disabledAbilityIds?: readonly string[];
};

function packFromMaterial(
  m: MaterialSolveInputs,
  opts?: { seed?: number; now?: number },
): SerializableSolverRequest {
  const bounds = barBoundsFromPreset(m.barSizePreset);
  // Combat fields only from ResolvedCombatModel - never re-derive from Loadout.
  // unlockedRegions below: ability pool eligibility only (not passives).
  // userBar is the actual incumbent; packSolverRequest injects necro conjures on seeds only.
  const userBar = m.modelled.map((x) => x.id);
  return packSolverRequest({
    model: m.combatModel,
    style: m.combatModel.style,
    build: m.build,
    tier: m.solverTier,
    profileId: m.solverProfile,
    minBarSize: bounds.minBarSize,
    maxBarSize: bounds.maxBarSize,
    userBar,
    lockedAbilityIds: m.lockedAbilityIds,
    disabledAbilityIds: m.disabledAbilityIds,
    seed: opts?.seed ?? 1,
    now: opts?.now,
    useBuildRegions: m.limitToRegions,
    unlockedRegions: m.limitToRegions ? undefined : [...REGION_IDS],
    includeUnknownAvailability: !m.limitToRegions,
  });
}

export function useRevolutionSolver({
  stats: _stats,
  loadout,
  combatModel,
  build,
  modelled,
  solverAbilities,
  onActiveBar,
  onClearSimResult,
  limitToRegions,
  setLimitToRegions,
}: UseRevolutionSolverArgs) {
  const [solverTier, setSolverTier] = useState<SolverSearchTier>("thorough");
  const [solverProfile, setSolverProfile] = useState<ObjectiveProfileId>("balanced");
  const [barSizePreset, setBarSizePreset] = useState<BarSizePresetId>(DEFAULT_BAR_SIZE_PRESET);
  const [abilityRules, setAbilityRules] = useState<SolverAbilityRules>({
    lockedAbilityIds: [],
    disabledAbilityIds: [],
  });
  const [solving, setSolving] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [solverProgress, setSolverProgress] = useState<SolverProgress | null>(null);
  /** Completed final result only - never built from mid-run progress. */
  const [solverResult, setSolverResult] = useState<SolverResultDTO | null>(null);
  /** Cancel/error best-so-far - facts only, not a SolverResultDTO. */
  const [stoppedPreview, setStoppedPreview] = useState<SolverStoppedPreview | null>(null);
  const [solverError, setSolverError] = useState<string | null>(null);
  const [bestPulse, setBestPulse] = useState(false);
  // Seed with a fixed tier default so SSR/hydrate match; read hardware after mount.
  const [solverAgents, setSolverAgents] = useState(() => preferredAgentCount("thorough", 4));
  const [barLibrary, setBarLibrary] = useState<RevoBarLibrary>(() => ({
    version: 2,
    recents: [],
    saved: [],
  }));

  const cancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastBestRef = useRef(0);
  const solveGenRef = useRef(0);
  const latestProgressRef = useRef<SolverProgress | null>(null);
  const sessionIdentityRef = useRef<string | null>(null);
  const sessionEnvironmentIdentityRef = useRef<string | null>(null);
  const materialRef = useRef<MaterialSolveInputs>({
    combatModel,
    loadout,
    build,
    modelled,
    solverTier,
    solverProfile,
    limitToRegions,
    barSizePreset,
    lockedAbilityIds: abilityRules.lockedAbilityIds,
    disabledAbilityIds: abilityRules.disabledAbilityIds,
  });

  materialRef.current = {
    combatModel,
    loadout,
    build,
    modelled,
    solverTier,
    solverProfile,
    limitToRegions,
    barSizePreset,
    lockedAbilityIds: abilityRules.lockedAbilityIds,
    disabledAbilityIds: abilityRules.disabledAbilityIds,
  };
  // Single live request: full identity includes the incumbent user bar.
  // Progress path is string compare against liveIdentityRef - no pack per event.
  const liveRequest = useMemo(
    () =>
      packFromMaterial(
        {
          combatModel,
          loadout,
          build,
          modelled,
          solverTier,
          solverProfile,
          limitToRegions,
          barSizePreset,
          lockedAbilityIds: abilityRules.lockedAbilityIds,
          disabledAbilityIds: abilityRules.disabledAbilityIds,
        },
        { seed: 1 },
      ),
    [
      combatModel,
      loadout,
      build,
      modelled,
      solverTier,
      solverProfile,
      limitToRegions,
      barSizePreset,
      abilityRules.lockedAbilityIds,
      abilityRules.disabledAbilityIds,
    ],
  );
  const liveIdentity = useMemo(() => solveContextPayload(liveRequest), [liveRequest]);
  const liveEnvironmentIdentity = useMemo(
    () => solveContextPayload({ ...liveRequest, userBar: [] }),
    [liveRequest],
  );

  const liveIdentityRef = useRef(liveIdentity);
  liveIdentityRef.current = liveIdentity;

  const currentBar = modelled.map((ability) => ability.id);
  const resultBar = solverResult?.bar?.length
    ? ensureNecroConjuresOnBarIds(solverResult.bar, loadout.style, combatModel.weaponConfiguration)
    : null;
  const completedResultStale = solverResult
    ? isCompletedResultStale({
        liveIdentity,
        resultSolveIdentity: solverResult.solveIdentity,
        sessionEnvironmentIdentity: sessionEnvironmentIdentityRef.current,
        liveEnvironmentIdentity,
        resultBar,
        currentBar,
      })
    : false;
  const publishedLiveIdentity =
    solverResult && !completedResultStale && solverResult.solveIdentity
      ? solverResult.solveIdentity
      : liveIdentity;

  const progressRafRef = useRef<ReturnType<typeof createProgressRafGate> | null>(null);
  if (progressRafRef.current == null) {
    progressRafRef.current = createProgressRafGate((progress) => {
      setSolverProgress({ ...progress });
    });
  }

  const clearSolverUi = useCallback(() => {
    progressRafRef.current?.cancel();
    latestProgressRef.current = null;
    setSolverProgress(null);
    setSolverResult(null);
    setStoppedPreview(null);
    setSolverError(null);
    setBestPulse(false);
  }, []);

  useEffect(() => {
    setBarLibrary(loadBarLibrary());
    setSolverAgents(preferredAgentCount("thorough"));
  }, []);

  useEffect(() => {
    const availableIds = new Set(solverAbilities.map((ability) => ability.id));
    const needsPrune =
      abilityRules.lockedAbilityIds.some((id) => !availableIds.has(id)) ||
      abilityRules.disabledAbilityIds.some((id) => !availableIds.has(id));
    if (!needsPrune) return;
    setAbilityRules((current) => pruneSolverAbilityRules(current, availableIds));
    clearSolverUi();
  }, [abilityRules, clearSolverUi, solverAbilities]);

  useEffect(() => {
    return () => {
      solveGenRef.current += 1;
      abortRef.current?.abort();
      cancelOptimize();
      progressRafRef.current?.cancel();
    };
  }, []);

  // Mid-run: material identity drift aborts the session (no verified final).
  useEffect(() => {
    if (!solving) return;
    const session = sessionIdentityRef.current;
    if (session == null || session === liveIdentity) return;
    cancelRef.current = true;
    abortRef.current?.abort();
    cancelOptimize();
    setStopping(true);
  }, [solving, liveIdentity]);

  // Completed result goes stale when live identity diverges; keep bar ids as seed.
  useEffect(() => {
    if (solving) return;
    if (!solverResult || !completedResultStale) return;
    clearSolverUi();
  }, [clearSolverUi, completedResultStale, solverResult, solving]);

  const sessionIsLive = useCallback((gen: number): boolean => {
    const identity = sessionIdentityRef.current;
    if (identity == null) return false;
    return isLiveSolverSession({
      sessionGen: gen,
      currentGen: solveGenRef.current,
      sessionIdentity: identity,
      currentIdentity: liveIdentityRef.current,
      cancelled: cancelRef.current,
    });
  }, []);

  /** Final DTO: show presentable results; adopt/cache only verified residual-free upgrades. */
  const applyFinalDto = useCallback(
    (dto: SolverResultDTO, request: SerializableSolverRequest) => {
      progressRafRef.current?.cancel();
      const bar = dto.bar?.length ? [...dto.bar] : [];
      setStoppedPreview(null);
      // Fail closed on exploratory/degraded/failed proofs; residual may still be shown.
      if (bar.length === 0 || !isPresentableSolverResult(request, dto)) {
        setSolverResult(null);
        setSolverError(
          bar.length === 0
            ? "No legal bar"
            : "No validated full-horizon upgrade; exploratory results are not applied",
        );
        return;
      }
      // Remains-best and residual-blocked: show DTO; do not replace bar / cache upgrade.
      setSolverError(null);
      setSolverResult(dto);
      // Necro Run needs conjure_*; inject wiki early-bar conjures if solver omitted all.
      // Keep dto.bar as scored; active/library bar is run-ready.
      const runBar = ensureNecroConjuresOnBarIds(
        bar,
        request.style,
        isSerializableSimBase(request.loadout) ? request.loadout.weaponConfiguration : undefined,
      );
      if (shouldAdoptSolverResultBar(dto)) {
        onActiveBar(runBar);
        onClearSimResult();
        // Cache only residual-free verified upgrades (stricter than presentable).
        if (isVerifiedCacheableResult(request, dto)) {
          void rememberSolvedBar(request, dto);
        }
        const { verified, scoreContext } = recentLibraryVerifiedFields(request, dto);
        setBarLibrary((prev) => {
          const next = withRecentBar(prev, {
            bar: runBar,
            style: request.style,
            score: dto.score,
            profileId: dto.profileId ?? request.profileId,
            tier: request.tier,
            verified,
            scoreContext,
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
        topBarPreview: runBar,
        noImprovementCount: 0,
        evaluationBudget: dto.poolMetrics?.globalBudget ?? TIER_BUDGETS[solverTier],
        progressRatio: 1,
        evaluationMode: "finalize",
      });
    },
    [solverTier, onActiveBar, onClearSimResult],
  );

  const publishStoppedPreview = useCallback(
    (partial: SolverProgress | null, reason: SolverStoppedPreview["reason"]) => {
      progressRafRef.current?.cancel();
      if (!partial?.topBarPreview?.length) return;
      const preview = stoppedPreviewFromProgress(partial, solverProfile, solverTier, reason);
      if (!preview) return;
      const runBar = ensureNecroConjuresOnBarIds(
        preview.bar,
        loadout.style,
        materialRef.current.combatModel.weaponConfiguration,
      );
      // Preview only - never auto-replace active bar with unverified estimate.
      setStoppedPreview(
        runBar.length === preview.bar.length && runBar.every((id, i) => id === preview.bar[i])
          ? preview
          : { ...preview, bar: runBar },
      );
      setSolverResult(null);
    },
    [solverProfile, solverTier, loadout.style],
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
    sessionEnvironmentIdentityRef.current = null;
    progressRafRef.current?.cancel();
    setSolving(true);
    setStopping(false);
    setSolverError(null);
    setSolverResult(null);
    setStoppedPreview(null);
    setBestPulse(false);
    try {
      const sessionNow = Date.now();
      const material = materialRef.current;
      const baseRequest = packFromMaterial(material, { seed: 1, now: sessionNow });
      // Same pack+payload family as liveIdentity (now is not in solve identity).
      const sessionIdentity = solveContextPayload(baseRequest);
      sessionIdentityRef.current = sessionIdentity;
      sessionEnvironmentIdentityRef.current = solveContextPayload({
        ...baseRequest,
        userBar: [],
      });

      const plan = planWorkers({
        minBarSize: baseRequest.minBarSize,
        maxBarSize: baseRequest.maxBarSize,
        minimumRequiredBarSize: minimumConstrainedBarSizeForRequest(baseRequest),
        tier: baseRequest.tier,
        baseSeed: baseRequest.seed,
      });
      noteSolverHost("ui-optimize-plan", {
        tier: baseRequest.tier,
        agents: plan.agentCount,
        minBarSize: baseRequest.minBarSize,
        maxBarSize: baseRequest.maxBarSize,
      });
      setSolverAgents(plan.agentCount);
      const seedProgress = seedProgressFromPlan(plan, solverTier);
      latestProgressRef.current = seedProgress;
      setSolverProgress(seedProgress);

      const cacheKey = await fingerprintSolveContext(baseRequest);
      const cached = lookupSolvedBar(cacheKey);
      const bounds = clampSolverBarSizes(baseRequest.minBarSize, baseRequest.maxBarSize);
      const cachedSeeds = seedBarsFromSolveCache(loadout.style, cacheKey, bounds.minBarSize);
      if (cached?.bar?.length) {
        lastBestRef.current = 0;
        const warm: SolverProgress = {
          ...seedProgress,
          uniqueCandidates: cached.top?.length ?? 1,
          ...(Number.isFinite(cached.score) ? { bestFullScore: cached.score } : {}),
          topBarPreview: [...cached.bar],
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
      const dto = await runOptimize(
        request,
        (progress) => {
          // String compare only - no pack+stringify on the progress path.
          if (!sessionIsLive(gen)) {
            const session = sessionIdentityRef.current;
            if (
              gen === solveGenRef.current &&
              session != null &&
              session !== liveIdentityRef.current &&
              !cancelRef.current
            ) {
              cancelRef.current = true;
              abortRef.current?.abort();
              cancelOptimize();
              setStopping(true);
            }
            return;
          }
          latestProgressRef.current = progress;
          if (progress.bestScore > lastBestRef.current + 1e-6) {
            lastBestRef.current = progress.bestScore;
            setBestPulse(true);
            window.setTimeout(() => setBestPulse(false), 450);
          }
          progressRafRef.current?.push(progress);
        },
        {
          isCancelled: () =>
            gen !== solveGenRef.current || cancelRef.current || abort.signal.aborted,
          signal: abort.signal,
          agents: plan.agentCount,
        },
      );
      progressRafRef.current?.flush();
      const live = liveIdentityRef.current;
      const settle = settlementActionForSolve({
        sessionGen: gen,
        currentGen: solveGenRef.current,
        sessionIdentity: sessionIdentityRef.current ?? "",
        currentIdentity: live,
        cancelled: cancelRef.current || abort.signal.aborted,
        hasFinalDto: true,
      });
      if (settle === "ignore") return;
      if (settle === "stopped-preview") {
        publishStoppedPreview(latestProgressRef.current, "stopped-early");
        return;
      }
      // Fail-closed stamp: empty or !== live never apply verified (same as cache).
      if (
        !mayApplyFinalDtoStamp({
          dtoSolveIdentity: dto.solveIdentity,
          liveIdentity: live,
        })
      ) {
        setSolverError(APPLY_FINAL_STAMP_REJECT_MESSAGE);
        return;
      }
      applyFinalDto(dto, request);
    } catch (err) {
      if (gen !== solveGenRef.current) return;
      progressRafRef.current?.flush();
      const aborted =
        cancelRef.current ||
        abort.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error &&
          (err.name === "AbortError" ||
            err.message === "solver cancelled" ||
            err.message === "revolution solver cancelled"));

      const settle = settlementActionForCatch({
        sessionGen: gen,
        currentGen: solveGenRef.current,
        sessionIdentity: sessionIdentityRef.current ?? "",
        currentIdentity: liveIdentityRef.current,
        aborted,
      });
      if (!mayPublishStoppedPreview(settle)) return;

      const partial = latestProgressRef.current;
      if (aborted) {
        publishStoppedPreview(partial, "stopped-early");
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      // Phase 4: failed full validation never applies exploratory as a solved bar.
      if (isNoValidatedUpgradeError(message)) {
        setSolverResult(null);
        setStoppedPreview(null);
        setSolverError(message || "No validated full-horizon upgrade");
        return;
      }
      publishStoppedPreview(partial, "error");
      setSolverError(message || "Failed");
    } finally {
      if (gen === solveGenRef.current) {
        // cancel only: flush already ran pre-settle; do not paint mid-run over finalize.
        progressRafRef.current?.cancel();
        setSolving(false);
        setStopping(false);
        abortRef.current = null;
      }
    }
  }, [loadout.style, solverTier, applyFinalDto, sessionIsLive, publishStoppedPreview]);

  const cancelSolve = () => {
    // Keep gen so the in-flight promise still hits finally.
    // Do not push partial topBarPreview onto the active bar (unverified).
    cancelRef.current = true;
    abortRef.current?.abort();
    setStopping(true);
    cancelOptimize();
    progressRafRef.current?.flush();
  };

  const setAbilityRule = useCallback(
    (abilityId: string, rule: SolverAbilityRule) => {
      setAbilityRules((current) =>
        applySolverAbilityRule(current, abilityId, rule, solverAbilities),
      );
      clearSolverUi();
    },
    [clearSolverUi, solverAbilities],
  );

  const clearAbilityRules = useCallback(() => {
    setAbilityRules({ lockedAbilityIds: [], disabledAbilityIds: [] });
    clearSolverUi();
  }, [clearSolverUi]);

  const saveCurrentBar = (
    currentSaveBar: string[] | null,
    currentSaveScore: number | null,
    opts?: { verified?: boolean },
  ) => {
    if (!currentSaveBar?.length || solving) return;
    // Verified only when caller asks AND live identity + bar + cacheable proof match.
    const verifiedOk =
      opts?.verified === true &&
      maySaveVerified({
        liveIdentity: liveIdentityRef.current,
        resultSolveIdentity: solverResult?.solveIdentity,
        finalBar: solverResult?.bar,
        currentBar: currentSaveBar,
        solving,
        proofLabel: solverResult?.proofLabel ?? solverResult?.proof?.label,
      });
    const scoreContext = verifiedOk ? liveIdentityRef.current : null;
    setBarLibrary((prev) => {
      const next = withPermanentBar(prev, {
        bar: currentSaveBar,
        style: loadout.style,
        score: currentSaveScore,
        profileId: solverResult?.profileId ?? stoppedPreview?.profileId ?? solverProfile,
        tier: solverResult?.tier ?? stoppedPreview?.tier ?? solverTier,
        verified: verifiedOk,
        scoreContext,
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
    lockedAbilityIds: abilityRules.lockedAbilityIds,
    disabledAbilityIds: abilityRules.disabledAbilityIds,
    setAbilityRule,
    clearAbilityRules,
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
    /** Live solve identity from material inputs (useMemo pack+payload). */
    liveIdentity: publishedLiveIdentity,
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
