"use client";

import { useMemo, useState } from "react";
import { combatRevolutionBars, type RevolutionBarRecord } from "@/combat/data";
import { resolveBar, type ResolvedSlot } from "@/combat/data/specs";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { RotationSummary } from "@/combat/rotation/simulate";
import { simulateRevolution as runRevolution } from "@/combat/rotation/revolution";
import { secondsToTicks, ticksToSeconds } from "@/combat/rotation/timeline";
import { MELEE_ABILITIES } from "@/combat/styles/melee/abilities";
import { RANGED_ABILITIES } from "@/combat/styles/ranged/abilities";
import { MAGIC_ABILITIES } from "@/combat/styles/magic/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "@/combat/styles/necromancy/abilities";
import type { CalcStats } from "./loadoutStats";
import { NumberField } from "./NumberField";

const ENGINE_SPECS: ReadonlyMap<string, AbilitySpec> = new Map(
  [
    ...MELEE_ABILITIES,
    ...RANGED_ABILITIES,
    ...MAGIC_ABILITIES,
    ...NECROMANCY_ABILITIES,
    volleyOfSouls(3),
  ].map((spec) => [spec.id, spec]),
);

const SUPPORTED_BARS = combatRevolutionBars.records.filter((bar) => bar.supported);
const UNSUPPORTED_BARS = combatRevolutionBars.records.filter((bar) => !bar.supported);

const DEFAULT_DURATION_SECONDS = 60;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

/** Compact wall-clock for cast rows (e.g. 3.6s). */
function formatTime(ticks: number): string {
  const seconds = ticksToSeconds(ticks);
  return `${seconds.toFixed(1)}s`;
}

/** Horizon label: "60s · 100 ticks" (whole seconds when clean). */
function formatHorizon(ticks: number): string {
  if (ticks <= 0) return "—";
  const seconds = ticksToSeconds(ticks);
  const secLabel = Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
  return `${secLabel} · ${ticks} ticks`;
}

function BarGraphic({ slots }: { slots: ResolvedSlot[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1" role="list" aria-label="Revolution bar">
      {slots.map((slot, index) => (
        <div
          key={`${slot.name}-${index}`}
          role="listitem"
          title={slot.modelledBy === "unmodelled" ? "No sourced band — skipped in the sim" : slot.name}
          className={`w-24 border px-1.5 py-1 ${
            slot.modelledBy === "unmodelled"
              ? "border-dashed border-stone-750 text-parch-300/60"
              : "border-stone-750 bg-stone-850 text-parch-50"
          }`}
        >
          <div className="font-mono text-[11px] text-parch-300">{index + 1}</div>
          <div className="text-[11px] leading-tight">{slot.name}</div>
          {slot.modelledBy === "unmodelled" ? (
            <div className="text-[11px] text-parch-300/60">unmodelled</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Revolution mode: wiki bars over a continuous horizon (default 60s), GCD basics when
 *  nothing on the bar is ready/affordable. */
export function RevolutionPanel({ stats }: { stats: CalcStats }) {
  const [barId, setBarId] = useState(SUPPORTED_BARS[0]?.id ?? "");
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [result, setResult] = useState<RotationSummary | null>(null);
  const [showAllCasts, setShowAllCasts] = useState(false);

  const bar: RevolutionBarRecord | undefined =
    SUPPORTED_BARS.find((candidate) => candidate.id === barId) ?? SUPPORTED_BARS[0];
  const slots = useMemo(() => (bar ? resolveBar(bar, ENGINE_SPECS) : []), [bar]);
  const modelled = slots.filter((slot) => slot.spec !== null).map((slot) => slot.spec!);
  const unmodelled = slots.filter((slot) => slot.modelledBy === "unmodelled");
  const nameById = useMemo(() => {
    const map = new Map(slots.filter((slot) => slot.spec).map((slot) => [slot.spec!.id, slot.name]));
    for (const spec of ENGINE_SPECS.values()) {
      if (!map.has(spec.id)) map.set(spec.id, spec.name);
    }
    return map;
  }, [slots]);

  const plannedTicks = secondsToTicks(Math.max(6, Number.isFinite(durationSeconds) ? durationSeconds : DEFAULT_DURATION_SECONDS));

  const run = () => {
    if (!bar) return;
    const durationTicks = secondsToTicks(Math.max(6, Number.isFinite(durationSeconds) ? durationSeconds : DEFAULT_DURATION_SECONDS));
    setShowAllCasts(false);
    setResult(
      runRevolution({
        base: stats.base,
        level: stats.level,
        accuracy: stats.dp,
        crit: { chance: stats.critChance },
        abilities: [...ENGINE_SPECS.values(), ...modelled],
        bar: modelled,
        style: bar.style,
        durationTicks,
        // Global loadout mods + per-cast perk scopes (Ultimatums, Lunging).
        modifiers: (ability) => stats.castModifiersFor(ability),
      }),
    );
  };

  const contributions = result
    ? Object.entries(result.perAbility)
        .map(([id, expected]) => ({
          id,
          name: nameById.get(id) ?? id,
          expected,
          share: result.totalExpected > 0 ? expected / result.totalExpected : 0,
          count: result.casts.filter((c) => c.abilityId === id).length,
        }))
        .sort((a, b) => b.expected - a.expected)
    : [];

  const basicCount = result?.casts.filter((c) => c.auto).length ?? 0;
  const horizonTicks = result?.horizonTicks ?? 0;
  const castLog = result
    ? showAllCasts
      ? result.casts
      : result.casts.slice(0, 40)
    : [];

  return (
    <div>
      <p className="mb-3 text-xs text-parch-300">
        Continuous revo over the duration: each GCD fires the first bar ability that is off
        cooldown and affordable; otherwise the style basic auto-weaves. Expected values only.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1 text-parch-300">
          Bar
          <select
            value={bar?.id ?? ""}
            onChange={(event) => setBarId(event.target.value)}
            className="border border-stone-750 bg-transparent px-2 py-1 text-parch-50"
          >
            {SUPPORTED_BARS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.style === "melee" ? `Melee (${candidate.setup.toLowerCase()})` : candidate.style}
              </option>
            ))}
            {UNSUPPORTED_BARS.map((candidate) => (
              <option key={candidate.id} value={candidate.id} disabled>
                {candidate.style} — unsupported yet
              </option>
            ))}
          </select>
        </label>
        <span className="text-parch-300">
          {modelled.length} of {slots.length} slots modelled
          {unmodelled.length > 0 ? ` · ${unmodelled.length} skipped` : ""}
        </span>
      </div>

      <BarGraphic slots={slots} />

      <div className="mt-3 grid gap-3 sm:grid-cols-[220px_auto] sm:items-end">
        <div>
          <NumberField
            label="Duration"
            value={durationSeconds}
            onChange={setDurationSeconds}
            suffix="s"
          />
          <p className="mt-1 text-[11px] text-parch-300" data-testid="revo-horizon-plan">
            Horizon {formatHorizon(plannedTicks)}
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={run}
            className="border border-stone-750 bg-stone-850 px-3 py-1.5 text-xs text-parch-50 hover:bg-stone-800"
          >
            Run revolution
          </button>
        </div>
      </div>

      {result && !result.ok ? (
        <p className="mt-3 text-xs text-chaos-300">{result.error}</p>
      ) : null}

      {!result ? (
        <p className="mt-4 border-t border-stone-750 pt-3 text-xs text-parch-300" data-testid="revo-empty">
          Run revolution for a full duration cast log
        </p>
      ) : null}

      {result?.ok ? (
        <div className="mt-4">
          <dl className="grid grid-cols-2 gap-x-6 border-t border-stone-750 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <div className="border-b border-stone-750/70 py-2">
              <dt className="text-xs text-parch-300">Horizon</dt>
              <dd className="font-mono text-parch-50" data-testid="revo-horizon">
                {formatHorizon(horizonTicks)}
              </dd>
            </div>
            <div className="border-b border-stone-750/70 py-2">
              <dt className="text-xs text-parch-300">Casts</dt>
              <dd className="font-mono text-parch-50" data-testid="revo-casts">
                {result.casts.length}
                <span className="text-parch-300"> · {basicCount} basic</span>
              </dd>
            </div>
            <div className="border-b border-stone-750/70 py-2">
              <dt className="text-xs text-parch-300">Expected</dt>
              <dd className="font-mono text-parch-50">{formatNumber(result.totalExpected)}</dd>
            </div>
            <div className="border-b border-stone-750/70 py-2">
              <dt className="text-xs text-parch-300">DPS (horizon)</dt>
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

          <h3 className="mt-5 text-xs font-medium text-parch-50">Cast timeline</h3>
          <p className="mt-1 text-xs text-parch-300">
            One row per GCD. Basics are auto-woven when the bar has nothing ready or affordable.
          </p>
          <div className="mt-2 max-h-80 overflow-y-auto border-t border-stone-750" data-testid="revo-cast-timeline">
            <table className="w-full min-w-[520px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-stone-900 text-parch-300">
                <tr className="border-b border-stone-750">
                  <th className="py-1.5 pr-2 font-medium">#</th>
                  <th className="py-1.5 pr-2 font-medium">Tick</th>
                  <th className="py-1.5 pr-2 font-medium">Time</th>
                  <th className="py-1.5 pr-2 font-medium">Ability</th>
                  <th className="py-1.5 pr-2 font-medium">Adren</th>
                  <th className="py-1.5 font-medium">Expected</th>
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
                    <td className="py-1 pr-2 font-mono text-parch-300">{formatTime(cast.tick)}</td>
                    <td className="py-1 pr-2 text-parch-50">
                      {nameById.get(cast.abilityId) ?? cast.abilityId}
                      {cast.auto ? (
                        <span className="ml-1.5 inline-block border border-gem-600/50 bg-stone-850 px-1 py-px font-mono text-[10px] uppercase tracking-wide text-gem-300">
                          basic
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1 pr-2 font-mono text-parch-300">{cast.adrenalineAfter}%</td>
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

          <h3 className="mt-5 text-xs font-medium text-parch-50">Damage by ability</h3>
          <div className="mt-2 border-t border-stone-750">
            {contributions.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-stone-750/70 py-2 text-xs"
              >
                <span className="text-parch-50">
                  {row.name}
                  <span className="ml-1.5 font-mono text-parch-300">×{row.count}</span>
                </span>
                <span className="font-mono text-parch-300">{formatNumber(row.expected)}</span>
                <span className="font-mono text-parch-50">{Math.round(row.share * 1000) / 10}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
