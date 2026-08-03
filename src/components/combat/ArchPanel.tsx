"use client";

import { useEffect, useMemo } from "react";
import { GameIcon } from "../GameIcon";
import { RegionCrest } from "../RegionCrest";
import { NumberField } from "./NumberField";
import {
  canSelectRelic,
  isRelicActive,
  MONOLITH_ACTIVE_LIMIT,
  relicsGroupedByCategory,
  resolveMonolithEnergyCap,
  sanitizeArchaeologyState,
  toggleArchaeologyRelic,
  totalEnergyUsed,
  type ArchaeologyRelic,
} from "@/combat/shared/archaeologyRelics";
import {
  getBerserkersFuryBonusFromPercent,
  sanitizeHealthPercent,
} from "@/combat/shared/berserkersFury";
import { loadoutStats } from "./loadoutStats";
import { withArchaeologySelection, type Loadout } from "./useLoadout";
import { isRegionUnlocked, REGION_IDS, type RegionId } from "@/league";
import { useBuild } from "@/league/useBuild";
import { regionDisplayName } from "@/tasks/regionMap";
import type { TaskRegionId } from "@/tasks";

const BONUS_FORMAT = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const CATEGORY_GROUPS = relicsGroupedByCategory();

function regionLabel(id: string): string {
  return regionDisplayName(id as TaskRegionId);
}

function RelicRegionBadges({
  regions,
  unlocked,
}: {
  regions: readonly string[];
  unlocked: (id: string) => boolean;
}) {
  if (!regions.length) return null;
  return (
    <span className="arch-relic-regions" aria-label="Regions">
      {regions.map((id) => {
        const met = unlocked(id);
        return (
          <span
            key={id}
            className={`arch-region-badge${met ? " is-met" : " is-missing"}`}
            title={`${regionLabel(id)}${met ? " (unlocked)" : " (locked)"}`}
          >
            <RegionCrest regionId={id} size={12} className="arch-region-badge__crest" />
            <span className="arch-region-badge__name">{regionLabel(id)}</span>
          </span>
        );
      })}
    </span>
  );
}

function RelicRow({
  relic,
  selected,
  blocked,
  unlocked,
  onToggle,
}: {
  relic: ArchaeologyRelic;
  selected: boolean;
  blocked: boolean;
  unlocked: (id: string) => boolean;
  onToggle: () => void;
}) {
  const disabled = blocked && !selected;
  return (
    <button
      type="button"
      className={`arch-relic-tile${selected ? " is-on" : ""}${disabled ? " is-disabled" : ""}`}
      aria-pressed={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={disabled ? undefined : onToggle}
    >
      <span className="arch-relic-tile__icon-wrap">
        <GameIcon src={relic.icon ?? null} size={34} className="arch-relic-tile__icon" />
      </span>
      <span className="arch-relic-tile__body">
        <span className="arch-relic-tile__title-row">
          <strong className="arch-relic-tile__name">{relic.name}</strong>
          <span className="arch-relic-tile__energy" title="Monolith energy">
            {relic.energyCost}
          </span>
          <span
            className={`arch-modeled-chip${relic.implementation === "full" ? " is-modeled" : ""}`}
          >
            {relic.implementation === "full" ? "Modeled" : "Energy only"}
          </span>
        </span>
        {relic.effect ? <span className="arch-relic-tile__effect">{relic.effect}</span> : null}
        <RelicRegionBadges regions={relic.requiredRegions} unlocked={unlocked} />
      </span>
    </button>
  );
}

export function ArchPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const { build } = useBuild();
  const unlockedRegions = useMemo(
    () => REGION_IDS.filter((id) => isRegionUnlocked(build, id)),
    [build],
  );
  const unlockedKey = unlockedRegions.join("|");

  const energyCap = resolveMonolithEnergyCap({
    unlockedRegions,
    requestedCap: loadout.archaeology?.energyCap ?? null,
  });

  const selectedIds = loadout.archaeology?.selectedIds ?? [];
  const selectedKey = selectedIds.join("|");
  const used = totalEnergyUsed(selectedIds);
  const remaining = energyCap - used;
  const furySelected = isRelicActive(selectedIds, "berserkers_fury");

  // Drop over-budget picks when Anachronia (650 cap) is removed.
  useEffect(() => {
    const stored = loadout.archaeology ?? { selectedIds: [], energyCap: 500 as const };
    const next = sanitizeArchaeologyState(stored, unlockedRegions);
    const sameCap = stored.energyCap === next.energyCap;
    const sameIds =
      next.selectedIds.length === stored.selectedIds.length &&
      next.selectedIds.every((id, i) => id === stored.selectedIds[i]);
    if (sameCap && sameIds) return;
    setLoadout(withArchaeologySelection(loadout, next.selectedIds, next.energyCap));
    // Cap follows build regions; re-run when unlocks or selection keys change.
  }, [unlockedKey, energyCap, selectedKey, loadout, setLoadout, unlockedRegions]);

  const stats = useMemo(
    () =>
      loadoutStats(loadout, {
        blessingPicks: build.blessingPicks,
        relics: Object.values(build.relics).filter(Boolean),
        unlockedRegions,
      }),
    [loadout, build.blessingPicks, build.relics, unlockedRegions],
  );

  const healthPercent = sanitizeHealthPercent(loadout.currentHealthPercent ?? 50);
  const maximumLife = stats.life.temporaryMaxLife;
  const liveBonus = furySelected
    ? getBerserkersFuryBonusFromPercent({
        currentHealthPercent: healthPercent,
        maximumLifePoints: maximumLife,
      })
    : 0;
  const engineBonus = furySelected ? stats.berserkersFury.bonus : 0;

  const regionUnlocked = (id: string) => isRegionUnlocked(build, id as RegionId);

  const setHealthPercent = (raw: number) => {
    setLoadout({
      ...loadout,
      currentHealthPercent: sanitizeHealthPercent(raw),
      currentLife: null,
    });
  };

  const toggleRelic = (relicId: string) => {
    const nextIds = toggleArchaeologyRelic({
      relicId,
      selectedIds,
      energyCap,
    });
    setLoadout(withArchaeologySelection(loadout, nextIds, energyCap));
  };

  const energyPct = energyCap > 0 ? Math.min(100, (used / energyCap) * 100) : 0;

  return (
    <div className="loadout-panel loadout-panel-wide arch-panel">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Arch</h2>
      <p className="mt-1 text-[11px] text-parch-300">
        Mysterious monolith powers. Energy budget is shared; up to three active in-game. League
        regions come from the build planner (no separate selector here).
      </p>

      <div className="arch-energy" role="group" aria-label="Monolith energy">
        <div className="arch-energy__head">
          <span className="arch-energy__label">Monolith energy</span>
          <strong className="arch-energy__values">
            {used} / {energyCap}
            <span className="arch-energy__remain"> · {remaining} free</span>
            <span className="arch-energy__active">
              {" "}
              · {selectedIds.length} / {MONOLITH_ACTIVE_LIMIT} active
            </span>
          </strong>
        </div>
        <div
          className="arch-energy__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={energyCap}
          aria-valuenow={used}
        >
          <span className="arch-energy__fill" style={{ width: `${energyPct}%` }} />
        </div>
        <p className="arch-energy__note">
          Cap 500 by default. 650 requires Anachronia
          {energyCap === 650 ? " (unlocked)" : " (locked)"}.
        </p>
      </div>

      {CATEGORY_GROUPS.map((group) => (
        <div
          key={group.category}
          className="buff-group arch-relic-group"
          role="group"
          aria-label={`${group.label} relics`}
        >
          <h3 className="buff-group__title">{group.label}</h3>
          <div className="arch-relic-list">
            {group.relics.map((relic) => {
              const selected = isRelicActive(selectedIds, relic.id);
              const canOn = canSelectRelic({
                relicId: relic.id,
                selectedIds,
                energyCap,
              });
              return (
                <RelicRow
                  key={relic.id}
                  relic={relic}
                  selected={selected}
                  blocked={!canOn}
                  unlocked={regionUnlocked}
                  onToggle={() => toggleRelic(relic.id)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {furySelected ? (
        <div className="buff-group arch-fury-detail" role="group" aria-label="Berserker's Fury">
          <h3 className="buff-group__title">Berserker&apos;s Fury</h3>
          <p className="arch-relic-meta__desc">
            Shared current health % (also drives Current HP when absolute is on Auto).
          </p>
          <div className="arch-relic-controls">
            <NumberField
              label="Current health"
              value={healthPercent}
              min={0}
              max={100}
              suffix="%"
              onChange={setHealthPercent}
            />
            <div className="arch-relic-bonus" aria-live="polite">
              <span className="arch-relic-bonus__label">Damage bonus</span>
              <strong className="arch-relic-bonus__value">
                +{BONUS_FORMAT.format(liveBonus)}
              </strong>
              {maximumLife > 0 ? (
                <span className="arch-relic-bonus__basis">
                  {Math.floor((maximumLife * healthPercent) / 100).toLocaleString()} /{" "}
                  {maximumLife.toLocaleString()} LP
                </span>
              ) : null}
            </div>
          </div>
          {Math.abs(liveBonus - engineBonus) > 1e-9 ? (
            <p className="arch-relic-meta__note">
              Engine uses resolved LP (
              {engineBonus > 0 ? `+${BONUS_FORMAT.format(engineBonus)}` : "0%"}) when absolute
              Current HP is set on Stats.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
