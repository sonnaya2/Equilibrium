"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveBar, type ResolvedSlot } from "@/combat/data/specs";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { secondsToTicks } from "@/combat/core/ticks";
import {
  engineSpecs as ENGINE_SPECS,
  engineSpecsForStyle,
  entryByEngineId,
} from "@/combat/abilities/registry";
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
import { activeLeagueRelicNames,  unlockedRegions  } from "@/league";
import type { ResolvedCombatModel } from "@/combat/model";
import { SLIVER_OF_EDICTS_ID } from "@/combat/league/naragiEdict";
import { hasEssenceOfFinalityEquipped } from "@/combat/shared/requirements";
import { eofStorableSpecials } from "@/combat/shared/eofStoredSpecials";
import { normalizeEofStoredSpecialId, persistStartingAdrenaline } from "./loadout/model";
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
import { formatNumber, maySaveVerified } from "./revoPanelFormat";
import { CombatFrame } from "./CombatFrame";
import { RevoBarGraphic } from "./RevoBarGraphic";
import { RevoBarLibraryPanel } from "./RevoBarLibraryPanel";
import { RevoSolverSection } from "./RevoSolverSection";
import { CalculationAssumptions } from "./CalculationAssumptions";
import { RevoRunResults } from "./RevoRunResults";
import {
  formatKph,
  formatTtkSeconds,
  killsPerHour,
  runTtkSeconds,
} from "./abilityTtkPresentation";
import { isApproximatedRun } from "./revoStochasticLabels";
import { TargetSummaryCard } from "./TargetSummaryCard";
import { useRevolutionSolver } from "./useRevolutionSolver";
import { adrenEconomyAssumptionRows } from "./adrenalinePresentation";
import { filterAbilitiesForLoadout } from "./abilityLoadoutFilter";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import "./revo-solver.css";

const EOF_ICON = "/game/upgrades/permanent-equipment/essence-of-finality.webp";
const SPEC_ICON = "/game/leagues/catalyst/relics/t7-specialist.webp";

const DEFAULT_DURATION_SECONDS = 60;
/** Hard cap for manual Run bar horizon (seconds). */
export const MAX_RUN_DURATION_SECONDS = 1000;
const MIN_RUN_DURATION_SECONDS = 6;
const MAX_EDITABLE_BAR_SLOTS = 14;

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
  onOpenTarget,
  rotationMode = "revolution",
  onRotationModeChange,
  limitToRegions,
  setLimitToRegions,
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
  onOpenTarget?: () => void;
  rotationMode?: "revolution" | "manual";
  onRotationModeChange?: (mode: "revolution" | "manual") => void;
  limitToRegions: boolean;
  setLimitToRegions: (value: boolean) => void;
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
  const [selectedBarSlot, setSelectedBarSlot] = useState(0);
  const [addAbilityId, setAddAbilityId] = useState("");
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
      setActiveBarIds(ids);
      saveActiveRevoBar(loadout.style, weaponConfiguration, ids);
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
    return activeBarIds;
  }, [activeBarIds]);

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

  const regions = useMemo(() => unlockedRegions(build), [build]);
  const regionGate = useMemo(
    () =>
      limitToRegions
        ? {
            unlockedRegions: regions,
            includeUnknownAvailability: false as const,
            league: stats.league,
            passiveIds: stats.equipmentEffects.passiveIds,
            equipmentIds: stats.equipmentIds,
            weaponConfiguration,
            eofStoredSpecialId: loadout.eofStoredSpecialId,
          }
        : {
            league: stats.league,
            passiveIds: stats.equipmentEffects.passiveIds,
            equipmentIds: stats.equipmentIds,
            weaponConfiguration,
            eofStoredSpecialId: loadout.eofStoredSpecialId,
          },
    [
      limitToRegions,
      regions,
      stats.league,
      stats.equipmentEffects.passiveIds,
      stats.equipmentIds,
      weaponConfiguration,
      loadout.eofStoredSpecialId,
    ],
  );
  const slots = useMemo(() => {
    if (solvedSlots) return solvedSlots;
    if (!bar) return [];
    const resolved = applyLoadoutVariantsToSlots(
      resolveBar(bar, ENGINE_SPECS, weaponConfiguration),
      igneousGate,
    );
    if (!limitToRegions) return resolved;
    return resolved.filter((slot) => {
      if (!slot.spec) return true;
      return filterAbilitiesForLoadout([slot.spec], regionGate).length > 0;
    });
  }, [solvedSlots, bar, weaponConfiguration, igneousGate, limitToRegions, regionGate]);
  const revoSize = solvedSlots ? solvedSlots.length : (bar?.revolutionSize ?? slots.length);
  const managedSlots = useMemo(
    () => (solvedSlots ? solvedSlots : bar ? slots.slice(0, Math.min(bar.revolutionSize, slots.length)) : []),
    [solvedSlots, bar, slots],
  );
  const modelled = useMemo(() => {
    const base = solvedSlots
      ? solvedSlots.filter((s) => s.spec).map((s) => s.spec!)
      : bar
        ? revoManagedModelled(bar, weaponConfiguration, igneousGate)
        : [];
    const withConjures = solvedSlots
      ? base
      : ensureNecroConjuresOnSpecs(base, loadout.style, weaponConfiguration, igneousGate);
    // Same cast gate as Higher Power: strip region-locked ids from the live bar.
    if (!limitToRegions) return withConjures;
    return filterAbilitiesForLoadout(withConjures, regionGate);
  }, [
    solvedSlots,
    bar,
    weaponConfiguration,
    igneousGate,
    loadout.style,
    limitToRegions,
    regionGate,
  ]);
  const unmodelled = managedSlots.filter((slot) => slot.modelledBy === "unmodelled");
  const keybindCount = Math.max(0, slots.length - revoSize);

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
  const editorAbilities = useMemo(() => {
    const available = filterAbilitiesForLoadout(engineSpecsForStyle(loadout.style), regionGate);
    return [...new Map(available.map((ability) => [ability.id, ability])).values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [loadout.style, regionGate]);
  const selectedAbilityId = barIdsForKey[selectedBarSlot] ?? "";
  const addableAbilities = useMemo(
    () => editorAbilities.filter((ability) => !barIdsForKey.includes(ability.id)),
    [barIdsForKey, editorAbilities],
  );

  useEffect(() => {
    setSelectedBarSlot((current) => Math.max(0, Math.min(current, barIdsForKey.length - 1)));
  }, [barIdsForKey.length]);

  useEffect(() => {
    if (addAbilityId && addableAbilities.some((ability) => ability.id === addAbilityId)) return;
    setAddAbilityId(addableAbilities[0]?.id ?? "");
  }, [addAbilityId, addableAbilities]);

  const applyEditedBar = (next: string[]) => {
    onActiveBar(next);
    setResult(null);
    setResultKey(null);
  };

  const replaceSelectedAbility = (id: string) => {
    if (!id || selectedBarSlot < 0 || selectedBarSlot >= barIdsForKey.length) return;
    const next = [...barIdsForKey];
    const existing = next.indexOf(id);
    if (existing >= 0 && existing !== selectedBarSlot) {
      [next[selectedBarSlot], next[existing]] = [next[existing]!, next[selectedBarSlot]!];
    } else {
      next[selectedBarSlot] = id;
    }
    applyEditedBar(next);
  };

  const moveSelectedAbility = (direction: -1 | 1) => {
    const target = selectedBarSlot + direction;
    if (target < 0 || target >= barIdsForKey.length) return;
    const next = [...barIdsForKey];
    [next[selectedBarSlot], next[target]] = [next[target]!, next[selectedBarSlot]!];
    setSelectedBarSlot(target);
    applyEditedBar(next);
  };

  const removeSelectedAbility = () => {
    if (barIdsForKey.length <= 1) return;
    const next = barIdsForKey.filter((_, index) => index !== selectedBarSlot);
    setSelectedBarSlot(Math.min(selectedBarSlot, next.length - 1));
    applyEditedBar(next);
  };

  const appendAbility = () => {
    if (!addAbilityId || barIdsForKey.length >= MAX_EDITABLE_BAR_SLOTS) return;
    const next = [...barIdsForKey, addAbilityId];
    setSelectedBarSlot(next.length - 1);
    applyEditedBar(next);
  };
  /**
   * Parent should pass run-aligned model (full loadout or hybrid manual).
   * Fallback: full loadout resolve (tests / isolated mount).
   */
  const combatModel = useMemo(() => {
    if (combatModelProp) return combatModelProp;
    return resolveLoadoutCombat(loadout, {
      blessingPicks: build.blessingPicks,
      relics: activeLeagueRelicNames(build),
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
    limitToRegions,
    setLimitToRegions,
  });

  useEffect(() => {
    const equipmentChanged = prevEquipKey.current !== equipKey;
    prevEquipKey.current = equipKey;
    const restored = loadActiveRevoBar(loadout.style, weaponConfiguration);
    setActiveBarIds(restored?.length ? restored : null);
    setSelectedBarSlot(0);
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
    // Always re-sim on click; cache only hydrates when the run key changes.

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
    onActiveBar(ensureNecroConjuresOnBarIds(ids, loadout.style, weaponConfiguration));
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
  const adrenEconomyRows = useMemo(() => adrenEconomyAssumptionRows(stats), [stats]);
  const eofEquipped = hasEssenceOfFinalityEquipped(loadout.equipmentIds);
  const eofStoredSpec = useMemo(() => {
    if (!loadout.eofStoredSpecialId) return null;
    return eofStorableSpecials().find((spec) => spec.id === loadout.eofStoredSpecialId) ?? null;
  }, [loadout.eofStoredSpecialId]);
  const weaponSpecialId = stats.equipmentEffects.activeWeapon?.specialAttackId ?? null;
  const weaponSpecialSpec = weaponSpecialId ? ENGINE_SPECS.get(weaponSpecialId) : undefined;
  const barAbilityOptions = useMemo(
    () =>
      modelled.map((spec) => ({
        id: spec.id,
        name: spec.name,
      })),
    [modelled],
  );

  const targetLp = loadout.target?.maximumLifePoints;
  const runDps = liveResult?.ok ? liveResult.dps : null;
  const targetTtkSec = runTtkSeconds(targetLp, runDps);
  const targetTtkLabel = formatTtkSeconds(targetTtkSec);
  const targetKphLabel = formatKph(killsPerHour(targetTtkSec));

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
            <div className="revo-bar-heading__title">
              <h2 id="revo-bar-title">Revolution bar</h2>
              {onRotationModeChange ? (
                <div className="revo-mode-toggle" role="group" aria-label="Rotation mode">
                  {(["revolution", "manual"] as const).map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      onClick={() => onRotationModeChange(candidate)}
                      aria-pressed={rotationMode === candidate}
                      className={`revo-mode-toggle__btn${
                        rotationMode === candidate ? " is-active" : ""
                      }`}
                    >
                      {candidate === "revolution" ? "Revolution" : "Manual"}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </header>
          <div className="ability-bar-row">
            <RevoBarGraphic
              slots={slots}
              revoSize={revoSize}
              selectedIndex={selectedBarSlot}
              onSelectSlot={setSelectedBarSlot}
            />
          </div>
          <div className="revo-bar-editor" data-testid="revo-bar-editor">
            <label className="revo-bar-editor__ability">
              <span>Slot {selectedBarSlot + 1}</span>
              <select
                aria-label={`Ability in slot ${selectedBarSlot + 1}`}
                value={selectedAbilityId}
                onChange={(event) => replaceSelectedAbility(event.target.value)}
              >
                {editorAbilities.map((ability) => (
                  <option key={ability.id} value={ability.id}>
                    {ability.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="revo-bar-editor__actions" role="group" aria-label="Edit selected slot">
              <button
                type="button"
                className="combat-button"
                onClick={() => moveSelectedAbility(-1)}
                disabled={selectedBarSlot <= 0}
                aria-label="Move selected ability left"
              >
                ←
              </button>
              <button
                type="button"
                className="combat-button"
                onClick={() => moveSelectedAbility(1)}
                disabled={selectedBarSlot >= barIdsForKey.length - 1}
                aria-label="Move selected ability right"
              >
                →
              </button>
              <button
                type="button"
                className="combat-button"
                onClick={removeSelectedAbility}
                disabled={barIdsForKey.length <= 1}
              >
                Remove
              </button>
            </div>
            <label className="revo-bar-editor__add">
              <span className="sr-only">Ability to add</span>
              <select
                aria-label="Ability to add"
                value={addAbilityId}
                onChange={(event) => setAddAbilityId(event.target.value)}
                disabled={addableAbilities.length === 0}
              >
                {addableAbilities.map((ability) => (
                  <option key={ability.id} value={ability.id}>
                    {ability.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="combat-button"
                onClick={appendAbility}
                disabled={!addAbilityId || barIdsForKey.length >= MAX_EDITABLE_BAR_SLOTS}
              >
                Add slot
              </button>
            </label>
            <button
              type="button"
              className="combat-button revo-bar-editor__reset"
              onClick={() => {
                onActiveBar(null);
                setResult(null);
                setResultKey(null);
              }}
              disabled={activeBarIds == null}
            >
              Reset
            </button>
          </div>
          <div className="revo-toolbar">
            <span className="revo-toolbar__meta" data-testid="revo-reference-bar">
              {activeBarIds ? (
                <>Active Revo++ · {modelled.length} abilities</>
              ) : bar ? (
                <>
                  <span className="revo-toolbar__emphasis">{barOptionLabel(bar)}</span>
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
          />
        </section>
      </CombatFrame>

      <div className="revo-right-stack">
      <CombatFrame as="aside" className="revo-status-rail" aria-label="Settings">
        <h2>Settings</h2>
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
          <label className="revo-status-control">
            <span>Start adren</span>
            <span>
              <input
                type="number"
                value={loadout.startingAdrenaline ?? stats.maxAdrenaline}
                min={0}
                max={stats.maxAdrenaline}
                step={1}
                onChange={(event) => {
                  const next = persistStartingAdrenaline(
                    Number(event.target.value),
                    stats.maxAdrenaline,
                  );
                  setLoadout({ ...loadout, startingAdrenaline: next });
                }}
                data-testid="revo-start-adren"
                aria-label="Starting adrenaline percent"
                disabled={runBusy}
              />
              <span>%</span>
            </span>
          </label>
        ) : null}
        {setLoadout ? (
          <div className="revo-spec-strip" data-testid="revo-spec-strip">
            <button
              type="button"
              className={`revo-spec-toggle${loadout.buffs.useEquippedWeaponSpecial ? " is-on" : ""}`}
              aria-pressed={loadout.buffs.useEquippedWeaponSpecial}
              aria-label={
                loadout.buffs.useEquippedWeaponSpecial
                  ? "Weapon special on"
                  : "Weapon special off"
              }
              title={
                weaponSpecialSpec
                  ? `Weapon special: ${weaponSpecialSpec.name}`
                  : "Weapon special (auto when ready)"
              }
              onClick={() =>
                setLoadout((prev) =>
                  withLoadoutBuffs(prev, {
                    useEquippedWeaponSpecial: !prev.buffs.useEquippedWeaponSpecial,
                  }),
                )
              }
            >
              <GameIcon
                src={
                  weaponSpecialSpec
                    ? abilityIconPath(weaponSpecialSpec.id, weaponSpecialSpec.style)
                    : SPEC_ICON
                }
                size={28}
              />
            </button>
            <label className="revo-spec-after">
              <span className="sr-only">Spec after ability</span>
              <select
                value={loadout.buffs.weaponSpecialAfterAbilityId ?? ""}
                aria-label="Cast special after ability"
                disabled={!loadout.buffs.useEquippedWeaponSpecial}
                onChange={(event) => {
                  const next = event.target.value || null;
                  setLoadout((prev) =>
                    withLoadoutBuffs(prev, {
                      weaponSpecialAfterAbilityId: next,
                    }),
                  );
                }}
              >
                <option value="">Any time</option>
                {barAbilityOptions.map((ability) => (
                  <option key={ability.id} value={ability.id}>
                    After {ability.name}
                  </option>
                ))}
              </select>
            </label>
            {eofEquipped ? (
              <label
                className={`revo-eof-badge${eofStoredSpec ? " is-filled" : " is-empty"}`}
                data-testid="eof-stored-special"
                title={
                  eofStoredSpec
                    ? `EoF stored: ${eofStoredSpec.name}`
                    : "EoF equipped · no special stored"
                }
              >
                <span className="revo-eof-badge__well" aria-hidden>
                  <GameIcon src={EOF_ICON} size={30} />
                  {eofStoredSpec ? (
                    <span className="revo-eof-badge__overlay">
                      <GameIcon
                        src={abilityIconPath(eofStoredSpec.id, eofStoredSpec.style)}
                        size={16}
                      />
                    </span>
                  ) : (
                    <span className="revo-eof-badge__overlay is-empty">?</span>
                  )}
                </span>
                <select
                  value={loadout.eofStoredSpecialId ?? ""}
                  aria-label="Essence of Finality stored special"
                  onChange={(event) => {
                    const next = event.target.value || null;
                    setLoadout((prev) => ({
                      ...prev,
                      eofStoredSpecialId: normalizeEofStoredSpecialId(prev.equipmentIds, next),
                    }));
                  }}
                >
                  <option value="">None</option>
                  {eofStorableSpecials().map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
        {loadout.equipmentSlots?.pocket === SLIVER_OF_EDICTS_ID && setLoadout ? (
          <div className="revo-sliver-group" data-testid="revo-sliver-group">
            <button
              type="button"
              className={`combat-button revo-sliver-toggle border text-xs ${
                loadout.buffs.sliverOfEdictsActive
                  ? "border-stone-750 bg-stone-850 text-parch-50"
                  : "border-stone-750 text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
              }`}
              aria-pressed={loadout.buffs.sliverOfEdictsActive}
              data-testid="sliver-buff-toggle"
              title="Activate Sliver of Edicts on a cycle: at combat start and again every 90s CD (16.8s window)"
              disabled={runBusy}
              onClick={() =>
                setLoadout((prev) =>
                  withLoadoutBuffs(prev, {
                    sliverOfEdictsActive: !prev.buffs.sliverOfEdictsActive,
                  }),
                )
              }
            >
              <span className="revo-sliver-toggle__label">Sliver</span>
              <span className="revo-sliver-toggle__state font-mono">
                {loadout.buffs.sliverOfEdictsActive ? "On" : "Off"}
              </span>
            </button>
            <p
              className="revo-sliver-base"
              data-testid="revo-sliver-base-compare"
              title="Effective base ability damage: loadout level (off) vs Naragi 255 window (on)"
            >
              <span className="revo-sliver-base__label">Base AD</span>
              <span className="revo-sliver-base__row font-mono">
                <span
                  className={
                    loadout.buffs.sliverOfEdictsActive
                      ? "revo-sliver-base__val is-dim"
                      : "revo-sliver-base__val is-active"
                  }
                  data-testid="revo-sliver-base-off"
                >
                  {formatNumber(sliverBaseCompare.off)}
                </span>
                <span className="revo-sliver-base__sep" aria-hidden>
                  /
                </span>
                <span
                  className={
                    loadout.buffs.sliverOfEdictsActive
                      ? "revo-sliver-base__val is-active"
                      : "revo-sliver-base__val is-dim"
                  }
                  data-testid="revo-sliver-base-on"
                >
                  {formatNumber(sliverBaseCompare.on)}
                </span>
              </span>
              <span className="revo-sliver-base__hint">off / on</span>
            </p>
          </div>
        ) : null}
        <div className="revo-status-actions">
          <button
            type="button"
            className={`combat-button revo-run-button revo-solver-controls__run${
              runBusy ? " is-running" : ""
            }`}
            onClick={run}
            disabled={runBusy || modelled.length === 0}
            data-testid="revo-run-button"
          >
            {runBusy ? "Running…" : "Run bar"}
          </button>
          {runBusy ? (
            <button
              type="button"
              className="combat-button revo-solver-controls__cancel revo-run-cancel"
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
        <dl className="revo-status-facts">
          <div>
            <dt>Total Ticks</dt>
            <dd>
              {plannedTicks > 0 ? plannedTicks : "—"}
              <span className="revo-muted"> · {durationSeconds}s</span>
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{statusLabel}</dd>
          </div>
          <div>
            <dt>Hit cap</dt>
            <dd data-testid="revo-run-hit-cap">
              {loadout.hitCapEnabled ? "On (30,000)" : "Off"}
            </dd>
          </div>
          <div>
            <dt>Bar</dt>
            <dd>{currentSaveBar?.length ?? 0} slots</dd>
          </div>
          <div>
            <dt>Proof</dt>
            <dd>{solver.solverResult?.proofLabel ?? "—"}</dd>
          </div>
        </dl>
        <section className="revo-adren-panel" aria-labelledby="revo-adren-title">
          <h2 id="revo-adren-title">Adrenaline</h2>
          <dl className="revo-adren-panel__run">
            <div>
              <dt>Start</dt>
              <dd>
                {firstCast ? `${firstCast.adrenalineBefore}%` : `${stats.startingAdrenaline}%`}
              </dd>
            </div>
            <div>
              <dt>End</dt>
              <dd>{lastCast ? `${lastCast.adrenalineAfter}%` : "—"}</dd>
            </div>
            <div>
              <dt>Gained</dt>
              <dd>{totalAdrenalineGained == null ? "—" : totalAdrenalineGained.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Cap</dt>
              <dd>{stats.maxAdrenaline}%</dd>
            </div>
          </dl>
          {adrenEconomyRows.length ? (
            <ul className="revo-adren-panel__effects">
              {adrenEconomyRows.map(([label, detail]) => (
                <li key={label}>
                  <strong>{label}</strong>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="revo-adren-panel__empty">No adren-saving effects on this loadout.</p>
          )}
        </section>
        <section
          className="revo-status-assumptions"
          aria-labelledby="revo-information-title"
          data-testid="revo-status-assumptions"
        >
          <h2 id="revo-information-title" className="sr-only">
            Information
          </h2>
          <CalculationAssumptions
            stats={stats}
            result={liveResult}
            heading="Information"
          />
        </section>
      </CombatFrame>

      <CombatFrame
        as="aside"
        className="revo-target-panel"
        aria-labelledby="revo-target-title"
        data-testid="revo-target-panel"
      >
        <header className="revo-target-panel__header">
          <h2 id="revo-target-title">Target</h2>
          {onOpenTarget ? (
            <button
              type="button"
              className="combat-button revo-target-panel__edit"
              onClick={onOpenTarget}
            >
              Edit
            </button>
          ) : null}
        </header>
        <TargetSummaryCard
          target={loadout.target}
          style={loadout.style}
          damagePotential={stats.dp}
          className="revo-target-panel__body"
        />
        <div className="revo-target-outcome" data-testid="revo-target-metrics">
          <dl className="revo-target-metrics">
            <div>
              <dt>
                {liveResult?.ok && isApproximatedRun(liveResult) ? "TTK (approx.)" : "TTK"}
              </dt>
              <dd aria-label={`Estimated time to kill ${targetTtkLabel}`}>{targetTtkLabel}</dd>
            </div>
            <div>
              <dt>
                {liveResult?.ok && isApproximatedRun(liveResult) ? "KPH (approx.)" : "KPH"}
              </dt>
              <dd aria-label={`Estimated kills per hour ${targetKphLabel}`}>{targetKphLabel}</dd>
            </div>
          </dl>
          {!targetLp ? (
            <p className="revo-target-metrics__hint">Set target LP.</p>
          ) : !liveResult?.ok ? (
            <p className="revo-target-metrics__hint">Run the bar for TTK / KPH.</p>
          ) : null}
        </div>
      </CombatFrame>
      </div>
    </div>
  );
}
