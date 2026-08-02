"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { combatRevolutionBars, type RevolutionBarRecord } from "@/combat/data";
import * as combatSpecs from "@/combat/data/specs";
import { resolveBar, type ResolvedSlot } from "@/combat/data/specs";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { simulateRevolution as runRevolution } from "@/combat/engine/simulation/revolution";
import { secondsToTicks, ticksToSeconds } from "@/combat/core/ticks";
import { engineSpecs as ENGINE_SPECS, entryByEngineId } from "@/combat/abilities/registry";
import { withStrengthCape99Dismember } from "@/combat/styles/melee/abilities";
import { STRENGTH_CAPE_DISMEMBER_EXTRA_HITS } from "@/combat/shared/perks";
import {
  cancelOptimize,
  clampSolverBarSizes,
  fingerprintSolveContext,
  lookupSolvedBar,
  MIN_SOLVER_BAR_SIZE,
  packSolverRequest,
  rememberSolvedBar,
  runOptimize,
  seedBarsFromSolveCache,
  solverPoolSize,
  TIER_BUDGETS,
  TIER_HORIZON_SECONDS,
  type ObjectiveProfileId,
  type SolverProgress,
  type SolverResultDTO,
  type SolverSearchTier,
} from "@/combat/solver";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import { CalculationAssumptions } from "./CalculationAssumptions";
import type { CalcStats } from "./loadoutStats";
import { RotationAnalysisModal, RotationEventPreview } from "./RotationAnalysis";
import { useLoadout, type Loadout } from "./useLoadout";
import { useBuild } from "@/league/useBuild";
import { REGION_IDS, unlockedRegions } from "@/league";
import "./revo-solver.css";

function solverPhaseLabel(
  phase: SolverProgress["phase"] | undefined,
  opts?: { stopping?: boolean; scoringLabel?: string },
): string {
  if (opts?.stopping) return "Stopping…";
  if (phase === "finalize") {
    return opts?.scoringLabel?.startsWith("Full-horizon")
      ? "Full-horizon scoring"
      : "Full-horizon scoring";
  }
  switch (phase) {
    case "seed":
      return "Seeding bars";
    case "explore":
      return "Exploring bars";
    case "exploit":
      return "Refining best";
    case "paused":
      return "Paused";
    default:
      return "Searching";
  }
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

function scoringHint(
  progress: SolverProgress | null,
  agentCount: number,
  stopping: boolean,
  tier: SolverSearchTier,
): string {
  const horizons = TIER_HORIZON_SECONDS[tier] ?? TIER_HORIZON_SECONDS.thorough;
  if (stopping) {
    return "Cancel received — killing workers after the current score if one is mid-flight.";
  }
  if (!progress) return "Starting solver workers…";
  if (progress.phase === "finalize") {
    const step = progress.finalizeStep ?? 0;
    const total = progress.finalizeTotal ?? 0;
    const label =
      progress.scoringLabel ??
      (total > 0 ? `Full score ${step}/${total}` : "Full scoring");
    return `${label}. Each shortlist bar is a ${horizons.fullSeconds}s game-time sim (not wall clock). Search was short (~${horizons.exploreSeconds}s); final ranking re-scores ${total || "a few"} bars one at a time.`;
  }
  if (agentCount > 1) {
    return `${agentCount} parallel agents searching (~${horizons.exploreSeconds}s game-time each eval). Best bars then get a ${horizons.fullSeconds}s full score.`;
  }
  return `Searching (~${horizons.exploreSeconds}s evals), then full-score shortlist (~${horizons.fullSeconds}s each).`;
}

function previewCategory(
  category: AbilitySpec["category"] | undefined,
): "basic" | "threshold" | "ultimate" | "utility" | undefined {
  if (category === "enhanced") return "threshold";
  if (category === "basic" || category === "ultimate" || category === "utility") return category;
  return undefined;
}

type RevoBarView = RevolutionBarRecord;

const STYLE_LABEL: Record<string, string> = {
  melee: "Melee",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
};

/** Single-target only — multi-target bars are not shipped in the app. */
const SUPPORTED_BARS = combatRevolutionBars.records.filter(
  (bar) => bar.supported && (bar.target == null || bar.target === "single"),
) as RevoBarView[];

const DEFAULT_DURATION_SECONDS = 60;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

/** Compact wall-clock for cast rows (e.g. 3.6s). */
function formatTime(ticks: number): string {
  const seconds = ticksToSeconds(ticks);
  return `${seconds.toFixed(1)}s`;
}

function styleLabel(style: string): string {
  return STYLE_LABEL[style] ?? style.charAt(0).toUpperCase() + style.slice(1);
}

function castCritLabel(result: RotationSummary["casts"][number]["result"]): string | null {
  const chance = Math.max(0, ...result.hits.map((hit) => hit.critChance));
  if (chance >= 1) return "Crit";
  return chance > 0 ? `${Math.round(chance * 1000) / 10}% crit EV` : null;
}

/** Human-readable select option — not bare "melee" / "ranged". */
function barOptionLabel(bar: RevoBarView): string {
  if (bar.name) return bar.name;

  const style = styleLabel(bar.style);
  // Prefer the authored name; fall back to style · setup only (no PvME lecture labels).
  if (bar.setup && bar.setup !== "Any") return `${style} · ${bar.setup}`;
  if (bar.mode === "basics") return `${style} · Basics`;
  if (bar.mode === "hybrid") return `${style} · Hybrid`;
  return style;
}

/**
 * Reference bar from Setup style + weapon shape (no manual picker).
 * Melee: twohand → 2h ST bar; dual-wield / defender → dual ST bar.
 * Other styles: revo++ "Any" when present.
 */
function pickBarForLoadout(
  style: string,
  weaponConfiguration?: CalcStats["weaponConfiguration"] | Loadout["weaponConfiguration"],
): RevoBarView | undefined {
  const forStyle = SUPPORTED_BARS.filter((b) => b.style === style);
  if (forStyle.length === 0) return undefined;
  const revoPlus = forStyle.filter((b) => b.mode === "revo++");
  const pool = revoPlus.length > 0 ? revoPlus : forStyle;

  if (style === "melee") {
    const twoHand =
      weaponConfiguration === "twohand"
        ? pool.find(
            (b) =>
              /two.?hand/i.test(b.setup) ||
              /two.?hand|2h/i.test(b.id) ||
              /2h|two.?hand/i.test(b.name ?? ""),
          )
        : undefined;
    if (twoHand) return twoHand;

    const dual =
      weaponConfiguration === "dualwield" ||
      weaponConfiguration === "defender" ||
      weaponConfiguration === "mainhand" ||
      weaponConfiguration === "shield" ||
      weaponConfiguration === undefined
        ? pool.find(
            (b) =>
              /dual/i.test(b.setup) || /dual/i.test(b.id) || /dual/i.test(b.name ?? ""),
          )
        : undefined;
    // Main-hand / shield prefer dual-shaped reference (closest 1H kit); fall through if missing.
    if (dual && weaponConfiguration !== "twohand") return dual;
  }

  return (
    pool.find((b) => b.setup === "Any") ??
    pool.find((b) => b.mode === "revo++") ??
    pool[0]
  );
}

/**
 * Revo-managed ability specs for the sim only (not manual keybind tail).
 * Prefers specs.revoManagedSlots when that export lands; otherwise first N slots.
 */
function revoManagedModelled(bar: RevoBarView): AbilitySpec[] {
  const helper = (
    combatSpecs as {
      revoManagedSlots?: (
        bar: RevolutionBarRecord,
        engine: ReadonlyMap<string, AbilitySpec>,
      ) => AbilitySpec[] | ResolvedSlot[];
    }
  ).revoManagedSlots;

  if (typeof helper === "function") {
    const out = helper(bar, ENGINE_SPECS);
    if (out.length === 0) return [];
    const first = out[0] as AbilitySpec | ResolvedSlot;
    if (first && typeof first === "object" && "spec" in first) {
      return (out as ResolvedSlot[]).filter((s) => s.spec !== null).map((s) => s.spec!);
    }
    return out as AbilitySpec[];
  }

  return resolveBar(bar, ENGINE_SPECS)
    .slice(0, bar.revolutionSize)
    .filter((slot) => slot.spec !== null)
    .map((slot) => slot.spec!);
}

function BarGraphic({ slots, revoSize }: { slots: ResolvedSlot[]; revoSize: number }) {
  return (
    <div className="ability-bar" role="list" aria-label="Revolution bar">
      {slots.map((slot, index) => {
        const isKeybind = index >= revoSize;
        const unmodelled = !isKeybind && slot.modelledBy === "unmodelled";
        const cat =
          slot.spec?.category === "enhanced"
            ? "threshold"
            : slot.spec?.category === "basic"
              ? "basic"
              : slot.spec?.category === "ultimate"
                ? "ultimate"
                : slot.spec?.category === "utility"
                  ? "utility"
                  : undefined;
        return (
          <div
            key={`${slot.name}-${index}`}
            role="listitem"
            title={slot.name}
            data-category={cat}
            className={`ability-bar-slot border ${
              isKeybind
                ? "border-dashed border-stone-750/40 text-parch-300/45"
                : unmodelled
                  ? "border-dashed border-stone-750 text-parch-300/60"
                  : "border-stone-750 bg-stone-850 text-parch-50"
            }`}
          >
            <div className="ability-bar-slot__number font-mono">{index + 1}</div>
            {slot.spec ? (
              <GameIcon
                src={abilityIconPath(slot.spec.id, slot.spec.style)}
                size={72}
                className="ability-bar-slot__icon"
              />
            ) : (
              <span className="ability-bar-slot__empty" aria-hidden="true" />
            )}
            <div className="ability-bar-slot__name">{slot.name}</div>
            {isKeybind ? <div className="ability-bar-slot__tag">keybind</div> : null}
            {unmodelled ? <div className="ability-bar-slot__tag">skip</div> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Revolution mode: solver-first bar search with wiki bars as seeds / references. */
export function RevolutionPanel({ stats }: { stats: CalcStats }) {
  const [loadout] = useLoadout();
  const { build } = useBuild();
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [result, setResult] = useState<RotationSummary | null>(null);
  const [showAllCasts, setShowAllCasts] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const [solverTier, setSolverTier] = useState<SolverSearchTier>("thorough");
  const [solverProfile, setSolverProfile] = useState<ObjectiveProfileId>("balanced");
  const [maxBarSize, setMaxBarSize] = useState(10);
  /** When true, solver ability pool respects Build region picks. Off = all regions. */
  const [limitToRegions, setLimitToRegions] = useState(false);
  const [cacheNote, setCacheNote] = useState<string | null>(null);
  const [solving, setSolving] = useState(false);
  /** True from Cancel click until the run promise settles (workers may still die). */
  const [stopping, setStopping] = useState(false);
  const [solverProgress, setSolverProgress] = useState<SolverProgress | null>(null);
  const [solverResult, setSolverResult] = useState<SolverResultDTO | null>(null);
  const [solverError, setSolverError] = useState<string | null>(null);
  const [activeBarIds, setActiveBarIds] = useState<string[] | null>(null);
  const [bestPulse, setBestPulse] = useState(false);
  const [solverAgents, setSolverAgents] = useState(1);
  /** Wall-clock ms when the current Optimize started (for elapsed timer). */
  const [solveStartedAt, setSolveStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const cancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastBestRef = useRef(0);
  /** Bumps on each Optimize / Cancel so stale promises cannot clear a newer run. */
  const solveGenRef = useRef(0);
  const latestProgressRef = useRef<SolverProgress | null>(null);

  /** Wiki reference bar — always follows Setup style + weapon shape (no manual picker). */
  const bar: RevoBarView | undefined = useMemo(
    () =>
      pickBarForLoadout(loadout.style, stats.weaponConfiguration) ??
      pickBarForLoadout(loadout.style) ??
      SUPPORTED_BARS[0],
    [loadout.style, stats.weaponConfiguration],
  );

  const solvedSlots: ResolvedSlot[] | null = useMemo(() => {
    if (!activeBarIds?.length) return null;
    return activeBarIds.map((id) => {
      const spec = ENGINE_SPECS.get(id) ?? null;
      const entry = entryByEngineId(id);
      return {
        name: spec?.name ?? entry?.spec.name ?? id,
        modelledBy: spec ? ("engine" as const) : ("unmodelled" as const),
        spec,
      };
    });
  }, [activeBarIds]);

  const slots = useMemo(
    () => solvedSlots ?? (bar ? resolveBar(bar, ENGINE_SPECS) : []),
    [solvedSlots, bar],
  );
  const revoSize = solvedSlots ? solvedSlots.length : (bar?.revolutionSize ?? slots.length);
  const managedSlots = useMemo(
    () => (solvedSlots ? solvedSlots : bar ? slots.slice(0, bar.revolutionSize) : []),
    [solvedSlots, bar, slots],
  );
  const modelled = useMemo(() => {
    if (solvedSlots) {
      return solvedSlots.filter((s) => s.spec).map((s) => s.spec!);
    }
    return bar ? revoManagedModelled(bar) : [];
  }, [solvedSlots, bar]);
  const unmodelled = managedSlots.filter((slot) => slot.modelledBy === "unmodelled");
  const keybindCount = Math.max(0, slots.length - revoSize);
  const regions = useMemo(() => unlockedRegions(build), [build]);

  const nameById = useMemo(() => {
    const map = new Map(
      slots.filter((slot) => slot.spec).map((slot) => [slot.spec!.id, slot.name]),
    );
    for (const spec of ENGINE_SPECS.values()) {
      if (!map.has(spec.id)) map.set(spec.id, spec.name);
    }
    return map;
  }, [slots]);

  const plannedTicks = secondsToTicks(
    Math.max(6, Number.isFinite(durationSeconds) ? durationSeconds : DEFAULT_DURATION_SECONDS),
  );

  // When Setup style or weapon shape changes, drop a solved/applied bar so the
  // graphic tracks the auto reference for the new loadout.
  const equipKey = `${loadout.style}|${stats.weaponConfiguration}`;
  const prevEquipKey = useRef(equipKey);
  useEffect(() => {
    if (prevEquipKey.current === equipKey) return;
    prevEquipKey.current = equipKey;
    setActiveBarIds(null);
    setResult(null);
    setShowAllCasts(false);
    setAnalysisOpen(false);
    setSolverResult(null);
    setSolverError(null);
  }, [equipKey]);

  // Tear down in-flight solve on unmount only (do not poison cancelRef for remounts).
  useEffect(() => {
    return () => {
      solveGenRef.current += 1;
      abortRef.current?.abort();
      cancelOptimize();
    };
  }, []);

  // Elapsed wall-clock while optimizing (1s tick).
  useEffect(() => {
    if (!solving || solveStartedAt == null) return;
    setElapsedMs(Date.now() - solveStartedAt);
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - solveStartedAt);
    }, 250);
    return () => window.clearInterval(id);
  }, [solving, solveStartedAt]);

  const simStyle = loadout.style;

  const run = () => {
    if (modelled.length === 0) return;
    const durationTicks = secondsToTicks(
      Math.max(6, Number.isFinite(durationSeconds) ? durationSeconds : DEFAULT_DURATION_SECONDS),
    );
    setShowAllCasts(false);
    setAnalysisOpen(false);
    setResult(
      runRevolution({
        base: stats.base,
        level: stats.level,
        accuracy: stats.dp,
        crit: {
          chance: stats.critChance,
          disabled: stats.critsDisabled,
          damageBonus: stats.critDamageBonus,
        },
        abilities: stats.strengthCape99
          ? withStrengthCape99Dismember(
              [...ENGINE_SPECS.values(), ...modelled],
              STRENGTH_CAPE_DISMEMBER_EXTRA_HITS,
            )
          : [...ENGINE_SPECS.values(), ...modelled],
        bar: stats.strengthCape99
          ? withStrengthCape99Dismember(modelled, STRENGTH_CAPE_DISMEMBER_EXTRA_HITS)
          : modelled,
        style: simStyle,
        durationTicks,
        modifiers: (ability) => stats.castModifiersFor(ability),
        adrenaline: stats.adrenaline,
        procs: stats.procs,
        plantedFeet: stats.plantedFeet,
        preciseRank: stats.preciseRank,
        conjureBasicDamageMult: stats.conjureBasicDamageMult,
        conjureDurationMult: stats.conjureDurationMult,
        tumekensPieces: stats.tumekensPieces,
        tumekensCritEnabled: stats.tumekensCritEnabled,
        equipmentEffects: stats.equipmentEffects,
        league: stats.league,
        context: stats.combatContext,
        targetHpPercent: loadout.target?.hpPercent,
        cap: stats.cap,
        startingAdrenaline: stats.startingAdrenaline,
        equipmentIds: stats.equipmentIds,
        weaponConfiguration: stats.weaponConfiguration,
      }),
    );
  };

  const applyDto = useCallback(
    (dto: SolverResultDTO, request: Parameters<typeof rememberSolvedBar>[0], sizes: { minBarSize: number; maxBarSize: number }) => {
      const bar = dto.bar?.length ? [...dto.bar] : [];
      if (bar.length === 0) {
        setSolverError(
          `Search finished without a legal bar (${sizes.minBarSize}–${sizes.maxBarSize} slots). Try more max slots or a different style.`,
        );
        setSolverResult(dto);
      } else {
        setSolverError(null);
        setSolverResult(dto);
        setActiveBarIds(bar);
        setResult(null);
        rememberSolvedBar(request, dto);
        setCacheNote("Saved to this browser");
      }
      setSolverProgress({
        phase: "finalize",
        evaluations: dto.evaluations,
        uniqueCandidates: dto.uniqueCandidates,
        // Exploratory scale only — never put full robust into bestScore.
        bestScore: Number.isFinite(dto.bestExploratoryScore) ? dto.bestExploratoryScore! : 0,
        ...(Number.isFinite(dto.bestExploratoryScore)
          ? { bestExploratoryScore: dto.bestExploratoryScore }
          : {}),
        ...(Number.isFinite(dto.bestFullScore)
          ? { bestFullScore: dto.bestFullScore }
          : Number.isFinite(dto.score)
            ? { bestFullScore: dto.score }
            : {}),
        // Real windows only — never stuff score into windowDpms.
        windowDpms: 0,
        topBarPreview: bar,
        noImprovementCount: 0,
        evaluationBudget: TIER_BUDGETS[solverTier],
        progressRatio: 1,
        evaluationMode: "finalize",
      });
    },
    [solverTier],
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
    setSolveStartedAt(Date.now());
    setElapsedMs(0);
    setSolverError(null);
    setSolverResult(null);
    setBestPulse(false);
    setCacheNote(null);
    const sizes = clampSolverBarSizes(MIN_SOLVER_BAR_SIZE, maxBarSize);
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
        maxBarSize: sizes.maxBarSize,
        minBarSize: sizes.minBarSize,
        // Horizons come from TIER_HORIZON_SECONDS (thorough: ~12s explore / 30s full).
        userBar: modelled.map((m) => m.id),
        seed: 1,
        // On: Build picks only. Off: every region + unknown unlocks (full ability pool).
        useBuildRegions: limitToRegions,
        unlockedRegions: limitToRegions ? undefined : [...REGION_IDS],
        includeUnknownAvailability: !limitToRegions,
      });
      const contextKey = await fingerprintSolveContext(baseRequest);
      const cached = lookupSolvedBar(contextKey);
      const cachedSeeds = seedBarsFromSolveCache(loadout.style, contextKey, sizes.minBarSize);
      if (cached?.bar?.length) {
        // Cache stores full winner score only — do not treat it as exploratory bestScore.
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
        setCacheNote(
          cachedSeeds.length > 1
            ? `Resuming from ${cachedSeeds.length} saved bars`
            : "Resuming from saved bar",
        );
      } else if (cachedSeeds.length > 0) {
        setCacheNote(
          `Seeding ${cachedSeeds.length} saved bar${cachedSeeds.length === 1 ? "" : "s"}`,
        );
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
      // Parallel Web Worker agents (different seeds); sticky main-thread fallback.
      // Each agent runs a full search+finalize; final scoring is still one bar at a time per agent.
      const agents = solverPoolSize();
      setSolverAgents(agents);
      if (agents > 1) {
        setCacheNote((prev) => prev ?? `${agents} parallel search agents…`);
      }
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
        // User cancel: keep best-so-far if we have a bar.
        const partial = latestProgressRef.current;
        if (partial?.topBarPreview?.length) {
          setActiveBarIds([...partial.topBarPreview]);
          setCacheNote("Stopped — kept best bar so far");
        } else {
          setCacheNote("Stopped");
        }
        return;
      }

      applyDto(dto, request, sizes);
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
          setActiveBarIds([...partial.topBarPreview]);
          setCacheNote("Stopped — kept best bar so far");
          // Surface as a minimal result so the UI is not "Done + nothing".
          const exp = partial.bestExploratoryScore ?? partial.bestScore;
          const full = partial.bestFullScore;
          setSolverResult({
            bar: [...partial.topBarPreview],
            // Prefer full when finalize scored; else exploratory preview.
            score: Number.isFinite(full) ? full! : exp,
            windowDpms: 0,
            evaluations: partial.evaluations,
            uniqueCandidates: partial.uniqueCandidates,
            seed: 1,
            profileId: solverProfile,
            tier: solverTier,
            durationTicks: 500,
            proofLabel: "stopped-early",
            ...(Number.isFinite(exp) ? { bestExploratoryScore: exp } : {}),
            ...(Number.isFinite(full) ? { bestFullScore: full } : {}),
          });
        } else {
          setCacheNote("Stopped");
          setSolverError("Search stopped before a bar was found.");
        }
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      // Last-ditch: if search had a best preview, keep it usable.
      if (partial?.topBarPreview?.length) {
        setActiveBarIds([...partial.topBarPreview]);
        const exp = partial.bestExploratoryScore ?? partial.bestScore;
        const full = partial.bestFullScore;
        setSolverResult({
          bar: [...partial.topBarPreview],
          score: Number.isFinite(full) ? full! : exp,
          windowDpms: 0,
          evaluations: partial.evaluations,
          uniqueCandidates: partial.uniqueCandidates,
          seed: 1,
          profileId: solverProfile,
          tier: solverTier,
          durationTicks: 500,
          proofLabel: "heuristic-best-found",
          ...(Number.isFinite(exp) ? { bestExploratoryScore: exp } : {}),
          ...(Number.isFinite(full) ? { bestFullScore: full } : {}),
        });
        setSolverError(`${message} — showing best bar found before the error.`);
      } else {
        setSolverError(message || "Optimize failed.");
      }
    } finally {
      if (gen === solveGenRef.current) {
        setSolving(false);
        setStopping(false);
        setSolveStartedAt(null);
        abortRef.current = null;
      }
    }
  }, [
    stats,
    loadout,
    build,
    solverTier,
    solverProfile,
    maxBarSize,
    modelled,
    applyDto,
    limitToRegions,
  ]);

  const cancelSolve = () => {
    // Do not bump solveGenRef here — the in-flight promise must still hit finally
    // to clear solving/stopping. Bumping is only for starting a newer Optimize.
    cancelRef.current = true;
    abortRef.current?.abort();
    setStopping(true);
    setCacheNote("Stopping — killing workers…");
    // Hard-terminates pool/single workers so finalize mid-sim cannot keep spinning.
    cancelOptimize();
    const partial = latestProgressRef.current;
    if (partial?.topBarPreview?.length) {
      setActiveBarIds([...partial.topBarPreview]);
    }
  };

  const progressFill = solving
    ? Math.min(
        0.995,
        solverProgress?.progressRatio ??
          (solverProgress
            ? // Fallback if a progress event omitted ratio: search share only.
              0.82 *
              Math.min(
                0.98,
                solverProgress.evaluations /
                  Math.max(1, solverProgress.evaluationBudget ?? TIER_BUDGETS[solverTier]),
              )
            : 0.04),
      )
    : solverProgress
      ? 1
      : 0;

  const trackLiveClass = stopping
    ? "revo-solver-track revo-solver-track--live revo-solver-track--stopping"
    : solving && solverProgress?.phase === "finalize"
      ? "revo-solver-track revo-solver-track--live revo-solver-track--finalize"
      : solving
        ? "revo-solver-track revo-solver-track--live"
        : solverProgress
          ? "revo-solver-track revo-solver-track--done"
          : "revo-solver-track";

  const applySolverBar = (ids: readonly string[]) => {
    setActiveBarIds([...ids]);
    setResult(null);
  };

  const contributions = result?.analysis.byEffect ?? [];

  const basicCount = result?.casts.filter((c) => c.auto).length ?? 0;
  const horizonTicks = result?.horizonTicks ?? 0;
  const castLog = result ? (showAllCasts ? result.casts : result.casts.slice(0, 40)) : [];

  return (
    <div className="revolution-panel">
      <section className="revo-solver-controls mb-3 border border-stone-750 bg-stone-850/40 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => void optimize()}
            disabled={solving}
            className="combat-button revo-run-button border border-gem-400 bg-stone-850 px-3 py-1.5 text-xs text-gem-300 hover:bg-stone-800 disabled:opacity-50"
            data-testid="revo-optimize"
          >
            {solving ? "Optimizing…" : "Optimize bar"}
          </button>
          {solving ? (
            <button
              type="button"
              onClick={cancelSolve}
              className="combat-button border border-stone-750 bg-transparent px-3 py-1.5 text-xs text-parch-300"
            >
              Cancel
            </button>
          ) : null}
          <label className="flex items-center gap-1 text-parch-300">
            Depth
            <select
              value={solverTier}
              onChange={(e) => setSolverTier(e.target.value as SolverSearchTier)}
              className="border border-stone-750 bg-transparent px-2 py-1 text-parch-50"
              disabled={solving}
            >
              <option value="thorough">
                Thorough (~{TIER_HORIZON_SECONDS.thorough.fullSeconds}s full)
              </option>
              <option value="extreme">
                Extreme (~{TIER_HORIZON_SECONDS.extreme.fullSeconds}s full)
              </option>
              <option value="unhinged">
                Unhinged (~{TIER_HORIZON_SECONDS.unhinged.fullSeconds}s full)
              </option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-parch-300">
            Objective
            <select
              value={solverProfile}
              onChange={(e) => setSolverProfile(e.target.value as ObjectiveProfileId)}
              className="border border-stone-750 bg-transparent px-2 py-1 text-parch-50"
              disabled={solving}
            >
              <option value="balanced">Balanced</option>
              <option value="burst">Burst</option>
              <option value="sustained">Sustained</option>
            </select>
          </label>
          <label
            className="flex items-center gap-1 text-parch-300"
            title={`Search floor ${MIN_SOLVER_BAR_SIZE} slots — shorter bars are skipped (degen 4–5 ok)`}
          >
            Max slots
            <input
              type="number"
              min={MIN_SOLVER_BAR_SIZE}
              max={14}
              value={maxBarSize}
              onChange={(e) =>
                setMaxBarSize(
                  clampSolverBarSizes(MIN_SOLVER_BAR_SIZE, Number(e.target.value) || 10).maxBarSize,
                )
              }
              className="w-14 border border-stone-750 bg-transparent px-2 py-1 font-mono text-parch-50"
              disabled={solving}
            />
          </label>
          <span className="text-parch-300" title={regions.join(", ") || "No picks"}>
            Regions · {regions.length}
          </span>
          <label
            className="flex items-center gap-1.5 text-parch-300"
            title={
              limitToRegions
                ? "Only abilities obtainable with your Build region picks"
                : "Use abilities from every region (ignores Build picks for the pool)"
            }
          >
            <input
              type="checkbox"
              checked={limitToRegions}
              onChange={(e) => setLimitToRegions(e.target.checked)}
              disabled={solving}
              className="accent-[var(--combat-gem)]"
              data-testid="revo-limit-regions"
            />
            Limit to picks
          </label>
        </div>
        {(solving || solverProgress) && (
          <div
            className={`revo-solver-status${stopping ? " is-stopping" : ""}${
              solverProgress?.phase === "finalize" && solving ? " is-scoring" : ""
            }`}
            data-testid="revo-solver-progress"
            data-evals={solverProgress?.evaluations ?? 0}
            data-phase={
              stopping ? "stopping" : (solverProgress?.phase ?? (solving ? "seed" : "idle"))
            }
            data-finalize-step={solverProgress?.finalizeStep ?? ""}
            data-finalize-total={solverProgress?.finalizeTotal ?? ""}
            role="status"
            aria-live="polite"
            aria-busy={solving}
          >
            <div className="revo-solver-status__head">
              <span className="revo-solver-status__phase">
                {solving
                  ? solverPhaseLabel(solverProgress?.phase, {
                      stopping,
                      scoringLabel: solverProgress?.scoringLabel,
                    })
                  : solverResult
                    ? "Done"
                    : solverError
                      ? "Failed"
                      : cacheNote?.startsWith("Stopped") || cacheNote?.startsWith("Stopping")
                        ? "Stopped"
                        : "Done"}
                {solving || stopping ? (
                  <>
                    <span className="revo-solver-status__dot" aria-hidden>
                      ·
                    </span>
                    <span className="revo-solver-status__timer font-mono" data-testid="revo-solver-elapsed">
                      {formatElapsed(elapsedMs)}
                    </span>
                  </>
                ) : null}
              </span>
              <span className="revo-solver-status__meta font-mono">
                {solverProgress ? (
                  <>
                    {solverProgress.phase === "finalize" &&
                    solverProgress.finalizeTotal != null &&
                    solverProgress.finalizeTotal > 0 ? (
                      <>
                        bar{" "}
                        {formatNumber(
                          Math.min(
                            (solverProgress.finalizeStep ?? 0) +
                              (solverProgress.finalizeStep != null &&
                              solverProgress.finalizeStep < solverProgress.finalizeTotal
                                ? 1
                                : 0),
                            solverProgress.finalizeTotal,
                          ),
                        )}
                        /{formatNumber(solverProgress.finalizeTotal)} full
                        <span className="revo-solver-status__dot" aria-hidden>
                          ·
                        </span>
                        {formatNumber(solverProgress.fullEvaluations ?? solverProgress.evaluations)}{" "}
                        full evals
                      </>
                    ) : (
                      <>
                        {formatNumber(solverProgress.evaluations)}
                        {solverProgress.evaluationBudget
                          ? ` / ${formatNumber(solverProgress.evaluationBudget)}`
                          : ""}{" "}
                        evals
                        {(solverProgress.agentCount ?? solverAgents) > 1 ? (
                          <>
                            <span className="revo-solver-status__dot" aria-hidden>
                              ·
                            </span>
                            {solverProgress.agentCount ?? solverAgents} agents
                          </>
                        ) : null}
                      </>
                    )}
                    <span className="revo-solver-status__dot" aria-hidden>
                      ·
                    </span>
                    <span
                      className={
                        bestPulse ? "revo-solver-status__best is-pulse" : "revo-solver-status__best"
                      }
                    >
                      {Number.isFinite(solverProgress.bestFullScore) ? (
                        <>
                          search{" "}
                          {formatNumber(
                            solverProgress.bestExploratoryScore ?? solverProgress.bestScore,
                          )}{" "}
                          · full {formatNumber(solverProgress.bestFullScore!)}
                        </>
                      ) : (
                        <>
                          best{" "}
                          {formatNumber(
                            solverProgress.bestExploratoryScore ?? solverProgress.bestScore,
                          )}
                        </>
                      )}
                    </span>
                    {solverProgress.uniqueCandidates > 0 ? (
                      <>
                        <span className="revo-solver-status__dot" aria-hidden>
                          ·
                        </span>
                        {formatNumber(solverProgress.uniqueCandidates)} unique
                      </>
                    ) : null}
                  </>
                ) : (
                  <span>warming search…</span>
                )}
              </span>
            </div>
            <div
              className={trackLiveClass}
              style={{ ["--fill" as string]: String(progressFill) }}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressFill * 100)}
            >
              <div className="revo-solver-track__rail" aria-hidden />
              <div className="revo-solver-track__fill">
                <span className="revo-solver-track__sheen" aria-hidden />
                <span className="revo-solver-track__tip" aria-hidden />
              </div>
            </div>
            {solverProgress?.phase === "finalize" &&
            solverProgress.finalizeTotal != null &&
            solverProgress.finalizeTotal > 0 ? (
              <div
                className="revo-solver-score-steps"
                role="list"
                aria-label="Full-horizon shortlist scoring"
              >
                {Array.from({ length: solverProgress.finalizeTotal }, (_, i) => {
                  const done = solverProgress.finalizeStep ?? 0;
                  const active = solving && !stopping && i === done && done < solverProgress.finalizeTotal!;
                  const complete = i < done;
                  return (
                    <span
                      key={i}
                      role="listitem"
                      className={`revo-solver-score-step${complete ? " is-done" : ""}${
                        active ? " is-active" : ""
                      }`}
                      title={
                        complete
                          ? `Shortlist bar ${i + 1} scored`
                          : active
                            ? `Scoring shortlist bar ${i + 1} now (full horizon)`
                            : `Shortlist bar ${i + 1} waiting`
                      }
                    >
                      {i + 1}
                    </span>
                  );
                })}
              </div>
            ) : null}
            {solverProgress?.phase === "finalize" &&
            solverProgress.scoringBarPreview?.length &&
            solving ? (
              <div
                className="revo-solver-preview revo-solver-preview--scoring"
                role="list"
                aria-label="Bar being full-scored now"
              >
                {solverProgress.scoringBarPreview.map((id, index) => {
                  const spec = ENGINE_SPECS.get(id);
                  return (
                    <div
                      key={`score-${id}-${index}`}
                      role="listitem"
                      title={spec?.name ?? id}
                      data-category={previewCategory(spec?.category)}
                      className="revo-solver-preview__slot"
                    >
                      {spec ? (
                        <GameIcon
                          src={abilityIconPath(spec.id, spec.style)}
                          size={22}
                          className="revo-solver-preview__icon"
                        />
                      ) : (
                        <span className="revo-solver-preview__empty" aria-hidden />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : solverProgress?.topBarPreview?.length ? (
              <div className="revo-solver-preview" role="list" aria-label="Best bar so far">
                {solverProgress.topBarPreview.map((id, index) => {
                  const spec = ENGINE_SPECS.get(id);
                  return (
                    <div
                      key={`${id}-${index}`}
                      role="listitem"
                      title={spec?.name ?? id}
                      data-category={previewCategory(spec?.category)}
                      className="revo-solver-preview__slot"
                    >
                      {spec ? (
                        <GameIcon
                          src={abilityIconPath(spec.id, spec.style)}
                          size={22}
                          className="revo-solver-preview__icon"
                        />
                      ) : (
                        <span className="revo-solver-preview__empty" aria-hidden />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
            <p className="revo-solver-status__hint">
              {scoringHint(
                solverProgress,
                solverProgress?.agentCount ?? solverAgents,
                stopping,
                solverTier,
              )}
            </p>
            {cacheNote ? <p className="revo-solver-status__hint">{cacheNote}</p> : null}
          </div>
        )}
        {solverError ? <p className="mt-2 text-xs text-chaos-300">{solverError}</p> : null}
        {solverResult ? (
          <div className="mt-3 border-t border-stone-750 pt-2" data-testid="revo-solver-results">
            <p className="text-xs text-parch-300">
              Score {formatNumber(solverResult.score)} ·{" "}
              {solverResult.proofLabel ?? "heuristic-best-found"} · {solverResult.evaluations} evals
              {solverResult.openingDpm != null
                ? ` · open ${formatNumber(solverResult.openingDpm)} / mid ${formatNumber(solverResult.developedDpm ?? 0)} / steady ${formatNumber(solverResult.steadyDpm ?? 0)}`
                : ""}
            </p>
            <ul className="mt-2 space-y-1">
              {(solverResult.top ?? [{ bar: solverResult.bar, score: solverResult.score }]).map(
                (row, i) => (
                  <li
                    key={`${row.fingerprint ?? i}-${row.score}`}
                    className="flex flex-wrap items-center gap-2 text-xs"
                  >
                    <span className="font-mono text-parch-50">
                      #{i + 1} {formatNumber(row.score)}
                    </span>
                    <span className="truncate text-parch-300">
                      {row.bar.map((id) => ENGINE_SPECS.get(id)?.name ?? id).join(" → ")}
                    </span>
                    <button
                      type="button"
                      className="border border-stone-750 px-2 py-0.5 text-parch-50 hover:bg-stone-800"
                      onClick={() => applySolverBar(row.bar)}
                    >
                      Apply
                    </button>
                  </li>
                ),
              )}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="revo-toolbar flex flex-wrap items-center gap-2 text-xs">
        <span className="text-parch-300" data-testid="revo-reference-bar">
          {activeBarIds ? (
            <>Solved bar · {modelled.length} abilities</>
          ) : bar ? (
            <>
              <span className="text-parch-50">{barOptionLabel(bar)}</span>
              <span className="revo-solver-status__dot" aria-hidden>
                ·
              </span>
              from Setup
              <span className="revo-solver-status__dot" aria-hidden>
                ·
              </span>
              {modelled.length} of {managedSlots.length} modelled
              {unmodelled.length > 0 ? ` · ${unmodelled.length} skipped` : ""}
              {keybindCount > 0
                ? ` · ${keybindCount} keybind${keybindCount === 1 ? "" : "s"}`
                : ""}
            </>
          ) : (
            "No reference bar for this loadout"
          )}
        </span>
      </div>

      <BarGraphic slots={slots} revoSize={revoSize} />

      <div className="revo-run-controls">
        <label className="revo-duration-field">
          <span>Duration</span>
          <input
            type="number"
            value={durationSeconds}
            min={6}
            step={1}
            onChange={(event) => setDurationSeconds(Number(event.target.value))}
            className="border border-stone-750 bg-transparent px-2 py-1 font-mono text-xs text-parch-50"
          />
          <span>s</span>
        </label>
        <p className="revo-horizon-plan" data-testid="revo-horizon-plan">
          {plannedTicks > 0 ? `${plannedTicks} ticks` : "—"}
        </p>
        <button
          type="button"
          onClick={run}
          className="combat-button revo-run-button border border-stone-750 bg-stone-850 px-3 py-1.5 text-xs text-parch-50 hover:bg-stone-800"
        >
          Run bar
        </button>
      </div>

      {result && !result.ok ? <p className="mt-3 text-xs text-chaos-300">{result.error}</p> : null}

      {!result ? (
        <p
          className="mt-4 border-t border-stone-750 pt-3 text-xs text-parch-300"
          data-testid="revo-empty"
        >
          Run the bar to score expected damage over the duration.
        </p>
      ) : null}

      {result?.ok ? (
        <div className="mt-4">
          <dl className="revo-stat-strip grid grid-cols-2 gap-x-6 border-t border-stone-750 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <div className="border-b border-stone-750/70 py-2">
              <dt className="text-xs text-parch-300">Ticks</dt>
              <dd className="font-mono text-parch-50" data-testid="revo-horizon">
                {horizonTicks > 0 ? horizonTicks : "—"}
              </dd>
            </div>
            <div className="border-b border-stone-750/70 py-2">
              <dt className="text-xs text-parch-300">Abilities</dt>
              <dd className="font-mono text-parch-50" data-testid="revo-casts">
                {result.casts.length}
                <span className="text-parch-300"> · {basicCount} basic</span>
              </dd>
            </div>
            <div className="border-b border-stone-750/70 py-2">
              <dt className="text-xs text-parch-300">Damage</dt>
              <dd className="font-mono text-parch-50">{formatNumber(result.totalExpected)}</dd>
            </div>
            <div className="border-b border-stone-750/70 py-2">
              <dt className="text-xs text-parch-300">Fixed-window DPS</dt>
              <dd className="font-mono text-parch-50">{formatNumber(result.dps)}</dd>
            </div>
            <div className="border-b border-stone-750/70 py-2">
              <dt className="text-xs text-parch-300">Min – max</dt>
              <dd className="font-mono text-parch-50">
                {formatNumber(result.totalMin)} – {formatNumber(result.totalMax)}
              </dd>
            </div>
            <div className="border-b border-stone-750/70 py-2">
              <dt className="text-xs text-parch-300">Last GCD</dt>
              <dd className="font-mono text-parch-50">
                t{result.casts[result.casts.length - 1]?.tick ?? 0} ·{" "}
                {formatTime(result.casts[result.casts.length - 1]?.tick ?? 0)}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setAnalysisOpen(true)}
              className="combat-button border border-gem-400 bg-stone-850 px-3 py-1.5 text-xs text-gem-300 hover:bg-stone-800"
            >
              Analyze damage
            </button>
          </div>

          <CalculationAssumptions stats={stats} result={result} />

          <section className="revo-section revo-timeline">
            <h3 className="combat-section-title text-xs font-medium text-parch-50">Timeline</h3>
            <div
              className="mt-2 max-h-80 overflow-y-auto border-t border-stone-750"
              data-testid="revo-cast-timeline"
            >
              <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-stone-900 text-parch-300">
                  <tr className="border-b border-stone-750">
                    <th className="py-1.5 pr-2 font-medium">#</th>
                    <th className="py-1.5 pr-2 font-medium">Tick</th>
                    <th className="py-1.5 pr-2 font-medium">Time</th>
                    <th className="py-1.5 pr-2 font-medium">Ability</th>
                    <th className="py-1.5 pr-2 font-medium">Adren</th>
                    <th className="py-1.5 font-medium">Damage</th>
                  </tr>
                </thead>
                <tbody>
                  {castLog.map((cast, index) => (
                    <tr
                      key={`${cast.tick}-${cast.abilityId}-${index}`}
                      className={
                        cast.auto
                          ? "border-b border-stone-750/70 bg-stone-zebra/80"
                          : "border-b border-stone-750/70"
                      }
                      data-basic={cast.auto ? "true" : undefined}
                    >
                      <td className="py-1 pr-2 font-mono text-parch-300">{index + 1}</td>
                      <td className="py-1 pr-2 font-mono text-parch-50">{cast.tick}</td>
                      <td className="py-1 pr-2 font-mono text-parch-300">
                        {formatTime(cast.tick)}
                      </td>
                      <td className="py-1 pr-2 text-parch-50">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          {(() => {
                            const spec = ENGINE_SPECS.get(cast.abilityId);
                            return (
                              <>
                                {spec ? (
                                  <GameIcon
                                    src={abilityIconPath(spec.id, spec.style)}
                                    size={16}
                                    className="shrink-0"
                                  />
                                ) : null}
                                <span className="min-w-0 truncate">
                                  {nameById.get(cast.abilityId) ?? cast.abilityId}
                                </span>
                                {castCritLabel(cast.result) ? (
                                  <span
                                    className={
                                      castCritLabel(cast.result) === "Crit"
                                        ? "rotation-crit"
                                        : "text-parch-300"
                                    }
                                  >
                                    {castCritLabel(cast.result)}
                                  </span>
                                ) : null}
                                {spec ? (
                                  <AbilityCategoryChip category={spec.category} />
                                ) : cast.auto ? (
                                  <AbilityCategoryChip category="basic" />
                                ) : null}
                              </>
                            );
                          })()}
                        </span>
                      </td>
                      <td className="py-1 pr-2 font-mono text-parch-300">
                        {typeof cast.adrenalineAfter === "number"
                          ? `${Math.round(cast.adrenalineAfter * 10) / 10}%`
                          : `${cast.adrenalineAfter}%`}
                      </td>
                      <td className="py-1 font-mono text-parch-50">
                        {formatNumber(cast.result.expected)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.casts.length > 40 ? (
              <button
                type="button"
                onClick={() => setShowAllCasts((v) => !v)}
                className="mt-2 text-xs text-parch-300 underline decoration-stone-750 underline-offset-2 hover:text-parch-50"
              >
                {showAllCasts ? "Show first 40 casts" : `Show all ${result.casts.length} casts`}
              </button>
            ) : null}
          </section>

          <section className="revo-section revo-damage">
            <h3 className="combat-section-title text-xs font-medium text-parch-50">
              Ability damage
            </h3>
            <div className="revo-contributions mt-2 border-t border-stone-750">
              {contributions.map((row) => (
                <div
                  key={row.id}
                  className="revo-contribution-row grid grid-cols-[1fr_auto_auto] gap-4 border-b border-stone-750/70 py-2 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-2 text-parch-50">
                    {(() => {
                      const spec = ENGINE_SPECS.get(row.id);
                      return spec ? (
                        <GameIcon src={abilityIconPath(spec.id, spec.style)} size={18} />
                      ) : null;
                    })()}
                    <span className="truncate">
                      {nameById.get(row.id) ?? row.id}
                      <span
                        className="ml-1.5 font-mono text-parch-300"
                        title="Probability-weighted number of times the effect occurs"
                      >
                        ×{formatCount(row.expectedActivations)}
                      </span>
                    </span>
                  </span>
                  <span className="font-mono text-parch-300">{formatNumber(row.totalDamage)}</span>
                  <span className="font-mono text-parch-50">
                    {Math.round(row.share * 1000) / 10}%
                  </span>
                </div>
              ))}
            </div>
          </section>
          <RotationEventPreview result={result} nameForId={(id) => nameById.get(id) ?? id} />
        </div>
      ) : null}
      {result?.ok ? (
        <RotationAnalysisModal
          open={analysisOpen}
          result={result}
          stats={stats}
          nameForId={(id) => nameById.get(id) ?? id}
          onClose={() => setAnalysisOpen(false)}
        />
      ) : null}
    </div>
  );
}
