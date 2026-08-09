"use client";

import type { ReactNode } from "react";
import { CombatFrame } from "./CombatFrame";
import { loadoutStats } from "./loadoutStats";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const LEVEL_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const PERCENT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

type ResolvedStats = ReturnType<typeof loadoutStats>;
export type { ResolvedStats };

function formatNum(value: number): string {
  return NUMBER_FORMAT.format(value);
}

function incompleteCount(stats: ResolvedStats, stat: "armour" | "life" | "damage") {
  return new Set(
    stats.equipment.incomplete.filter((item) => item.stat === stat).map((item) => item.id),
  ).size;
}

function Breakdown({
  items,
  total,
  percent = false,
}: {
  items: readonly { label: string; value: number }[];
  total: number;
  percent?: boolean;
}) {
  return (
    <dl className="summary-breakdown" data-breakdown-total={total}>
      {items.map((item) =>
        item.value !== 0 ? (
          <div key={item.label} data-breakdown-value={item.value}>
            <dt>{item.label}</dt>
            <dd>{percent ? PERCENT_FORMAT.format(item.value) : formatNum(item.value)}</dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

export function SummaryMetric({
  label,
  value,
  note,
  partialItems = 0,
  child = false,
  children,
}: {
  label: string;
  value: string;
  note?: string;
  partialItems?: number;
  child?: boolean;
  children?: ReactNode;
}) {
  const row = (
    <>
      <span className="summary-metric__label">
        {label}
        {note ? <small>{note}</small> : null}
      </span>
      <span className="summary-metric__result">
        <strong>{partialItems ? `≥ ${value}` : value}</strong>
        {partialItems ? (
          <small>
            Partial · {partialItems} item{partialItems === 1 ? "" : "s"}
          </small>
        ) : null}
      </span>
    </>
  );

  return children ? (
    <details
      className={`summary-metric summary-metric--expandable${child ? " summary-metric--child" : ""}`}
      role="group"
      aria-label={label}
    >
      <summary>{row}</summary>
      {children}
    </details>
  ) : (
    <div
      className={`summary-metric${child ? " summary-metric--child" : ""}`}
      role="group"
      aria-label={label}
    >
      {row}
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="summary-section" aria-label={title}>
      <h4>{title}</h4>
      <div>{children}</div>
    </section>
  );
}

function partialNote(stats: ResolvedStats): string | null {
  const missingDamage = incompleteCount(stats, "damage");
  const missingArmour = incompleteCount(stats, "armour");
  const missingLife = incompleteCount(stats, "life");
  const missingItems = new Set(stats.equipment.incomplete.map((item) => item.id)).size;
  if (!missingItems) return null;
  const partial = [
    missingDamage ? "Equipment Damage" : null,
    missingArmour ? "Armour" : null,
    missingLife ? "Maximum Hitpoints" : null,
  ].filter((label): label is string => label != null);
  return `${missingItems} equipped item${missingItems === 1 ? " lacks" : "s lack"} stats. Partial: ${partial.join(", ")}.`;
}

function damagePotentialNote(
  stats: ResolvedStats,
  storedTargetAffinity?: number,
): string | undefined {
  if (stats.targetAffinity == null) return undefined;
  const parts: string[] = [stats.damagePotentialSource];
  if (storedTargetAffinity != null && storedTargetAffinity !== stats.targetAffinity) {
    parts.push(`Aff_eff ${stats.targetAffinity}`, `stored ${storedTargetAffinity}`);
  } else {
    parts.push(`Aff ${stats.targetAffinity}`);
  }
  return parts.join(" · ");
}

export function ResolvedSummary({
  stats,
  storedTargetAffinity,
}: {
  stats: ResolvedStats;
  storedTargetAffinity?: number;
}) {
  return (
    <CombatFrame as="section" className="setup-summary" aria-labelledby="combat-results-title">
      <header className="setup-card-header">
        <h2 id="combat-results-title" className="combat-section-title">
          Combat Results
        </h2>
      </header>
      <ResolvedBreakdown stats={stats} storedTargetAffinity={storedTargetAffinity} />
    </CombatFrame>
  );
}

export function ResolvedBreakdown({
  stats,
  storedTargetAffinity,
}: {
  stats: ResolvedStats;
  storedTargetAffinity?: number;
}) {
  const missingArmour = incompleteCount(stats, "armour");
  const missingLife = incompleteCount(stats, "life");
  const missingDamage = incompleteCount(stats, "damage");
  const life = stats.life.breakdown;
  const maximumLifePoints = stats.life.temporaryMaxLife;
  const maximumLifePointsNote = stats.life.powerburstActive
    ? "Powerburst active"
    : stats.life.temporaryMaxLife !== stats.life.normalMaxLife
      ? "Includes temporary effects"
      : undefined;
  const maximumLifePointsBreakdown = [
    { label: "Constitution", value: life.constitution },
    { label: "Equipment", value: life.equipment },
    { label: "Reaper Crew", value: life.reaperCrew },
    { label: "Boon of Het", value: life.boonOfHet },
    { label: "Font of Life", value: life.fontOfLife },
    { label: "Fortitude", value: life.fortitude },
    { label: "Thermal bath", value: life.thermalBath },
    { label: "Elidinis Statuette", value: life.elidinisStatuette },
    { label: "Bonfire", value: life.bonfire },
    { label: "Totem of Vitality", value: life.totemOfVitality },
    { label: "True Equilibrium", value: life.leagueMaximumFlat },
    { label: "Big Boned", value: life.leagueMaximumNormal + life.leagueMaximumTemporary },
    { label: "Havoc Born", value: life.finalMaximumNormal + life.finalMaximumTemporary },
    { label: "Powerburst of vitality", value: life.powerburst },
  ];
  const note = partialNote(stats);

  return (
    <div className="setup-summary__sections">
      <SummarySection title="Offence">
        <SummaryMetric label="Base Ability Damage" value={formatNum(stats.base)}>
          <Breakdown total={stats.base} items={stats.baseAbilityDamageBreakdown} />
        </SummaryMetric>
        <SummaryMetric
          label="Equipment Damage"
          value={formatNum(stats.equipment.damage)}
          partialItems={missingDamage}
        >
          <Breakdown total={stats.equipment.damage} items={stats.equipmentDamageBreakdown} />
          {stats.styleMismatchNotes.length ? (
            <ul className="summary-notes">
              {stats.styleMismatchNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </SummaryMetric>
        <div className="summary-metric-stack">
          <SummaryMetric label="Accuracy" value={formatNum(stats.accuracyRating)}>
            <Breakdown total={stats.accuracyRating} items={stats.accuracyBreakdown} />
          </SummaryMetric>
          <SummaryMetric
            child
            label="Damage Potential"
            value={PERCENT_FORMAT.format(stats.dp)}
            note={damagePotentialNote(stats, storedTargetAffinity)}
          />
        </div>
        <SummaryMetric label="Crit Chance" value={PERCENT_FORMAT.format(stats.critChance)}>
          <Breakdown
            percent
            total={stats.critChance}
            items={[
              { label: "Configured", value: stats.critChanceBreakdown.configured },
              { label: "Biting", value: stats.critChanceBreakdown.biting },
              { label: "Set Effects", value: stats.critChanceBreakdown.sets },
              ...stats.critChanceSources,
              { label: "Equipment", value: stats.critChanceBreakdown.equipment },
              { label: "True Equilibrium", value: stats.critChanceBreakdown.trueEquilibrium ?? 0 },
              {
                label: stats.critsDisabled ? "Equilibrium" : "Cap Adjustment",
                value: stats.critChanceBreakdown.adjustment,
              },
            ]}
          />
          {stats.critConditionalNotes.length ? (
            <ul className="summary-notes">
              {stats.critConditionalNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </SummaryMetric>
        <SummaryMetric
          label="Crit Damage"
          value={`+${PERCENT_FORMAT.format(stats.totalCritDamageBonus)}`}
        >
          <Breakdown
            percent
            total={stats.totalCritDamageBonus}
            items={[
              { label: "Level", value: stats.baseCritDamageBonus },
              ...stats.critDamageSources,
            ]}
          />
        </SummaryMetric>
      </SummarySection>

      <SummarySection title="Defence">
        <SummaryMetric label="Defence" value={LEVEL_FORMAT.format(stats.defence.visibleLevel)}>
          <Breakdown total={stats.defence.visibleLevel} items={stats.defenceBreakdown} />
        </SummaryMetric>
        <SummaryMetric
          label="Equipment Armour"
          value={formatNum(stats.defence.totalArmour)}
          partialItems={missingArmour}
        >
          <Breakdown total={stats.defence.totalArmour} items={stats.armourBreakdown} />
        </SummaryMetric>
        <SummaryMetric
          label="Total Armour Value"
          value={formatNum(stats.defence.blockArmourRating)}
          partialItems={missingArmour}
        >
          <Breakdown total={stats.defence.blockArmourRating} items={stats.armourRatingBreakdown} />
        </SummaryMetric>
        <SummaryMetric label="Prayer Bonus" value={formatNum(stats.league.prayerBonus)}>
          <Breakdown
            total={stats.league.prayerBonus}
            items={[
              { label: "Equipment", value: stats.equipment.prayer },
              { label: "True Equilibrium", value: stats.league.trueEquilibrium.prayerBonus },
            ]}
          />
        </SummaryMetric>
      </SummarySection>

      <SummarySection title="Hitpoints & Adrenaline">
        <SummaryMetric
          label="Maximum Hitpoints"
          value={formatNum(maximumLifePoints)}
          note={maximumLifePointsNote}
          partialItems={missingLife}
        >
          <Breakdown total={maximumLifePoints} items={maximumLifePointsBreakdown} />
        </SummaryMetric>
        <SummaryMetric label="Current Hitpoints" value={formatNum(stats.life.currentLife)} />
        {stats.life.overhealCeiling > stats.life.temporaryMaxLife ? (
          <SummaryMetric label="Overheal Cap" value={formatNum(stats.life.overhealCeiling)} />
        ) : null}
        <SummaryMetric
          label="Starting Adrenaline"
          value={
            stats.startingAdrenaline === stats.maxAdrenaline
              ? `Open at max (${stats.maxAdrenaline}%)`
              : `${stats.startingAdrenaline}%`
          }
        />
        <SummaryMetric
          label="Maximum Adrenaline"
          value={`${stats.maxAdrenaline}%`}
          note={
            stats.adrenaline?.maxAdrenalineBonus
              ? `Includes Heightened Senses +${stats.adrenaline.maxAdrenalineBonus}`
              : undefined
          }
        />
        {stats.adrenaline?.basicAdrenalineFlatBonus ? (
          <SummaryMetric
            label="Fury of the Small"
            value={`+${stats.adrenaline.basicAdrenalineFlatBonus}% on basics`}
          />
        ) : null}
        {(stats.adrenaline?.conservationOfEnergyRefund ?? 0) > 0 ? (
          <SummaryMetric
            label="Conservation of Energy"
            value={`+${stats.adrenaline!.conservationOfEnergyRefund}% after ultimates`}
          />
        ) : null}
      </SummarySection>
      {note ? (
        <p className="summary-incomplete" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}
