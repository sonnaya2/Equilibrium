"use client";

import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { engineSpecs as ENGINE_SPECS } from "@/combat/abilities/registry";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import type { CalcStats } from "./loadoutStats";
import { RotationAnalysisModal, RotationEventPreview } from "./RotationAnalysis";
import {
  formatConjureByEffectLabel,
  formatConjureCastDurationNote,
  isConjureCommandAbilityId,
  isConjureSummonAbilityId,
  spiritEffectDisplayName,
} from "./conjurePresentation";
import { formatBlessingByEffectLabel, strikingLightBasicRowMark } from "./blessingPresentation";
import {
  castCritLabel,
  formatAdrenalineTimeline,
  formatCount,
  formatCritContext,
  formatNumber,
  formatTime,
} from "./revoPanelFormat";
import {
  primaryDamageLabel,
  primaryDpsLabel,
  residualWeightOf,
  runDiagnosticsNote,
  runScoreBadge,
  shouldShowRunScoreChrome,
} from "./revoStochasticLabels";
import { combatEffectDisplayName, combatEffectIconPath } from "./effectPresentation";

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
  /** Multi-worker Run in flight. */
  runBusy?: boolean;
  runProgressLabel?: string | null;
  runError?: string | null;
  onCancelRun?: () => void;
  showControls?: boolean;
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
  runBusy = false,
  runProgressLabel = null,
  runError = null,
  onCancelRun,
  showControls = true,
  sliverToggle = null,
}: RevoRunResultsProps) {
  const groups = result?.analysis.groups ?? [];
  const contributions =
    result?.analysis.byEffect.filter((row) => row.analysisGroupId == null) ?? [];
  const basicCount = result?.casts.filter((c) => c.auto).length ?? 0;
  const horizonTicks = result?.horizonTicks ?? 0;
  const castLog = result ? (showAllCasts ? result.casts : result.casts.slice(0, 40)) : [];
  const conjureDurationMult = stats.conjureDurationMult ?? 1;
  const effectLabel = (id: string) =>
    combatEffectDisplayName(id) ?? nameById.get(id) ?? spiritEffectDisplayName(id) ?? id;
  const effectIcon = (id: string, kind?: string, blessingId?: string) => {
    const spec = ENGINE_SPECS.get(id);
    return spec
      ? abilityIconPath(spec.id, spec.style)
      : combatEffectIconPath(id, { kind, blessingId });
  };
  const scoreBadge = result ? runScoreBadge(result) : null;
  const scoreNote = result ? runDiagnosticsNote(result) : null;
  const hasResidual = result ? residualWeightOf(result) > 0 : false;
  const damageLabel = result ? primaryDamageLabel(result) : "Damage";
  const dpsLabel = result ? primaryDpsLabel(result) : "DPS";
  const showScoreStrip = shouldShowRunScoreChrome(result);
  const run = () => onRun();
  const busyPhaseLabel = "Full analysis";
  const slotCount = 8;

  return (
    <>
      {showControls ? (
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
      ) : null}

      {runBusy ? (
        <div
          className="revo-run-busy is-full"
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
          <div
            className="revo-run-busy__rail"
            aria-hidden="true"
            style={{ ["--slots" as string]: String(slotCount) }}
          >
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

      {runError ? (
        <p className="revo-alert" role="alert" data-testid="revo-run-worker-error">
          {runError}
        </p>
      ) : null}

      {result && !result.ok ? (
        <p className="revo-alert" data-testid="revo-run-error">
          {result.error}
        </p>
      ) : null}

      {!result ? (
        <p className="revo-empty" data-testid="revo-empty">
          Run the bar.
        </p>
      ) : null}

      {showScoreStrip && result ? (
        <div className="revo-run-output">
          <dl className="revo-stat-strip">
            <div className="revo-stat-primary">
              <div className="revo-stat-cell is-primary">
                <dt>{damageLabel}</dt>
                <dd data-testid="revo-damage">{formatNumber(result.totalExpected)}</dd>
                {scoreBadge && !damageLabel.includes("approx") ? (
                  <span className="revo-score-badge" data-testid="revo-score-badge">
                    {scoreBadge}
                  </span>
                ) : scoreBadge ? (
                  <span className="sr-only" data-testid="revo-score-badge">
                    {scoreBadge}
                  </span>
                ) : null}
              </div>
              <div className="revo-stat-cell is-primary">
                <dt>{dpsLabel}</dt>
                <dd data-testid="revo-dps">{formatNumber(result.dps)}</dd>
              </div>
              <div className="revo-stat-cell is-primary">
                <dt>Abilities</dt>
                <dd data-testid="revo-casts">
                  {result.casts.length}
                  <span className="revo-muted"> · {basicCount} basic</span>
                </dd>
              </div>
            </div>
            <div className="revo-stat-trail">
              <div className="revo-stat-cell is-trail">
                <dt>Ticks</dt>
                <dd data-testid="revo-horizon">{horizonTicks > 0 ? horizonTicks : "—"}</dd>
              </div>
              <div className="revo-stat-cell is-trail">
                <dt>Crit</dt>
                <dd data-testid="revo-crit-context">
                  {formatCritContext({
                    critChance: stats.critChance,
                    uncappedCritChance: stats.uncappedCritChance,
                    convertedCritChance: stats.convertedCritChance,
                    critualActive: stats.league.blessings.some(
                      (choice) => choice.id === "unholy-critual",
                    ),
                  })}
                </dd>
              </div>
            </div>
          </dl>

          <div className="revo-meta-stack">
            {result.analysis.song.enabled ? (
              <dl className="revo-meta-line revo-meta-song" data-testid="revo-song-state">
                <div>
                  <dt>Essence Corruption</dt>
                  <dd>
                    {formatCount(result.analysis.song.finalStacks)} end ·{" "}
                    {formatCount(result.analysis.song.peakStacks)} peak
                  </dd>
                </div>
                <div>
                  <dt>Empowered DoTs</dt>
                  <dd>
                    {formatCount(result.analysis.song.empowermentActivations)} /{" "}
                    {formatCount(result.analysis.song.empowermentRolls)} rolls
                  </dd>
                </div>
              </dl>
            ) : null}
            {scoreNote ? (
              <p className="revo-meta-line revo-meta-note" data-testid="revo-score-note" role="note">
                {hasResidual ? (
                  <span data-testid="revo-residual-diagnostics">{scoreNote}</span>
                ) : (
                  scoreNote
                )}
              </p>
            ) : null}
            {showControls ? (
              <div className="revo-meta-actions">
                <button
                  type="button"
                  onClick={() => setAnalysisOpen(true)}
                  className="combat-button revo-analyze-button"
                >
                  Analyze damage
                </button>
              </div>
            ) : null}
          </div>

          <section className="revo-section revo-timeline">
            <header className="revo-section-head">
              <h3 className="combat-section-title">Timeline</h3>
              <span className="revo-section-meta">
                {result.casts.length} cast{result.casts.length === 1 ? "" : "s"}
              </span>
            </header>
            <div className="revo-timeline-scroll" data-testid="revo-cast-timeline">
              <table className="revo-cast-table">
                <colgroup>
                  <col className="revo-col-idx" />
                  <col className="revo-col-tick" />
                  <col className="revo-col-time" />
                  <col className="revo-col-ability" />
                  <col className="revo-col-adren" />
                  <col className="revo-col-dmg" />
                </colgroup>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tick</th>
                    <th>Time</th>
                    <th>Ability</th>
                    <th title="Before cast → after resources → end of occupancy">Adren</th>
                    <th title="Damage from this cast that lands in the horizon">Dmg</th>
                  </tr>
                </thead>
                <tbody>
                  {castLog.map((cast, index) => {
                    const spec = ENGINE_SPECS.get(cast.abilityId);
                    const crit = castCritLabel(cast.result);
                    return (
                      <tr
                        key={`${cast.tick}-${cast.abilityId}-${index}`}
                        className={cast.auto ? "is-basic" : undefined}
                        data-basic={cast.auto ? "true" : undefined}
                      >
                        <td className="revo-num revo-muted">{index + 1}</td>
                        <td className="revo-num">{cast.tick}</td>
                        <td className="revo-num revo-muted">{formatTime(cast.tick)}</td>
                        <td className="revo-ability-cell">
                          <span className="revo-ability-line">
                            {spec ? (
                              <GameIcon
                                src={abilityIconPath(spec.id, spec.style)}
                                size={16}
                                className="shrink-0"
                              />
                            ) : null}
                            <span className="revo-ability-name">
                              {effectLabel(cast.abilityId)}
                            </span>
                            {isConjureSummonAbilityId(cast.abilityId) ||
                            isConjureCommandAbilityId(cast.abilityId) ? (
                              <AbilityCategoryChip category="conjure" />
                            ) : null}
                            {isConjureSummonAbilityId(cast.abilityId) ? (
                              <span
                                className="revo-inline-note"
                                title="Spirit Pact exclusive end (no despawn event)"
                              >
                                {formatConjureCastDurationNote(cast.tick, conjureDurationMult)}
                              </span>
                            ) : null}
                            {crit === "Crit" ? <span className="rotation-crit">Crit</span> : null}
                            {cast.surgingStormAtCast ? (
                              <span
                                className="revo-status-chip"
                                title="Surging Storm: +15% to +25% critical strike damage (FSoA casts)"
                                data-testid="timeline-surging-storm"
                              >
                                <GameIcon
                                  src={
                                    combatEffectIconPath("surging-storm") ??
                                    "/game/combat/status/surging-storm.webp"
                                  }
                                  size={14}
                                  className="shrink-0"
                                />
                                <span className="revo-status-chip-label">
                                  {combatEffectDisplayName("surging-storm") ?? "Surging Storm"}
                                </span>
                              </span>
                            ) : null}
                            {spec &&
                            !isConjureSummonAbilityId(cast.abilityId) &&
                            !isConjureCommandAbilityId(cast.abilityId) &&
                            (spec.weaponSpecial ||
                              spec.category === "ultimate" ||
                              spec.category === "threshold" ||
                              spec.category === "enhanced") ? (
                              <AbilityCategoryChip
                                category={spec.category}
                                weaponSpecial={spec.weaponSpecial}
                              />
                            ) : null}
                          </span>
                        </td>
                        <td className="revo-num revo-adren-cell revo-muted">
                          {formatAdrenalineTimeline(cast)}
                        </td>
                        <td className="revo-num revo-dmg-cell">
                          {formatNumber(cast.result.expected)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {result.casts.length > 40 ? (
              <button
                type="button"
                onClick={() => setShowAllCasts((v) => !v)}
                className="revo-show-more"
              >
                {showAllCasts ? "Show first 40 casts" : `Show all ${result.casts.length} casts`}
              </button>
            ) : null}
          </section>

          <div className="revo-detail-pair">
            <section className="revo-section revo-damage">
              <header className="revo-section-head">
                <h3 className="combat-section-title">Ability damage</h3>
                <span className="revo-section-meta">
                  {groups.length + contributions.length} sources
                </span>
              </header>
              <div className="revo-contributions">
                {[
                  ...groups.map((group) => ({
                    key: `g-${group.id}`,
                    kind: "group" as const,
                    id: group.id,
                    effectKind: group.kind,
                    blessingId: group.sourceBreakdown?.[0]?.blessingId,
                    name: formatBlessingByEffectLabel(group.id, group.kind, effectLabel(group.id)),
                    activations: group.expectedActivations,
                    total: group.totalDamage,
                    share: group.share,
                  })),
                  ...contributions.map((row) => ({
                    key: `e-${row.id}`,
                    kind: "effect" as const,
                    id: row.id,
                    effectKind: row.kind,
                    blessingId: row.sourceBreakdown?.[0]?.blessingId,
                    name: formatConjureByEffectLabel(
                      row.id,
                      row.kind,
                      formatBlessingByEffectLabel(row.id, row.kind, effectLabel(row.id)),
                    ),
                    activations: row.expectedActivations,
                    total: row.totalDamage,
                    share: row.share,
                    mark: (() => {
                      const spec = ENGINE_SPECS.get(row.id);
                      return strikingLightBasicRowMark(stats.league.blessings, {
                        id: row.id,
                        category: spec?.category,
                        basicAttack: spec?.basicAttack,
                        kind: row.kind,
                      });
                    })(),
                  })),
                ]
                  .sort((a, b) => b.total - a.total)
                  .map((row) => {
                    const sharePct = Math.round(row.share * 1000) / 10;
                    return (
                      <div
                        key={row.key}
                        className="revo-contribution-row"
                        data-effect-group={row.kind === "group" ? row.id : undefined}
                        data-effect-id={row.kind === "effect" ? row.id : undefined}
                        data-effect-kind={row.kind === "effect" ? row.effectKind : undefined}
                        style={{ ["--share" as string]: `${sharePct}%` }}
                      >
                        <span className="revo-contrib-main">
                          <GameIcon
                            src={effectIcon(row.id, row.effectKind, row.blessingId)}
                            size={18}
                          />
                          <span className="revo-contrib-name">{row.name}</span>
                          {"mark" in row && row.mark ? (
                            <span
                              className="revo-inline-note text-gem-300"
                              data-striking-light-basic-mark=""
                              title="Striking Light ability-stage mult on Basic Attacks"
                            >
                              {row.mark}
                            </span>
                          ) : null}
                          <span className="revo-contrib-count" title="Expected activations">
                            ×{formatCount(row.activations)}
                          </span>
                        </span>
                        <span className="revo-share-bar" aria-hidden>
                          <span />
                        </span>
                        <span className="revo-num revo-contrib-total">
                          {formatNumber(row.total)}
                        </span>
                        <span className="revo-num revo-contrib-share">{sharePct}%</span>
                      </div>
                    );
                  })}
              </div>
            </section>
            <RotationEventPreview result={result} nameForId={effectLabel} />
          </div>
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
