"use client";

import { useMemo, useState } from "react";
import { calculateAbility, type AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { CombatStyle } from "@/combat/types";
import { MELEE_ABILITIES } from "@/combat/styles/melee/abilities";
import { RANGED_ABILITIES, type RangedAbilitySpec } from "@/combat/styles/ranged/abilities";
import { MAGIC_ABILITIES } from "@/combat/styles/magic/abilities";
import { MAX_SOULS, volleyOfSouls } from "@/combat/styles/necromancy/abilities";
import { NumberField } from "./NumberField";
import { loadoutStats, type CalcStats } from "./loadoutStats";
import { useLoadout, type Loadout } from "./useLoadout";

const STYLE_ABILITIES: Record<CombatStyle, AbilitySpec[]> = {
  melee: MELEE_ABILITIES,
  ranged: RANGED_ABILITIES,
  magic: MAGIC_ABILITIES,
  necromancy: [],
};

const DAMAGING: Array<{ style: CombatStyle; ability: AbilitySpec }> = (
  ["melee", "ranged", "magic"] as const
).flatMap((style) =>
  STYLE_ABILITIES[style].filter((ability) => ability.hits.length > 0).map((ability) => ({ style, ability })),
);

const VOLLEY_ENTRY = { style: "necromancy" as CombatStyle, ability: volleyOfSouls(3) };
const ALL_ENTRIES = [...DAMAGING, VOLLEY_ENTRY];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function runCast(ability: AbilitySpec, style: CombatStyle, stats: CalcStats) {
  return calculateAbility(ability, {
    base: Math.max(0, finite(stats.base, 0)),
    level: stats.level,
    accuracy: stats.dp,
    crit: {
      chance: stats.critChance,
      guaranteed: (ability as RangedAbilitySpec).guaranteedCrit,
    },
    modifiers: stats.castModifiersFor(ability),
    context: { style },
  });
}

/** Analysis: one cast through two stat lines — the shared loadout (A, perks and
 *  target model included) against an editable comparison line (B). */
export function AnalysisTab() {
  const [loadout] = useLoadout();
  const [abilityId, setAbilityId] = useState(ALL_ENTRIES[0].ability.id);
  const [souls, setSouls] = useState(3);
  const [lineB, setLineB] = useState(() => ({ ...loadout }));

  const entry = ALL_ENTRIES.find((candidate) => candidate.ability.id === abilityId) ?? ALL_ENTRIES[0];
  const ability = entry.ability.id === "volley_of_souls" ? volleyOfSouls(souls) : entry.ability;

  const statsA = loadoutStats(loadout);
  const statsB: CalcStats = {
    ...statsA,
    base: lineB.base,
    level: Math.min(Math.max(1, finite(lineB.level, 99)), 145),
    dp: Math.min(Math.max(0, finite(lineB.accuracy, 100)), 100) / 100,
    critChance: Math.min(
      1,
      Math.max(0, finite(lineB.critChance, 10)) / 100 +
        (statsA.critChance - loadout.critChance / 100),
    ),
  };

  const resultA = useMemo(() => runCast(ability, entry.style, statsA), [ability, entry.style, statsA]);
  const resultB = useMemo(() => runCast(ability, entry.style, statsB), [ability, entry.style, statsB]);

  const delta =
    resultA.expected !== 0 ? ((resultB.expected - resultA.expected) / resultA.expected) * 100 : 0;

  return (
    <div className="grid gap-5 py-5 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-medium text-parch-50">Analysis</h2>
        <p className="mt-1 text-xs text-parch-300">
          A is the shared loadout from the Build tab. B is a scratch line — edit it to judge a
          change before committing to it.
        </p>
        <div className="mt-3 border-t border-stone-750">
          {ALL_ENTRIES.map(({ style, ability: candidate }) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setAbilityId(candidate.id)}
              className={`grid w-full grid-cols-[1fr_auto] gap-2 border-b border-stone-750/70 px-2 py-1.5 text-left text-xs ${
                candidate.id === entry.ability.id
                  ? "bg-stone-850 text-parch-50"
                  : "text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
              }`}
            >
              <span>{candidate.name}</span>
              <span className="font-mono capitalize">{style}</span>
            </button>
          ))}
        </div>
        {entry.ability.id === "volley_of_souls" ? (
          <div className="mt-3 border-t border-stone-750">
            <NumberField label="Residual Souls spent" value={souls} onChange={(value) => setSouls(Math.min(Math.max(1, Math.floor(value)), MAX_SOULS))} />
          </div>
        ) : null}
      </div>

      <div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium text-parch-50">A · Build loadout</h3>
            <dl className="mt-2 border-t border-stone-750 text-xs">
              {(
                [
                  ["Level", statsA.level],
                  ["Base", statsA.base],
                  ["Damage Potential", `${Math.round(statsA.dp * 1000) / 10}%`],
                  ["Crit", `${Math.round(statsA.critChance * 1000) / 10}%`],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="grid grid-cols-2 border-b border-stone-750/70 py-1.5">
                  <dt className="text-parch-300">{label}</dt>
                  <dd className="text-right font-mono text-parch-50">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-medium text-parch-50">B · Comparison</h3>
              <button
                type="button"
                onClick={() => setLineB({ ...loadout })}
                className="border border-stone-750 px-2 py-0.5 text-xs text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
              >
                Reset to A
              </button>
            </div>
            <div className="mt-2 border-t border-stone-750">
              <NumberField label="Level" value={lineB.level} onChange={(level) => setLineB({ ...lineB, level })} />
              <NumberField label="Base" value={lineB.base} onChange={(base) => setLineB({ ...lineB, base })} />
              <NumberField label="Accuracy" value={lineB.accuracy} onChange={(accuracy) => setLineB({ ...lineB, accuracy })} suffix="%" />
              <NumberField label="Crit" value={lineB.critChance} onChange={(critChance) => setLineB({ ...lineB, critChance })} suffix="%" />
            </div>
          </div>
        </div>

        <h3 className="mt-5 text-xs font-medium text-parch-50">
          {entry.ability.name} <span className="font-normal text-parch-300">· {entry.ability.category}</span>
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-t border-stone-750 text-sm">
            <thead>
              <tr className="border-b border-stone-750/70 text-left text-xs text-parch-300">
                <th className="py-1.5 pr-3 font-normal">Line</th>
                <th className="py-1.5 pr-3 text-right font-normal">Expected</th>
                <th className="py-1.5 pr-3 text-right font-normal">Min – max</th>
                <th className="py-1.5 pr-3 text-right font-normal">Crit min – max</th>
                <th className="py-1.5 text-right font-normal">Damage Potential</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {(
                [
                  ["A", resultA],
                  ["B", resultB],
                ] as const
              ).map(([line, result]) => (
                <tr key={line} className="border-b border-stone-750/70 text-parch-50">
                  <td className="py-1.5 pr-3 font-sans text-parch-300">{line}</td>
                  <td className="py-1.5 pr-3 text-right text-base">{formatNumber(result.expected)}</td>
                  <td className="py-1.5 pr-3 text-right">
                    {formatNumber(result.min)} – {formatNumber(result.max)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {formatNumber(result.hits.reduce((n, h) => n + h.critMin, 0))} –{" "}
                    {formatNumber(result.hits.reduce((n, h) => n + h.critMax, 0))}
                  </td>
                  <td className="py-1.5 text-right">
                    {Math.round((result.hits[0]?.potential ?? 0) * 1000) / 10}%
                  </td>
                </tr>
              ))}
              <tr className="text-parch-50">
                <td className="py-1.5 pr-3 font-sans text-parch-300">B − A</td>
                <td className="py-1.5 pr-3 text-right">
                  {delta >= 0 ? "+" : ""}
                  {Math.round(delta * 10) / 10}%
                </td>
                <td colSpan={3} className="py-1.5 text-right font-sans text-xs text-parch-300">
                  expected-value change
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
