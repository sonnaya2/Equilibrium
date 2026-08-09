"use client";

import { useMemo, useState } from "react";
import {
  analyzeSingleCast,
  overlayAnalysisStatLine,
  type AnalysisStatLine,
  type SingleCastAnalysis,
} from "@/combat/model";
import { MAX_SOULS, VOLLEY_MIN_SOULS, volleyOfSouls } from "@/combat/styles/necromancy/abilities";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import { AbilityUnlockMarkers } from "./AbilityUnlockMarkers";
import {
  analysisAdrenalineBreakdownRows,
  analysisAdrenalineTransaction,
  formatAdrenPct,
} from "./adrenalinePresentation";
import { CalculationAssumptions } from "./CalculationAssumptions";
import { CombatFrame } from "./CombatFrame";
import { NumberField } from "./NumberField";
import { ANALYSIS_ABILITY_ENTRIES, ANALYSIS_ABILITY_ENTRY_BY_ID } from "./analysisAbilityCatalogue";
import { resolveLoadoutCombat } from "./toResolvedCombatModel";
import type { Loadout } from "./useLoadout";
import { unlockedRegions } from "@/league";
import { useBuild as useLeagueBuild } from "@/league/useBuild";

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
  const [entryId, setEntryId] = useState<string | null>(null);
  const [abilityFilter, setAbilityFilter] = useState("");
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

  const defaultEntry =
    ANALYSIS_ABILITY_ENTRIES.find(
      ({ style, ability: candidate }) => style === loadout.style && candidate.basicAttack === true,
    ) ?? ANALYSIS_ABILITY_ENTRIES[0];
  const entry = (entryId ? ANALYSIS_ABILITY_ENTRY_BY_ID.get(entryId) : null) ?? defaultEntry;
  const visibleEntries = ANALYSIS_ABILITY_ENTRIES.filter(({ ability: candidate }) =>
    candidate.name.toLocaleLowerCase().includes(abilityFilter.trim().toLocaleLowerCase()),
  );
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
  const compositionRows = analysisA.ok
    ? [
        { label: "Expected", value: analysisA.expected },
        { label: "Critical", value: analysisA.criticalContribution },
        { label: "Cap loss", value: analysisA.capLoss },
      ]
    : [];
  const compositionScale = Math.max(1, ...compositionRows.map((row) => Math.abs(row.value)));
  const supportLabel = analysisA.parity === "full" ? "Exact" : "Partial";

  return (
    <div className="analysis-layout">
      <CombatFrame as="aside" className="analysis-library">
        <h2 className="combat-page-title text-sm font-medium text-parch-50">Ability library</h2>
        <label className="analysis-ability-filter-label" htmlFor="analysis-ability-filter">
          Ability filter
        </label>
        <input
          id="analysis-ability-filter"
          className="analysis-ability-filter"
          type="search"
          value={abilityFilter}
          onChange={(event) => setAbilityFilter(event.target.value)}
          placeholder="Filter abilities"
        />
        <div className="analysis-ability-list mt-3">
          {visibleEntries.map(({ id, style, ability: candidate }) => (
            <button
              key={id}
              type="button"
              onClick={() => setEntryId(id)}
              aria-pressed={id === entry.id}
              className="analysis-ability"
            >
              <GameIcon src={abilityIconPath(candidate.id, style)} size={24} className="shrink-0" />
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
                <AbilityCategoryChip
                  category={candidate.category}
                  weaponSpecial={candidate.weaponSpecial}
                />
                <AbilityUnlockMarkers ability={candidate} />
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
      </CombatFrame>

      <CombatFrame as="section" className="analysis-workbench">
        <header className="analysis-cast-header">
          <GameIcon src={abilityIconPath(ability.id, entry.style)} size={38} />
          <div>
            <h3 className="text-base font-medium text-parch-50">{ability.name}</h3>
          </div>
          <AbilityCategoryChip category={ability.category} weaponSpecial={ability.weaponSpecial} />
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

        <div className="analysis-results">
          <p className="analysis-results-note">
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

          <div className="analysis-single-cast">
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
                      {castResultCell(analysis, (a) => formatAdrenPct(a.adrenalineDelta))}
                    </td>
                  </tr>
                ))}
                <tr className="analysis-delta">
                  <td className="font-sans text-parch-300">B - A</td>
                  <td className="text-right text-gem-300">
                    {deltaReady ? `${delta >= 0 ? "+" : ""}${Math.round(delta * 10) / 10}%` : "—"}
                  </td>
                  <td colSpan={5} className="text-right font-sans text-xs text-parch-300">
                    Expected damage change (adren economy is not damage EV)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="analysis-secondary-grid">
            <section
              className="analysis-panel analysis-adren-breakdown"
              data-testid="analysis-adren-breakdown"
            >
              <h4 className="analysis-panel-title">Adrenaline breakdown · A</h4>
              <dl>
                {adrenBreakdownA.map(({ label, value }) => (
                  <div key={label} className="analysis-adren-row">
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section
              className="analysis-panel analysis-composition"
              aria-labelledby="analysis-composition-title"
            >
              <h4 id="analysis-composition-title" className="analysis-panel-title">
                Damage composition · A
              </h4>
              {compositionRows.length ? (
                compositionRows.map((row) => (
                  <div key={row.label} className="analysis-composition__row">
                    <span>{row.label}</span>
                    <span className="analysis-composition__bar" aria-hidden>
                      <span
                        style={{
                          width: `${Math.min(100, (Math.abs(row.value) / compositionScale) * 100)}%`,
                        }}
                      />
                    </span>
                    <strong>{formatNumber(row.value)}</strong>
                  </div>
                ))
              ) : (
                <p className="setup-workbench-copy">
                  Composition is unavailable for a failed cast.
                </p>
              )}
            </section>
          </div>
          <div className="analysis-lower-grid">
            <div id="analysis-assumptions" className="analysis-assumptions-panel">
              <CalculationAssumptions stats={stats} />
            </div>
            <section id="analysis-limitations" className="analysis-panel analysis-limitations">
              <h4 className="analysis-panel-title">
                Stateful limitations{analysisA.parity === "limited" ? " · partial parity" : ""}
              </h4>
              {limitations.length > 0 ? (
                <ul>
                  {limitations.map((item) => (
                    <li key={item.id}>
                      <strong>{item.label}</strong>
                      {item.detail ? <span> · {item.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="setup-workbench-copy">No stateful limitations reported.</p>
              )}
            </section>
          </div>
        </div>
      </CombatFrame>

      <aside className="analysis-summary-rail" aria-label="Analysis summary">
        <CombatFrame
          as="section"
          className="analysis-summary-card"
          aria-labelledby="analysis-cast-summary-title"
        >
          <h2 id="analysis-cast-summary-title">Cast summary (A)</h2>
          <dl>
            <div>
              <dt>Expected primary</dt>
              <dd>{analysisA.ok ? formatNumber(analysisA.expected) : "—"}</dd>
            </div>
            <div>
              <dt>Min - max</dt>
              <dd>
                {analysisA.ok
                  ? `${formatNumber(analysisA.min)} - ${formatNumber(analysisA.max)}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Critical contribution</dt>
              <dd>{analysisA.ok ? formatNumber(analysisA.criticalContribution) : "—"}</dd>
            </div>
            <div>
              <dt>Cap loss</dt>
              <dd>{analysisA.ok ? formatNumber(analysisA.capLoss) : "—"}</dd>
            </div>
            <div>
              <dt>Damage Potential</dt>
              <dd>{analysisA.ok ? formatPct01(analysisA.damagePotential) : "—"}</dd>
            </div>
            <div>
              <dt>B versus A</dt>
              <dd>
                {deltaReady ? `${delta >= 0 ? "+" : ""}${Math.round(delta * 10) / 10}%` : "—"}
              </dd>
            </div>
          </dl>
          <a className="analysis-summary-action" href="#analysis-assumptions">
            Inspect calculation details
          </a>
        </CombatFrame>
        <CombatFrame
          as="section"
          className="analysis-summary-card"
          aria-labelledby="analysis-support-title"
        >
          <h2 id="analysis-support-title">Support status</h2>
          <dl>
            <div>
              <dt>Parity</dt>
              <dd>{supportLabel}</dd>
            </div>
            <div>
              <dt>Cast state</dt>
              <dd>{castFailed ? "Failed" : "Ready"}</dd>
            </div>
          </dl>
          {limitations.length ? (
            <ul className="mt-3">
              {limitations.map((limitation) => (
                <li key={limitation.id}>
                  {limitation.label}
                  {limitation.detail ? `: ${limitation.detail}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 setup-workbench-copy">No stateful limitations reported.</p>
          )}
        </CombatFrame>
      </aside>
    </div>
  );
}
