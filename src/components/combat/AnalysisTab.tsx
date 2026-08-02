"use client";

import { useState } from "react";
import { calculateAbility, type AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { CombatStyle } from "@/combat/types";
import { MELEE_ABILITIES } from "@/combat/styles/melee/abilities";
import { RANGED_ABILITIES, type RangedAbilitySpec } from "@/combat/styles/ranged/abilities";
import { MAGIC_ABILITIES, resplendentAsphyxiate } from "@/combat/styles/magic/abilities";
import { MAX_SOULS, volleyOfSouls } from "@/combat/styles/necromancy/abilities";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import { CalculationAssumptions } from "./CalculationAssumptions";
import { CombatFrameCorners } from "./CombatFrameCorners";
import { NumberField } from "./NumberField";
import { loadoutStats, type CalcStats } from "./loadoutStats";
import { useLoadout } from "./useLoadout";

const STYLE_ABILITIES: Record<CombatStyle, AbilitySpec[]> = {
  melee: MELEE_ABILITIES,
  ranged: RANGED_ABILITIES,
  magic: MAGIC_ABILITIES,
  necromancy: [],
};

const DAMAGING: Array<{ style: CombatStyle; ability: AbilitySpec }> = (
  ["melee", "ranged", "magic"] as const
).flatMap((style) =>
  STYLE_ABILITIES[style]
    .filter((ability) => ability.hits.length > 0)
    .map((ability) => ({ style, ability })),
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
  const working =
    ability.id === "asphyxiate" && (stats.tumekensPieces ?? 0) >= 4
      ? resplendentAsphyxiate(ability)
      : ability;
  return calculateAbility(working, {
    base: Math.max(0, finite(stats.base, 0)),
    level: stats.level,
    accuracy: stats.dp,
    crit: {
      chance: stats.critChance,
      guaranteed: (working as RangedAbilitySpec).guaranteedCrit,
      disabled: stats.critsDisabled,
    },
    modifiers: stats.castModifiersFor(working),
    context: { style },
    cap: stats.cap,
  });
}

/** Analysis: one cast through two stat lines — the shared loadout (A, perks and
 *  target model included) against an editable comparison line (B). */
export function AnalysisTab() {
  const [loadout] = useLoadout();
  const [abilityId, setAbilityId] = useState(ALL_ENTRIES[0].ability.id);
  const [souls, setSouls] = useState(3);
  const [lineB, setLineB] = useState(() => ({
    base: loadoutStats(loadout).base,
    level: loadout.level,
    accuracy: loadout.accuracy,
    critChance: loadout.critChance,
  }));

  const entry =
    ALL_ENTRIES.find((candidate) => candidate.ability.id === abilityId) ?? ALL_ENTRIES[0];
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

  const resultA = runCast(ability, entry.style, statsA);
  const resultB = runCast(ability, entry.style, statsB);

  const delta =
    resultA.expected !== 0 ? ((resultB.expected - resultA.expected) / resultA.expected) * 100 : 0;

  return (
    <div className="analysis-layout py-3">
      <aside className="combat-frame analysis-library">
        <CombatFrameCorners />
        <h2 className="combat-page-title text-sm font-medium text-parch-50">Analysis</h2>
        <div className="analysis-ability-list mt-3">
          {ALL_ENTRIES.map(({ style, ability: candidate }) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setAbilityId(candidate.id)}
              aria-pressed={candidate.id === entry.ability.id}
              className="analysis-ability"
            >
              <GameIcon src={abilityIconPath(candidate.id, style)} size={24} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">
                {candidate.name}
                <AbilityCategoryChip category={candidate.category} />
              </span>
              <span className="font-mono text-[10px] capitalize text-parch-300">{style}</span>
            </button>
          ))}
        </div>
        {entry.ability.id === "volley_of_souls" ? (
          <div className="loadout-fields mt-3">
            <NumberField
              label="Residual Souls spent"
              value={souls}
              onChange={(value) => setSouls(Math.min(Math.max(1, Math.floor(value)), MAX_SOULS))}
            />
          </div>
        ) : null}
      </aside>

      <section className="combat-frame analysis-workbench">
        <CombatFrameCorners />
        <header className="analysis-cast-header">
          <GameIcon src={abilityIconPath(ability.id, entry.style)} size={38} />
          <div>
            <h3 className="text-base font-medium text-parch-50">{ability.name}</h3>
          </div>
          <AbilityCategoryChip category={ability.category} />
        </header>

        <div className="analysis-lines">
          <div className="analysis-line">
            <h3 className="combat-section-title text-xs font-medium text-parch-50">A · Loadout</h3>
            <dl className="mt-2 text-xs">
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
          <div className="analysis-line">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="combat-section-title text-xs font-medium text-parch-50">
                B · Comparison
              </h3>
              <button
                type="button"
                onClick={() =>
                  setLineB({
                    base: statsA.base,
                    level: statsA.level,
                    accuracy: statsA.dp * 100,
                    critChance: statsA.critChance * 100,
                  })
                }
                className="combat-button border border-stone-750 px-2 py-0.5 text-xs text-parch-300"
              >
                Reset to A
              </button>
            </div>
            <div className="mt-2">
              <NumberField
                label="Level"
                value={lineB.level}
                onChange={(level) => setLineB({ ...lineB, level })}
              />
              <NumberField
                label="Base"
                value={lineB.base}
                onChange={(base) => setLineB({ ...lineB, base })}
              />
              <NumberField
                label="Accuracy"
                value={lineB.accuracy}
                onChange={(accuracy) => setLineB({ ...lineB, accuracy })}
                suffix="%"
              />
              <NumberField
                label="Crit"
                value={lineB.critChance}
                onChange={(critChance) => setLineB({ ...lineB, critChance })}
                suffix="%"
              />
            </div>
          </div>
        </div>

        <div className="analysis-results overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-parch-300">
                <th>Line</th>
                <th className="text-right">Expected</th>
                <th className="text-right">Min – max</th>
                <th className="text-right">Crit min – max</th>
                <th className="text-right">Damage Potential</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {(
                [
                  ["A", resultA],
                  ["B", resultB],
                ] as const
              ).map(([line, result]) => (
                <tr key={line}>
                  <td className="font-sans text-parch-300">{line}</td>
                  <td className="text-right text-base text-parch-50">
                    {formatNumber(result.expected)}
                  </td>
                  <td className="text-right text-parch-50">
                    {formatNumber(result.min)} – {formatNumber(result.max)}
                  </td>
                  <td className="text-right text-parch-50">
                    {formatNumber(result.hits.reduce((n, h) => n + h.critMin, 0))} –{" "}
                    {formatNumber(result.hits.reduce((n, h) => n + h.critMax, 0))}
                  </td>
                  <td className="text-right text-parch-50">
                    {Math.round((result.hits[0]?.potential ?? 0) * 1000) / 10}%
                  </td>
                </tr>
              ))}
              <tr className="analysis-delta">
                <td className="font-sans text-parch-300">B − A</td>
                <td className="text-right text-gem-300">
                  {delta >= 0 ? "+" : ""}
                  {Math.round(delta * 10) / 10}%
                </td>
                <td colSpan={3} className="text-right font-sans text-xs text-parch-300">
                  expected-value change
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <CalculationAssumptions stats={statsA} />
      </section>
    </div>
  );
}
