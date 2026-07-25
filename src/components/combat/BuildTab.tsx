"use client";

import { useMemo, useState } from "react";
import regionsData from "#data/league/regions.json";
import { combatEquipment, type EquipmentRecord } from "@/combat/data";
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
          <NumberField label="Base ability damage" value={loadout.base} onChange={(base) => setLoadout({ ...loadout, base })} />
          <NumberField label="Accuracy" value={loadout.accuracy} onChange={(accuracy) => setLoadout({ ...loadout, accuracy })} suffix="%" />
          <NumberField label="Crit chance" value={loadout.critChance} onChange={(critChance) => setLoadout({ ...loadout, critChance })} suffix="%" />
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
