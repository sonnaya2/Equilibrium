"use client";

import { useEffect, useMemo, useState } from "react";
import { combatRevolutionBars, type RevolutionBarRecord } from "@/combat/data";
import * as combatSpecs from "@/combat/data/specs";
import { resolveBar, type ResolvedSlot } from "@/combat/data/specs";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { RotationSummary } from "@/combat/rotation/simulate";
import { simulateRevolution as runRevolution } from "@/combat/rotation/revolution";
import { secondsToTicks, ticksToSeconds } from "@/combat/rotation/timeline";
import { MELEE_ABILITIES } from "@/combat/styles/melee/abilities";
import { RANGED_ABILITIES } from "@/combat/styles/ranged/abilities";
import { MAGIC_ABILITIES } from "@/combat/styles/magic/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "@/combat/styles/necromancy/abilities";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import type { CalcStats } from "./loadoutStats";
import { DEFAULT_LOADOUT, useLoadout } from "./useLoadout";

const ENGINE_SPECS: ReadonlyMap<string, AbilitySpec> = new Map(
  [
    ...MELEE_ABILITIES,
    ...RANGED_ABILITIES,
    ...MAGIC_ABILITIES,
    ...NECROMANCY_ABILITIES,
    volleyOfSouls(3),
  ].map((spec) => [spec.id, spec]),
);

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

/** Compact wall-clock for cast rows (e.g. 3.6s). */
function formatTime(ticks: number): string {
  const seconds = ticksToSeconds(ticks);
  return `${seconds.toFixed(1)}s`;
}



function styleLabel(style: string): string {
  if (style in STYLE_LABEL) return STYLE_LABEL[style as keyof typeof STYLE_LABEL];
  return style.charAt(0).toUpperCase() + style.slice(1);
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

function isHybridBar(bar: RevoBarView, slotCount: number): boolean {
  return bar.mode === "hybrid" || slotCount > bar.revolutionSize;
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

function BarGraphic({
  slots,
  revoSize,
}: {
  slots: ResolvedSlot[];
  revoSize: number;
}) {
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

/** Revolution mode: wiki bars over a continuous horizon (default 60s), GCD basics when
 *  nothing on the bar is ready/affordable. */
export function RevolutionPanel({ stats }: { stats: CalcStats }) {
  const [loadout] = useLoadout();
  const [barId, setBarId] = useState(
    () => pickBarForStyle(DEFAULT_LOADOUT.style)?.id ?? SUPPORTED_BARS[0]?.id ?? "",
  );
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [result, setResult] = useState<RotationSummary | null>(null);
  const [showAllCasts, setShowAllCasts] = useState(false);

  const bar: RevoBarView | undefined =
    SUPPORTED_BARS.find((candidate) => candidate.id === barId) ??
    pickBarForStyle(loadout.style) ??
    SUPPORTED_BARS[0];
  const styleMismatch = Boolean(bar && bar.style !== loadout.style);
  const slots = useMemo(() => (bar ? resolveBar(bar, ENGINE_SPECS) : []), [bar]);
  const revoSize = bar?.revolutionSize ?? slots.length;
  const managedSlots = useMemo(
    () => (bar ? slots.slice(0, bar.revolutionSize) : []),
    [bar, slots],
  );
  const modelled = useMemo(() => (bar ? revoManagedModelled(bar) : []), [bar]);
  const unmodelled = managedSlots.filter((slot) => slot.modelledBy === "unmodelled");
  const keybindCount = Math.max(0, slots.length - revoSize);
  const hybrid = bar ? isHybridBar(bar, slots.length) : false;
  const nameById = useMemo(() => {
    const map = new Map(slots.filter((slot) => slot.spec).map((slot) => [slot.spec!.id, slot.name]));
    for (const spec of ENGINE_SPECS.values()) {
      if (!map.has(spec.id)) map.set(spec.id, spec.name);
    }
    return map;
  }, [slots]);

  const plannedTicks = secondsToTicks(Math.max(6, Number.isFinite(durationSeconds) ? durationSeconds : DEFAULT_DURATION_SECONDS));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Wave F1 style auto-switch
  }, [loadout.style]);

  const selectBar = (id: string) => {
    setBarId(id);
    setResult(null);
    setShowAllCasts(false);
  };

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
        adrenaline: stats.adrenaline,
        procs: stats.procs,
        plantedFeet: stats.plantedFeet,
        conjureBasicDamageMult: stats.conjureBasicDamageMult,
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
    <div className="revolution-panel">
      <div className="revo-toolbar flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1 text-parch-300">
          Bar
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
          {modelled.length === managedSlots.length && managedSlots.length > 0
            ? `All ${managedSlots.length} revo slots ready`
            : `${modelled.length} of ${managedSlots.length} revo slots ready`}
          {unmodelled.length > 0 ? ` · ${unmodelled.length} skipped` : ""}
          {keybindCount > 0
            ? ` · ${keybindCount} keybind${keybindCount === 1 ? "" : "s"}`
            : ""}
        </span>
      </div>

      {styleMismatch && bar ? (
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

      {result && !result.ok ? (
        <p className="mt-3 text-xs text-chaos-300">{result.error}</p>
      ) : null}

      {!result ? (
        <p className="mt-4 border-t border-stone-750 pt-3 text-xs text-parch-300" data-testid="revo-empty">
          Hit Run to see how the bar plays out.
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
              <dt className="text-xs text-parch-300">Last GCD</dt>
              <dd className="font-mono text-parch-50">
                t{result.casts[result.casts.length - 1]?.tick ?? 0} ·{" "}
                {formatTime(result.casts[result.casts.length - 1]?.tick ?? 0)}
              </dd>
            </div>
          </dl>

          <section className="revo-section revo-timeline">
            <h3 className="combat-section-title text-xs font-medium text-parch-50">Timeline</h3>
            <div className="mt-2 max-h-80 overflow-y-auto border-t border-stone-750" data-testid="revo-cast-timeline">
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
                    <td className="py-1 pr-2 font-mono text-parch-300">{formatTime(cast.tick)}</td>
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
            <h3 className="combat-section-title text-xs font-medium text-parch-50">Ability damage</h3>
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
                  {row.name}
                  <span className="ml-1.5 font-mono text-parch-300">×{row.count}</span>
                  </span>
                </span>
                <span className="font-mono text-parch-300">{formatNumber(row.expected)}</span>
                <span className="font-mono text-parch-50">{Math.round(row.share * 1000) / 10}%</span>
              </div>
            ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
