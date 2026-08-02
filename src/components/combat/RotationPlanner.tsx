"use client";

import { useEffect, useMemo, useState } from "react";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import { rotationOf } from "@/combat/engine/simulation/contracts";
import { simulate, type RotationSummary } from "@/combat/engine/simulation/simulate";
import { meetsEquipmentRequirement, meetsWeaponRequirement } from "@/combat/engine/cast/rules";
import { TICK_SECONDS } from "@/combat/core/ticks";
import type { CombatStyle } from "@/combat/types";
import { MELEE_ABILITIES } from "@/combat/styles/melee/abilities";
import { RANGED_ABILITIES } from "@/combat/styles/ranged/abilities";
import { MAGIC_ABILITIES } from "@/combat/styles/magic/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "@/combat/styles/necromancy/abilities";
import { abilityIconPath } from "@/lib/gameArt";
import { loadState, saveState } from "@/lib/storage";
import { GameIcon } from "../GameIcon";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import { CombatFrameCorners } from "./CombatFrameCorners";
import { CalculationAssumptions } from "./CalculationAssumptions";
import { critDamageStats, loadoutStats, type CalcStats } from "./loadoutStats";
import { RevolutionPanel } from "./RevolutionPanel";
import { RotationAnalysisModal, RotationEventPreview } from "./RotationAnalysis";
import { useLoadout } from "./useLoadout";
import { useBuild as useLeagueBuild } from "@/league/useBuild";

const STORAGE_KEY = "eq:rotation:v1";

// Volley is factory-built (soul count); 3 = base Residual Soul cap.
const NECRO_PALETTE: AbilitySpec[] = [...NECROMANCY_ABILITIES, volleyOfSouls(3)];

// One combined registry: swapping styles mid-rotation is legal in-game, and the
// sim handles style resources per cast.
const ALL_ABILITIES: AbilitySpec[] = [
  ...MELEE_ABILITIES,
  ...RANGED_ABILITIES,
  ...MAGIC_ABILITIES,
  ...NECRO_PALETTE,
];

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
  return ALL_ABILITIES.find((a) => a.id === id);
}

function abilityName(id: string): string {
  return abilityById(id)?.name ?? id;
}

function castCritLabel(result: RotationSummary["casts"][number]["result"]): string | null {
  const chance = Math.max(0, ...result.hits.map((hit) => hit.critChance));
  if (chance >= 1) return "Crit";
  return chance > 0 ? `${Math.round(chance * 1000) / 10}% crit EV` : null;
}

/** Assumptions scaffold only — sim path builds SimulateInput directly. */
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
    damagePotentialSource:
      line.damagePotentialPct === 100 ? "100% assumption" : "manual override",
    equipmentIds: [],
    weaponConfiguration: line.combatStyle === "necromancy" ? "necromancy" : "twohand",
    globalModifiers: [],
    castModifiersFor: () => [],
  };
}

export function RotationPlanner() {
  const [loadout, setLoadout] = useLoadout();
  const { build } = useLeagueBuild();
  const [mode, setMode] = useState<"revolution" | "manual">("revolution");
  const [useBuild, setUseBuild] = useState(true);
  const [weave, setWeave] = useState(true);
  const [base, setBase] = useState(1000);
  const [level, setLevel] = useState(99);
  const [accuracy, setAccuracy] = useState(100);
  const [critChance, setCritChance] = useState(10);
  const [paletteStyle, setPaletteStyle] = useState<CombatStyle>("melee");
  const [ammo, setAmmo] = useState<"none" | "deathspore">("none");
  const [queue, setQueue] = useState<string[]>([]);
  const [result, setResult] = useState<RotationSummary | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  useEffect(() => {
    const stored = loadState<unknown>(STORAGE_KEY, []);
    const list = Array.isArray(stored) ? stored : [];
    setQueue(
      list.filter(
        (id): id is string => typeof id === "string" && ALL_ABILITIES.some((a) => a.id === id),
      ),
    );
  }, []);

  const setupStats = useMemo(
    () =>
      loadoutStats(
        loadout,
        useBuild ? { blessingPicks: build.blessingPicks } : { ruleset: "base" },
      ),
    [loadout, useBuild, build.blessingPicks],
  );

  const updateQueue = (next: string[]) => {
    setQueue(next);
    saveState(STORAGE_KEY, next);
  };

  const run = () => {
    setAnalysisOpen(false);
    const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
    if (useBuild) {
      setResult(
        simulate({
          base: setupStats.base,
          level: setupStats.level,
          accuracy: setupStats.dp,
          crit: {
            chance: setupStats.critChance,
            disabled: setupStats.critsDisabled,
            damageBonus: setupStats.critDamageBonus,
          },
          abilities: ALL_ABILITIES,
          rotation: rotationOf(...queue),
          modifiers: setupStats.globalModifiers,
          adrenaline: setupStats.adrenaline,
          procs: setupStats.procs,
          plantedFeet: setupStats.plantedFeet,
          preciseRank: setupStats.preciseRank,
          conjureBasicDamageMult: setupStats.conjureBasicDamageMult,
          conjureDurationMult: setupStats.conjureDurationMult,
          tumekensPieces: setupStats.tumekensPieces,
          tumekensCritEnabled: setupStats.tumekensCritEnabled,
          equipmentEffects: setupStats.equipmentEffects,
          league: setupStats.league,
          context: setupStats.combatContext,
          targetHpPercent: loadout.target?.hpPercent,
          cap: setupStats.cap,
          startingAdrenaline: setupStats.startingAdrenaline,
          equipmentIds: setupStats.equipmentIds,
          weaponConfiguration: setupStats.weaponConfiguration,
          autoWeave: weave,
          ammo: ammo === "none" ? undefined : ammo,
        }),
      );
      return;
    }
    setResult(
      simulate({
        base: Math.max(0, finite(base, 0)),
        level: Math.min(Math.max(1, finite(level, 99)), 145),
        accuracy: Math.min(Math.max(0, finite(accuracy, 100)), 100) / 100,
        crit: { chance: Math.min(Math.max(0, finite(critChance, 10)), 100) / 100 },
        abilities: ALL_ABILITIES,
        rotation: rotationOf(...queue),
        cap: setupStats.cap,
        startingAdrenaline: setupStats.startingAdrenaline,
        autoWeave: weave,
        ammo: ammo === "none" ? undefined : ammo,
      }),
    );
  };

  const palette = ALL_ABILITIES.filter((a) => a.style === paletteStyle);
  const selectedVariants = new Map<string, string>();
  for (const id of queue) {
    const ability = abilityById(id);
    if (ability?.replacementGroup) selectedVariants.set(ability.replacementGroup, ability.id);
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

  const contributions = result?.analysis.byEffect ?? [];

  const inputCls =
    "w-full border border-stone-750 bg-transparent px-2 py-1 text-right font-mono text-xs text-parch-50";

  return (
    <div className="rotation-layout">
      <div className="combat-frame rotation-settings">
        <CombatFrameCorners />
        <h2 className="combat-page-title text-sm font-medium text-parch-50">Rotation</h2>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <label className="flex items-center gap-2 text-xs text-parch-300">
            <input
              type="checkbox"
              checked={useBuild}
              onChange={(e) => setUseBuild(e.target.checked)}
            />
            Use Loadout
          </label>
          {mode === "manual" ? (
            <label className="flex items-center gap-2 text-xs text-parch-300">
              <input type="checkbox" checked={weave} onChange={(e) => setWeave(e.target.checked)} />
              Auto-weave basics
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-xs text-parch-300">
            <input
              type="checkbox"
              checked={loadout.hitCapEnabled}
              aria-label="30,000 hit cap"
              onChange={(e) => setLoadout({ ...loadout, hitCapEnabled: e.target.checked })}
            />
            30,000 hit cap
          </label>
        </div>
        {useBuild ? (
          <dl className="rotation-facts mt-2 grid grid-cols-2 gap-x-4 border-t border-stone-750 text-xs sm:grid-cols-4">
            {(
              [
                ["Level", setupStats.level],
                ["Base", setupStats.base],
                ["DP", `${Math.round(setupStats.dp * 1000) / 10}%`],
                ["Crit", `${Math.round(setupStats.critChance * 1000) / 10}%`],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="border-b border-stone-750/70 py-1.5">
                <dt className="text-parch-300">{label}</dt>
                <dd className="font-mono text-parch-50">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-parch-300">
            <label className="grid gap-1">
              <span>Base damage</span>
              <input
                type="number"
                value={base}
                onChange={(e) => setBase(Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label className="grid gap-1">
              <span>Level</span>
              <input
                type="number"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label className="grid gap-1">
              <span>Damage Potential %</span>
              <input
                type="number"
                value={accuracy}
                onChange={(e) => setAccuracy(Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label className="grid gap-1">
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
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-parch-300">
          <label className="grid gap-1">
            <span>Ammo</span>
            <select
              value={ammo}
              onChange={(e) => setAmmo(e.target.value as "none" | "deathspore")}
              className="w-full border border-stone-750 bg-transparent px-2 py-1 text-xs text-parch-50"
            >
              <option value="none">None</option>
              <option value="deathspore">Deathspore arrows</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex gap-1 border-t border-stone-750 pt-3">
          {(["revolution", "manual"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setMode(candidate)}
              aria-pressed={mode === candidate}
              className={`combat-button border px-3 py-1.5 text-xs capitalize ${
                mode === candidate
                  ? "border-stone-750 bg-stone-850 text-parch-50"
                  : "border-stone-750 text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
              }`}
            >
              {candidate}
            </button>
          ))}
        </div>

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
                const reason =
                  selectedVariant && selectedVariant !== a.id
                    ? `Replaced by ${abilityName(selectedVariant)}`
                    : useBuild && !meetsWeaponRequirement(a, setupStats.weaponConfiguration)
                      ? `Requires ${
                          a.weaponRequirement === "conduit"
                            ? "a conduit"
                            : a.weaponRequirement === "death-guard-and-conduit"
                              ? "death guard and conduit"
                              : (a.weaponRequirement ??
                                (a.style === "necromancy"
                                  ? "a necromancy weapon"
                                  : `${a.style} weapon`))
                        }`
                      : useBuild && !meetsEquipmentRequirement(a, setupStats.equipmentIds)
                        ? "Requires an Igneous cape"
                        : undefined;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => updateQueue([...queue, a.id])}
                    disabled={reason !== undefined}
                    title={reason}
                    className="grid w-full grid-cols-[1fr_auto] gap-2 border-b border-stone-750/70 px-2 py-2 text-left text-xs text-parch-300 enabled:hover:bg-white/[0.02] enabled:hover:text-parch-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <GameIcon
                        src={abilityIconPath(a.id, a.style)}
                        size={16}
                        className="shrink-0"
                      />
                      <span className="min-w-0 truncate">{a.name}</span>
                      <AbilityCategoryChip category={a.category} />
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
      </div>

      {mode === "revolution" ? (
        <div className="combat-frame rotation-workbench">
          <CombatFrameCorners />
          <RevolutionPanel stats={activeStats} />
        </div>
      ) : (
        <div className="combat-frame rotation-workbench rotation-manual">
          <CombatFrameCorners />
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium text-parch-50">Queue · {queue.length} casts</h2>
            <div className="flex gap-2">
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
              {queue.map((id, index) => (
                <button
                  key={`${id}-${index}`}
                  type="button"
                  title="Remove cast"
                  onClick={() => updateQueue(queue.filter((_, i) => i !== index))}
                  className="grid w-full grid-cols-[2rem_1fr] gap-2 border-b border-stone-750/70 px-2 py-1.5 text-left text-xs text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
                >
                  <span className="font-mono text-parch-300">{index + 1}</span>
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    {(() => {
                      const a = abilityById(id);
                      return a ? (
                        <>
                          <GameIcon
                            src={abilityIconPath(a.id, a.style)}
                            size={16}
                            className="shrink-0"
                          />
                          <span className="min-w-0 truncate">{a.name}</span>
                          <AbilityCategoryChip category={a.category} />
                        </>
                      ) : (
                        <span>{abilityName(id)}</span>
                      );
                    })()}
                  </span>
                </button>
              ))}
            </div>
          )}

          {result ? (
            <div className="mt-4">
              {result.ok ? (
                <>
                  <dl className="grid grid-cols-2 gap-x-6 border-t border-stone-750 text-sm sm:grid-cols-4">
                    <div className="border-b border-stone-750/70 py-2">
                      <dt className="text-xs text-parch-300">Expected</dt>
                      <dd className="font-mono text-parch-50">
                        {formatNumber(result.totalExpected)}
                      </dd>
                    </div>
                    <div className="border-b border-stone-750/70 py-2">
                      <dt className="text-xs text-parch-300">
                        {result.metric.type === "fixed-window"
                          ? "Fixed-window DPS"
                          : result.rng
                            ? "Expected natural DPS"
                            : "Natural DPS"}
                      </dt>
                      <dd className="font-mono text-parch-50">{formatNumber(result.dps)}</dd>
                    </div>
                    <div className="border-b border-stone-750/70 py-2">
                      <dt className="text-xs text-parch-300">Min – max</dt>
                      <dd className="font-mono text-parch-50">
                        {formatNumber(result.totalMin)} – {formatNumber(result.totalMax)}
                      </dd>
                    </div>
                    <div className="border-b border-stone-750/70 py-2">
                      <dt className="text-xs text-parch-300">
                        {result.rng ? "Expected length" : "Length"}
                      </dt>
                      <dd className="font-mono text-parch-50">
                        {formatTicks(result.ticks)} ticks ·{" "}
                        {(result.ticks * TICK_SECONDS).toFixed(1)}s
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

                  <CalculationAssumptions stats={activeStats} result={result} />

                  <div className="mt-4 overflow-x-auto border-t border-stone-750">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="text-xs text-parch-300">
                        <tr className="border-b border-stone-750">
                          <th className="py-2 pr-4 font-medium">Tick</th>
                          <th className="py-2 pr-4 font-medium">Ability</th>
                          <th className="py-2 pr-4 font-medium">Expected</th>
                          <th className="py-2 font-medium">Adrenaline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.casts.map((cast, index) => (
                          <tr
                            key={`${cast.abilityId}-${index}`}
                            className="border-b border-stone-750/70"
                          >
                            <td className="py-2 pr-4 font-mono text-xs text-parch-300">
                              {cast.tick}
                            </td>
                            <td className="py-2 pr-4 text-parch-50">
                              {abilityName(cast.abilityId)}
                              {cast.auto ? (
                                <span className="ml-1.5 text-xs text-parch-300">auto</span>
                              ) : null}
                              {castCritLabel(cast.result) ? (
                                <span
                                  className={`ml-1.5 text-xs ${
                                    castCritLabel(cast.result) === "Crit"
                                      ? "rotation-crit"
                                      : "text-parch-300"
                                  }`}
                                >
                                  {castCritLabel(cast.result)}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2 pr-4 font-mono text-xs text-parch-50">
                              {formatNumber(cast.result.expected)}
                            </td>
                            <td className="py-2 font-mono text-xs text-parch-300">
                              {cast.adrenalineAfter}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 border-t border-stone-750">
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
                  <RotationEventPreview result={result} nameForId={abilityName} />
                </>
              ) : (
                <p className="mt-3 border border-stone-750 px-3 py-2 text-xs text-parch-300">
                  Rotation fails: {result.error}
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}
      {result?.ok ? (
        <RotationAnalysisModal
          open={analysisOpen}
          result={result}
          stats={activeStats}
          nameForId={abilityName}
          onClose={() => setAnalysisOpen(false)}
        />
      ) : null}
    </div>
  );
}
