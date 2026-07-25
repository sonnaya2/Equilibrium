"use client";

import { useMemo, useState } from "react";
import regionsData from "#data/league/regions.json";
import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { combatEquipment, type EquipmentRecord } from "@/combat/data";
import type { AffinityKind } from "@/combat/target/genericTarget";
import type { RegionId } from "@/league";
import { GameIcon } from "../GameIcon";
import { regionCrestPath } from "@/lib/gameArt";
import { NumberField } from "./NumberField";
import { useLoadout } from "./useLoadout";

const REGION_NAMES = new Map(regionsData.records.map((r) => [r.id, r.name]));

type SortKey = "region" | "tier" | "name";
type RegionFilter = RegionId | "base" | "all";

function recordRegions(record: EquipmentRecord): RegionId[] {
  return record.unlock?.regions ?? [];
}

function regionLabel(record: EquipmentRecord): string {
  const regions = recordRegions(record);
  if (!regions.length) return "Base game";
  return regions.map((id) => REGION_NAMES.get(id) ?? id).join(", ");
}

/** Build tab: loadout stats plus the region-labelled equipment browser. Item stat
 *  bonuses are unsourced per item (post 9 Mar 2026 values await the corpus), so
 *  selection is organisational — the engine consumes the manual stats above. */
export function BuildTab() {
  const [loadout, setLoadout] = useLoadout();
  const [sortKey, setSortKey] = useState<SortKey>("region");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");

  const rows = useMemo(() => {
    const filtered = combatEquipment.records.filter((record) => {
      if (regionFilter === "all") return true;
      if (regionFilter === "base") return recordRegions(record).length === 0;
      return recordRegions(record).includes(regionFilter);
    });
    const byRegion = (a: EquipmentRecord, b: EquipmentRecord) =>
      regionLabel(a).localeCompare(regionLabel(b));
    return [...filtered].sort((a, b) => {
      if (sortKey === "tier") return (b.tier ?? 0) - (a.tier ?? 0) || byRegion(a, b);
      if (sortKey === "name") return a.name.localeCompare(b.name);
      return byRegion(a, b) || (b.tier ?? 0) - (a.tier ?? 0);
    });
  }, [sortKey, regionFilter]);

  const selected = new Set(loadout.equipmentIds);
  const toggle = (id: string) =>
    setLoadout({
      ...loadout,
      equipmentIds: selected.has(id)
        ? loadout.equipmentIds.filter((entry) => entry !== id)
        : [...loadout.equipmentIds, id],
    });

  return (
    <div className="grid gap-5 py-5 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-medium text-parch-50">Loadout</h2>
        <p className="mt-1 text-xs text-parch-300">
          Shared with Rotation and Analysis. Item stat bonuses land when sourced per-item
          values arrive — until then the engine runs on these manual stats.
        </p>
        <div className="mt-3 border-t border-stone-750">
          <NumberField label="Style level" value={loadout.level} onChange={(level) => setLoadout({ ...loadout, level })} />
          <NumberField label="Weapon tier" value={loadout.weaponTier} onChange={(weaponTier) => setLoadout({ ...loadout, weaponTier })} />
          <NumberField label="Base ability damage" value={loadout.base} onChange={(base) => setLoadout({ ...loadout, base })} />
          <div className="flex justify-end border-b border-stone-750/70 py-1.5">
            <button
              type="button"
              onClick={() =>
                setLoadout({
                  ...loadout,
                  base: baseAbilityDamage(loadout.level, {
                    kind: "twohand",
                    weapon: { tier: loadout.weaponTier },
                    style: loadout.style,
                  }),
                })
              }
              className="border border-stone-750 px-2 py-1 text-xs text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
            >
              Compute from level + tier
            </button>
          </div>
          <NumberField label="Accuracy" value={loadout.accuracy} onChange={(accuracy) => setLoadout({ ...loadout, accuracy })} suffix="%" />
          <NumberField label="Crit chance" value={loadout.critChance} onChange={(critChance) => setLoadout({ ...loadout, critChance })} suffix="%" />
        </div>

        <h3 className="mt-4 text-xs font-medium text-parch-50">Target</h3>
        <p className="mt-1 text-xs text-parch-300">
          Model an NPC instead of entering accuracy directly — Damage Potential follows the
          verified hit-chance chain.
        </p>
        <div className="mt-2 border-t border-stone-750">
          <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-300">
            <input
              type="checkbox"
              checked={loadout.target !== null}
              onChange={(event) =>
                setLoadout({
                  ...loadout,
                  target: event.target.checked ? { defenceLevel: 80, affinity: "same" } : null,
                })
              }
            />
            Use NPC target model
          </label>
          {loadout.target ? (
            <>
              <NumberField
                label="Defence level"
                value={loadout.target.defenceLevel}
                onChange={(defenceLevel) =>
                  setLoadout({ ...loadout, target: { ...loadout.target!, defenceLevel } })
                }
              />
              <label className="grid grid-cols-[1fr_110px] items-center gap-3 border-b border-stone-750/70 py-2 text-xs text-parch-300">
                <span>Affinity</span>
                <select
                  value={loadout.target.affinity}
                  onChange={(event) =>
                    setLoadout({
                      ...loadout,
                      target: { ...loadout.target!, affinity: event.target.value as AffinityKind },
                    })
                  }
                  className="w-full border border-stone-750 bg-transparent px-2 py-1 text-xs text-parch-50"
                >
                  <option value="weak">Weak (70)</option>
                  <option value="same">Same (60)</option>
                  <option value="strong">Strong (50)</option>
                  <option value="weakness">Specific weakness (90)</option>
                </select>
              </label>
            </>
          ) : null}
        </div>

        <h3 className="mt-4 text-xs font-medium text-parch-50">Perks &amp; sets</h3>
        <p className="mt-1 text-xs text-parch-300">
          Only sourced current values — unsourced perks stay out rather than guessed.
        </p>
        <div className="mt-2 border-t border-stone-750">
          {(
            [
              ["equilibrium", "Equilibrium rank (+10% +1%/rank AD)", 5],
              ["ultimatums", "Ultimatums rank (+3% +1%/rank ult)", 4],
              ["lunging", "Lunging rank (+10% +3%/rank bleeds)", 4],
              ["energising", "Energising rank (+50 +25/rank acc)", 4],
              ["tectonicPieces", "Tectonic pieces (+1%/piece crit)", 5],
              ["tumekensPieces", "Tumeken's pieces (+1.5%/piece crit)", 5],
            ] as const
          ).map(([key, label, max]) => (
            <NumberField
              key={key}
              label={label}
              value={loadout.perks[key]}
              onChange={(value) =>
                setLoadout({
                  ...loadout,
                  perks: { ...loadout.perks, [key]: Math.min(Math.max(0, Math.floor(value)), max) },
                })
              }
            />
          ))}
          <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-300">
            <input
              type="checkbox"
              checked={loadout.perks.eliteTectonic}
              onChange={(event) =>
                setLoadout({ ...loadout, perks: { ...loadout.perks, eliteTectonic: event.target.checked } })
              }
            />
            Elite tectonic (+2%/piece instead)
          </label>
          <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-300">
            <input
              type="checkbox"
              checked={loadout.perks.insideSunshine}
              onChange={(event) =>
                setLoadout({ ...loadout, perks: { ...loadout.perks, insideSunshine: event.target.checked } })
              }
            />
            Inside Sunshine (Tumeken set(3) active)
          </label>
        </div>

        <p className="mt-3 text-xs text-parch-300">
          {selected.size} item{selected.size === 1 ? "" : "s"} pinned to the loadout.
        </p>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-parch-300">
            Region
            <select
              value={regionFilter}
              onChange={(event) => setRegionFilter(event.target.value as RegionFilter)}
              className="border border-stone-750 bg-transparent px-2 py-1 text-parch-50"
            >
              <option value="all">All regions</option>
              <option value="base">Base game</option>
              {regionsData.records.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-1" role="group" aria-label="Sort equipment">
            {(["region", "tier", "name"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortKey(key)}
                className={`border px-2 py-1 capitalize ${
                  sortKey === key
                    ? "border-stone-700 bg-stone-850 text-parch-50"
                    : "border-stone-750 text-parch-300 hover:text-parch-50"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          <span className="text-parch-300">{rows.length} records</span>
        </div>

        <div className="mt-3 border-t border-stone-750">
          {rows.map((record) => {
            const isSelected = selected.has(record.id);
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => toggle(record.id)}
                className={`grid w-full grid-cols-[1fr_auto] items-center gap-2 border-b border-stone-750/70 px-2 py-1.5 text-left text-xs ${
                  isSelected ? "bg-stone-850 text-parch-50" : "text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{record.name}</span>
                  {record.tier != null ? <span className="font-mono text-parch-300">T{record.tier}</span> : null}
                </span>
                <span className="flex items-center gap-1.5 text-parch-300">
                  {recordRegions(record).map((id) => (
                    <GameIcon key={id} src={regionCrestPath(id)} size={14} />
                  ))}
                  <span>{regionLabel(record)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
