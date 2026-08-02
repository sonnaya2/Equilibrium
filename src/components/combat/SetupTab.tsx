"use client";

import { useMemo, useState, type ReactNode } from "react";
import { GameIcon } from "../GameIcon";
import { BuffsPanel } from "./BuffsPanel";
import { CombatFrameCorners } from "./CombatFrameCorners";
import { GearPanel } from "./GearPanel";
import { loadoutStats } from "./loadoutStats";
import { PerksPanel } from "./PerksPanel";
import { QuickCalculator } from "./QuickCalculator";
import { StatsPanel } from "./StatsPanel";
import { TargetPanel } from "./TargetPanel";
import type { Loadout } from "./useLoadout";

const SUB_TABS = [
  "Gear",
  "Stats",
  "Buffs",
  "Archaeology",
  "Invention",
  "Abilities",
  "Target",
] as const;
type SubTab = (typeof SUB_TABS)[number];

const SUB_TAB_ICONS: Record<SubTab, string> = {
  Gear: "/game/skills/defence.webp",
  Stats: "/game/skills/constitution.webp",
  Buffs: "/game/skills/prayer.webp",
  Archaeology: "/game/skills/archaeology.webp",
  Invention: "/game/skills/invention.webp",
  Abilities: "/game/combat/melee-abilities.webp",
  Target: "/game/combat/critical-strike.webp",
};

function ArchaeologyPanel() {
  return (
    <div className="loadout-panel">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Archaeology</h2>
      <p className="mt-2 text-sm text-parch-300">No Archaeology combat buffs are modeled yet.</p>
    </div>
  );
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const LEVEL_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const PERCENT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

function formatNum(value: number): string {
  return NUMBER_FORMAT.format(value);
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
  children,
}: {
  label: string;
  value: string;
  note?: string;
  partialItems?: number;
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
    <details className="summary-metric summary-metric--expandable" role="group" aria-label={label}>
      <summary>{row}</summary>
      {children}
    </details>
  ) : (
    <div className="summary-metric" role="group" aria-label={label}>
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

export function SetupTab({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>("Gear");
  const stats = useMemo(() => loadoutStats(loadout), [loadout]);
  const incompleteCount = (stat: "armour" | "life" | "damage") =>
    new Set(stats.equipment.incomplete.filter((item) => item.stat === stat).map((item) => item.id))
      .size;
  const missingArmour = incompleteCount("armour");
  const missingLife = incompleteCount("life");
  const missingDamage = incompleteCount("damage");
  const missingItems = new Set(stats.equipment.incomplete.map((item) => item.id)).size;
  const partialTotals = [
    missingDamage ? "Equipment Damage" : null,
    missingArmour ? "Equipment Armour and Armour rating" : null,
    missingLife ? "Equipment Life and life-point totals" : null,
  ].filter((label): label is string => label != null);
  const life = stats.life.breakdown;

  return (
    <div className="combat-setup py-3">
      <div className="setup-layout grid">
        <nav
          className="combat-frame setup-nav flex flex-row flex-wrap gap-1 lg:flex-col"
          aria-label="Loadout sections"
        >
          <CombatFrameCorners />
          {SUB_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSubTab(tab)}
              aria-pressed={subTab === tab}
              className={`combat-button setup-nav-button border px-2.5 py-1.5 text-left text-xs ${
                subTab === tab
                  ? "border-gem-400 bg-stone-850 font-medium text-gem-300"
                  : "border-stone-750 text-parch-100 hover:text-parch-50"
              }`}
            >
              <GameIcon
                src={
                  tab === "Abilities"
                    ? `/game/combat/${loadout.style}-abilities.webp`
                    : SUB_TAB_ICONS[tab]
                }
                size={20}
              />
              {tab}
            </button>
          ))}
        </nav>

        <div
          className={`setup-stage min-w-0${
            subTab === "Gear" || subTab === "Abilities" ? "" : " combat-frame loadout-editor"
          }`}
        >
          {subTab === "Gear" || subTab === "Abilities" ? null : <CombatFrameCorners />}
          {subTab === "Gear" ? <GearPanel loadout={loadout} setLoadout={setLoadout} /> : null}
          {subTab === "Stats" ? <StatsPanel loadout={loadout} setLoadout={setLoadout} /> : null}
          {subTab === "Buffs" ? <BuffsPanel loadout={loadout} setLoadout={setLoadout} /> : null}
          {subTab === "Archaeology" ? <ArchaeologyPanel /> : null}
          {subTab === "Invention" ? <PerksPanel loadout={loadout} setLoadout={setLoadout} /> : null}
          {subTab === "Abilities" ? <QuickCalculator loadout={loadout} /> : null}
          {subTab === "Target" ? <TargetPanel loadout={loadout} setLoadout={setLoadout} /> : null}
        </div>

        <aside className="combat-frame setup-summary" aria-label="Loadout summary">
          <CombatFrameCorners />
          <header className="setup-summary__header">
            <div>
              <p>{loadout.style} loadout</p>
              <h3 className="combat-section-title">Setup summary</h3>
            </div>
            <span>{stats.baseDamageMode === "automatic" ? "Core derived" : "Manual base"}</span>
          </header>

          <div className="setup-summary__sections">
            <SummarySection title="Offence">
              <SummaryMetric label="Base ability damage" value={formatNum(stats.base)} />
              <SummaryMetric
                label="Equipment Damage"
                value={formatNum(stats.equipment.damage)}
                partialItems={missingDamage}
              />
              <SummaryMetric label="Accuracy" value={formatNum(stats.accuracyRating)} />
              <SummaryMetric
                label="Damage Potential"
                value={PERCENT_FORMAT.format(stats.dp)}
                note={stats.damagePotentialSource}
              />
              <SummaryMetric label="Crit chance" value={PERCENT_FORMAT.format(stats.critChance)}>
                <Breakdown
                  percent
                  total={stats.critChance}
                  items={[
                    { label: "Configured", value: stats.critChanceBreakdown.configured },
                    { label: "Biting", value: stats.critChanceBreakdown.biting },
                    { label: "Set effects", value: stats.critChanceBreakdown.sets },
                    { label: "Equipment", value: stats.critChanceBreakdown.equipment },
                    {
                      label: stats.critsDisabled ? "Equilibrium" : "Cap adjustment",
                      value: stats.critChanceBreakdown.adjustment,
                    },
                  ]}
                />
              </SummaryMetric>
              <SummaryMetric
                label="Crit damage"
                value={`+${PERCENT_FORMAT.format(stats.totalCritDamageBonus)}`}
              >
                <Breakdown
                  percent
                  total={stats.totalCritDamageBonus}
                  items={[
                    { label: "Level", value: stats.baseCritDamageBonus },
                    { label: "Equipment", value: stats.critDamageBonus },
                  ]}
                />
              </SummaryMetric>
            </SummarySection>

            <SummarySection title="Defence">
              <SummaryMetric label="Base Defence" value={formatNum(loadout.defenceLevel)} />
              <SummaryMetric
                label="Visible boosted Defence"
                value={LEVEL_FORMAT.format(stats.defence.visibleLevel)}
              />
              {stats.defence.blockLevel !== stats.defence.visibleLevel ? (
                <SummaryMetric
                  label="Block-calculation Defence"
                  value={LEVEL_FORMAT.format(stats.defence.blockLevel)}
                />
              ) : null}
              <SummaryMetric
                label="Equipment Armour"
                value={formatNum(stats.defence.equipmentArmour)}
                partialItems={missingArmour}
              />
              <SummaryMetric
                label="Armour rating"
                value={formatNum(stats.defence.totalArmour)}
                partialItems={missingArmour}
              />
            </SummarySection>

            <SummarySection title="Life & resources">
              <SummaryMetric label="Constitution" value={formatNum(loadout.constitutionLevel)} />
              <SummaryMetric
                label="Constitution life"
                value={formatNum(stats.life.constitutionLife)}
              />
              <SummaryMetric
                label="Equipment Life"
                value={formatNum(stats.life.equipmentLife)}
                partialItems={missingLife}
              />
              <SummaryMetric
                label="Maximum life points"
                value={formatNum(stats.life.normalMaxLife)}
                note="Normal maximum"
                partialItems={missingLife}
              >
                <Breakdown
                  total={stats.life.normalMaxLife}
                  items={[
                    { label: "Constitution", value: life.constitution },
                    { label: "Equipment", value: life.equipment },
                    { label: "Reaper Crew", value: life.reaperCrew },
                    { label: "Boon of Het", value: life.boonOfHet },
                  ]}
                />
              </SummaryMetric>
              {stats.life.temporaryMaxLife !== stats.life.normalMaxLife ? (
                <SummaryMetric
                  label="Temporary maximum life"
                  value={formatNum(stats.life.temporaryMaxLife)}
                  note={stats.life.powerburstActive ? "Powerburst active" : undefined}
                  partialItems={missingLife}
                >
                  <Breakdown
                    total={stats.life.temporaryMaxLife}
                    items={[
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
                      { label: "Powerburst of vitality", value: life.powerburst },
                    ]}
                  />
                </SummaryMetric>
              ) : null}
              <SummaryMetric label="Current life" value={formatNum(stats.life.currentLife)} />
              {stats.life.overhealCeiling > stats.life.temporaryMaxLife ? (
                <SummaryMetric label="Overheal cap" value={formatNum(stats.life.overhealCeiling)} />
              ) : null}
              <SummaryMetric label="Prayer bonus" value={formatNum(stats.equipment.prayer)} />
              <SummaryMetric label="Starting adrenaline" value={`${stats.startingAdrenaline}%`} />
              <SummaryMetric label="Maximum adrenaline" value={`${stats.maxAdrenaline}%`} />
              <SummaryMetric
                label="Hit cap"
                value={stats.cap.bypass ? "Disabled" : formatNum(stats.cap.cap)}
                note={stats.cap.bypass ? undefined : "Per hit"}
              />
            </SummarySection>
          </div>

          {missingItems ? (
            <p className="summary-incomplete" role="status">
              {missingItems} equipped item{missingItems === 1 ? " is" : "s are"} missing relevant
              stats. Partial totals: {partialTotals.join(", ")}.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
