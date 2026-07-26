"use client";

import { useMemo, useState } from "react";
import { combatRevolutionBars, type RevolutionBarRecord } from "@/combat/data";
import { resolveBar, type ResolvedSlot } from "@/combat/data/specs";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { RotationSummary } from "@/combat/rotation/simulate";
import { simulateRevolution as runRevolution } from "@/combat/rotation/revolution";
import { secondsToTicks, TICK_SECONDS } from "@/combat/rotation/timeline";
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
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
              : "border-stone-700 bg-stone-850 text-parch-50"
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

/** Revolution mode: the wiki's recommended bars driven through the revolution rule.
 *  This is the default way to evaluate a setup — the manual queue stays for
 *  deliberate cast-by-cast work. */
export function RevolutionPanel({ stats }: { stats: CalcStats }) {
  const [barId, setBarId] = useState(SUPPORTED_BARS[0]?.id ?? "");
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [result, setResult] = useState<RotationSummary | null>(null);

  const bar: RevolutionBarRecord | undefined =
    SUPPORTED_BARS.find((candidate) => candidate.id === barId) ?? SUPPORTED_BARS[0];
  const slots = useMemo(() => (bar ? resolveBar(bar, ENGINE_SPECS) : []), [bar]);
  const modelled = slots.filter((slot) => slot.spec !== null).map((slot) => slot.spec!);
  const unmodelled = slots.filter((slot) => slot.modelledBy === "unmodelled");
  const nameById = useMemo(
    () => new Map(slots.filter((slot) => slot.spec).map((slot) => [slot.spec!.id, slot.name])),
    [slots],
  );

  const run = () => {
    if (!bar) return;
    setResult(
      runRevolution({
        base: stats.base,
        level: stats.level,
        accuracy: stats.dp,
        crit: { chance: stats.critChance },
        abilities: [...ENGINE_SPECS.values(), ...modelled],
        bar: modelled,
        style: bar.style,
        durationTicks: secondsToTicks(Math.max(6, durationSeconds)),
        modifiers: stats.globalModifiers,
      }),
    );
  };

  const contributions = result
    ? Object.entries(result.perAbility)
        .map(([id, expected]) => ({
          name: nameById.get(id) ?? id,
          expected,
          share: result.totalExpected > 0 ? expected / result.totalExpected : 0,
        }))
        .sort((a, b) => b.expected - a.expected)
    : [];

  return (
    <div>
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
        <NumberField label="Duration" value={durationSeconds} onChange={setDurationSeconds} suffix="s" />
        <div>
          <button
            type="button"
            onClick={run}
            className="border border-stone-700 bg-stone-850 px-3 py-1.5 text-xs text-parch-50 hover:bg-stone-800"
          >
            Run revolution
          </button>
        </div>
      </div>

      {result ? (
        <div className="mt-4">
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
              <dt className="text-xs text-parch-300">Casts</dt>
              <dd className="font-mono text-parch-50">{result.casts.length}</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-stone-750">
            {contributions.map((row) => (
              <div key={row.name} className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-stone-750/70 py-2 text-xs">
                <span className="text-parch-50">{row.name}</span>
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
