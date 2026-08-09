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
  occurrenceModelNote,
  resolvedEventPreview,
  RESOLVED_EVENT_PREVIEW_LIMIT,
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

  return (
    <div className={compact ? "revo-event-scroll is-compact" : "revo-event-scroll"}>
      <table className={compact ? "revo-event-table is-compact" : "revo-event-table"}>
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
          {events.map((event) => {
            const critical = eventCritLabel(event);
            const weight = eventExpectedWeight(event);
            const parent = parentEffectLabel(event, bySeq, nameForId);
            const occurrenceNote = occurrenceModelNote(
              event,
              effectName(event.abilityId, nameForId),
            );
            return (
              <tr key={event.seq}>
                <td className="revo-num revo-muted">
                  {event.tick}{" "}
                  <span className="revo-time-sub">{ticksToSeconds(event.tick).toFixed(1)}s</span>
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
                    {parent ? <span className="revo-muted">on {parent}</span> : null}
                    {compact && critical === "Crit" ? (
                      <span className="rotation-crit">Crit</span>
                    ) : null}
                    {compact && isExpectedProcEvent(event) && weight !== undefined ? (
                      <span className="revo-inline-note">
                        ×{formatExpectedOccurrence(weight)}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="revo-event-type">{eventType(event)}</td>
                {!compact ? (
                  <td className="revo-num revo-muted text-right">
                    {event.attached || event.hitIndex < 0 ? "–" : event.hitIndex + 1}
                  </td>
                ) : null}
                <td className="revo-num text-right">
                  {formatNumber(event.damage.expected)}
                  {event.damage.capLoss ? (
                    <span className="revo-cap-loss">
                      -{formatNumber(event.damage.capLoss)} cap
                    </span>
                  ) : null}
                </td>
                {!compact ? (
                  <td className="revo-event-state">
                    {isExpectedProcEvent(event) && weight !== undefined ? (
                      <span className="mr-2">
                        {formatExpectedOccurrence(weight)}×
                      </span>
                    ) : null}
                    {critical ? (
                      <span className={critical === "Crit" ? "rotation-crit" : "revo-muted"}>
                        {critical}
                      </span>
                    ) : null}
                    {occurrenceNote ? (
                      <span
                        className="ml-2 text-gold-300"
                        data-occurrence-model={event.occurrenceModel?.kind}
                        title="Expected multiplicity is packed into this event; it is not one deterministic hit."
                      >
                        {occurrenceNote}
                      </span>
                    ) : null}
                    {event.stackCount != null ? (
                      <span className="ml-2">{event.stackCount} stacks</span>
                    ) : null}
                    {event.remainingTicks != null ? (
                      <span
                        className="ml-2 font-mono text-[11px] text-parch-300"
                        title="Remaining summon / effect life at this land"
                      >
                        {formatRemainingDurationNote(event.tick, event.remainingTicks)}
                      </span>
                    ) : null}
                    {event.appliedEffects?.map((effect) => (
                      <span
                        key={effect.id}
                        className="ml-2 inline-flex items-center gap-1 text-gold-300"
                      >
                        <GameIcon src={effectIconPath(effect.id)} size={16} />
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
  const shown = Math.min(RESOLVED_EVENT_PREVIEW_LIMIT, result.events.length);
  return (
    <section className="revo-section revo-event-preview">
      <header className="revo-section-head">
        <h3 className="combat-section-title">Resolved events</h3>
        <span className="revo-section-meta">
          {shown}
          {preview.pinnedPerfectEquilibrium ? " + PE" : ""} / {result.events.length}
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

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const visibleColumns = EFFECT_COLUMNS.filter((column) =>
    result.analysis.byEffect.some((row) => column.showIf(row)),
  );
  const afterTotalColumns = visibleColumns.filter((column) => column.afterTotal);
  const trailingColumns = visibleColumns.filter((column) => !column.afterTotal);
  const effectRows = result.analysis.byEffect.filter((row) => row.analysisGroupId == null);
  const deathMark = result.targetStatus?.deathMark;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="rotation-analysis-title"
      className="rotation-analysis-dialog"
    >
      <div className="rotation-analysis-shell">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-750 pb-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-gold-400">Rotation result</p>
            <h2 id="rotation-analysis-title" className="mt-1 text-xl text-parch-50">
              Damage analysis
            </h2>
            <p className="mt-1 text-xs text-parch-300">
              {result.rng
                ? "Damage is EV. Log is the top sampled path."
                : "Expected-value timeline."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="combat-button border border-stone-750 px-3 py-1.5 text-xs text-parch-100 hover:text-parch-50"
          >
            Close
          </button>
        </header>

        <dl className="grid grid-cols-2 border-b border-stone-750 text-sm md:grid-cols-4">
          {[
            ["Expected damage", formatNumber(result.totalExpected)],
            ["DPS", formatNumber(result.dps)],
            ["Critical contribution", formatNumber(result.analysis.criticalContribution)],
            ["Lost to hit caps", formatNumber(result.analysis.capLoss)],
          ].map(([label, value]) => (
            <div key={label} className="border-r border-stone-750 px-3 py-3 last:border-r-0">
              <dt className="text-xs text-parch-300">{label}</dt>
              <dd className="mt-0.5 font-mono text-parch-50">{value}</dd>
            </div>
          ))}
        </dl>

        {result.playerPoison ? (
          <section className="border-b border-stone-750 py-3" data-testid="player-poison-analysis">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="combat-section-title text-xs font-medium text-parch-50">
                  Player poison
                </h3>
                <p className="mt-1 text-xs text-parch-300">
                  {result.playerPoison.sourceLabel} · tier {result.playerPoison.effectiveTier} ·
                  poison proc chance {formatPercent(result.playerPoison.procChance)}
                </p>
              </div>
              <span className="text-[11px] text-parch-300">
                {result.playerPoison.supportStatus} · probability mass{" "}
                {formatPercent(result.playerPoison.probabilityMass)}
              </span>
            </div>
            {result.playerPoison.supportNote ? (
              <p className="mt-1 text-[11px] text-parch-300">{result.playerPoison.supportNote}</p>
            ) : null}
            {result.playerPoison.cinderbaneContinuationChance > 0 ? (
              <p className="mt-1 font-mono text-[11px] text-parch-200">
                Cinderbane chain:{" "}
                {formatExpected(result.playerPoison.successfulCinderbaneContinuations)}
                {" expected extra hits / "}
                {formatExpected(result.playerPoison.cinderbaneContinuationAttempts)} poison-hit
                rolls · {formatPercent(result.playerPoison.cinderbaneContinuationChance)} each
              </p>
            ) : null}
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <div className="combat-subpanel p-2">
                <dt className="text-parch-300">Applications</dt>
                <dd className="mt-1 font-mono text-parch-50">
                  {formatExpected(result.playerPoison.successfulApplications)} /{" "}
                  {formatExpected(result.playerPoison.applicationAttempts)} attempts
                </dd>
              </div>
              <div className="combat-subpanel p-2">
                <dt className="text-parch-300">Expected poison hits</dt>
                <dd className="mt-1 font-mono text-parch-50">
                  {formatExpected(result.playerPoison.separateHits)}
                </dd>
              </div>
              <div className="combat-subpanel p-2">
                <dt className="text-parch-300">Poison damage band</dt>
                <dd className="mt-1 font-mono text-parch-50">
                  {formatNumber(result.playerPoison.minimumDamage)} /{" "}
                  {formatNumber(result.playerPoison.expectedDamage)} /{" "}
                  {formatNumber(result.playerPoison.maximumDamage)}
                </dd>
              </div>
              <div className="combat-subpanel p-2">
                <dt className="text-parch-300">Sampled target state</dt>
                <dd className="mt-1 font-mono text-parch-50">
                  decay {result.playerPoison.targetState.decayIndex} · poison{" "}
                  {result.playerPoison.targetState.remainingTargetPoisonTicks}t · Bik{" "}
                  {result.playerPoison.targetState.bikStacks} (
                  {result.playerPoison.targetState.bikRemainingTicks}t)
                </dd>
              </div>
              {result.playerPoison.expectedTargetState ? (
                <div className="combat-subpanel p-2">
                  <dt className="text-parch-300">Weighted end-state</dt>
                  <dd
                    className="mt-1 font-mono text-parch-50"
                    title="Lane-weighted expectation; not a concrete target state."
                  >
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
            </dl>
          </section>
        ) : null}

        {deathMark ? (
          <section className="border-b border-stone-750 py-3" data-testid="target-status-analysis">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="combat-section-title text-xs font-medium text-parch-50">
                  Target state
                </h3>
                <p className="mt-1 text-xs text-parch-300">
                  Death Mark · {deathMark.active ? "active" : "inactive"}
                  {deathMark.source ? ` · ${deathMark.source.label}` : ""}
                </p>
              </div>
              <span className="text-[11px] text-parch-300">
                {deathMark.remainingTicks} ticks remaining
              </span>
            </div>
            {deathMark.currentLifePoints !== undefined ? (
              <p className="mt-2 font-mono text-xs text-parch-100">
                Hitpoints {formatNumber(deathMark.currentLifePoints)} /{" "}
                {formatNumber(deathMark.maximumLifePoints ?? 0)}
              </p>
            ) : null}
            {deathMark.expected ? (
              <p
                className="mt-1 font-mono text-[11px] text-parch-300"
                title="Lane-weighted expectation; not a concrete target state."
              >
                Weighted active probability {formatPercent(deathMark.expected.activeProbability)} ·{" "}
                {formatExpected(deathMark.expected.remainingTicks)} ticks remaining
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
          <section>
            <h3 className="combat-section-title text-xs font-medium text-parch-50">By source</h3>
            <div className="mt-2 border-t border-stone-750">
              {result.analysis.bySource.map((row) => (
                <div
                  key={row.kind}
                  className="flex justify-between gap-4 border-b border-stone-750/70 py-2 text-xs"
                  data-source-kind={row.kind}
                >
                  <span
                    className={
                      row.kind === "league-blessing"
                        ? "text-gold-400"
                        : row.kind === "conjure-or-familiar"
                          ? "text-gem-300"
                          : "text-parch-100"
                    }
                  >
                    {SOURCE_LABEL[row.kind]}
                  </span>
                  <span className="font-mono text-parch-50">{formatNumber(row.damage)}</span>
                </div>
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="combat-subpanel p-2">
                <dt className="text-parch-300">Direct</dt>
                <dd className="mt-1 font-mono text-parch-50">
                  {formatNumber(result.analysis.directDamage)}
                </dd>
              </div>
              <div className="combat-subpanel p-2">
                <dt className="text-parch-300">Damage over time</dt>
                <dd className="mt-1 font-mono text-parch-50">
                  {formatNumber(result.analysis.dotDamage)}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="combat-section-title text-xs font-medium text-parch-50">By effect</h3>
            {result.analysis.groups?.map((group) => (
              <div
                key={group.id}
                className="mt-2 border-t border-stone-750 text-xs"
                data-effect-group={group.id}
              >
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-stone-750/70 py-2">
                  <span className="inline-flex items-center gap-1.5 text-parch-50">
                    <GameIcon
                      src={effectIconPath(
                        group.id,
                        group.kind,
                        group.sourceBreakdown?.[0]?.blessingId,
                      )}
                      size={18}
                    />
                    {effectName(group.id, nameForId)}
                    <span className="ml-1.5 font-mono text-[10px] text-gold-300">grouped</span>
                  </span>
                  <span className="font-mono text-parch-50">{formatNumber(group.totalDamage)}</span>
                  <span className="font-mono text-parch-300">
                    ×{formatExpected(group.expectedActivations)}
                  </span>
                  <span className="font-mono text-parch-300">{formatPercent(group.share)}</span>
                </div>
                <p className="border-b border-stone-750/70 py-1.5 text-[10px] text-parch-300">
                  Roll-up already included in Expected damage; components remain separate below.
                </p>
                {group.components.map((component) => (
                  <div
                    key={`${group.id}-${component.id}`}
                    className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-stone-750/50 py-1.5 pl-3 text-[11px]"
                    data-effect-component={component.id}
                  >
                    <span className="inline-flex items-center gap-1.5 text-parch-300">
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
            <div className="mt-2 overflow-auto border-t border-stone-750">
              <table
                className={`w-full border-collapse text-left text-xs ${
                  afterTotalColumns.length > 0 ? "min-w-[820px]" : "min-w-[680px]"
                }`}
              >
                <thead className="text-parch-300">
                  <tr className="border-b border-stone-750">
                    <th className="py-1.5 pr-3 text-left font-medium">Effect</th>
                    <th className="w-[1%] whitespace-nowrap py-1.5 pl-3 pr-3 text-right font-medium">
                      Total
                    </th>
                    {afterTotalColumns.map((column) => (
                      <th
                        key={column.id}
                        className="w-[1%] whitespace-nowrap py-1.5 pl-3 pr-3 text-right font-medium"
                        title={column.title}
                      >
                        {column.label}
                      </th>
                    ))}
                    <th className="w-[1%] whitespace-nowrap py-1.5 pl-3 pr-3 text-right font-medium">
                      Share
                    </th>
                    {trailingColumns.map((column) => (
                      <th
                        key={column.id}
                        className="w-[1%] whitespace-nowrap py-1.5 pl-3 pr-3 text-right font-medium last:pr-0"
                        title={column.title}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {effectRows.map((effect) => (
                    <tr
                      key={effect.id}
                      className="border-b border-stone-750/70"
                      data-effect-id={effect.id}
                      data-effect-kind={effect.kind}
                    >
                      <td className="py-1.5 pr-3 text-parch-50">
                        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
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
                              className="whitespace-nowrap font-mono text-[10px] text-emerald-300"
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
                            const mark = strikingLightBasicRowMark(stats.league.blessings, {
                              category: ENGINE_SPECS.get(effect.id)?.category,
                              kind: effect.kind,
                            });
                            return mark ? (
                              <span
                                className="whitespace-nowrap font-mono text-[10px] text-gem-300"
                                data-striking-light-basic-mark=""
                                title="Striking Light ability-stage mult on Basic Attacks"
                              >
                                {mark}
                              </span>
                            ) : null;
                          })()}
                          {/* DoT badge only for real DoT; rider-only skills use Bonus column. */}
                          {effect.dotDamage > 0 ? (
                            <span className="whitespace-nowrap text-parch-300">DoT</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-1.5 pl-3 pr-3 text-right font-mono tabular-nums text-parch-50">
                        {formatNumber(effect.totalDamage)}
                      </td>
                      {afterTotalColumns.map((column) => (
                        <td
                          key={column.id}
                          className="whitespace-nowrap py-1.5 pl-3 pr-3 text-right font-mono tabular-nums text-parch-300"
                          title={column.title}
                        >
                          {column.format(effect)}
                        </td>
                      ))}
                      <td className="whitespace-nowrap py-1.5 pl-3 pr-3 text-right font-mono tabular-nums text-parch-300">
                        {formatPercent(effect.share)}
                      </td>
                      {trailingColumns.map((column) => (
                        <td
                          key={column.id}
                          className="whitespace-nowrap py-1.5 pl-3 pr-3 text-right font-mono tabular-nums text-parch-300 last:pr-0"
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

        <section>
          <h3 className="combat-section-title text-xs font-medium text-parch-50">
            Resolved timeline
          </h3>
          <div className="mt-2 border-t border-stone-750">
            <EventTable events={result.events} nameForId={nameForId} />
          </div>
        </section>

        <CalculationAssumptions stats={stats} result={result} />
      </div>
    </dialog>
  );
}
