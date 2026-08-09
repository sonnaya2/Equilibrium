"use client";

import { useEffect, useMemo, useRef } from "react";
import { ticksToSeconds } from "@/combat/core/ticks";
import type {
  DamageEffectBreakdown,
  DamageSourceKind,
  ResolvedEvent,
  RotationSummary,
} from "@/combat";
import type { CalcStats } from "./loadoutStats";
import { CalculationAssumptions } from "./CalculationAssumptions";
import {
  conjureEventTypeLabel,
  formatRemainingDurationNote,
  isConjureDamageEvent,
  isConjureEffectRow,
  spiritEffectDisplayName,
} from "./conjurePresentation";
import { engineSpecs as ENGINE_SPECS } from "@/combat/abilities/registry";
import {
  blessingEventTypeLabel,
  isBlessingEffectRow,
  strikingLightBasicRowMark,
} from "./blessingPresentation";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import {
  eventTimelineMarks,
  occurrenceModelNote,
  resolvedEventPreview,
} from "./rotationAnalysisFormat";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { combatEffectDisplayName, combatEffectIconPath } from "./effectPresentation";

const SOURCE_LABEL: Record<DamageSourceKind, string> = {
  "ability-direct": "Direct abilities",
  "ability-dot": "Damage over time",
  "equipment-passive": "Equipment passives",
  "league-blessing": "Equilibrium blessings",
  perk: "Invention perks",
  "conjure-or-familiar": "Conjures and familiars",
  "player-poison": "Player poison",
  "basic-attack": "Basic Attacks",
  "auto-attack": "Basic Attacks",
  "other-modeled": "Other effects",
  "target-status": "Target status",
};
/** Damage totals as whole numbers. */
const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
/** Expected activations/hits; keep fractional weight (never round 0.35 → 0). */
const formatExpected = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const formatExpectedOccurrence = (value: number) =>
  value > 0 && value < 0.01 ? "<0.01" : formatExpected(value);
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

function effectName(id: string, nameForId: (id: string) => string): string {
  return combatEffectDisplayName(id) ?? spiritEffectDisplayName(id) ?? nameForId(id);
}

function effectIconPath(id: string, kind?: string, blessingId?: string): string | null {
  const spec = ENGINE_SPECS.get(id);
  return spec
    ? abilityIconPath(spec.id, spec.style)
    : combatEffectIconPath(id, { kind, blessingId });
}

/** Probability weight carried by an EV-scheduled event, when present. */
function eventExpectedWeight(event: ResolvedEvent): number | undefined {
  if (event.expectedOccurrences !== undefined) return event.expectedOccurrences;
  if (event.expectedActivations !== undefined) return event.expectedActivations;
  return undefined;
}

function isExpectedProcEvent(event: ResolvedEvent): boolean {
  if (event.attached) return false;
  const weight = eventExpectedWeight(event);
  return weight !== undefined && weight < 1;
}

function eventType(event: ResolvedEvent): string {
  // Blessing wins over Bonus / Attached / Expected proc so riders are not generic Hit.
  const blessingType = blessingEventTypeLabel(event);
  if (blessingType) return blessingType;
  if (event.damageTag === "bonus-damage") return "Bonus";
  if (event.attached) return "Attached bonus";
  if (isExpectedProcEvent(event)) return "Expected proc";
  if (event.abilityId === "aftershock" || event.abilityId === "crackling") return "Invention";
  const conjureType = conjureEventTypeLabel(event);
  if (conjureType) return conjureType;
  if (event.family === "dot") return event.dotKind ? `${event.dotKind} DoT` : "DoT";
  if (event.family === "proc") return "Proc";
  if (event.family === "poison" && event.provenance.kind === "player_poison") return "Poison";
  return "Hit";
}

/**
 * Event-row / State-column crit chrome from concrete outcomes only.
 * No "% crit EV". Engine pins damage.expected to the crit or non-crit band at land.
 */
export function eventCritLabel(event: ResolvedEvent): string | null {
  const critical = event.damage.critical;
  if (!critical || critical.mode === "none") return null;
  if (critical.outcome !== undefined) return critical.outcome ? "Crit" : "No crit";
  if (critical.mode === "guaranteed" || critical.chance >= 1) return "Crit";
  return null;
}

function CritLabel({ label }: { label: string }) {
  const isCrit = label === "Crit";
  return (
    <span
      className={isCrit ? "rotation-crit" : "revo-no-crit"}
      data-crit-outcome={isCrit ? "crit" : "no-crit"}
    >
      {label}
    </span>
  );
}

function parentEffectLabel(
  event: ResolvedEvent,
  bySeq: Map<number, ResolvedEvent>,
  nameForId: (id: string) => string,
): string | null {
  if (!event.attached) return null;
  if (event.derivedFrom != null) {
    const parent = bySeq.get(event.derivedFrom);
    if (parent) return effectName(parent.abilityId, nameForId);
  }
  return null;
}

type EffectColumnId =
  | "bonusDamage"
  | "expectedCasts"
  | "expectedTriggerRolls"
  | "expectedActivations"
  | "expectedSeparateHits"
  | "expectedAttachedComponents"
  | "averagePerActivation"
  | "capLoss";

const EFFECT_COLUMNS: readonly {
  id: EffectColumnId;
  label: string;
  title?: string;
  align: "right";
  /** When true, column is rendered immediately after Total (not with the trailing set). */
  afterTotal?: boolean;
  showIf: (row: DamageEffectBreakdown) => boolean;
  format: (row: DamageEffectBreakdown) => string;
}[] = [
  {
    id: "bonusDamage",
    label: "Bonus",
    title:
      "Bonus damage riders added to this effect (e.g. Big Boned). The rider row itself is 0 — its Total is the bonus.",
    align: "right",
    afterTotal: true,
    // Column visible when any parent skill received riders; rider rows show-.
    showIf: (row) => row.bonusDamage !== 0,
    format: (row) => (row.bonusDamage !== 0 ? formatNumber(row.bonusDamage) : "–"),
  },
  {
    id: "expectedCasts",
    label: "Expected casts",
    title: "Probability-weighted owning casts for this effect",
    align: "right",
    showIf: (row) => row.expectedCasts !== 0,
    format: (row) => formatExpected(row.expectedCasts),
  },
  {
    id: "expectedTriggerRolls",
    label: "Expected trigger rolls",
    title: "Probability-weighted proc rolls represented by this effect",
    align: "right",
    showIf: (row) => row.expectedTriggerRolls !== 0,
    format: (row) => formatExpected(row.expectedTriggerRolls),
  },
  {
    id: "expectedActivations",
    label: "Expected activations",
    title: "Probability-weighted number of times the effect occurs",
    align: "right",
    showIf: (row) => row.expectedActivations !== 0,
    format: (row) => formatExpected(row.expectedActivations),
  },
  {
    id: "expectedSeparateHits",
    label: "Expected hits",
    title: "Probability-weighted separate hits; attached riders do not count",
    align: "right",
    showIf: (row) => row.expectedSeparateHits !== 0,
    format: (row) => formatExpected(row.expectedSeparateHits),
  },
  {
    id: "expectedAttachedComponents",
    label: "Expected attached",
    title: "Probability-weighted bonus damage components added to another hit",
    align: "right",
    showIf: (row) => row.expectedAttachedComponents !== 0,
    format: (row) => formatExpected(row.expectedAttachedComponents),
  },
  {
    id: "averagePerActivation",
    label: "Average per activation",
    title: "Total damage divided by expected activations",
    align: "right",
    showIf: (row) => row.averagePerActivation !== 0,
    format: (row) => formatNumber(row.averagePerActivation),
  },
  {
    id: "capLoss",
    label: "Cap loss",
    align: "right",
    showIf: (row) => row.capLoss !== 0,
    format: (row) => formatNumber(row.capLoss),
  },
];

function EventTable({
  events,
  nameForId,
  compact = false,
}: {
  events: readonly ResolvedEvent[];
  nameForId: (id: string) => string;
  compact?: boolean;
}) {
  const bySeq = useMemo(() => new Map(events.map((event) => [event.seq, event])), [events]);
  const marks = useMemo(() => eventTimelineMarks(events), [events]);

  return (
    <div className={compact ? "revo-event-scroll is-compact" : "revo-event-scroll"}>
      <table className={compact ? "revo-event-table is-compact" : "revo-event-table"}>
        <caption className="sr-only">
          {compact ? "Resolved event preview" : "Resolved timeline"}
        </caption>
        <thead>
          <tr>
            <th>Tick</th>
            <th>Effect</th>
            <th>Event</th>
            {!compact ? <th className="text-right">Hit</th> : null}
            <th
              className="text-right"
              title="Damage for this landed event; DoTs show one tick, not the full ability"
            >
              Dmg
            </th>
            {!compact ? <th>State</th> : null}
          </tr>
        </thead>
        <tbody>
          {events.map((event, index) => {
            const critical = eventCritLabel(event);
            const weight = eventExpectedWeight(event);
            const parent = parentEffectLabel(event, bySeq, nameForId);
            const occurrenceNote = occurrenceModelNote(
              event,
              effectName(event.abilityId, nameForId),
            );
            const mark = marks[index]!;
            const rowClass = [
              mark.isTickStart ? "is-tick-start" : null,
              mark.isCastStart ? "is-cast-start" : "is-cast-cont",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <tr key={event.seq} className={rowClass || undefined}>
                <td className="revo-num revo-tick-cell">
                  {mark.isTickStart ? (
                    <>
                      <span className="revo-tick-value">{event.tick}</span>{" "}
                      <span className="revo-time-sub">
                        {ticksToSeconds(event.tick).toFixed(1)}s
                      </span>
                    </>
                  ) : (
                    <span className="revo-tick-cont" aria-hidden>
                      ·
                    </span>
                  )}
                </td>
                <td className="revo-ability-cell">
                  <span className="revo-ability-line">
                    <GameIcon
                      src={effectIconPath(event.abilityId, undefined, event.blessingId)}
                      size={compact ? 16 : 18}
                      className="shrink-0"
                    />
                    <span className="revo-ability-name">
                      {effectName(event.abilityId, nameForId)}
                    </span>
                    {!compact && isConjureDamageEvent(event) ? (
                      <AbilityCategoryChip category="conjure" />
                    ) : null}
                    {parent ? <span className="revo-muted revo-event-secondary">on {parent}</span> : null}
                    {compact && isExpectedProcEvent(event) && weight !== undefined ? (
                      <span className="revo-inline-note revo-event-secondary">
                        ×{formatExpectedOccurrence(weight)}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="revo-event-type">
                  <span className="revo-event-type-chips">
                    <span className="revo-event-kind">{eventType(event)}</span>
                    {critical ? <CritLabel label={critical} /> : null}
                  </span>
                </td>
                {!compact ? (
                  <td className="revo-num revo-muted revo-event-secondary text-right">
                    {event.attached || event.hitIndex < 0 ? "–" : event.hitIndex + 1}
                  </td>
                ) : null}
                <td className="revo-num revo-dmg-cell text-right">
                  {formatNumber(event.damage.expected)}
                  {event.damage.capLoss ? (
                    <span className="revo-cap-loss revo-event-secondary">
                      -{formatNumber(event.damage.capLoss)} cap
                    </span>
                  ) : null}
                </td>
                {!compact ? (
                  <td className="revo-event-state">
                    {isExpectedProcEvent(event) && weight !== undefined ? (
                      <span className="revo-event-secondary revo-state-meta">
                        {formatExpectedOccurrence(weight)}×
                      </span>
                    ) : null}
                    {occurrenceNote ? (
                      <span
                        className="revo-event-secondary revo-state-meta revo-occurrence-note"
                        data-occurrence-model={event.occurrenceModel?.kind}
                        title="Expected multiplicity is packed into this event; it is not one deterministic hit."
                      >
                        {occurrenceNote}
                      </span>
                    ) : null}
                    {event.stackCount != null ? (
                      <span className="revo-event-secondary revo-state-meta">
                        {event.stackCount} stacks
                      </span>
                    ) : null}
                    {event.remainingTicks != null ? (
                      <span
                        className="revo-event-secondary revo-state-meta revo-remaining-note"
                        title="Remaining summon / effect life at this land"
                      >
                        {formatRemainingDurationNote(event.tick, event.remainingTicks)}
                      </span>
                    ) : null}
                    {event.appliedEffects?.map((effect) => (
                      <span
                        key={effect.id}
                        className="revo-event-secondary revo-state-meta revo-applied-effect"
                      >
                        <GameIcon src={effectIconPath(effect.id)} size={14} />
                        {effectName(effect.id, nameForId)}
                        {effect.stackCount != null ? ` · ${effect.stackCount} stacks` : ""}
                        {effect.remainingTicks != null
                          ? ` · ${ticksToSeconds(effect.remainingTicks).toFixed(1)}s left`
                          : ""}
                      </span>
                    ))}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RotationEventPreview({
  result,
  nameForId,
}: {
  result: RotationSummary;
  nameForId: (id: string) => string;
}) {
  const preview = resolvedEventPreview(result.events);
  return (
    <section className="revo-section revo-event-preview">
      <header className="revo-section-head revo-event-section-head">
        <h3 className="combat-section-title">Resolved events</h3>
        <span className="revo-section-meta">
          {result.events.length} event{result.events.length === 1 ? "" : "s"}
        </span>
      </header>
      <EventTable events={preview.events} nameForId={nameForId} compact />
    </section>
  );
}

export function RotationAnalysisModal({
  open,
  result,
  stats,
  nameForId,
  onClose,
}: {
  open: boolean;
  result: RotationSummary;
  stats: CalcStats;
  nameForId: (id: string) => string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal traps focus + Esc; land on Close for keyboard users.
      closeRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const visibleColumns = EFFECT_COLUMNS.filter((column) =>
    result.analysis.byEffect.some((row) => column.showIf(row)),
  );
  const afterTotalColumns = visibleColumns.filter((column) => column.afterTotal);
  const trailingColumns = visibleColumns.filter((column) => !column.afterTotal);
  const effectRows = result.analysis.byEffect.filter((row) => row.analysisGroupId == null);
  const deathMark = result.targetStatus?.deathMark;
  const bySourceRows = useMemo(
    () => [...result.analysis.bySource].sort((a, b) => b.damage - a.damage),
    [result.analysis.bySource],
  );
  const bySourceTotal = useMemo(
    () => bySourceRows.reduce((sum, row) => sum + row.damage, 0),
    [bySourceRows],
  );

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="rotation-analysis-title"
      aria-describedby="rotation-analysis-desc"
      className="rotation-analysis-dialog"
    >
      <div className="rotation-analysis-shell">
        <header className="rotation-analysis-header">
          <div className="rotation-analysis-header__copy">
            <p className="rotation-analysis-kicker">Rotation result</p>
            <h2 id="rotation-analysis-title" className="rotation-analysis-title">
              Damage analysis
            </h2>
            <p id="rotation-analysis-desc" className="rotation-analysis-subtitle">
              {result.rng
                ? "Damage is EV. Log is the top sampled path."
                : "Expected-value timeline."}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close damage analysis"
            className="rotation-analysis-close"
          >
            Close
          </button>
        </header>

        <div className="rotation-analysis-body">
          <dl className="rotation-analysis-metrics">
            {[
              ["Expected damage", formatNumber(result.totalExpected)],
              ["DPS", formatNumber(result.dps)],
              ["Critical contribution", formatNumber(result.analysis.criticalContribution)],
              ["Lost to hit caps", formatNumber(result.analysis.capLoss)],
            ].map(([label, value]) => (
              <div key={label} className="rotation-analysis-metric">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          {result.playerPoison ? (
            <section
              className="rotation-analysis-section rotation-analysis-poison"
              data-testid="player-poison-analysis"
            >
              <header className="rotation-analysis-section__head">
                <h3 className="combat-section-title">Player poison</h3>
                <span className="rotation-analysis-section__meta">
                  {result.playerPoison.supportStatus} · mass{" "}
                  {formatPercent(result.playerPoison.probabilityMass)}
                </span>
              </header>
              <p className="rotation-analysis-poison__line">
                {result.playerPoison.sourceLabel} · tier {result.playerPoison.effectiveTier} ·
                proc {formatPercent(result.playerPoison.procChance)}
              </p>
              <dl className="rotation-analysis-poison-grid">
                <div>
                  <dt>Applications</dt>
                  <dd>
                    {formatExpected(result.playerPoison.successfulApplications)} /{" "}
                    {formatExpected(result.playerPoison.applicationAttempts)}
                  </dd>
                </div>
                <div>
                  <dt>Expected poison hits</dt>
                  <dd>{formatExpected(result.playerPoison.separateHits)}</dd>
                </div>
                <div>
                  <dt>Damage band</dt>
                  <dd>
                    {formatNumber(result.playerPoison.minimumDamage)} /{" "}
                    {formatNumber(result.playerPoison.expectedDamage)} /{" "}
                    {formatNumber(result.playerPoison.maximumDamage)}
                  </dd>
                </div>
                <div>
                  <dt>Sampled state</dt>
                  <dd>
                    decay {result.playerPoison.targetState.decayIndex} · poison{" "}
                    {result.playerPoison.targetState.remainingTargetPoisonTicks}t · Bik{" "}
                    {result.playerPoison.targetState.bikStacks} (
                    {result.playerPoison.targetState.bikRemainingTicks}t)
                  </dd>
                </div>
                {result.playerPoison.expectedTargetState ? (
                  <div>
                    <dt>Weighted end</dt>
                    <dd title="Lane-weighted expectation; not a concrete target state.">
                      decay {formatExpected(result.playerPoison.expectedTargetState.decayIndex)} ·
                      poison{" "}
                      {formatExpected(
                        result.playerPoison.expectedTargetState.remainingTargetPoisonTicks,
                      )}
                      t · Bik {formatExpected(result.playerPoison.expectedTargetState.bikStacks)} (
                      {formatExpected(result.playerPoison.expectedTargetState.bikRemainingTicks)}t)
                    </dd>
                  </div>
                ) : null}
                {result.playerPoison.cinderbaneContinuationChance > 0 ? (
                  <div className="rotation-analysis-poison-grid__wide">
                    <dt>Cinderbane</dt>
                    <dd>
                      Cinderbane chain:{" "}
                      {formatExpected(result.playerPoison.successfulCinderbaneContinuations)}
                      {" expected extra hits / "}
                      {formatExpected(result.playerPoison.cinderbaneContinuationAttempts)}{" "}
                      poison-hit rolls ·{" "}
                      {formatPercent(result.playerPoison.cinderbaneContinuationChance)} each
                    </dd>
                  </div>
                ) : null}
              </dl>
              {result.playerPoison.supportNote ? (
                <details className="rotation-analysis-notes">
                  <summary>Model notes</summary>
                  <p>{result.playerPoison.supportNote}</p>
                </details>
              ) : null}
            </section>
          ) : null}

          {deathMark ? (
            <section className="rotation-analysis-section" data-testid="target-status-analysis">
              <header className="rotation-analysis-section__head">
                <h3 className="combat-section-title">Target state</h3>
                <span className="rotation-analysis-section__meta">
                  {deathMark.remainingTicks} ticks remaining
                </span>
              </header>
              <p className="rotation-analysis-poison__line">
                Death Mark · {deathMark.active ? "active" : "inactive"}
                {deathMark.source ? ` · ${deathMark.source.label}` : ""}
                {deathMark.currentLifePoints !== undefined
                  ? ` · HP ${formatNumber(deathMark.currentLifePoints)} / ${formatNumber(deathMark.maximumLifePoints ?? 0)}`
                  : ""}
                {deathMark.expected
                  ? ` · weighted ${formatPercent(deathMark.expected.activeProbability)} active · ${formatExpected(deathMark.expected.remainingTicks)}t`
                  : ""}
              </p>
            </section>
          ) : null}

          <div className="rotation-analysis-breakdown" aria-label="Damage breakdown">
            <section className="rotation-analysis-section">
              <header className="rotation-analysis-section__head">
                <h3 className="combat-section-title">By source</h3>
              </header>
              <div className="rotation-analysis-source-list">
                {bySourceRows.map((row) => {
                  const sharePct = bySourceTotal > 0 ? (row.damage / bySourceTotal) * 100 : 0;
                  return (
                    <div
                      key={row.kind}
                      className="rotation-analysis-source-row"
                      data-source-kind={row.kind}
                      style={{ ["--share" as string]: `${sharePct}%` }}
                    >
                      <div className="rotation-analysis-source-row__meta">
                        <span className="rotation-analysis-source-row__label">
                          {SOURCE_LABEL[row.kind]}
                        </span>
                        <span className="rotation-analysis-source-row__damage font-mono">
                          {formatNumber(row.damage)}
                        </span>
                        <span className="rotation-analysis-source-row__share font-mono">
                          {formatPercent(sharePct / 100)}
                        </span>
                      </div>
                      <span className="rotation-analysis-source-row__bar" aria-hidden>
                        <span />
                      </span>
                    </div>
                  );
                })}
              </div>
              <dl className="rotation-analysis-stat-grid is-pair">
                <div className="combat-subpanel">
                  <dt>Direct</dt>
                  <dd>{formatNumber(result.analysis.directDamage)}</dd>
                </div>
                <div className="combat-subpanel">
                  <dt>Damage over time</dt>
                  <dd>{formatNumber(result.analysis.dotDamage)}</dd>
                </div>
              </dl>
            </section>

            <section className="rotation-analysis-section">
              <header className="rotation-analysis-section__head">
                <h3 className="combat-section-title">By effect</h3>
              </header>
              {result.analysis.groups?.map((group) => (
                <div
                  key={group.id}
                  className="rotation-analysis-group"
                  data-effect-group={group.id}
                >
                  <div className="rotation-analysis-group__head">
                    <span className="rotation-analysis-group__name">
                      <GameIcon
                        src={effectIconPath(
                          group.id,
                          group.kind,
                          group.sourceBreakdown?.[0]?.blessingId,
                        )}
                        size={18}
                      />
                      {effectName(group.id, nameForId)}
                      <span className="rotation-analysis-group__tag">grouped</span>
                    </span>
                    <span className="font-mono text-parch-50">{formatNumber(group.totalDamage)}</span>
                    <span className="font-mono text-parch-300">
                      ×{formatExpected(group.expectedActivations)}
                    </span>
                    <span className="font-mono text-parch-300">{formatPercent(group.share)}</span>
                  </div>
                  <p className="rotation-analysis-group__note">
                    Roll-up already included in Expected damage; components remain separate below.
                  </p>
                  {group.components.map((component) => (
                    <div
                      key={`${group.id}-${component.id}`}
                      className="rotation-analysis-group__component"
                      data-effect-component={component.id}
                    >
                      <span className="rotation-analysis-group__name is-muted">
                        <GameIcon
                          src={effectIconPath(
                            component.id,
                            component.kind,
                            component.sourceBreakdown?.[0]?.blessingId,
                          )}
                          size={16}
                        />
                        {effectName(component.id, nameForId)}
                      </span>
                      <span className="font-mono text-parch-300">
                        {formatNumber(component.totalDamage)}
                      </span>
                      <span className="font-mono text-parch-300">
                        ×{formatExpected(component.expectedActivations)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="rotation-analysis-effect-scroll">
                <table
                  className={`rotation-analysis-effect-table ${
                    afterTotalColumns.length > 0 ? "is-wide" : ""
                  }`}
                >
                  <caption className="sr-only">Damage by effect</caption>
                  <thead>
                    <tr>
                      <th className="text-left">Effect</th>
                      <th className="text-right">Total</th>
                      {afterTotalColumns.map((column) => (
                        <th key={column.id} className="text-right" title={column.title}>
                          {column.label}
                        </th>
                      ))}
                      <th className="text-right">Share</th>
                      {trailingColumns.map((column) => (
                        <th key={column.id} className="text-right" title={column.title}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {effectRows.map((effect) => (
                      <tr
                        key={effect.id}
                        data-effect-id={effect.id}
                        data-effect-kind={effect.kind}
                      >
                        <td>
                          <span className="rotation-analysis-effect-name">
                            <GameIcon
                              src={effectIconPath(
                                effect.id,
                                effect.kind,
                                effect.sourceBreakdown?.[0]?.blessingId,
                              )}
                              size={18}
                            />
                            <span>{effectName(effect.id, nameForId)}</span>
                            {effect.expectedPlayerPoisonHits > 0 ? (
                              <span
                                className="rotation-analysis-poison-hits"
                                data-player-poison-hits=""
                                title="Expected delayed player-poison hits earned by this effect"
                              >
                                +{formatExpectedOccurrence(effect.expectedPlayerPoisonHits)} poison
                                hits
                              </span>
                            ) : null}
                            {isBlessingEffectRow(effect.id, effect.kind) ? (
                              <AbilityCategoryChip category="blessing" />
                            ) : isConjureEffectRow(effect.id, effect.kind) ? (
                              <AbilityCategoryChip category="conjure" />
                            ) : null}
                            {(() => {
                              const spec = ENGINE_SPECS.get(effect.id);
                              const mark = strikingLightBasicRowMark(stats.league.blessings, {
                                id: effect.id,
                                category: spec?.category,
                                basicAttack: spec?.basicAttack,
                                kind: effect.kind,
                              });
                              return mark ? (
                                <span
                                  className="rotation-analysis-basic-mark"
                                  data-striking-light-basic-mark=""
                                  title="Striking Light ability-stage mult on Basic Attacks"
                                >
                                  {mark}
                                </span>
                              ) : null;
                            })()}
                            {effect.dotDamage > 0 ? (
                              <span className="revo-muted">DoT</span>
                            ) : null}
                          </span>
                        </td>
                        <td className="text-right font-mono tabular-nums text-parch-50">
                          {formatNumber(effect.totalDamage)}
                        </td>
                        {afterTotalColumns.map((column) => (
                          <td
                            key={column.id}
                            className="text-right font-mono tabular-nums text-parch-300"
                            title={column.title}
                          >
                            {column.format(effect)}
                          </td>
                        ))}
                        <td className="text-right font-mono tabular-nums text-parch-300">
                          {formatPercent(effect.share)}
                        </td>
                        {trailingColumns.map((column) => (
                          <td
                            key={column.id}
                            className="text-right font-mono tabular-nums text-parch-300"
                            title={column.title}
                          >
                            {column.format(effect)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="rotation-analysis-section rotation-analysis-timeline">
            <h3 className="combat-section-title rotation-analysis-section__title">
              Resolved timeline
              <span className="rotation-analysis-section__meta">
                {result.events.length} events
              </span>
            </h3>
            <div className="rotation-analysis-timeline__table">
              <EventTable events={result.events} nameForId={nameForId} />
            </div>
          </section>

          <CalculationAssumptions stats={stats} result={result} />
        </div>
      </div>
    </dialog>
  );
}
