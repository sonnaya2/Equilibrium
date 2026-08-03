"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveBar, type ResolvedSlot } from "@/combat/data/specs";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { simulateRevolution as runRevolution } from "@/combat/engine/simulation/revolution";
import { secondsToTicks } from "@/combat/core/ticks";
import { engineSpecs as ENGINE_SPECS, entryByEngineId } from "@/combat/abilities/registry";
import { withStrengthCape99Dismember } from "@/combat/styles/melee/abilities";
import { STRENGTH_CAPE_DISMEMBER_EXTRA_HITS } from "@/combat/shared/perks";
import { preferredAgentCount } from "@/combat/solver";
import type { CalcStats } from "./loadoutStats";
import { isBarAlreadySaved, type RevoBarEntry } from "./revoBarLibrary";
import type { Loadout } from "./useLoadout";
import { useBuild } from "@/league/useBuild";
import { unlockedRegions } from "@/league";
import {
  barOptionLabel,
  pickBarForLoadout,
  revoManagedModelled,
  SUPPORTED_BARS,
  type RevoBarView,
} from "./revoBarResolve";
import { RevoBarGraphic } from "./RevoBarGraphic";
import { RevoBarLibraryPanel } from "./RevoBarLibraryPanel";
import { RevoSolverSection } from "./RevoSolverSection";
import { RevoRunResults } from "./RevoRunResults";
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
}: {
  stats: CalcStats;
  loadout: Loadout;
}) {
  const { build } = useBuild();
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [result, setResult] = useState<RotationSummary | null>(null);
  const [showAllCasts, setShowAllCasts] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [activeBarIds, setActiveBarIds] = useState<string[] | null>(null);

  const onActiveBar = useCallback((ids: string[] | null) => setActiveBarIds(ids), []);
  const onClearSimResult = useCallback(() => setResult(null), []);

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

  const plannedTicks = secondsToTicks(clampRunDurationSeconds(durationSeconds));

  const equipKey = `${loadout.style}|${stats.weaponConfiguration}`;
  const prevEquipKey = useRef(equipKey);
  const adrenEconomyKey = useMemo(() => {
    const a = stats.adrenaline;
    return [
      stats.startingAdrenaline,
      stats.maxAdrenaline,
      a?.basicAdrenalineFlatBonus ?? 0,
      a?.basicGainMultiplier ?? 1,
      a?.abilityGainMultiplier ?? 1,
      a?.ultimateAdrenalineRefund ?? 0,
      a?.maxAdrenalineBonus ?? 0,
      a?.impatientRank ?? 0,
      a?.impatientLevel20 ? 1 : 0,
      a?.relentlessRank ?? 0,
      a?.relentlessLevel20 ? 1 : 0,
      a?.ringOfVigour ? 1 : 0,
    ].join("|");
  }, [stats.adrenaline, stats.startingAdrenaline, stats.maxAdrenaline]);

  const solver = useRevolutionSolver({
    stats,
    loadout,
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
    setShowAllCasts(false);
    setAnalysisOpen(false);
    solver.clearSolverUi();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only equip shape; clearSolverUi is stable
  }, [equipKey]);

  // Arch / perks change adren economy without changing equip shape — clear stale DPS.
  useEffect(() => {
    setResult(null);
    setShowAllCasts(false);
    setAnalysisOpen(false);
  }, [adrenEconomyKey]);

  const simStyle = loadout.style;

  const run = () => {
    if (modelled.length === 0) return;
    const durationTicks = secondsToTicks(clampRunDurationSeconds(durationSeconds));
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

  const applySolverBar = (ids: readonly string[]) => {
    setActiveBarIds([...ids]);
    setResult(null);
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
  /** Verified score only from a completed final DTO matching the bar. */
  const currentSaveScore = finalBarMatch
    ? solver.solverResult!.score
    : stoppedBarMatch
      ? (solver.stoppedPreview!.bestFullScore ??
        solver.stoppedPreview!.bestExploratoryScore ??
        null)
      : null;
  const saveVerified = finalBarMatch;
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
        result={result}
        showAllCasts={showAllCasts}
        setShowAllCasts={setShowAllCasts}
        analysisOpen={analysisOpen}
        setAnalysisOpen={setAnalysisOpen}
        nameById={nameById}
      />
    </div>
  );
}
