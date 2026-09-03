"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import {
  resolveAbilityCastAvailability,
  rotationOf,
  simulate,
  type RotationSummary,
} from "@/combat";
import { resolveAbilityCatalogue } from "@/combat/abilities/catalogue";
import {
  buildManualStatSimulationInputBase,
  buildSimulationInputBase,
  toHybridManualCombatModel,
  toManualSimulateInput,
} from "@/combat/model";
import { TICK_SECONDS } from "@/combat/core/ticks";
import type { CombatStyle } from "@/combat/types";
import { abilityIconPath } from "@/lib/gameArt";
import { loadState, saveState } from "@/lib/storage";
import { GameIcon } from "../GameIcon";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import { AbilityUnlockMarkers } from "./AbilityUnlockMarkers";
import { CombatFrame } from "./CombatFrame";
import { CalculationAssumptions } from "./CalculationAssumptions";
import { spiritEffectDisplayName } from "./conjurePresentation";
import { blessingEffectDisplayName } from "./blessingPresentation";
import { combatEffectDisplayName, combatEffectIconPath } from "./effectPresentation";
import { critDamageStats, type CalcStats } from "./loadoutStats";
import { LoadoutEditorDialog, type LoadoutEditorMode } from "./LoadoutEditorDialog";
import { resolveLoadoutCombat } from "./toResolvedCombatModel";
import { RevolutionPanel } from "./RevolutionPanel";
import { RotationAnalysisModal, RotationEventPreview } from "./RotationAnalysis";
import {
  primaryExpectedLabel,
  primaryManualDpsLabel,
  runDiagnosticsNote,
  runScoreBadge,
  shouldShowRunScoreChrome,
} from "./revoStochasticLabels";
import type { Loadout, SetLoadout } from "./useLoadout";
import { persistStartingAdrenaline } from "./loadout/model";
import { activeLeagueRelicNames,  unlockedRegions  } from "@/league";
import { useBuild as useLeagueBuild } from "@/league/useBuild";
import { uiRunFingerprint } from "./uiSimFingerprint";
import { getUiRunCache, setUiRunCache } from "./uiRunCache";
import {
  loadLimitToRegions,
  loadRotationMode,
  saveLimitToRegions,
  saveRotationMode,
} from "./revoBarLibrary";
import {
  equipAbilityForLoadout,
  filterAbilitiesForLoadout,
  sortAbilitiesForDisplay,
} from "./abilityLoadoutFilter";
import {
  castCritLabel,
  formatAdrenalineTimeline,
  formatCritContext,
} from "./revoPanelFormat";

const STORAGE_KEY = "eq:rotation:v1";
const MANUAL_HORIZON_TICKS = 100;

/** Display/palette catalogue without Strength Cape (cape applied per-run for use-build). */
const DISPLAY_CATALOGUE = resolveAbilityCatalogue();

const PALETTE_FILTERS: { id: CombatStyle; label: string }[] = [
  { id: "melee", label: "Melee" },
  { id: "ranged", label: "Ranged" },
  { id: "magic", label: "Magic" },
  { id: "necromancy", label: "Necromancy" },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatTicks(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function abilityById(id: string): AbilitySpec | undefined {
  return DISPLAY_CATALOGUE.byId.get(id);
}

function abilityName(id: string): string {
  return (
    combatEffectDisplayName(id) ??
    blessingEffectDisplayName(id) ??
    abilityById(id)?.name ??
    spiritEffectDisplayName(id) ??
    id
  );
}

/** Assumptions scaffold only; sim path builds SimulateInput directly. */
function withManualRotationLine(
  scaffold: CalcStats,
  line: {
    combatStyle: string;
    base: number;
    level: number;
    damagePotentialPct: number;
    critPct: number;
  },
): CalcStats {
  const level = Math.min(Math.max(1, line.level), 145);
  const base = Math.max(0, line.base);
  const critChance = Math.min(Math.max(0, line.critPct), 100) / 100;
  const dp = Math.min(Math.max(0, line.damagePotentialPct), 100) / 100;
  const manualCritDamage = critDamageStats(level);
  return {
    ...scaffold,
    combatStyle: line.combatStyle,
    baseDamageMode: "manual",
    rawBase: base,
    base,
    level,
    attackLevel: level,
    dp,
    accuracyRating: 0,
    critChance,
    critsDisabled: false,
    critDamageBonus: 0,
    baseCritDamage: manualCritDamage.baseMultiplier,
    totalCritDamage: manualCritDamage.totalMultiplier,
    baseCritDamageBonus: manualCritDamage.baseBonus,
    totalCritDamageBonus: manualCritDamage.totalBonus,
    activePassives: [],
    critByHitFor: (ability, crit) => ability.hits.map(() => crit),
    effectiveDamageLevel: level,
    mainhandTier: 0,
    offhandTier: null,
    spellTier: null,
    ammunitionTier: null,
    equipmentStyleDamageBonus: 0,
    styleDamageBonus: 0,
    damagePotentialSource: line.damagePotentialPct === 100 ? "100% assumption" : "manual override",
    // equipmentIds / weaponConfiguration preserved via ...scaffold (Leng / passives).
    globalModifiers: [],
    castModifiersFor: () => [],
  };
}

export function RotationPlanner({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: SetLoadout;
}) {
  const { build } = useLeagueBuild();
  const [mode, setMode] = useState<"revolution" | "manual">("revolution");
  const [useBuild, setUseBuild] = useState(true);
  const [weave, setWeave] = useState(true);
  const [base, setBase] = useState(1000);
  const [level, setLevel] = useState(99);
  const [accuracy, setAccuracy] = useState(100);
  const [critChance, setCritChance] = useState(10);
  const [paletteStyle, setPaletteStyle] = useState<CombatStyle>("melee");
  const [queue, setQueue] = useState<string[]>([]);
  const [result, setResult] = useState<RotationSummary | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<LoadoutEditorMode | null>(null);
  // Default true (league regions); rehydrate from storage after mount.
  const [limitToRegions, setLimitToRegionsState] = useState(true);
  const setLimitToRegions = useCallback((value: boolean) => {
    setLimitToRegionsState(value);
    saveLimitToRegions(value);
  }, []);
  const buildRegions = useMemo(() => unlockedRegions(build), [build]);

  useEffect(() => {
    setMode(loadRotationMode());
    setLimitToRegionsState(loadLimitToRegions());
    const stored = loadState<unknown>(STORAGE_KEY, []);
    const list = Array.isArray(stored) ? stored : [];
    setQueue(
      list.filter((id): id is string => typeof id === "string" && DISPLAY_CATALOGUE.byId.has(id)),
    );
  }, []);

  const loadoutOptions = useMemo(
    () => ({
      blessingPicks: build.blessingPicks,
      relics: activeLeagueRelicNames(build),
      unlockedRegions: unlockedRegions(build),
    }),
    [build],
  );

  // One loadoutStats + one model, shared `now` (powerburst tick freeze).
  const { stats: setupStats, model: loadoutCombatModel } = useMemo(
    () => resolveLoadoutCombat(loadout, loadoutOptions),
    [loadout, loadoutOptions],
  );

  const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
  const manualLine = useMemo(
    () => ({
      base: Math.max(0, finite(base, 0)),
      level: Math.min(Math.max(1, finite(level, 99)), 145),
      accuracy: Math.min(Math.max(0, finite(accuracy, 100)), 100) / 100,
      critChance: Math.min(Math.max(0, finite(critChance, 10)), 100) / 100,
    }),
    [base, level, accuracy, critChance],
  );

  /**
   * Run + Optimize share this model:
   * - Use Loadout on → full loadout resolve
   * - Use Loadout off → hybrid (slider AD line, empty damage mods; adren/league scaffold kept)
   */
  const combatModel = useMemo(
    () =>
      useBuild ? loadoutCombatModel : toHybridManualCombatModel(loadoutCombatModel, manualLine),
    [useBuild, loadoutCombatModel, manualLine],
  );

  const runKey = useMemo(
    () =>
      uiRunFingerprint({
        mode: "manual",
        stats: setupStats,
        combatModel,
        queue,
        autoWeave: weave,
        useBuild,
        manual: {
          base: manualLine.base,
          level: manualLine.level,
          accuracy: manualLine.accuracy * 100,
          critChance: manualLine.critChance * 100,
        },
      }),
    [setupStats, combatModel, queue, weave, useBuild, manualLine],
  );
  const [resultKey, setResultKey] = useState<string | null>(null);
  const liveResult = result != null && resultKey === runKey ? result : null;

  useEffect(() => {
    const cached = getUiRunCache(runKey);
    if (!cached) return;
    setResult(cached.summary);
    setResultKey(runKey);
  }, [runKey]);

  useEffect(() => {
    if (result != null && resultKey !== runKey) {
      setAnalysisOpen(false);
    }
  }, [result, resultKey, runKey]);

  const updateQueue = (next: string[]) => {
    setQueue(next);
    saveState(STORAGE_KEY, next);
    window.dispatchEvent(new Event("eq:rotation:changed"));
  };

  const run = () => {
    setAnalysisOpen(false);
    // Always re-sim on click; cache only hydrates when the run key changes.
    const rotation = rotationOf(...queue);
    if (useBuild) {
      const catalogue = resolveAbilityCatalogue({
        strengthCape99: combatModel.strengthCape99,
      });
      const simBase = buildSimulationInputBase(combatModel, catalogue);
      const summary = simulate(
        toManualSimulateInput(simBase, {
          rotation,
          autoWeave: weave,
          horizonTicks: MANUAL_HORIZON_TICKS,
        }),
      );
      setResult(summary);
      setResultKey(runKey);
      setUiRunCache(runKey, { summary });
      return;
    }
    // Manual-stat mode: slider damage line only. League + vestments for adren cap
    // so start-at-max (T4 125 / Vestments 120) does not fail createRuntime.
    const catalogue = resolveAbilityCatalogue();
    const simBase = buildManualStatSimulationInputBase(manualLine, catalogue, {
      cap: setupStats.cap,
      startingAdrenaline: setupStats.startingAdrenaline,
      adrenaline: setupStats.adrenaline,
      procs: setupStats.procs,
      league: setupStats.league,
      equipmentEffects: setupStats.equipmentEffects,
    });
    const summary = simulate(
      toManualSimulateInput(simBase, {
        rotation,
        autoWeave: weave,
        horizonTicks: MANUAL_HORIZON_TICKS,
      }),
    );
    setResult(summary);
    setResultKey(runKey);
    setUiRunCache(runKey, { summary });
  };

  const stylePool = sortAbilitiesForDisplay(
    DISPLAY_CATALOGUE.catalogue.filter((a) => a.style === paletteStyle),
  );
  // Use-build: cast legality (Igneous pairs, etc.). Limit-to-regions: same gate as solver.
  const palette = useBuild || limitToRegions
    ? filterAbilitiesForLoadout(stylePool, {
        weaponConfiguration: setupStats.weaponConfiguration,
        equipmentIds: setupStats.equipmentIds,
        activeWeapon: setupStats.equipmentEffects.activeWeapon,
        passiveIds: setupStats.equipmentEffects.passiveIds,
        eofStoredSpecialId: loadout.eofStoredSpecialId,
        league: setupStats.league,
        ...(limitToRegions
          ? {
              unlockedRegions: buildRegions,
              includeUnknownAvailability: false,
            }
          : {}),
      })
    : stylePool;
  const loadoutGateOpts = useMemo(
    () => ({
      weaponConfiguration: setupStats.weaponConfiguration,
      equipmentIds: setupStats.equipmentIds,
      activeWeapon: setupStats.equipmentEffects.activeWeapon,
      passiveIds: setupStats.equipmentEffects.passiveIds,
      eofStoredSpecialId: loadout.eofStoredSpecialId,
      league: setupStats.league,
      ...(limitToRegions
        ? {
            unlockedRegions: buildRegions,
            includeUnknownAvailability: false as const,
          }
        : {}),
    }),
    [setupStats, loadout.eofStoredSpecialId, limitToRegions, buildRegions],
  );
  useEffect(() => {
    if (!useBuild && !limitToRegions) return;
    setQueue((current) => {
      const legal = current.filter((id) => {
        const raw = abilityById(id);
        if (!raw) return false;
        const resolved = equipAbilityForLoadout(raw, DISPLAY_CATALOGUE.byId, loadoutGateOpts);
        if (limitToRegions) {
          const gated = filterAbilitiesForLoadout([resolved], loadoutGateOpts);
          if (gated.length === 0) return false;
        }
        if (!useBuild) return true;
        return resolveAbilityCastAvailability(resolved, {
          ...loadoutGateOpts,
          groupPeers: DISPLAY_CATALOGUE.catalogue,
        }).available;
      });
      if (legal.length === current.length) return current;
      saveState(STORAGE_KEY, legal);
      return legal;
    });
  }, [loadoutGateOpts, useBuild]);
  // Map exclusive groups to the loadout-resolved id so a stale base queue entry
  // (pre-cape) does not block the Igneous row as "Replaced by Overpower".
  const selectedVariants = new Map<string, string>();
  for (const id of queue) {
    const raw = abilityById(id);
    if (!raw?.replacementGroup) continue;
    const resolved = useBuild
      ? equipAbilityForLoadout(raw, DISPLAY_CATALOGUE.byId, loadoutGateOpts)
      : raw;
    selectedVariants.set(resolved.replacementGroup!, resolved.id);
  }
  const manualStyles = [...new Set(queue.map((id) => abilityById(id)?.style).filter(Boolean))];
  const manualCombatStyle =
    mode === "revolution" ? loadout.style : manualStyles.join(" + ") || paletteStyle;
  const activeStats = useBuild
    ? setupStats
    : withManualRotationLine(setupStats, {
        combatStyle: manualCombatStyle,
        base,
        level,
        damagePotentialPct: accuracy,
        critPct: critChance,
      });

  const groups = liveResult?.analysis.groups ?? [];
  const contributions =
    liveResult?.analysis.byEffect.filter(
      (row) =>
        row.analysisGroupId == null &&
        (row.totalDamage !== 0 ||
          row.expectedActivations !== 0 ||
          row.expectedTriggerRolls !== 0 ||
          row.expectedAttachedComponents !== 0),
    ) ?? [];
  const scoreBadge = liveResult ? runScoreBadge(liveResult) : null;
  const scoreNote = liveResult ? runDiagnosticsNote(liveResult) : null;
  const expectedLabel = liveResult ? primaryExpectedLabel(liveResult) : "Expected";
  const dpsLabel = liveResult ? primaryManualDpsLabel(liveResult) : "Natural DPS";
  const showScoreStrip = shouldShowRunScoreChrome(liveResult);

  const inputCls =
    "w-full border border-stone-750 bg-transparent px-2 py-1 text-right font-mono text-xs text-parch-50";

  const setRotationMode = (next: "revolution" | "manual") => {
    setMode(next);
    saveRotationMode(next);
  };

  return (
    <div className="rotation-layout">
      <CombatFrame className="rotation-settings">
        <div className="rotation-settings__row">
          <h2>Setup</h2>
          <div className="rotation-settings__checks">
            <label>
              <input
                type="checkbox"
                checked={useBuild}
                onChange={(e) => setUseBuild(e.target.checked)}
              />
              Use Loadout
            </label>
            {mode === "manual" ? (
              <label>
                <input
                  type="checkbox"
                  checked={weave}
                  onChange={(e) => setWeave(e.target.checked)}
                />
                Auto Basic Attacks
              </label>
            ) : null}
            <label>
              <input
                type="checkbox"
                checked={!setupStats.cap.bypass}
                disabled={setupStats.league.ruleset === "equilibrium"}
                aria-label={
                  setupStats.league.ruleset === "equilibrium"
                    ? "Hit cap removed in League"
                    : "30,000 hit cap"
                }
                onChange={(e) => setLoadout({ ...loadout, hitCapEnabled: e.target.checked })}
              />
              {setupStats.league.ruleset === "equilibrium"
                ? "Hit cap removed in League"
                : "30k hit cap"}
            </label>
          </div>
        </div>
        {useBuild ? (
          <>
            <dl className="rotation-facts">
              {(
                [
                  ["Level", setupStats.level],
                  ["Base", setupStats.base],
                  ["DP", `${Math.round(setupStats.dp * 1000) / 10}%`],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <label className="revo-status-control">
              <span>Start adren</span>
              <span>
                <input
                  type="number"
                  value={loadout.startingAdrenaline ?? setupStats.maxAdrenaline}
                  min={0}
                  max={setupStats.maxAdrenaline}
                  step={1}
                  onChange={(e) =>
                    setLoadout({
                      ...loadout,
                      startingAdrenaline: persistStartingAdrenaline(
                        Number(e.target.value),
                        setupStats.maxAdrenaline,
                      ),
                    })
                  }
                  data-testid="rotation-start-adren"
                  aria-label="Starting adrenaline percent"
                />
                <span>%</span>
              </span>
            </label>
          </>
        ) : (
          <div className="rotation-settings__manual">
            <label>
              <span>Base damage</span>
              <input
                type="number"
                value={base}
                onChange={(e) => setBase(Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label>
              <span>Level</span>
              <input
                type="number"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label>
              <span>Damage Potential %</span>
              <input
                type="number"
                value={accuracy}
                onChange={(e) => setAccuracy(Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label>
              <span>Crit %</span>
              <input
                type="number"
                value={critChance}
                onChange={(e) => setCritChance(Number(e.target.value))}
                className={inputCls}
              />
            </label>
          </div>
        )}

        {mode === "manual" ? (
          <>
            <div className="mt-3 flex gap-1">
              {PALETTE_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setPaletteStyle(filter.id)}
                  aria-pressed={paletteStyle === filter.id}
                  className={`combat-button border px-3 py-1.5 text-xs ${
                    paletteStyle === filter.id
                      ? "border-stone-750 bg-stone-850 text-parch-50"
                      : "border-stone-750 text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="mt-3 border-t border-stone-750">
              {palette.map((a) => {
                const selectedVariant = a.replacementGroup
                  ? selectedVariants.get(a.replacementGroup)
                  : undefined;
                // Manual mode: still block double-picking exclusive variants on the queue.
                const reason =
                  selectedVariant && selectedVariant !== a.id
                    ? `Replaced by ${abilityName(selectedVariant)}`
                    : undefined;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      if (reason !== undefined) return;
                      updateQueue([...queue, a.id]);
                    }}
                    disabled={reason !== undefined}
                    aria-disabled={reason !== undefined}
                    title={reason}
                    className="grid w-full grid-cols-[1fr_auto] gap-2 border-b border-stone-750/70 px-2 py-2 text-left text-xs text-parch-300 enabled:hover:bg-white/[0.02] enabled:hover:text-parch-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="flex w-full min-w-0 items-center gap-1.5">
                      <GameIcon
                        src={abilityIconPath(a.id, a.style)}
                        size={16}
                        className="shrink-0"
                      />
                      <span className="min-w-0 truncate">{a.name}</span>
                      <AbilityCategoryChip category={a.category} weaponSpecial={a.weaponSpecial} />
                      <AbilityUnlockMarkers ability={a} />
                    </span>
                    <span className="font-mono">
                      {reason ??
                        (a.adrenaline?.gain
                          ? `+${a.adrenaline.gain}%`
                          : a.adrenaline?.cost
                            ? `${a.adrenaline.cost}%`
                            : "")}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </CombatFrame>

      {mode === "revolution" ? (
        <div className="rotation-workbench">
          <RevolutionPanel
            stats={activeStats}
            loadout={loadout}
            setLoadout={setLoadout}
            combatModel={combatModel}
            useBuild={useBuild}
            onOpenTarget={() => setEditorMode("target")}
            rotationMode={mode}
            onRotationModeChange={setRotationMode}
            limitToRegions={limitToRegions}
            setLimitToRegions={setLimitToRegions}
          />
        </div>
      ) : (
        <CombatFrame className="rotation-workbench rotation-manual">
          <div className="rotation-manual-header">
            <div className="revo-bar-heading__title">
              <h2>
                Queue · {queue.length} casts · 60s
              </h2>
              <div className="revo-mode-toggle" role="group" aria-label="Rotation mode">
                {(["revolution", "manual"] as const).map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => setRotationMode(candidate)}
                    aria-pressed={mode === candidate}
                    className={`revo-mode-toggle__btn${mode === candidate ? " is-active" : ""}`}
                  >
                    {candidate === "revolution" ? "Revolution" : "Manual"}
                  </button>
                ))}
              </div>
            </div>
            <div className="rotation-manual-header__actions">
              <button
                type="button"
                onClick={() => updateQueue([])}
                disabled={queue.length === 0}
                className="combat-button border border-stone-750 px-3 py-1.5 text-xs text-parch-300 hover:bg-white/[0.02] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={run}
                disabled={queue.length === 0}
                className="combat-button border border-stone-750 bg-stone-850 px-3 py-1.5 text-xs text-parch-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Run
              </button>
            </div>
          </div>

          {queue.length === 0 ? (
            <p className="mt-3 text-xs text-parch-300">Add abilities to the queue</p>
          ) : (
            <div className="mt-3 border-t border-stone-750">
              {queue.map((id, index) => {
                const raw = abilityById(id);
                // Show Igneous name when cape is on even if the queue still stores base id.
                const a =
                  useBuild && raw
                    ? equipAbilityForLoadout(raw, DISPLAY_CATALOGUE.byId, loadoutGateOpts)
                    : raw;
                const slotGate =
                  useBuild && a
                    ? resolveAbilityCastAvailability(a, {
                        ...loadoutGateOpts,
                        groupPeers: DISPLAY_CATALOGUE.catalogue,
                      })
                    : ({ available: true } as const);
                const lockReason = !slotGate.available ? slotGate.message : undefined;
                return (
                  <button
                    key={`${id}-${index}`}
                    type="button"
                    title={
                      lockReason
                        ? `${lockReason} · click to remove`
                        : "Remove cast"
                    }
                    onClick={() => updateQueue(queue.filter((_, i) => i !== index))}
                    className={`grid w-full grid-cols-[2rem_1fr_auto] gap-2 border-b border-stone-750/70 px-2 py-1.5 text-left text-xs hover:bg-white/[0.02] ${
                      lockReason
                        ? "text-parch-300/70 opacity-70"
                        : "text-parch-300 hover:text-parch-50"
                    }`}
                  >
                    <span className="font-mono text-parch-300">{index + 1}</span>
                    <span className="flex w-full min-w-0 items-center gap-1.5">
                      {a ? (
                        <>
                          <GameIcon
                            src={abilityIconPath(a.id, a.style)}
                            size={16}
                            className="shrink-0"
                          />
                          <span className="min-w-0 truncate">{a.name}</span>
                          <AbilityCategoryChip
                            category={a.category}
                            weaponSpecial={a.weaponSpecial}
                          />
                          <AbilityUnlockMarkers ability={a} />
                        </>
                      ) : (
                        <span>{abilityName(id)}</span>
                      )}
                    </span>
                    {lockReason ? (
                      <span className="max-w-[12rem] truncate font-mono text-[10px] text-parch-300">
                        {lockReason}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {liveResult && !liveResult.ok ? (
            <p
              className="mt-3 border border-stone-750 px-3 py-2 text-xs text-chaos-300"
              data-testid="rotation-run-error"
            >
              Rotation fails: {liveResult.error}
            </p>
          ) : null}

          {showScoreStrip && liveResult ? (
            <div className="mt-4">
              <dl className="grid grid-cols-2 gap-x-6 border-t border-stone-750 text-sm sm:grid-cols-4">
                <div className="border-b border-stone-750/70 py-2">
                  <dt className="text-xs text-parch-300">{expectedLabel}</dt>
                  <dd className="font-mono text-parch-50" data-testid="rotation-expected">
                    {formatNumber(liveResult.totalExpected)}
                    {scoreBadge ? (
                      <span
                        className="ml-1.5 font-sans text-[10px] uppercase tracking-[0.08em] text-chaos-300"
                        data-testid="rotation-score-badge"
                      >
                        {scoreBadge}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="border-b border-stone-750/70 py-2">
                  <dt className="text-xs text-parch-300">{dpsLabel}</dt>
                  <dd className="font-mono text-parch-50" data-testid="rotation-dps">
                    {formatNumber(liveResult.dps)}
                  </dd>
                </div>
                <div className="border-b border-stone-750/70 py-2">
                  <dt className="text-xs text-parch-300">Min – max</dt>
                  <dd className="font-mono text-parch-50">
                    {formatNumber(liveResult.totalMin)} – {formatNumber(liveResult.totalMax)}
                  </dd>
                </div>
                <div className="border-b border-stone-750/70 py-2">
                  <dt className="text-xs text-parch-300">
                    {liveResult.rng ? "Expected length" : "Length"}
                  </dt>
                  <dd className="font-mono text-parch-50">
                    {formatTicks(liveResult.ticks)} ticks ·{" "}
                    {(liveResult.ticks * TICK_SECONDS).toFixed(1)}s
                  </dd>
                </div>
              </dl>

              <p className="mt-2 text-xs text-parch-300" data-testid="rotation-crit-context">
                Effective crit rate{" "}
                {formatCritContext({
                  critChance: activeStats.critChance,
                  uncappedCritChance: activeStats.uncappedCritChance,
                  convertedCritChance: activeStats.convertedCritChance,
                  critualActive: activeStats.league.blessings.some(
                    (choice) => choice.id === "unholy-critual",
                  ),
                })}
              </p>

              {scoreNote ? (
                <p
                  className="mt-2 text-xs text-chaos-300"
                  data-testid="rotation-score-note"
                  role="note"
                >
                  {scoreNote}
                </p>
              ) : null}

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAnalysisOpen(true)}
                  className="combat-button border border-gem-400 bg-stone-850 px-3 py-1.5 text-xs text-gem-300 hover:bg-stone-800"
                >
                  Analyze damage
                </button>
              </div>

              <CalculationAssumptions stats={activeStats} result={liveResult} />

              <div className="mt-4 overflow-x-auto border-t border-stone-750">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="text-xs text-parch-300">
                    <tr className="border-b border-stone-750">
                      <th className="py-2 pr-4 font-medium">Tick</th>
                      <th className="py-2 pr-4 font-medium">Ability</th>
                      <th className="py-2 pr-4 font-medium">Expected</th>
                      <th
                        className="py-2 font-medium"
                        title="Before cast → after immediate resources → end of occupancy"
                      >
                        Adren (before → resources → end)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveResult.casts.map((cast, index) => (
                      <tr
                        key={`${cast.abilityId}-${index}`}
                        className="border-b border-stone-750/70"
                      >
                        <td className="py-2 pr-4 font-mono text-xs text-parch-300">{cast.tick}</td>
                        <td className="py-2 pr-4 text-parch-50">
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <span>{abilityName(cast.abilityId)}</span>
                            {cast.auto ? (
                              <span className="text-xs text-parch-300">automatic</span>
                            ) : null}
                            {castCritLabel(cast.result) ? (
                              <span
                                className={`text-xs ${
                                  castCritLabel(cast.result) === "Crit"
                                    ? "rotation-crit"
                                    : "text-parch-300"
                                }`}
                              >
                                {castCritLabel(cast.result)}
                              </span>
                            ) : null}
                            {cast.surgingStormAtCast ? (
                              <span
                                className="revo-status-chip"
                                title="Surging Storm: +15% to +25% critical strike damage (FSoA casts)"
                                data-testid="timeline-surging-storm"
                              >
                                <GameIcon
                                  src={
                                    combatEffectIconPath("surging-storm") ??
                                    "/game/combat/status/surging-storm.webp"
                                  }
                                  size={14}
                                  className="shrink-0"
                                />
                                <span className="revo-status-chip-label">
                                  {combatEffectDisplayName("surging-storm") ?? "Surging Storm"}
                                </span>
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-parch-50">
                          {formatNumber(cast.result.expected)}
                        </td>
                        <td className="py-2 font-mono text-xs text-parch-300">
                          {formatAdrenalineTimeline(cast)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 border-t border-stone-750">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-stone-750/70 py-2 text-xs"
                    data-effect-group={group.id}
                  >
                    <span className="text-parch-50">
                      {abilityName(group.id)}
                      <span
                        className="ml-1.5 font-mono text-[10px] text-gold-300"
                        title="Unique grouped triggers"
                      >
                        ×{formatTicks(group.expectedActivations)}
                      </span>
                    </span>
                    <span className="font-mono text-parch-300">
                      {formatNumber(group.totalDamage)}
                    </span>
                    <span className="font-mono text-parch-50">
                      {Math.round(group.share * 1000) / 10}%
                    </span>
                  </div>
                ))}
                {contributions.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-stone-750/70 py-2 text-xs"
                  >
                    <span className="text-parch-50">{abilityName(row.id)}</span>
                    <span className="font-mono text-parch-300">
                      {formatNumber(row.totalDamage)}
                    </span>
                    <span className="font-mono text-parch-50">
                      {Math.round(row.share * 1000) / 10}%
                    </span>
                  </div>
                ))}
              </div>
              <RotationEventPreview result={liveResult} nameForId={abilityName} />
            </div>
          ) : null}
        </CombatFrame>
      )}
      {liveResult?.ok ? (
        <RotationAnalysisModal
          open={analysisOpen}
          result={liveResult}
          stats={activeStats}
          nameForId={abilityName}
          onClose={() => setAnalysisOpen(false)}
        />
      ) : null}
      <LoadoutEditorDialog
        mode={editorMode}
        loadout={loadout}
        setLoadout={setLoadout}
        stats={setupStats}
        onDismiss={() => setEditorMode(null)}
      />
    </div>
  );
}
