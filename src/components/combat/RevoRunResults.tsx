"use client";

import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { engineSpecs as ENGINE_SPECS } from "@/combat/abilities/registry";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import { CalculationAssumptions } from "./CalculationAssumptions";
import type { CalcStats } from "./loadoutStats";
import { RotationAnalysisModal, RotationEventPreview } from "./RotationAnalysis";
import { castCritLabel, formatCount, formatNumber, formatTime } from "./revoPanelFormat";
import {
  primaryDamageLabel,
  primaryDpsLabel,
  runDiagnosticsNote,
  runScoreBadge,
  shouldShowRunScoreChrome,
} from "./revoStochasticLabels";

export type RevoRunResultsProps = {
  stats: CalcStats;
  durationSeconds: number;
  setDurationSeconds: (n: number) => void;
  plannedTicks: number;
  onRun: () => void;
  result: RotationSummary | null;
  showAllCasts: boolean;
  setShowAllCasts: (v: boolean | ((p: boolean) => boolean)) => void;
  analysisOpen: boolean;
  setAnalysisOpen: (v: boolean) => void;
  nameById: Map<string, string>;
};

export function RevoRunResults({
  stats,
  durationSeconds,
  setDurationSeconds,
  plannedTicks,
  onRun,
  result,
  showAllCasts,
  setShowAllCasts,
  analysisOpen,
  setAnalysisOpen,
  nameById,
}: RevoRunResultsProps) {
  const contributions = result?.analysis.byEffect ?? [];
  const basicCount = result?.casts.filter((c) => c.auto).length ?? 0;
  const horizonTicks = result?.horizonTicks ?? 0;
  const castLog = result ? (showAllCasts ? result.casts : result.casts.slice(0, 40)) : [];
  const scoreBadge = result ? runScoreBadge(result) : null;
  const scoreNote = result ? runDiagnosticsNote(result) : null;
  const damageLabel = result ? primaryDamageLabel(result) : "Damage";
  const dpsLabel = result ? primaryDpsLabel(result) : "Fixed-window DPS";
  const showScoreStrip = shouldShowRunScoreChrome(result);
  const run = () => onRun();

  return (
    <>
      <div className="revo-run-controls">
        <label className="revo-duration-field">
          <span>Duration</span>
          <input
            type="number"
            value={durationSeconds}
            min={6}
            max={1000}
            step={1}
            onChange={(event) => setDurationSeconds(Number(event.target.value))}
            className="border border-stone-750 bg-transparent px-2 py-1 font-mono text-xs text-parch-50"
            data-testid="revo-run-duration"
            title="Run bar duration (6–1000 seconds)"
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
        <p className="mt-3 text-xs text-chaos-300" data-testid="revo-run-error">
          {result.error}
        </p>
      ) : null}

      {!result ? (
        <p
          className="mt-4 border-t border-stone-750 pt-3 text-xs text-parch-300"
          data-testid="revo-empty"
        >
          Run the bar to score expected damage over the duration.
        </p>
      ) : null}

      {showScoreStrip && result ? (
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
              <dt className="text-xs text-parch-300">{damageLabel}</dt>
              <dd className="font-mono text-parch-50" data-testid="revo-damage">
                {formatNumber(result.totalExpected)}
                {scoreBadge ? (
                  <span
                    className="ml-1.5 font-sans text-[10px] uppercase tracking-[0.08em] text-chaos-300"
                    data-testid="revo-score-badge"
                  >
                    {scoreBadge}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="border-b border-stone-750/70 py-2">
              <dt className="text-xs text-parch-300">{dpsLabel}</dt>
              <dd className="font-mono text-parch-50" data-testid="revo-dps">
                {formatNumber(result.dps)}
              </dd>
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

          {scoreNote ? (
            <p
              className="mt-2 text-xs text-chaos-300"
              data-testid="revo-score-note"
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

          <CalculationAssumptions stats={stats} result={result} />

          <section className="revo-section revo-timeline">
            <h3 className="combat-section-title text-xs font-medium text-parch-50">Timeline</h3>
            <div
              className="mt-2 max-h-80 overflow-y-auto border-t border-stone-750"
              data-testid="revo-cast-timeline"
            >
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
                      <td className="py-1 pr-2 font-mono text-parch-300">
                        {formatTime(cast.tick)}
                      </td>
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
                                {castCritLabel(cast.result) ? (
                                  <span
                                    className={
                                      castCritLabel(cast.result) === "Crit"
                                        ? "rotation-crit"
                                        : "text-parch-300"
                                    }
                                  >
                                    {castCritLabel(cast.result)}
                                  </span>
                                ) : null}
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
            <h3 className="combat-section-title text-xs font-medium text-parch-50">
              Ability damage
            </h3>
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
                      {nameById.get(row.id) ?? row.id}
                      <span
                        className="ml-1.5 font-mono text-parch-300"
                        title="Expected activations"
                      >
                        ×{formatCount(row.expectedActivations)}
                      </span>
                    </span>
                  </span>
                  <span className="font-mono text-parch-300">{formatNumber(row.totalDamage)}</span>
                  <span className="font-mono text-parch-50">
                    {Math.round(row.share * 1000) / 10}%
                  </span>
                </div>
              ))}
            </div>
          </section>
          <RotationEventPreview result={result} nameForId={(id) => nameById.get(id) ?? id} />
        </div>
      ) : null}
      {result?.ok ? (
        <RotationAnalysisModal
          open={analysisOpen}
          result={result}
          stats={stats}
          nameForId={(id) => nameById.get(id) ?? id}
          onClose={() => setAnalysisOpen(false)}
        />
      ) : null}
    </>
  );
}
