"use client";

import { useEffect, useState } from "react";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import { rotationOf } from "@/combat/rotation/actions";
import { simulate, type RotationSummary } from "@/combat/rotation/simulate";
import { TICK_SECONDS } from "@/combat/rotation/timeline";
import type { CombatStyle } from "@/combat/types";
import { MELEE_ABILITIES } from "@/combat/styles/melee/abilities";
import { RANGED_ABILITIES } from "@/combat/styles/ranged/abilities";
import { MAGIC_ABILITIES } from "@/combat/styles/magic/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "@/combat/styles/necromancy/abilities";
import { loadState, saveState } from "@/lib/storage";
import { loadoutStats, type CalcStats } from "./loadoutStats";
import { RevolutionPanel } from "./RevolutionPanel";
import { useLoadout } from "./useLoadout";

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

function abilityName(id: string): string {
  return ALL_ABILITIES.find((a) => a.id === id)?.name ?? id;
}

export function RotationPlanner() {
  const [loadout] = useLoadout();
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

  useEffect(() => {
    const stored = loadState<unknown>(STORAGE_KEY, []);
    const list = Array.isArray(stored) ? stored : [];
    setQueue(list.filter((id): id is string => typeof id === "string" && ALL_ABILITIES.some((a) => a.id === id)));
  }, []);

  const updateQueue = (next: string[]) => {
    setQueue(next);
    saveState(STORAGE_KEY, next);
  };

  const run = () => {
    const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
    if (useBuild) {
      const stats = loadoutStats(loadout);
      setResult(
        simulate({
          base: stats.base,
          level: stats.level,
          accuracy: stats.dp,
          crit: { chance: stats.critChance },
          abilities: ALL_ABILITIES,
          rotation: rotationOf(...queue),
          modifiers: stats.globalModifiers,
          adrenaline: stats.adrenaline,
          procs: stats.procs,
          plantedFeet: stats.plantedFeet,
          conjureBasicDamageMult: stats.conjureBasicDamageMult,
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
        autoWeave: weave,
        ammo: ammo === "none" ? undefined : ammo,
      }),
    );
  };

  const palette = ALL_ABILITIES.filter((a) => a.style === paletteStyle);
  const buildStats = loadoutStats(loadout);
  const manualStats: CalcStats = {
    base: Math.max(0, base),
    level: Math.min(Math.max(1, level), 145),
    attackLevel: Math.min(Math.max(1, level), 145),
    dp: Math.min(Math.max(0, accuracy), 100) / 100,
    critChance: Math.min(Math.max(0, critChance), 100) / 100,
    critDamageBonus: 0,
    globalModifiers: [],
    castModifiersFor: () => [],
  };
  const activeStats = useBuild ? buildStats : manualStats;

  const contributions = result
    ? Object.entries(result.perAbility)
        .map(([id, expected]) => ({ id, expected, share: result.totalExpected > 0 ? expected / result.totalExpected : 0 }))
        .sort((a, b) => b.expected - a.expected)
    : [];

  const inputCls = "w-full border border-stone-750 bg-transparent px-2 py-1 text-right font-mono text-xs text-parch-50";

  return (
    <div className="grid gap-5 py-5 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-medium text-parch-50">Rotation</h2>
        <p className="mt-1 text-xs text-parch-300">
          Revolution runs the wiki&apos;s recommended bars by default; switch to Manual for
          deliberate cast-by-cast work.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <label className="flex items-center gap-2 text-xs text-parch-300">
            <input type="checkbox" checked={useBuild} onChange={(e) => setUseBuild(e.target.checked)} />
            Use Setup loadout
          </label>
          {mode === "manual" ? (
            <label className="flex items-center gap-2 text-xs text-parch-300" title="Basics auto-fire in GCD gaps and adrenaline shortfalls, as in game">
              <input type="checkbox" checked={weave} onChange={(e) => setWeave(e.target.checked)} />
              Auto-weave basics
            </label>
          ) : null}
        </div>
        {useBuild ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 border-t border-stone-750 text-xs sm:grid-cols-4">
            {(
              [
                ["Level", buildStats.level],
                ["Base", buildStats.base],
                ["DP", `${Math.round(buildStats.dp * 1000) / 10}%`],
                ["Crit", `${Math.round(buildStats.critChance * 1000) / 10}%`],
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
              <input type="number" value={base} onChange={(e) => setBase(Number(e.target.value))} className={inputCls} />
            </label>
            <label className="grid gap-1">
              <span>Level</span>
              <input type="number" value={level} onChange={(e) => setLevel(Number(e.target.value))} className={inputCls} />
            </label>
            <label className="grid gap-1">
              <span>Accuracy %</span>
              <input type="number" value={accuracy} onChange={(e) => setAccuracy(Number(e.target.value))} className={inputCls} />
            </label>
            <label className="grid gap-1">
              <span>Crit %</span>
              <input type="number" value={critChance} onChange={(e) => setCritChance(Number(e.target.value))} className={inputCls} />
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
              className={`border px-3 py-1.5 text-xs capitalize ${
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
                  className={`border px-3 py-1.5 text-xs ${
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
              {palette.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => updateQueue([...queue, a.id])}
                  className="grid w-full grid-cols-[1fr_auto] gap-2 border-b border-stone-750/70 px-2 py-2 text-left text-xs text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
                >
                  <span>{a.name}</span>
                  <span className="font-mono">
                    {a.adrenaline?.gain ? `+${a.adrenaline.gain}%` : a.adrenaline?.cost ? `${a.adrenaline.cost}%` : ""}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {mode === "revolution" ? (
        <div>
          <RevolutionPanel stats={activeStats} />
        </div>
      ) : (
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-parch-50">Queue · {queue.length} casts</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateQueue([])}
              disabled={queue.length === 0}
              className="border border-stone-750 px-3 py-1.5 text-xs text-parch-300 hover:bg-white/[0.02] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={run}
              disabled={queue.length === 0}
              className="border border-stone-750 bg-stone-850 px-3 py-1.5 text-xs text-parch-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Run
            </button>
          </div>
        </div>

        {queue.length === 0 ? (
          <p className="mt-3 text-xs text-parch-300">Add abilities from the list to build a rotation.</p>
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
                <span>{abilityName(id)}</span>
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
                    <dd className="font-mono text-parch-50">{formatNumber(result.totalExpected)}</dd>
                  </div>
                  <div className="border-b border-stone-750/70 py-2">
                    <dt className="text-xs text-parch-300">DPS</dt>
                    <dd className="font-mono text-parch-50">{formatNumber(result.dps)}</dd>
                  </div>
                  <div className="border-b border-stone-750/70 py-2">
                    <dt className="text-xs text-parch-300">Min – max</dt>
                    <dd className="font-mono text-parch-50">
                      {formatNumber(result.totalMin)} – {formatNumber(result.totalMax)}
                    </dd>
                  </div>
                  <div className="border-b border-stone-750/70 py-2">
                    <dt className="text-xs text-parch-300">Length</dt>
                    <dd className="font-mono text-parch-50">
                      {result.ticks} ticks · {(result.ticks * TICK_SECONDS).toFixed(1)}s
                    </dd>
                  </div>
                </dl>

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
                        <tr key={`${cast.abilityId}-${index}`} className="border-b border-stone-750/70">
                          <td className="py-2 pr-4 font-mono text-xs text-parch-300">{cast.tick}</td>
                          <td className="py-2 pr-4 text-parch-50">
                            {abilityName(cast.abilityId)}
                            {cast.auto ? <span className="ml-1.5 text-xs text-parch-300">auto</span> : null}
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs text-parch-50">{formatNumber(cast.result.expected)}</td>
                          <td className="py-2 font-mono text-xs text-parch-300">{cast.adrenalineAfter}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 border-t border-stone-750">
                  {contributions.map((row) => (
                    <div key={row.id} className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-stone-750/70 py-2 text-xs">
                      <span className="text-parch-50">{abilityName(row.id)}</span>
                      <span className="font-mono text-parch-300">{formatNumber(row.expected)}</span>
                      <span className="font-mono text-parch-50">{Math.round(row.share * 1000) / 10}%</span>
                    </div>
                  ))}
                </div>
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
    </div>
  );
}
