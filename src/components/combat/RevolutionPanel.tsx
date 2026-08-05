"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveBar, type ResolvedSlot } from "@/combat/data/specs";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { secondsToTicks } from "@/combat/core/ticks";
import { engineSpecs as ENGINE_SPECS, entryByEngineId } from "@/combat/abilities/registry";
import { resolveAbilityCatalogue } from "@/combat/abilities/catalogue";
import {
  buildSimulationInputBase,
  resolveRevolutionBar,
  toRevolutionInput,
} from "@/combat/model";
import { preferredAgentCount, simulateRevolutionForUi } from "@/combat/solver";
import type { CalcStats } from "./loadoutStats";
import { resolveLoadoutCombat } from "./toResolvedCombatModel";
import { uiRunFingerprint } from "./uiSimFingerprint";
import { isBarAlreadySaved, type RevoBarEntry } from "./revoBarLibrary";
import type { Loadout } from "./useLoadout";
import { useBuild as useLeagueBuild } from "@/league/useBuild";
import { unlockedRegions } from "@/league";
import type { ResolvedCombatModel } from "@/combat/model";
import {
  barOptionLabel,
  pickBarForLoadout,
  revoManagedModelled,
  SUPPORTED_BARS,
  type RevoBarView,
} from "./revoBarResolve";
import { maySaveVerified } from "./revoPanelFormat";
import { RevoBarGraphic } from "./RevoBarGraphic";
import { RevoBarLibraryPanel } from "./RevoBarLibraryPanel";
import { RevoSolverSection } from "./RevoSolverSection";
import { RevoRunResults, type BranchFidelityMeta } from "./RevoRunResults";
import { useRevolutionSolver } from "./useRevolutionSolver";
import "./revo-solver.css";

const DEFAULT_DURATION_SECONDS = 60;
/** Hard cap for manual Run bar horizon (seconds). */
export const MAX_RUN_DURATION_SECONDS = 1000;
const MIN_RUN_DURATION_SECONDS = 6;

function clampRunDurationSeconds(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_DURATION_SECONDS;
  return Math.min(
    MAX_RUN_DURATION_SECONDS,
    Math.max(MIN_RUN_DURATION_SECONDS, Math.floor(raw)),
  );
}

/** Revolution mode: solver-first bar search; wiki bars as seeds/references. */
export function RevolutionPanel({
  stats,
  loadout,
  combatModel: combatModelProp,
  useBuild: _useLoadoutBuild = true,
}: {
  stats: CalcStats;
  loadout: Loadout;
  /**
   * Run-aligned combat model (full loadout or hybrid manual).
   * Parent must pass the same model used for Optimize packing.
   */
  combatModel?: ResolvedCombatModel;
  /** UI chrome only; model already encodes use-build vs hybrid. */
  useBuild?: boolean;
}) {
  const { build } = useLeagueBuild();
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [result, setResult] = useState<RotationSummary | null>(null);
  /** Live-cap / adaptive fidelity meta from Run; separate from RotationSummary. */
  const [branchFidelityMeta, setBranchFidelityMeta] = useState<BranchFidelityMeta | null>(
    null,
  );
  const [showAllCasts, setShowAllCasts] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [activeBarIds, setActiveBarIds] = useState<string[] | null>(null);

  const onActiveBar = useCallback((ids: string[] | null) => setActiveBarIds(ids), []);
  const onClearSimResult = useCallback(() => {
    setResult(null);
    setBranchFidelityMeta(null);
  }, []);

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

  const weaponConfiguration = stats.weaponConfiguration;
  const slots = useMemo(
    () =>
      solvedSlots ??
      (bar ? resolveBar(bar, ENGINE_SPECS, weaponConfiguration) : []),
    [solvedSlots, bar, weaponConfiguration],
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
    return bar ? revoManagedModelled(bar, weaponConfiguration) : [];
  }, [solvedSlots, bar, weaponConfiguration]);
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

  const plannedTicks = secondsToTicks(clampRunDurationSeconds(durationSeconds));

  const equipKey = `${loadout.style}|${stats.weaponConfiguration}`;
  const prevEquipKey = useRef(equipKey);
  const barIdsForKey = useMemo(
    () => (activeBarIds?.length ? activeBarIds : modelled.map((a) => a.id)),
    [activeBarIds, modelled],
  );
  /**
   * Parent should pass run-aligned model (full loadout or hybrid manual).
   * Fallback: full loadout resolve (tests / isolated mount).
   */
  const combatModel = useMemo(() => {
    if (combatModelProp) return combatModelProp;
    return resolveLoadoutCombat(loadout, {
      blessingPicks: build.blessingPicks,
      relics: Object.values(build.relics).filter(Boolean),
      unlockedRegions: regions,
    }).model;
  }, [combatModelProp, loadout, build, regions]);

  const runKey = useMemo(
    () =>
      uiRunFingerprint({
        mode: "revolution",
        stats,
        combatModel,
        barIds: barIdsForKey,
        durationSeconds: clampRunDurationSeconds(durationSeconds),
        style: loadout.style,
      }),
    [stats, combatModel, barIdsForKey, durationSeconds, loadout.style],
  );
  const [resultKey, setResultKey] = useState<string | null>(null);
  const liveResult = result != null && resultKey === runKey ? result : null;

  // Solver always packs the same combatModel as Run (use-build or hybrid).
  const solver = useRevolutionSolver({
    stats,
    loadout,
    combatModel,
    build,
    modelled,
    onActiveBar,
    onClearSimResult,
  });

  useEffect(() => {
    if (prevEquipKey.current === equipKey) return;
    prevEquipKey.current = equipKey;
    setActiveBarIds(null);
    setResult(null);
    setBranchFidelityMeta(null);
    setResultKey(null);
    setShowAllCasts(false);
    setAnalysisOpen(false);
    solver.clearSolverUi();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only equip shape; clearSolverUi is stable
  }, [equipKey]);

  useEffect(() => {
    if (result != null && resultKey !== runKey) {
      setShowAllCasts(false);
      setAnalysisOpen(false);
    }
  }, [result, resultKey, runKey]);

  const simStyle = loadout.style;

  const run = () => {
    if (modelled.length === 0) return;
    const durationTicks = secondsToTicks(clampRunDurationSeconds(durationSeconds));
    setShowAllCasts(false);
    setAnalysisOpen(false);
    // Cape from model (same freeze as sim base / solver pack).
    const catalogue = resolveAbilityCatalogue({
      strengthCape99: combatModel.strengthCape99,
    });
    const bar = resolveRevolutionBar(catalogue, modelled);
    // Full loadout and hybrid manual both go through the shared builder.
    const simBase = buildSimulationInputBase(combatModel, catalogue);
    // Adaptive live caps (UI ladder); residual notes stay honest.
    const { summary, meta } = simulateRevolutionForUi(
      toRevolutionInput(simBase, {
        bar,
        style: simStyle,
        durationTicks,
      }),
    );
    setResult(summary);
    setBranchFidelityMeta({
      maxLiveBranches: meta.finalBudget.maxLiveBranches,
      residualWeight: meta.residualWeight,
      attempts: meta.attempts,
    });
    setResultKey(runKey);
  };

  const applySolverBar = (ids: readonly string[]) => {
    setActiveBarIds([...ids]);
    setResult(null);
    setBranchFidelityMeta(null);
  };

  const currentSaveBar = activeBarIds?.length
    ? activeBarIds
    : solver.solverResult?.bar?.length
      ? [...solver.solverResult.bar]
      : solver.stoppedPreview?.bar?.length
        ? [...solver.stoppedPreview.bar]
        : null;
  const finalBarMatch =
    !!solver.solverResult &&
    !!currentSaveBar &&
    solver.solverResult.bar?.length === currentSaveBar.length &&
    solver.solverResult.bar.every((id, i) => id === currentSaveBar[i]);
  const stoppedBarMatch =
    !finalBarMatch &&
    !!solver.stoppedPreview &&
    !!currentSaveBar &&
    solver.stoppedPreview.bar.length === currentSaveBar.length &&
    solver.stoppedPreview.bar.every((id, i) => id === currentSaveBar[i]);
  /** Score shown for save: verified final when identity+bar match; else stopped facts. */
  const currentSaveScore = finalBarMatch
    ? solver.solverResult!.score
    : stoppedBarMatch
      ? (solver.stoppedPreview!.bestFullScore ??
        solver.stoppedPreview!.bestExploratoryScore ??
        null)
      : null;
  const saveVerified = maySaveVerified({
    liveIdentity: solver.liveIdentity,
    resultSolveIdentity: solver.solverResult?.solveIdentity,
    finalBar: solver.solverResult?.bar,
    currentBar: currentSaveBar,
    solving: solver.solving,
    proofLabel:
      solver.solverResult?.proofLabel ?? solver.solverResult?.proof?.label,
  });
  const alreadySaved =
    currentSaveBar != null && isBarAlreadySaved(solver.barLibrary, loadout.style, currentSaveBar);

  const loadLibraryBar = (entry: RevoBarEntry) => {
    applySolverBar(entry.bar);
  };

  return (
    <div className="revolution-panel">
      <RevoBarLibraryPanel
        style={loadout.style}
        barLibrary={solver.barLibrary}
        currentSaveBar={currentSaveBar}
        currentSaveScore={currentSaveScore}
        alreadySaved={alreadySaved}
        solving={solver.solving}
        liveScoreContext={solver.liveIdentity}
        onSave={() =>
          solver.saveCurrentBar(currentSaveBar, currentSaveScore, { verified: saveVerified })
        }
        onLoad={loadLibraryBar}
        onDropRecent={solver.dropRecent}
        onDropSaved={solver.dropSaved}
      />

      <RevoSolverSection
        regions={regions}
        solving={solver.solving}
        stopping={solver.stopping}
        solverProgress={solver.solverProgress}
        solverResult={solver.solverResult}
        stoppedPreview={solver.stoppedPreview}
        solverError={solver.solverError}
        bestPulse={solver.bestPulse}
        solverAgents={solver.solverAgents}
        solverTier={solver.solverTier}
        setSolverTier={(t) => {
          solver.setSolverTier(t);
          solver.setSolverAgents(preferredAgentCount(t));
        }}
        setSolverAgents={solver.setSolverAgents}
        solverProfile={solver.solverProfile}
        setSolverProfile={solver.setSolverProfile}
        barSizePreset={solver.barSizePreset}
        setBarSizePreset={solver.setBarSizePreset}
        limitToRegions={solver.limitToRegions}
        setLimitToRegions={solver.setLimitToRegions}
        onOptimize={() => void solver.optimize()}
        onCancel={solver.cancelSolve}
        onApplyBar={applySolverBar}
      />

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
              {keybindCount > 0 ? ` · ${keybindCount} keybind${keybindCount === 1 ? "" : "s"}` : ""}
            </>
          ) : (
            "No reference bar for this loadout"
          )}
        </span>
      </div>

      <RevoBarGraphic slots={slots} revoSize={revoSize} />

      <RevoRunResults
        stats={stats}
        durationSeconds={durationSeconds}
        setDurationSeconds={(n) => setDurationSeconds(clampRunDurationSeconds(n))}
        plannedTicks={plannedTicks}
        onRun={run}
        result={liveResult}
        showAllCasts={showAllCasts}
        setShowAllCasts={setShowAllCasts}
        analysisOpen={analysisOpen}
        setAnalysisOpen={setAnalysisOpen}
        nameById={nameById}
        branchFidelityMeta={liveResult ? branchFidelityMeta : null}
      />
    </div>
  );
}
