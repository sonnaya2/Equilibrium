"use client";

import { useMemo, useState } from "react";
import type { CombatStyle } from "@/combat/types";
import { styleIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { BuffsPanel } from "./BuffsPanel";
import { CombatFrameCorners } from "./CombatFrameCorners";
import { GearPanel } from "./GearPanel";
import { loadoutOverloadTier, loadoutStats, loadoutWeaponTier } from "./loadoutStats";
import { overloadBoostedLevel } from "@/combat/shared/potions";
import { PerksPanel } from "./PerksPanel";
import { StatsPanel } from "./StatsPanel";
import { TargetPanel } from "./TargetPanel";
import { equipmentIdList, useLoadout } from "./useLoadout";

const STYLE_LABELS: Record<CombatStyle, string> = {
  melee: "Melee",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
};

const STYLES: CombatStyle[] = ["melee", "ranged", "magic", "necromancy"];

const SUB_TABS = ["Gear", "Stats", "Buffs", "Perks", "Target"] as const;
type SubTab = (typeof SUB_TABS)[number];

function formatPct(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`;
}

function formatNum(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

/** Stat level with the overload boost folded in — the number the engine actually uses. */
function BoostedLevel({ base, boosted }: { base: number; boosted: number }) {
  if (boosted === base) return <dd className="font-mono text-parch-50">{base}</dd>;
  return (
    <dd className="font-mono text-parch-50">
      {boosted}
      <span className="ml-1 text-parch-300">
        ({base} +{boosted - base})
      </span>
    </dd>
  );
}

export function SetupTab() {
  const [loadout, setLoadout] = useLoadout();
  const [subTab, setSubTab] = useState<SubTab>("Gear");
  const stats = useMemo(() => loadoutStats(loadout), [loadout]);

  const slotted = equipmentIdList(loadout.equipmentSlots);
  // Mirrors loadoutStats' accuracy path: overload only, curse is a prayer boost.
  const overloadTier = loadoutOverloadTier(loadout);
  const boostedAttackLevel = overloadTier
    ? overloadBoostedLevel(loadout.attackLevel, overloadTier)
    : loadout.attackLevel;
  const activeBuffs = [
    loadout.buffs.vulnerability ? "Vuln" : null,
    loadout.buffs.styleCurse !== "none" ? loadout.buffs.styleCurse : null,
    loadout.buffs.overload !== "none" ? loadout.buffs.overload : null,
  ].filter(Boolean) as string[];

  const setStyle = (style: CombatStyle) => {
    if (style === loadout.style) return;
    if (style === "melee") {
      setLoadout({
        ...loadout,
        style,
        baseDamage: { ...loadout.baseDamage, mode: "automatic" },
        // Keep current strength/attack; level alias tracks strength.
        level: loadout.strengthLevel,
      });
    } else {
      // Non-melee: single style level from prior damage level.
      const level = loadout.style === "melee" ? loadout.strengthLevel : loadout.level;
      setLoadout({
        ...loadout,
        style,
        baseDamage: { ...loadout.baseDamage, mode: "automatic" },
        level,
        attackLevel: level,
        strengthLevel: level,
      });
    }
  };

  return (
    <div className="combat-setup py-3">
      <div className="combat-page-header flex flex-wrap items-start justify-end gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Combat style">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              aria-pressed={loadout.style === s}
              className={`combat-button setup-style-button flex items-center gap-1.5 border px-3 py-1.5 text-xs ${
                loadout.style === s
                  ? "border-gem-400 bg-stone-850 text-parch-50"
                  : "border-stone-750 text-parch-100 hover:bg-white/[0.02] hover:text-parch-50"
              }`}
            >
              <GameIcon src={styleIconPath(s)} size={16} />
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-layout mt-3 grid gap-4 lg:grid-cols-[7.5rem_minmax(0,1fr)_12rem]">
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
              {tab}
            </button>
          ))}
        </nav>

        <div
          className={`setup-stage min-w-0${subTab === "Gear" ? "" : " combat-frame loadout-editor"}`}
        >
          {subTab === "Gear" ? null : <CombatFrameCorners />}
          {subTab === "Gear" ? <GearPanel loadout={loadout} setLoadout={setLoadout} /> : null}
          {subTab === "Stats" ? <StatsPanel loadout={loadout} setLoadout={setLoadout} /> : null}
          {subTab === "Buffs" ? <BuffsPanel loadout={loadout} setLoadout={setLoadout} /> : null}
          {subTab === "Perks" ? <PerksPanel loadout={loadout} setLoadout={setLoadout} /> : null}
          {subTab === "Target" ? <TargetPanel loadout={loadout} setLoadout={setLoadout} /> : null}
        </div>

        <aside className="combat-frame setup-summary p-3">
          <CombatFrameCorners />
          <h3 className="combat-section-title text-xs font-medium uppercase tracking-wide text-parch-300">
            Summary
          </h3>
          <dl className="mt-2 space-y-2 text-xs">
            <div className="flex justify-between gap-2 border-b border-stone-750/70 pb-1.5">
              <dt className="text-parch-300">Style</dt>
              <dd className="font-medium text-parch-50">{STYLE_LABELS[loadout.style]}</dd>
            </div>
            {loadout.style === "melee" ? (
              <>
                <div className="flex justify-between gap-2 border-b border-stone-750/70 pb-1.5">
                  <dt className="text-parch-300">Attack</dt>
                  <BoostedLevel base={loadout.attackLevel} boosted={boostedAttackLevel} />
                </div>
                <div className="flex justify-between gap-2 border-b border-stone-750/70 pb-1.5">
                  <dt className="text-parch-300">Strength</dt>
                  <BoostedLevel base={loadout.strengthLevel} boosted={stats.effectiveDamageLevel} />
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-2 border-b border-stone-750/70 pb-1.5">
                <dt className="text-parch-300">Level</dt>
                <BoostedLevel base={loadout.level} boosted={stats.effectiveDamageLevel} />
              </div>
            )}
            <div className="flex justify-between gap-2 border-b border-stone-750/70 pb-1.5">
              <dt className="text-parch-300">Weapon tier</dt>
              <dd className="font-mono text-parch-50">{loadoutWeaponTier(loadout)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-stone-750/70 pb-1.5">
              <dt className="text-parch-300">
                Base AD · {loadout.baseDamage.mode === "automatic" ? "auto" : "manual"}
              </dt>
              <dd className="font-mono text-parch-50">{formatNum(stats.base)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-stone-750/70 pb-1.5">
              <dt className="text-parch-300">DP · {stats.damagePotentialSource}</dt>
              <dd className="font-mono text-parch-50">{formatPct(stats.dp)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-stone-750/70 pb-1.5">
              <dt className="text-parch-300">Crit</dt>
              <dd className="font-mono text-parch-50">{formatPct(stats.critChance)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-stone-750/70 pb-1.5">
              <dt className="text-parch-300">Starting adrenaline</dt>
              <dd className="font-mono text-parch-50">{loadout.startingAdrenaline}%</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-stone-750/70 pb-1.5">
              <dt className="text-parch-300">30,000 cap</dt>
              <dd className="font-mono text-parch-50">{loadout.hitCapEnabled ? "On" : "Off"}</dd>
            </div>
            <div className="border-b border-stone-750/70 pb-1.5">
              <dt className="text-parch-300">Buffs</dt>
              <dd className="mt-0.5 text-parch-50">
                {activeBuffs.length ? activeBuffs.join(" · ") : "None"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-parch-300">Equipped</dt>
              <dd className="font-mono text-parch-50">
                {slotted.length}/{14}
              </dd>
            </div>
          </dl>
          {loadout.equipmentIds.length > slotted.length ? (
            <p className="mt-2 text-[11px] text-parch-300">
              +{loadout.equipmentIds.length - slotted.length} unlock pin
              {loadout.equipmentIds.length - slotted.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
