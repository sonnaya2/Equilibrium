"use client";

import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { engineSpecs as ENGINE_SPECS } from "@/combat/abilities/registry";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import { CalculationAssumptions } from "./CalculationAssumptions";
import type { CalcStats } from "./loadoutStats";
import { RotationAnalysisModal, RotationEventPreview } from "./RotationAnalysis";
import {
  formatConjureByEffectLabel,
  formatConjureCastDurationNote,
  isConjureCommandAbilityId,
  isConjureEffectRow,
  isConjureSummonAbilityId,
  spiritEffectDisplayName,
} from "./conjurePresentation";
import {
  blessingEffectDisplayName,
  formatBlessingByEffectLabel,
  isBlessingEffectRow,
  strikingLightBasicRowMark,
} from "./blessingPresentation";
import { castCritLabel, formatCount, formatNumber, formatTime } from "./revoPanelFormat";
import {
  primaryDamageLabel,
  primaryDpsLabel,
  residualWeightOf,
  runDiagnosticsNote,
  runScoreBadge,
  shouldShowRunScoreChrome,
  type BranchCapDiagnosticsOpts,
} from "./revoStochasticLabels";

/** Adaptive / fixed branch budget meta for residual under-count chrome. */
export type BranchFidelityMeta = {
  maxLiveBranches: number;
  residualWeight: number;
  attempts?: number;
};

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
  /** From adaptive fidelity Run meta; optional live-cap disclosure when residual remains. */
  branchFidelityMeta?: BranchFidelityMeta | null;
  /** Multi-worker Run in flight. */
  runBusy?: boolean;
  runProgressLabel?: string | null;
  onCancelRun?: () => void;
  /** Sliver of Edicts start-activate (Naragi); shown beside Run when pocket is Sliver. */
  sliverToggle?: {
    active: boolean;
    onToggle: () => void;
    disabled?: boolean;
    /** Effective base AD with activation off vs on (level 255 window). */
    baseOff: number;
    baseOn: number;
  } | null;
};

function capOptsFromMeta(
  meta: BranchFidelityMeta | null | undefined,
): BranchCapDiagnosticsOpts | undefined {
  if (meta == null) return undefined;
  if (!(typeof meta.maxLiveBranches === "number" && meta.maxLiveBranches > 0)) {
    return undefined;
  }
  return {
    maxLiveBranches: meta.maxLiveBranches,
    attempts: meta.attempts,
  };
}

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
  branchFidelityMeta = null,
  runBusy = false,
  runProgressLabel = null,
  onCancelRun,
  sliverToggle = null,
}: RevoRunResultsProps) {
  const contributions = result?.analysis.byEffect ?? [];
  const basicCount = result?.casts.filter((c) => c.auto).length ?? 0;
  const horizonTicks = result?.horizonTicks ?? 0;
  const castLog = result ? (showAllCasts ? result.casts : result.casts.slice(0, 40)) : [];
  const conjureDurationMult = stats.conjureDurationMult ?? 1;
  const effectLabel = (id: string) =>
    blessingEffectDisplayName(id) ?? nameById.get(id) ?? spiritEffectDisplayName(id) ?? id;
  const capOpts = capOptsFromMeta(branchFidelityMeta);
  const scoreBadge = result ? runScoreBadge(result) : null;
  const scoreNote = result ? runDiagnosticsNote(result, capOpts) : null;
  const hasResidual = result ? residualWeightOf(result) > 0 : false;
  const damageLabel = result ? primaryDamageLabel(result) : "Damage";
  const dpsLabel = result ? primaryDpsLabel(result) : "Fixed-window DPS";
  const showScoreStrip = shouldShowRunScoreChrome(result);
  const run = () => onRun();
  const busyPhaseFull =
    typeof runProgressLabel === "string" && /full analysis/i.test(runProgressLabel);
  const busyPhaseLabel = busyPhaseFull ? "Full analysis" : "Branch probe";
  const slotCount = 8;

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
            disabled={runBusy}
          />
          <span>s</span>
        </label>
        <p className="revo-horizon-plan" data-testid="revo-horizon-plan">
          {plannedTicks > 0 ? `${plannedTicks} ticks` : "—"}
        </p>
        {sliverToggle ? (
          <div className="revo-sliver-group" data-testid="revo-sliver-group">
            <button
              type="button"
              className={`combat-button revo-sliver-toggle border text-xs ${
                sliverToggle.active
                  ? "border-stone-750 bg-stone-850 text-parch-50"
                  : "border-stone-750 text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
              }`}
              aria-pressed={sliverToggle.active}
              data-testid="sliver-buff-toggle"
              title="Activate Sliver of Edicts on a cycle: at combat start and again every 90s CD (16.8s window)"
              disabled={sliverToggle.disabled === true || runBusy}
              onClick={sliverToggle.onToggle}
            >
              <span className="revo-sliver-toggle__label">Sliver</span>
              <span className="revo-sliver-toggle__state font-mono">
                {sliverToggle.active ? "On" : "Off"}
              </span>
            </button>
            <p
              className="revo-sliver-base"
              data-testid="revo-sliver-base-compare"
              title="Effective base ability damage: loadout level (off) vs Naragi 255 window (on)"
            >
              <span className="revo-sliver-base__label">Base AD</span>
              <span className="revo-sliver-base__row font-mono">
                <span
                  className={
                    sliverToggle.active
                      ? "revo-sliver-base__val is-dim"
                      : "revo-sliver-base__val is-active"
                  }
                  data-testid="revo-sliver-base-off"
                >
                  {formatNumber(sliverToggle.baseOff)}
                </span>
                <span className="revo-sliver-base__sep" aria-hidden>
                  /
                </span>
                <span
                  className={
                    sliverToggle.active
                      ? "revo-sliver-base__val is-active"
                      : "revo-sliver-base__val is-dim"
                  }
                  data-testid="revo-sliver-base-on"
                >
                  {formatNumber(sliverToggle.baseOn)}
                </span>
              </span>
              <span className="revo-sliver-base__hint">off / on</span>
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={run}
          disabled={runBusy}
          className={
            runBusy ? "combat-button revo-run-button is-running" : "combat-button revo-run-button"
          }
          data-testid="revo-run-button"
        >
          {runBusy ? "Scanning…" : "Run bar"}
        </button>
        {runBusy && onCancelRun ? (
          <button
            type="button"
            onClick={onCancelRun}
            className="combat-button revo-run-cancel"
            data-testid="revo-run-cancel"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {runBusy ? (
        <div
          className={busyPhaseFull ? "revo-run-busy is-full" : "revo-run-busy"}
          data-testid="revo-run-busy"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="revo-run-busy__head">
            <span className="revo-run-busy__phase" data-testid="revo-run-busy-phase">
              {busyPhaseLabel}
            </span>
            <span className="revo-run-busy__meta" data-testid="revo-run-progress">
              {runProgressLabel ?? "Working…"}
            </span>
          </div>
          <div className="revo-run-busy__rail" aria-hidden="true">
            {Array.from({ length: slotCount }, (_, i) => (
              <span
                key={i}
                className="revo-run-busy__slot"
                style={{ ["--i" as string]: String(i) }}
              />
            ))}
            <span className="revo-run-busy__cursor" />
          </div>
        </div>
      ) : null}

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
            <p className="mt-2 text-xs text-chaos-300" data-testid="revo-score-note" role="note">
              {hasResidual ? (
                <span data-testid="revo-residual-diagnostics">{scoreNote}</span>
              ) : (
                scoreNote
              )}
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

          <CalculationAssumptions stats={stats} result={result} branchCapOpts={capOpts} />

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
                                  {effectLabel(cast.abilityId)}
                                </span>
                                {isConjureSummonAbilityId(cast.abilityId) ||
                                isConjureCommandAbilityId(cast.abilityId) ? (
                                  <AbilityCategoryChip category="conjure" />
                                ) : null}
                                {isConjureSummonAbilityId(cast.abilityId) ? (
                                  <span
                                    className="shrink-0 font-mono text-[10px] text-parch-300"
                                    title="Spirit Pact exclusive end (no despawn event)"
                                  >
                                    {formatConjureCastDurationNote(cast.tick, conjureDurationMult)}
                                  </span>
                                ) : null}
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
                                {spec &&
                                !isConjureSummonAbilityId(cast.abilityId) &&
                                !isConjureCommandAbilityId(cast.abilityId) ? (
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
                  data-effect-kind={row.kind}
                >
                  <span className="flex min-w-0 items-center gap-2 text-parch-50">
                    {(() => {
                      const spec = ENGINE_SPECS.get(row.id);
                      return spec ? (
                        <GameIcon src={abilityIconPath(spec.id, spec.style)} size={18} />
                      ) : null;
                    })()}
                    <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                      <span className="truncate">
                        {formatConjureByEffectLabel(
                          row.id,
                          row.kind,
                          formatBlessingByEffectLabel(row.id, row.kind, effectLabel(row.id)),
                        )}
                      </span>
                      {isBlessingEffectRow(row.id, row.kind) ? (
                        <AbilityCategoryChip category="blessing" />
                      ) : isConjureEffectRow(row.id, row.kind) ? (
                        <AbilityCategoryChip category="conjure" />
                      ) : null}
                      {(() => {
                        const mark = strikingLightBasicRowMark(stats.league.blessings, {
                          category: ENGINE_SPECS.get(row.id)?.category,
                          kind: row.kind,
                        });
                        return mark ? (
                          <span
                            className="shrink-0 font-mono text-[10px] text-gem-300"
                            data-striking-light-basic-mark=""
                            title="Striking Light ability-stage mult on Basic Attacks"
                          >
                            {mark}
                          </span>
                        ) : null;
                      })()}
                      <span
                        className="ml-0.5 shrink-0 font-mono text-parch-300"
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
          <RotationEventPreview result={result} nameForId={effectLabel} />
        </div>
      ) : null}
      {result?.ok ? (
        <RotationAnalysisModal
          open={analysisOpen}
          result={result}
          stats={stats}
          nameForId={effectLabel}
          onClose={() => setAnalysisOpen(false)}
        />
      ) : null}
    </>
  );
}
