"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveBar, type ResolvedSlot } from "@/combat/data/specs";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { secondsToTicks } from "@/combat/core/ticks";
import { engineSpecs as ENGINE_SPECS, entryByEngineId } from "@/combat/abilities/registry";
import {
  preferredAgentCount,
  packSimBaseFromModel,
  runUiRevolution,
  cancelUiRevolutionWorkers,
} from "@/combat/solver";
import type { CalcStats } from "./loadoutStats";
import { naragiBaseDamageCompare, resolveLoadoutCombat } from "./toResolvedCombatModel";
import { uiRunFingerprint } from "./uiSimFingerprint";
import { getUiRunCache, setUiRunCache } from "./uiRunCache";
import {
  isBarAlreadySaved,
  loadActiveRevoBar,
  loadRevoRunDuration,
  saveActiveRevoBar,
  saveRevoRunDuration,
  type RevoBarEntry,
} from "./revoBarLibrary";
import type { Loadout, SetLoadout } from "./useLoadout";
import { withLoadoutBuffs } from "./useLoadout";
import { useBuild as useLeagueBuild } from "@/league/useBuild";
import { unlockedRegions } from "@/league";
import type { ResolvedCombatModel } from "@/combat/model";
import { SLIVER_OF_EDICTS_ID } from "@/combat/league/naragiEdict";
import {
  applyLoadoutVariantsToSlots,
  barOptionLabel,
  ensureNecroConjuresOnBarIds,
  ensureNecroConjuresOnSpecs,
  pickBarForLoadout,
  revoManagedModelled,
  SUPPORTED_BARS,
  type RevoBarView,
} from "./revoBarResolve";
import { maySaveVerified } from "./revoPanelFormat";
import { CombatFrame } from "./CombatFrame";
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
  return Math.min(MAX_RUN_DURATION_SECONDS, Math.max(MIN_RUN_DURATION_SECONDS, Math.floor(raw)));
}

/** Revolution mode: solver-first bar search; wiki bars as seeds/references. */
export function RevolutionPanel({
  stats,
  loadout,
  setLoadout,
  combatModel: combatModelProp,
  useBuild: _useLoadoutBuild = true,
}: {
  stats: CalcStats;
  loadout: Loadout;
  setLoadout?: SetLoadout;
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
  const [runBusy, setRunBusy] = useState(false);
  const [runProgressLabel, setRunProgressLabel] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [showAllCasts, setShowAllCasts] = useState(false);

  useEffect(() => {
    setDurationSeconds(loadRevoRunDuration());
  }, []);

  const updateDurationSeconds = (value: number) => {
    const duration = clampRunDurationSeconds(value);
    setDurationSeconds(duration);
    saveRevoRunDuration(duration);
  };
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [activeBarIds, setActiveBarIds] = useState<string[] | null>(null);
  const runGenRef = useRef(0);
  const runCancelRef = useRef(false);
  const weaponConfiguration = stats.weaponConfiguration;

  useEffect(() => {
    return () => {
      runCancelRef.current = true;
      runGenRef.current += 1;
      cancelUiRevolutionWorkers();
    };
  }, []);

  const onActiveBar = useCallback(
    (ids: string[] | null) => {
      if (ids == null) {
        setActiveBarIds(null);
        saveActiveRevoBar(loadout.style, weaponConfiguration, null);
        return;
      }
      const normalized = ensureNecroConjuresOnBarIds(ids, loadout.style, weaponConfiguration);
      setActiveBarIds(normalized);
      saveActiveRevoBar(loadout.style, weaponConfiguration, normalized);
    },
    [loadout.style, weaponConfiguration],
  );
  const onClearSimResult = useCallback(() => {
    setResult(null);
  }, []);

  const bar: RevoBarView | undefined = useMemo(
    () =>
      pickBarForLoadout(loadout.style, stats.weaponConfiguration) ??
      pickBarForLoadout(loadout.style) ??
      SUPPORTED_BARS[0],
    [loadout.style, stats.weaponConfiguration],
  );

  const igneousGate = useMemo(
    () => ({
      passiveIds: stats.equipmentEffects.passiveIds,
      equipmentIds: stats.equipmentIds,
    }),
    [stats.equipmentEffects.passiveIds, stats.equipmentIds],
  );

  // Solver bars can drop conjure_*; merge wiki early-bar conjures for necro Run/display.
  const effectiveActiveBarIds = useMemo(() => {
    if (!activeBarIds?.length) return null;
    return ensureNecroConjuresOnBarIds(activeBarIds, loadout.style, weaponConfiguration);
  }, [activeBarIds, loadout.style, weaponConfiguration]);

  const solvedSlots: ResolvedSlot[] | null = useMemo(() => {
    if (!effectiveActiveBarIds?.length) return null;
    const raw = effectiveActiveBarIds.map((id) => {
      const spec = ENGINE_SPECS.get(id) ?? null;
      const entry = entryByEngineId(id);
      return {
        name: spec?.name ?? entry?.spec.name ?? id,
        modelledBy: spec ? ("engine" as const) : ("unmodelled" as const),
        spec,
      };
    });
    // Solver bars already use upgrade ids; still normalize for display safety.
    return applyLoadoutVariantsToSlots(raw, igneousGate);
  }, [effectiveActiveBarIds, igneousGate]);

  const slots = useMemo(() => {
    if (solvedSlots) return solvedSlots;
    if (!bar) return [];
    return applyLoadoutVariantsToSlots(
      resolveBar(bar, ENGINE_SPECS, weaponConfiguration),
      igneousGate,
    );
  }, [solvedSlots, bar, weaponConfiguration, igneousGate]);
  const revoSize = solvedSlots ? solvedSlots.length : (bar?.revolutionSize ?? slots.length);
  const managedSlots = useMemo(
    () => (solvedSlots ? solvedSlots : bar ? slots.slice(0, bar.revolutionSize) : []),
    [solvedSlots, bar, slots],
  );
  const modelled = useMemo(() => {
    const base = solvedSlots
      ? solvedSlots.filter((s) => s.spec).map((s) => s.spec!)
      : bar
        ? revoManagedModelled(bar, weaponConfiguration, igneousGate)
        : [];
    return ensureNecroConjuresOnSpecs(base, loadout.style, weaponConfiguration, igneousGate);
  }, [solvedSlots, bar, weaponConfiguration, igneousGate, loadout.style]);
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
  const sliverBaseCompare = useMemo(
    () => naragiBaseDamageCompare(loadout, stats.base),
    [loadout, stats.base],
  );

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

  useEffect(() => {
    const cached = getUiRunCache(runKey);
    if (!cached) return;
    setResult(cached.summary);
    setResultKey(runKey);
  }, [runKey]);

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
    const equipmentChanged = prevEquipKey.current !== equipKey;
    prevEquipKey.current = equipKey;
    const restored = loadActiveRevoBar(loadout.style, weaponConfiguration);
    setActiveBarIds(
      restored?.length
        ? ensureNecroConjuresOnBarIds(restored, loadout.style, weaponConfiguration)
        : null,
    );
    if (!equipmentChanged) return;
    setResult(null);
    setResultKey(null);
    setShowAllCasts(false);
    setAnalysisOpen(false);
    solver.clearSolverUi();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only equip shape; clearSolverUi is stable
  }, [equipKey, loadout.style, weaponConfiguration]);

  useEffect(() => {
    if (result != null && resultKey !== runKey) {
      setShowAllCasts(false);
      setAnalysisOpen(false);
    }
  }, [result, resultKey, runKey]);

  const simStyle = loadout.style;

  const run = () => {
    if (modelled.length === 0 || runBusy) return;
    setShowAllCasts(false);
    setAnalysisOpen(false);
    setRunError(null);

    const cached = getUiRunCache(runKey);
    if (cached) {
      setResult(cached.summary);
      setResultKey(runKey);
      return;
    }

    const durationTicks = secondsToTicks(clampRunDurationSeconds(durationSeconds));
    const gen = ++runGenRef.current;
    runCancelRef.current = false;
    setRunBusy(true);
    setRunProgressLabel("Running full analysis…");

    const barIds = modelled.map((m) => m.id).filter(Boolean);
    const packed = packSimBaseFromModel(combatModel);

    void (async () => {
      try {
        const { summary } = await runUiRevolution(
          {
            loadout: packed,
            barIds,
            style: simStyle,
            durationTicks,
          },
          {
            isCancelled: () => runCancelRef.current || gen !== runGenRef.current,
            onProgress: (p) => {
              if (gen !== runGenRef.current) return;
              setRunProgressLabel(`Full analysis (${p.done}/${p.total})…`);
            },
          },
        );
        if (gen !== runGenRef.current) return;
        setResult(summary);
        setResultKey(runKey);
        setUiRunCache(runKey, { summary });
      } catch (err) {
        if (gen !== runGenRef.current) return;
        const aborted =
          (err instanceof Error && err.name === "AbortError") ||
          (err instanceof Error && /cancelled/i.test(err.message));
        if (!aborted && typeof console !== "undefined") {
          console.warn("[revo-run]", err);
        }
        if (!aborted) {
          setRunError(err instanceof Error ? err.message : "Revolution analysis failed");
        }
      } finally {
        if (gen === runGenRef.current) {
          setRunBusy(false);
          setRunProgressLabel(null);
        }
      }
    })();
  };

  const cancelRun = () => {
    runCancelRef.current = true;
    runGenRef.current += 1;
    cancelUiRevolutionWorkers();
    setRunBusy(false);
    setRunProgressLabel(null);
  };

  const applySolverBar = (ids: readonly string[]) => {
    onActiveBar([...ids]);
    setResult(null);
  };

  // Run/active bars are necro-normalized; match verified DTO against the same face.
  const finalRunBar = solver.solverResult?.bar?.length
    ? ensureNecroConjuresOnBarIds(solver.solverResult.bar, loadout.style, weaponConfiguration)
    : null;
  const stoppedRunBar = solver.stoppedPreview?.bar?.length
    ? ensureNecroConjuresOnBarIds(solver.stoppedPreview.bar, loadout.style, weaponConfiguration)
    : null;
  const currentSaveBar = activeBarIds?.length
    ? activeBarIds
    : finalRunBar
      ? [...finalRunBar]
      : stoppedRunBar
        ? [...stoppedRunBar]
        : barIdsForKey.length
          ? [...barIdsForKey]
          : null;
  const finalBarMatch =
    !!finalRunBar &&
    !!currentSaveBar &&
    finalRunBar.length === currentSaveBar.length &&
    finalRunBar.every((id, i) => id === currentSaveBar[i]);
  const stoppedBarMatch =
    !finalBarMatch &&
    !!stoppedRunBar &&
    !!currentSaveBar &&
    stoppedRunBar.length === currentSaveBar.length &&
    stoppedRunBar.every((id, i) => id === currentSaveBar[i]);
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
    finalBar: finalRunBar,
    currentBar: currentSaveBar,
    solving: solver.solving,
    proofLabel: solver.solverResult?.proofLabel ?? solver.solverResult?.proof?.label,
  });
  const alreadySaved =
    currentSaveBar != null && isBarAlreadySaved(solver.barLibrary, loadout.style, currentSaveBar);

  const loadLibraryBar = (entry: RevoBarEntry) => {
    applySolverBar(entry.bar);
  };

  const firstCast = liveResult?.casts[0];
  const lastCast = liveResult?.casts.at(-1);
  const totalAdrenalineGained = liveResult
    ? liveResult.casts.reduce((total, cast) => total + cast.adrenalineGained, 0)
    : null;
  const statusLabel = runBusy
    ? "Running"
    : liveResult
      ? liveResult.ok
        ? "Complete"
        : "Failed"
      : "Not run";
  const statusWarnings = [
    modelled.length === 0 ? "No modelled abilities available." : null,
    unmodelled.length > 0 ? `${unmodelled.length} bar slot(s) are unmodelled.` : null,
    solver.solverError,
    runError,
  ].filter((warning): warning is string => warning != null);

  return (
    <div className="revolution-panel">
      <CombatFrame as="aside" className="revo-library-column" aria-label="Bar library">
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
      </CombatFrame>

      <CombatFrame as="main" className="revo-main-column">
        <section className="revo-bar-frame" aria-labelledby="revo-bar-title">
          <header className="revo-bar-heading">
            <h2 id="revo-bar-title">Revolution bar</h2>
            <span>
              {slots.length} slots · {revoSize} active
            </span>
          </header>
          <div className="ability-bar-row">
            <RevoBarGraphic slots={slots} revoSize={revoSize} />
          </div>
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
        </section>

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

        <section className="revo-results-shell" aria-label="Run results">
          <RevoRunResults
            stats={stats}
            durationSeconds={durationSeconds}
            setDurationSeconds={updateDurationSeconds}
            plannedTicks={plannedTicks}
            onRun={run}
            result={liveResult}
            showAllCasts={showAllCasts}
            setShowAllCasts={setShowAllCasts}
            analysisOpen={analysisOpen}
            setAnalysisOpen={setAnalysisOpen}
            nameById={nameById}
            runBusy={runBusy}
            runProgressLabel={runProgressLabel}
            runError={runError}
            onCancelRun={cancelRun}
            showControls={false}
            sliverToggle={
              loadout.equipmentSlots?.pocket === SLIVER_OF_EDICTS_ID && setLoadout
                ? {
                    active: loadout.buffs.sliverOfEdictsActive,
                    onToggle: () =>
                      setLoadout((prev) =>
                        withLoadoutBuffs(prev, {
                          sliverOfEdictsActive: !prev.buffs.sliverOfEdictsActive,
                        }),
                      ),
                    baseOff: sliverBaseCompare.off,
                    baseOn: sliverBaseCompare.on,
                  }
                : null
            }
          />
        </section>
      </CombatFrame>

      <CombatFrame as="aside" className="revo-status-rail" aria-label="Run control status">
        <h2>Run control &amp; status</h2>
        <label className="revo-status-control">
          <span>Duration</span>
          <span>
            <input
              type="number"
              value={durationSeconds}
              min={6}
              max={1000}
              step={1}
              onChange={(event) => updateDurationSeconds(Number(event.target.value))}
              data-testid="revo-run-duration"
              disabled={runBusy}
            />
            <span>s</span>
          </span>
        </label>
        {setLoadout ? (
          <label className="revo-status-check">
            <input
              type="checkbox"
              checked={loadout.buffs.useEquippedWeaponSpecial}
              onChange={(event) =>
                setLoadout((prev) =>
                  withLoadoutBuffs(prev, {
                    useEquippedWeaponSpecial: event.target.checked,
                  }),
                )
              }
            />
            <span>
              <strong>Use equipped weapon special manually</strong>
              <small>Fires it when legal.</small>
            </span>
          </label>
        ) : null}
        <div className="revo-status-actions">
          <button
            type="button"
            className="combat-button revo-run-button"
            onClick={run}
            disabled={runBusy || modelled.length === 0}
            data-testid="revo-run-button"
          >
            {runBusy ? "Running…" : "Run bar"}
          </button>
          {runBusy ? (
            <button
              type="button"
              className="combat-button revo-run-cancel"
              onClick={cancelRun}
              data-testid="revo-run-cancel"
            >
              Cancel
            </button>
          ) : null}
          {liveResult?.ok ? (
            <button
              type="button"
              className="combat-button revo-analyze-button"
              onClick={() => setAnalysisOpen(true)}
            >
              Analyze damage
            </button>
          ) : null}
        </div>
        <dl>
          <div>
            <dt>Duration</dt>
            <dd>{durationSeconds}s</dd>
          </div>
          <div>
            <dt>Horizon</dt>
            <dd>{plannedTicks > 0 ? `${plannedTicks} ticks` : "—"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{statusLabel}</dd>
          </div>
          <div>
            <dt>Active bar</dt>
            <dd>{currentSaveBar?.length ?? 0} slots</dd>
          </div>
          <div>
            <dt>Solver proof</dt>
            <dd>{solver.solverResult?.proofLabel ?? "Not available"}</dd>
          </div>
        </dl>
        <section aria-labelledby="revo-adren-title">
          <h2 id="revo-adren-title">Adrenaline</h2>
          <dl>
            <div>
              <dt>Start</dt>
              <dd>{firstCast ? `${firstCast.adrenalineBefore}%` : "—"}</dd>
            </div>
            <div>
              <dt>End</dt>
              <dd>{lastCast ? `${lastCast.adrenalineAfter}%` : "—"}</dd>
            </div>
            <div>
              <dt>Gained</dt>
              <dd>{totalAdrenalineGained == null ? "—" : totalAdrenalineGained.toFixed(1)}</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="revo-warnings-title">
          <h2 id="revo-warnings-title">Warnings / limits</h2>
          {statusWarnings.length ? (
            <ul>
              {statusWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <small>No current warnings.</small>
          )}
        </section>
      </CombatFrame>
    </div>
  );
}
