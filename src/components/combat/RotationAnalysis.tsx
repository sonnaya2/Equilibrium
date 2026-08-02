"use client";

import { useEffect, useRef } from "react";
import { ticksToSeconds } from "@/combat/core/ticks";
import type { ResolvedEvent } from "@/combat/engine/runtime/events";
import type { DamageSourceKind, RotationSummary } from "@/combat/engine/simulation/contracts";
import type { CalcStats } from "./loadoutStats";
import { CalculationAssumptions } from "./CalculationAssumptions";

const SOURCE_LABEL: Record<DamageSourceKind, string> = {
  "ability-direct": "Direct abilities",
  "ability-dot": "Damage over time",
  "equipment-passive": "Equipment passives",
  "league-blessing": "Equilibrium blessings",
  perk: "Invention perks",
  "conjure-or-familiar": "Conjures and familiars",
  "auto-attack": "Auto-attacks",
  "other-modeled": "Other modeled effects",
};
const PROCEDURAL_EFFECT_LABEL: Record<string, string> = {
  aftershock: "Aftershock",
  crackling: "Crackling",
  "big-boned": "Big Boned",
  "abyssal-cinders": "Cinders",
  "inferno-of-zamorak": "Inferno",
  "light-of-saradomin": "Striking Light",
  "grasp-of-guthix": "Grasp of Guthix",
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
const formatCount = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

function eventType(event: ResolvedEvent): string {
  if (event.abilityId === "aftershock" || event.abilityId === "crackling") return "Perk proc";
  if (event.family === "dot") return event.dotKind ? `${event.dotKind} DoT` : "DoT";
  if (event.family === "conjureAuto") return "Conjure auto";
  if (event.family === "command") return "Conjure command";
  if (event.family === "poison") return "Poison";
  if (event.family === "proc") return "Proc";
  if (event.family === "blessing") return "Blessing";
  return "Hit";
}

function critLabel(event: ResolvedEvent): string | null {
  const critical = event.damage.critical;
  if (!critical || critical.mode === "none") return null;
  if (critical.mode === "guaranteed") return "Crit";
  return `${formatPercent(critical.chance)} crit EV`;
}

function EventTable({
  events,
  nameForId,
  compact = false,
}: {
  events: readonly ResolvedEvent[];
  nameForId: (id: string) => string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "max-h-72 overflow-auto" : "max-h-[30rem] overflow-auto"}>
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-stone-900 text-parch-300">
          <tr className="border-b border-stone-750">
            <th className="py-1.5 pr-3 font-medium">Tick</th>
            <th className="py-1.5 pr-3 font-medium">Effect</th>
            <th className="py-1.5 pr-3 font-medium">Event</th>
            <th className="py-1.5 pr-3 font-medium">Hit</th>
            <th className="py-1.5 pr-3 text-right font-medium">Expected</th>
            <th className="py-1.5 font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const critical = critLabel(event);
            return (
              <tr key={event.seq} className="border-b border-stone-750/70">
                <td className="py-1.5 pr-3 font-mono text-parch-300">
                  {event.tick}{" "}
                  <span className="text-parch-300/70">
                    {ticksToSeconds(event.tick).toFixed(1)}s
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-parch-50">
                  {PROCEDURAL_EFFECT_LABEL[event.abilityId] ?? nameForId(event.abilityId)}
                </td>
                <td className="py-1.5 pr-3 text-parch-300">{eventType(event)}</td>
                <td className="py-1.5 pr-3 font-mono text-parch-300">{event.hitIndex + 1}</td>
                <td className="py-1.5 pr-3 text-right font-mono text-parch-50">
                  {formatNumber(event.damage.expected)}
                  {event.damage.capLoss ? (
                    <span className="ml-1 text-chaos-300">
                      -{formatNumber(event.damage.capLoss)} cap
                    </span>
                  ) : null}
                </td>
                <td className="py-1.5 text-parch-300">
                  {critical ? (
                    <span className={critical === "Crit" ? "rotation-crit" : undefined}>
                      {critical}
                    </span>
                  ) : null}
                  {event.stackCount != null ? (
                    <span className="ml-2">{event.stackCount} stacks</span>
                  ) : null}
                  {event.remainingTicks != null ? (
                    <span className="ml-2">{event.remainingTicks} ticks left</span>
                  ) : null}
                </td>
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
  const preview = result.events.slice(0, 12);
  return (
    <section className="mt-4 border-t border-stone-750 pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="combat-section-title text-xs font-medium text-parch-50">Resolved events</h3>
        <span className="text-[11px] text-parch-300">
          First {preview.length} of {result.events.length}
        </span>
      </div>
      <div className="mt-2 border-t border-stone-750">
        <EventTable events={preview} nameForId={nameForId} compact />
      </div>
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
                ? "Totals are probability-weighted. The event log shows the most likely terminal path."
                : "The event log follows the resolved expected-value timeline."}
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

        <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
          <section>
            <h3 className="combat-section-title text-xs font-medium text-parch-50">By source</h3>
            <div className="mt-2 border-t border-stone-750">
              {result.analysis.bySource.map((row) => (
                <div
                  key={row.kind}
                  className="flex justify-between gap-4 border-b border-stone-750/70 py-2 text-xs"
                >
                  <span className="text-parch-100">{SOURCE_LABEL[row.kind]}</span>
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
            <div className="mt-2 overflow-auto border-t border-stone-750">
              <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                <thead className="text-parch-300">
                  <tr className="border-b border-stone-750">
                    <th className="py-1.5 pr-3 font-medium">Effect</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Total</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Share</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Uses</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Hits</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Average</th>
                    <th className="py-1.5 text-right font-medium">Cap loss</th>
                  </tr>
                </thead>
                <tbody>
                  {result.analysis.byEffect.map((effect) => (
                    <tr key={effect.id} className="border-b border-stone-750/70">
                      <td className="py-1.5 pr-3 text-parch-50">
                        {PROCEDURAL_EFFECT_LABEL[effect.id] ?? nameForId(effect.id)}
                        {effect.dotDamage > 0 ? (
                          <span className="ml-1.5 text-parch-300">DoT</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono text-parch-50">
                        {formatNumber(effect.totalDamage)}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono text-parch-300">
                        {formatPercent(effect.share)}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono text-parch-300">
                        {formatCount(effect.applications)}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono text-parch-300">
                        {formatCount(effect.damagingEvents)}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono text-parch-300">
                        {formatNumber(effect.averagePerApplication)}
                      </td>
                      <td className="py-1.5 text-right font-mono text-parch-300">
                        {formatNumber(effect.capLoss)}
                      </td>
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
