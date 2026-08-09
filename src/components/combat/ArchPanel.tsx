"use client";

import { useEffect, useMemo, useState } from "react";
import { GameIcon } from "../GameIcon";
import { RegionCrest } from "../RegionCrest";
import { NumberField } from "./NumberField";
import {
  archaeologyRejectLabel,
  archaeologySelectBlockReason,
  isRelicActive,
  MONOLITH_ACTIVE_LIMIT,
  relicsGroupedByCategory,
  resolveMonolithEnergyCap,
  sanitizeArchaeologyState,
  totalEnergyUsed,
  type ArchaeologyRelic,
  type ArchaeologySelectRejectReason,
} from "@/combat/shared/archaeologyRelics";
import {
  getBerserkersFuryBonus,
  lifePointsFromHealthPercent,
  sanitizeHealthPercent,
} from "@/combat/shared/berserkersFury";
import { CONSERVATION_OF_ENERGY_REFUND } from "@/combat/shared/conservationOfEnergy";
import { FURY_OF_THE_SMALL_EXTRA_ADRENALINE } from "@/combat/shared/furyOfTheSmall";
import { loadoutStats } from "./loadoutStats";
import {
  applyArchaeologyToggle,
  withArchaeologySelection,
  type Loadout,
  type SetLoadout,
} from "./useLoadout";
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
  blockReason,
  unlocked,
  onToggle,
}: {
  relic: ArchaeologyRelic;
  selected: boolean;
  blockReason: ArchaeologySelectRejectReason | null;
  unlocked: (id: string) => boolean;
  onToggle: () => void;
}) {
  const disabled = blockReason != null && !selected;
  const blockLabel = blockReason != null ? archaeologyRejectLabel(blockReason) : null;
  return (
    <button
      type="button"
      className={`arch-relic-tile${selected ? " is-on" : ""}${disabled ? " is-disabled" : ""}`}
      aria-pressed={selected}
      aria-disabled={disabled}
      disabled={disabled}
      title={disabled && blockLabel ? blockLabel : undefined}
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
        {disabled && blockLabel ? (
          <span className="arch-relic-tile__block text-[10px] text-parch-400">{blockLabel}</span>
        ) : null}
        <RelicRegionBadges regions={relic.requiredRegions} unlocked={unlocked} />
      </span>
    </button>
  );
}

export function ArchPanel({ loadout, setLoadout }: { loadout: Loadout; setLoadout: SetLoadout }) {
  const { build } = useBuild();
  const [rejectHint, setRejectHint] = useState<string | null>(null);
  const unlockedRegions = useMemo(
    () => REGION_IDS.filter((id) => isRegionUnlocked(build, id)),
    [build],
  );
  const unlockedKey = unlockedRegions.join("|");

  // Same clamp combat/stats use - tiles and bars never show illegal "selected but dead" relics.
  const effectiveArch = useMemo(
    () =>
      sanitizeArchaeologyState(
        loadout.archaeology ?? { selectedIds: [], energyCap: 500 },
        unlockedRegions,
      ),
    [loadout.archaeology, unlockedRegions],
  );
  const energyCap = effectiveArch.energyCap;
  const selectedIds = effectiveArch.selectedIds;
  const used = totalEnergyUsed(selectedIds);
  const remaining = energyCap - used;
  const furySelected = isRelicActive(selectedIds, "berserkers_fury");
  const fotsSelected = isRelicActive(selectedIds, "fury_of_the_small");
  const hsSelected = isRelicActive(selectedIds, "heightened_senses");
  const coeSelected = isRelicActive(selectedIds, "conservation_of_energy");

  // Only re-clamp when league regions change (Anachronia 500↔650). Functional update
  // so a pending relic toggle is not wiped by a stale loadout snapshot.
  useEffect(() => {
    setLoadout((prev) => {
      const stored = prev.archaeology ?? { selectedIds: [], energyCap: 500 as const };
      const next = sanitizeArchaeologyState(stored, unlockedRegions);
      const sameCap = stored.energyCap === next.energyCap;
      const sameIds =
        next.selectedIds.length === stored.selectedIds.length &&
        next.selectedIds.every((id, i) => id === stored.selectedIds[i]);
      if (sameCap && sameIds) return prev;
      return withArchaeologySelection(prev, next.selectedIds, next.energyCap);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- region key only
  }, [unlockedKey, setLoadout]);

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
  // Absolute LP when set; else percent of max (same resolve path as Stats / engine).
  const currentLifePoints =
    loadout.currentLife != null
      ? loadout.currentLife
      : lifePointsFromHealthPercent(maximumLife, healthPercent);
  const liveBonus = furySelected
    ? getBerserkersFuryBonus({
        currentLifePoints,
        maximumLifePoints: maximumLife,
      })
    : 0;
  const engineBonus = stats.berserkersFury.active ? stats.berserkersFury.bonus : 0;

  const regionUnlocked = (id: string) => isRegionUnlocked(build, id as RegionId);

  const setHealthPercent = (raw: number) => {
    const pct = sanitizeHealthPercent(raw);
    setLoadout((prev) => ({
      ...prev,
      currentHealthPercent: pct,
      currentLife: lifePointsFromHealthPercent(maximumLife, pct),
    }));
  };

  const setCurrentLife = (raw: number) => {
    const lp = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    const pct =
      maximumLife > 0
        ? sanitizeHealthPercent((lp / maximumLife) * 100)
        : sanitizeHealthPercent(healthPercent);
    setLoadout((prev) => ({
      ...prev,
      currentLife: lp,
      currentHealthPercent: pct,
    }));
  };

  const displayHealthPercent =
    maximumLife > 0
      ? Math.round(sanitizeHealthPercent((currentLifePoints / maximumLife) * 100) * 10) / 10
      : Math.round(healthPercent * 10) / 10;

  // CoE / FotS / HS from selectedIds (and direct adrenaline fields), not ultRefund - RoV.
  const adren = stats.adrenaline as
    (typeof stats.adrenaline & { conservationOfEnergyRefund?: number }) | undefined;
  const fotsBonus = fotsSelected
    ? (adren?.basicAdrenalineFlatBonus ?? FURY_OF_THE_SMALL_EXTRA_ADRENALINE)
    : 0;
  const coeRefund = coeSelected
    ? (adren?.conservationOfEnergyRefund ?? CONSERVATION_OF_ENERGY_REFUND)
    : 0;
  const adrenLive = [
    hsSelected ? `Heightened Senses · max adrenaline ${stats.maxAdrenaline}%` : null,
    fotsSelected ? `Fury of the Small · basics +${fotsBonus}% adren` : null,
    coeSelected ? `Conservation of Energy · +${coeRefund}% after ultimate` : null,
  ].filter((line): line is string => line != null);

  const toggleRelic = (relicId: string) => {
    const cap = resolveMonolithEnergyCap({
      unlockedRegions,
      requestedCap: loadout.archaeology?.energyCap ?? null,
    });
    const attempt = applyArchaeologyToggle(loadout, relicId, cap, unlockedRegions);
    if (!attempt.result.ok) {
      setRejectHint(archaeologyRejectLabel(attempt.result.reason));
      return;
    }
    setRejectHint(null);
    setLoadout((prev) => {
      const currentCap = resolveMonolithEnergyCap({
        unlockedRegions,
        requestedCap: prev.archaeology?.energyCap ?? null,
      });
      return applyArchaeologyToggle(prev, relicId, currentCap, unlockedRegions).loadout;
    });
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
        {rejectHint ? (
          <p className="arch-energy__reject mt-1 text-[11px] text-ruby-300" role="status">
            {rejectHint}
          </p>
        ) : null}
        {adrenLive.length > 0 ? (
          <ul
            className="arch-energy__live mt-1.5 space-y-0.5 text-[11px] text-gem-300"
            data-testid="arch-adren-live"
          >
            {adrenLive.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
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
              const blockReason = archaeologySelectBlockReason({
                relicId: relic.id,
                selectedIds,
                energyCap,
                unlockedRegions,
              });
              return (
                <RelicRow
                  key={relic.id}
                  relic={relic}
                  selected={selected}
                  blockReason={blockReason}
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
          <p className="arch-relic-meta__desc">Current Hitpoints set the bonus.</p>
          <div className="arch-relic-controls">
            <NumberField
              label="Current Hitpoints"
              value={currentLifePoints}
              min={0}
              max={stats.life.overhealCeiling}
              onChange={setCurrentLife}
            />
            <NumberField
              label="Health"
              value={displayHealthPercent}
              min={0}
              max={100}
              suffix="%"
              onChange={setHealthPercent}
            />
            <div className="arch-relic-bonus" aria-live="polite">
              <span className="arch-relic-bonus__label">Damage bonus</span>
              <strong className="arch-relic-bonus__value">+{BONUS_FORMAT.format(liveBonus)}</strong>
              {maximumLife > 0 ? (
                <span className="arch-relic-bonus__basis">
                  {currentLifePoints.toLocaleString()} / {maximumLife.toLocaleString()} Hitpoints
                </span>
              ) : null}
            </div>
          </div>
          {Math.abs(liveBonus - engineBonus) > 1e-9 ? (
            <p className="arch-relic-meta__note">
              Engine bonus is +{BONUS_FORMAT.format(engineBonus)} from resolved Hitpoints (
              {stats.berserkersFury.currentLifePoints.toLocaleString()} /{" "}
              {stats.berserkersFury.maximumLifePoints.toLocaleString()}).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
