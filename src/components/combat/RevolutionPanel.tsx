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
  TIER_BUDGETS,
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
import { DEFAULT_LOADOUT, useLoadout } from "./useLoadout";
import { useBuild } from "@/league/useBuild";
import { unlockedRegions } from "@/league";
import "./revo-solver.css";

function solverPhaseLabel(phase: SolverProgress["phase"] | undefined): string {
  switch (phase) {
    case "seed":
      return "Seeding bars";
    case "explore":
      return "Exploring bars";
    case "exploit":
      return "Refining best";
    case "finalize":
      return "Final scoring";
    case "paused":
      return "Paused";
    default:
      return "Searching";
  }
}

function previewCategory(
  category: AbilitySpec["category"] | undefined,
): "basic" | "threshold" | "ultimate" | "utility" | undefined {
  if (category === "enhanced") return "threshold";
  if (category === "basic" || category === "ultimate" || category === "utility") return category;
  return undefined;
}

type RevoBarView = RevolutionBarRecord;

const STYLE_ORDER = ["melee", "ranged", "magic", "necromancy"] as const;
const STYLE_LABEL: Record<(typeof STYLE_ORDER)[number], string> = {
  melee: "Melee",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
};

/** Single-target only — multi-target bars are not shipped in the app. */
const SUPPORTED_BARS = combatRevolutionBars.records.filter(
  (bar) => bar.supported && (bar.target == null || bar.target === "single"),
) as RevoBarView[];
const UNSUPPORTED_BARS = combatRevolutionBars.records.filter(
  (bar) => !bar.supported && (bar.target == null || bar.target === "single"),
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
  if (style in STYLE_LABEL) return STYLE_LABEL[style as keyof typeof STYLE_LABEL];
  return style.charAt(0).toUpperCase() + style.slice(1);
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

/** First supported ST bar for a combat style — prefer revo++ over basics. */
function pickBarForStyle(style: string): RevoBarView | undefined {
  const forStyle = SUPPORTED_BARS.filter((b) => b.style === style);
  return forStyle.find((b) => b.mode === "revo++") ?? forStyle[0];
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
  const [barId, setBarId] = useState(
    () => pickBarForStyle(DEFAULT_LOADOUT.style)?.id ?? SUPPORTED_BARS[0]?.id ?? "",
  );
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [result, setResult] = useState<RotationSummary | null>(null);
  const [showAllCasts, setShowAllCasts] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const [solverTier, setSolverTier] = useState<SolverSearchTier>("thorough");
  const [solverProfile, setSolverProfile] = useState<ObjectiveProfileId>("balanced");
  const [maxBarSize, setMaxBarSize] = useState(10);
  const [cacheNote, setCacheNote] = useState<string | null>(null);
  const [solving, setSolving] = useState(false);
  const [solverProgress, setSolverProgress] = useState<SolverProgress | null>(null);
  const [solverResult, setSolverResult] = useState<SolverResultDTO | null>(null);
  const [solverError, setSolverError] = useState<string | null>(null);
  const [activeBarIds, setActiveBarIds] = useState<string[] | null>(null);
  const [bestPulse, setBestPulse] = useState(false);
  const cancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastBestRef = useRef(0);

  const bar: RevoBarView | undefined =
    SUPPORTED_BARS.find((candidate) => candidate.id === barId) ??
    pickBarForStyle(loadout.style) ??
    SUPPORTED_BARS[0];
  const styleMismatch = Boolean(bar && bar.style !== loadout.style);

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

  // Setup style owns the default bar; manual cross-style picks stay until Setup changes.
  useEffect(() => {
    const current = SUPPORTED_BARS.find((candidate) => candidate.id === barId);
    if (current?.style === loadout.style) return;
    const next = pickBarForStyle(loadout.style);
    if (!next || next.id === barId) return;
    setBarId(next.id);
    setResult(null);
    setShowAllCasts(false);
    // barId intentionally omitted: only react to Setup style changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to Setup style
  }, [loadout.style]);

  // Cancel in-flight worker solve if the panel unmounts mid-run.
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      abortRef.current?.abort();
      cancelOptimize();
    };
  }, []);

  const selectBar = (id: string) => {
    setBarId(id);
    setActiveBarIds(null);
    setResult(null);
    setShowAllCasts(false);
    setAnalysisOpen(false);
  };

  const simStyle = (solvedSlots ? loadout.style : bar?.style) ?? loadout.style;

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
        abilities: [...ENGINE_SPECS.values(), ...modelled],
        bar: modelled,
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

  const optimize = useCallback(async () => {
    cancelRef.current = false;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    lastBestRef.current = 0;
    setSolving(true);
    setSolverError(null);
    setSolverResult(null);
    setBestPulse(false);
    setCacheNote(null);
    const sizes = clampSolverBarSizes(MIN_SOLVER_BAR_SIZE, maxBarSize);
    // Immediate progress plate so the UI never looks dead while the first eval runs.
    setSolverProgress({
      phase: "seed",
      evaluations: 0,
      uniqueCandidates: 0,
      bestScore: 0,
      windowDpms: 0,
      topBarPreview: [],
      noImprovementCount: 0,
      evaluationBudget: TIER_BUDGETS[solverTier],
      progressRatio: 0.02,
    });
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
        exploreSeconds: 30,
        durationSeconds: 300,
        userBar: modelled.map((m) => m.id),
        seed: 1,
      });
      const contextKey = fingerprintSolveContext(baseRequest);
      const cached = lookupSolvedBar(contextKey);
      const cachedSeeds = seedBarsFromSolveCache(loadout.style, contextKey, sizes.minBarSize);
      if (cached?.bar?.length) {
        lastBestRef.current = cached.score;
        setSolverProgress({
          phase: "seed",
          evaluations: 0,
          uniqueCandidates: cached.top?.length ?? 1,
          bestScore: Number.isFinite(cached.score) ? cached.score : 0,
          windowDpms: Number.isFinite(cached.score) ? cached.score : 0,
          topBarPreview: [...cached.bar],
          noImprovementCount: 0,
          evaluationBudget: TIER_BUDGETS[solverTier],
          progressRatio: 0.08,
        });
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
      // Worker-first: sims run off the UI thread. Main-thread fallback only if
      // Worker construct/load fails (sticky for the tab session).
      const dto = await runOptimize(
        request,
        (progress) => {
          if (cancelRef.current || abort.signal.aborted) return;
          if (progress.bestScore > lastBestRef.current + 1e-6) {
            lastBestRef.current = progress.bestScore;
            setBestPulse(true);
            window.setTimeout(() => setBestPulse(false), 450);
          }
          setSolverProgress({ ...progress });
        },
        {
          isCancelled: () => cancelRef.current || abort.signal.aborted,
          signal: abort.signal,
        },
      );
      if (cancelRef.current || abort.signal.aborted) return;

      const bar = dto.bar?.length ? [...dto.bar] : [];
      if (bar.length === 0) {
        setSolverError(
          `Search finished without a legal bar (${sizes.minBarSize}–${sizes.maxBarSize} slots). Try more max slots or a different style.`,
        );
        setSolverResult(dto);
      } else {
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
        bestScore: Number.isFinite(dto.score) ? dto.score : 0,
        windowDpms: Number.isFinite(dto.score) ? dto.score : 0,
        topBarPreview: bar,
        noImprovementCount: 0,
        evaluationBudget: TIER_BUDGETS[solverTier],
        progressRatio: 1,
      });
    } catch (err) {
      if (cancelRef.current || abort.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : String(err);
      setSolverError(message === "solver cancelled" ? null : message);
    } finally {
      setSolving(false);
      abortRef.current = null;
    }
  }, [stats, loadout, build, solverTier, solverProfile, maxBarSize, modelled]);

  const cancelSolve = () => {
    cancelRef.current = true;
    abortRef.current?.abort();
    cancelOptimize();
    setSolving(false);
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

  const trackLiveClass =
    solving && solverProgress?.phase === "finalize"
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
              <option value="thorough">Thorough</option>
              <option value="extreme">Extreme</option>
              <option value="unhinged">Unhinged</option>
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
            title={`Search floor ${MIN_SOLVER_BAR_SIZE} slots — shorter bars are skipped`}
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
          <span className="text-parch-300" title={regions.join(", ")}>
            Regions · {regions.length}
          </span>
        </div>
        {(solving || solverProgress) && (
          <div
            className="revo-solver-status"
            data-testid="revo-solver-progress"
            data-evals={solverProgress?.evaluations ?? 0}
            data-phase={solverProgress?.phase ?? (solving ? "seed" : "idle")}
            role="status"
            aria-live="polite"
            aria-busy={solving}
          >
            <div className="revo-solver-status__head">
              <span className="revo-solver-status__phase">
                {solving ? solverPhaseLabel(solverProgress?.phase) : "Done"}
              </span>
              <span className="revo-solver-status__meta font-mono">
                {solverProgress ? (
                  <>
                    {solverProgress.phase === "finalize" &&
                    solverProgress.finalizeTotal != null &&
                    solverProgress.finalizeTotal > 0 ? (
                      <>
                        scoring{" "}
                        {formatNumber(
                          Math.min(solverProgress.finalizeStep ?? 0, solverProgress.finalizeTotal),
                        )}
                        /{formatNumber(solverProgress.finalizeTotal)}
                        <span className="revo-solver-status__dot" aria-hidden>
                          ·
                        </span>
                        {formatNumber(solverProgress.evaluations)} evals
                      </>
                    ) : (
                      <>
                        {formatNumber(solverProgress.evaluations)}
                        {solverProgress.evaluationBudget
                          ? ` / ${formatNumber(solverProgress.evaluationBudget)}`
                          : ""}{" "}
                        evals
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
                      best {formatNumber(solverProgress.bestScore)}
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
            {solverProgress?.topBarPreview?.length ? (
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
            ) : solving ? (
              <p className="revo-solver-status__hint">
                Searching legal bars ({MIN_SOLVER_BAR_SIZE}+ slots) for this loadout and region
                pick…
              </p>
            ) : null}
            {cacheNote ? <p className="revo-solver-status__hint">{cacheNote}</p> : null}
          </div>
        )}
        {solverError ? <p className="mt-2 text-xs text-chaos-300">{solverError}</p> : null}
        {solverResult ? (
          <div className="mt-3 border-t border-stone-750 pt-2" data-testid="revo-solver-results">
            <p className="text-xs text-parch-300">
              Score {formatNumber(solverResult.score)} · {solverResult.proofLabel ?? "best-found"} ·{" "}
              {solverResult.evaluations} evals
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
        <label className="flex items-center gap-1 text-parch-300">
          Reference bar
          <select
            value={bar?.id ?? ""}
            onChange={(event) => selectBar(event.target.value)}
            className="border border-stone-750 bg-transparent px-2 py-1 text-parch-50"
          >
            {STYLE_ORDER.map((style) => {
              const supported = SUPPORTED_BARS.filter((b) => b.style === style);
              const unsupported = UNSUPPORTED_BARS.filter((b) => b.style === style);
              if (supported.length === 0 && unsupported.length === 0) return null;
              return (
                <optgroup key={style} label={STYLE_LABEL[style]}>
                  {supported.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {barOptionLabel(candidate)}
                    </option>
                  ))}
                  {unsupported.map((candidate) => (
                    <option key={candidate.id} value={candidate.id} disabled>
                      {barOptionLabel(candidate)} — not in sim
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        <span className="text-parch-300">
          {activeBarIds
            ? `Solved bar · ${modelled.length} abilities`
            : `${modelled.length} of ${managedSlots.length} slots modelled`}
          {!activeBarIds && unmodelled.length > 0 ? ` · ${unmodelled.length} skipped` : ""}
          {!activeBarIds && keybindCount > 0
            ? ` · ${keybindCount} keybind${keybindCount === 1 ? "" : "s"}`
            : ""}
        </span>
      </div>

      {styleMismatch && bar && !activeBarIds ? (
        <p className="mt-2 text-xs text-chaos-300">
          Loadout is {loadout.style}; this bar is {bar.style}. Accuracy and crit may be off.
        </p>
      ) : null}

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
