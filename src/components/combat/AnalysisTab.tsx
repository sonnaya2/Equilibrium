"use client";

import { useMemo, useState } from "react";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import {
  analyzeSingleCast,
  overlayAnalysisStatLine,
  type AnalysisStatLine,
  type SingleCastAnalysis,
} from "@/combat/model";
import type { CombatStyle } from "@/combat/types";
import { engineSpecsForStyle } from "@/combat/abilities/registry";
import { MAX_SOULS, VOLLEY_MIN_SOULS, volleyOfSouls } from "@/combat/styles/necromancy/abilities";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import {
  analysisAdrenalineBreakdownRows,
  analysisAdrenalineTransaction,
  formatAdrenPct,
} from "./adrenalinePresentation";
import { CalculationAssumptions } from "./CalculationAssumptions";
import { CombatFrameCorners } from "./CombatFrameCorners";
import { NumberField } from "./NumberField";
import { resolveLoadoutCombat } from "./toResolvedCombatModel";
import type { Loadout } from "./useLoadout";
import { unlockedRegions } from "@/league";
import { useBuild as useLeagueBuild } from "@/league/useBuild";

/** Damaging melee/ranged/magic from engine registry; necro is Volley-only (+ residual souls). */
const DAMAGING: Array<{ style: CombatStyle; ability: AbilitySpec }> = (
  ["melee", "ranged", "magic"] as const
).flatMap((style) =>
  engineSpecsForStyle(style)
    .filter((ability) => ability.hits.length > 0)
    .map((ability) => ({ style, ability })),
);

const VOLLEY_ENTRY = { style: "necromancy" as CombatStyle, ability: volleyOfSouls(3) };
const ALL_ENTRIES = [...DAMAGING, VOLLEY_ENTRY];
const ENTRY_BY_ID = new Map(ALL_ENTRIES.map((entry) => [entry.ability.id, entry]));

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** UI Line B fields: DP / crit stored as percent for NumberFields. */
type LineBFields = {
  base: number;
  level: number;
  accuracy: number;
  critChance: number;
};

function lineBToStatLine(lineB: LineBFields): AnalysisStatLine {
  return {
    base: Math.max(0, finite(lineB.base, 0)),
    level: Math.min(Math.max(1, finite(lineB.level, 99)), 145),
    accuracy: Math.min(Math.max(0, finite(lineB.accuracy, 100)), 100) / 100,
    critChance: Math.min(Math.max(0, finite(lineB.critChance, 10)), 100) / 100,
  };
}

function statLineFromModel(model: {
  base: number;
  level: number;
  accuracy: number;
  crit: { chance: number };
}): LineBFields {
  return {
    base: model.base,
    level: model.level,
    accuracy: model.accuracy * 100,
    critChance: model.crit.chance * 100,
  };
}

function formatPct01(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function castResultCell(
  analysis: SingleCastAnalysis,
  pick: (a: SingleCastAnalysis) => string,
): string {
  if (!analysis.ok) return "—";
  return pick(analysis);
}

/** Analysis: one cast through two stat lines - the shared loadout (A, perks and
 *  target model included) against an editable comparison line (B). */
export function AnalysisTab({ loadout }: { loadout: Loadout }) {
  const { build } = useLeagueBuild();
  const [abilityId, setAbilityId] = useState(ALL_ENTRIES[0].ability.id);
  const [souls, setSouls] = useState(VOLLEY_MIN_SOULS + 1);

  const leagueOptions = useMemo(
    () => ({
      blessingPicks: build.blessingPicks,
      relics: Object.values(build.relics).filter(Boolean),
      unlockedRegions: unlockedRegions(build),
    }),
    [build],
  );

  const { stats, model } = useMemo(
    () => resolveLoadoutCombat(loadout, leagueOptions),
    [loadout, leagueOptions],
  );

  const [lineB, setLineB] = useState<LineBFields>(() =>
    statLineFromModel(
      resolveLoadoutCombat(loadout, {
        blessingPicks: build.blessingPicks,
        relics: Object.values(build.relics).filter(Boolean),
        unlockedRegions: unlockedRegions(build),
      }).model,
    ),
  );

  // Cap 3 without soulbound lantern, 5 with it (never invent lantern for the control).
  const soulCap = model.equipmentIds.includes("item:soulbound-lantern") ? MAX_SOULS : 3;
  const clampedSouls = Math.min(
    soulCap,
    Math.max(VOLLEY_MIN_SOULS, Number.isFinite(souls) ? Math.floor(souls) : VOLLEY_MIN_SOULS),
  );

  const entry = ENTRY_BY_ID.get(abilityId) ?? ALL_ENTRIES[0];
  const ability =
    entry.ability.id === "volley_of_souls" ? volleyOfSouls(clampedSouls) : entry.ability;

  const lineBAbsolute = useMemo(() => lineBToStatLine(lineB), [lineB]);
  const modelB = useMemo(
    () => overlayAnalysisStatLine(model, lineBAbsolute),
    [model, lineBAbsolute],
  );

  // ability is a catalogue record treated as immutable; React Compiler still flags the object dep.
  const castOptions = useMemo(
    () =>
      ability.id === "volley_of_souls"
        ? { residualSouls: clampedSouls, abilityOverlay: ability }
        : {},
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- AbilitySpec is immutable catalogue data
    [ability, clampedSouls],
  );

  const analysisA = useMemo(
    () => analyzeSingleCast(model, ability, castOptions),
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- AbilitySpec is immutable catalogue data
    [model, ability, castOptions],
  );
  const analysisB = useMemo(
    () => analyzeSingleCast(modelB, ability, castOptions),
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- AbilitySpec is immutable catalogue data
    [modelB, ability, castOptions],
  );

  const adrenTxA =
    analysisA.adrenalineTransaction ?? analysisAdrenalineTransaction(ability, stats.adrenaline);
  const adrenBreakdownA = analysisAdrenalineBreakdownRows(adrenTxA);

  const delta =
    analysisA.ok && analysisB.ok && analysisA.expected !== 0
      ? ((analysisB.expected - analysisA.expected) / analysisA.expected) * 100
      : 0;
  const deltaReady = analysisA.ok && analysisB.ok && analysisA.expected !== 0;

  const limitations = analysisA.statefulLimitations;
  const castFailed = !analysisA.ok || !analysisB.ok;
  const castError =
    (!analysisA.ok && analysisA.error) || (!analysisB.ok && analysisB.error) || undefined;

  return (
    <div className="analysis-layout">
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
              value={clampedSouls}
              onChange={(value) => {
                const n = Number.isFinite(value) ? Math.floor(value) : VOLLEY_MIN_SOULS;
                setSouls(Math.min(soulCap, Math.max(VOLLEY_MIN_SOULS, n)));
              }}
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
            <dl className="analysis-stat-rows mt-2">
              {(
                [
                  ["Level", model.level],
                  ["Base", model.base],
                  ["Damage Potential", formatPct01(model.accuracy)],
                  ["Crit", formatPct01(model.crit.chance)],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
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
                onClick={() => setLineB(statLineFromModel(model))}
                className="combat-button px-2 py-0.5 text-xs text-parch-300"
              >
                Reset to A
              </button>
            </div>
            <div className="loadout-fields mt-2">
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
                label="Damage Potential"
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
          <p className="mb-2 text-[11px] leading-4 text-parch-300">
            Single-cast damage EV on the shared combat model. FotS / CoE / Invigorating change{" "}
            <strong className="font-medium text-parch-100">Adren Δ</strong> here; multi-cast economy
            (second ultimates, starvation) is on Rotation / Revolution after Run.
          </p>

          {castFailed ? (
            <p
              className="mb-2 rounded border border-ruby-700/50 bg-ruby-950/40 px-2 py-1.5 text-xs text-ruby-200"
              role="alert"
            >
              Cast did not complete
              {castError ? `: ${castError}` : "."} Damage figures below are blanked so a failed cast
              is not shown as zero EV.
            </p>
          ) : null}

          {limitations.length > 0 ? (
            <div className="mb-2 rounded border border-stone-700/70 bg-stone-900/40 px-2 py-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-parch-300">
                Stateful limitations
                {analysisA.parity === "limited" ? " · limited parity" : null}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-parch-100">
                {limitations.map((item) => (
                  <li key={item.id}>
                    <span className="font-medium">{item.label}</span>
                    {item.detail ? <span className="text-parch-300"> — {item.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-parch-300">
                <th>Line</th>
                <th className="text-right">Expected</th>
                <th className="text-right">Min – max</th>
                <th className="text-right">Critical contribution</th>
                <th className="text-right">Cap loss</th>
                <th className="text-right">Damage Potential</th>
                <th className="text-right">Adren Δ</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {(
                [
                  ["A", analysisA],
                  ["B", analysisB],
                ] as const
              ).map(([line, analysis]) => (
                <tr key={line}>
                  <td className="font-sans text-parch-300">{line}</td>
                  <td className="text-right text-base text-parch-50">
                    {castResultCell(analysis, (a) => formatNumber(a.expected))}
                  </td>
                  <td className="text-right text-parch-50">
                    {castResultCell(
                      analysis,
                      (a) => `${formatNumber(a.min)} – ${formatNumber(a.max)}`,
                    )}
                  </td>
                  <td className="text-right text-parch-50">
                    {castResultCell(analysis, (a) => formatNumber(a.criticalContribution))}
                  </td>
                  <td className="text-right text-parch-50">
                    {castResultCell(analysis, (a) => formatNumber(a.capLoss))}
                  </td>
                  <td className="text-right text-parch-50">
                    {castResultCell(analysis, (a) => formatPct01(a.damagePotential))}
                  </td>
                  <td className="text-right text-parch-50">
                    {formatAdrenPct(analysis.adrenalineDelta)}
                  </td>
                </tr>
              ))}
              <tr className="analysis-delta">
                <td className="font-sans text-parch-300">B − A</td>
                <td className="text-right text-gem-300">
                  {deltaReady ? `${delta >= 0 ? "+" : ""}${Math.round(delta * 10) / 10}%` : "—"}
                </td>
                <td colSpan={5} className="text-right font-sans text-xs text-parch-300">
                  Expected damage change (adren economy is not damage EV)
                </td>
              </tr>
            </tbody>
          </table>
          <div className="analysis-adren-breakdown" data-testid="analysis-adren-breakdown">
            <h4 className="mt-3 text-[11px] uppercase tracking-[0.1em] text-parch-300">
              Adren breakdown · A (loadout)
            </h4>
            <dl className="mt-1 grid gap-x-4 text-xs sm:grid-cols-2">
              {adrenBreakdownA.map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between gap-2 border-b border-stone-750/60 py-1"
                >
                  <dt className="text-parch-300">{label}</dt>
                  <dd className="text-right font-mono text-parch-50">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <CalculationAssumptions stats={stats} />
      </section>
    </div>
  );
}
