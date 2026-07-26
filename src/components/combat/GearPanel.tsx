"use client";

import { useMemo, useState } from "react";
import regionsData from "#data/league/regions.json";
import { combatEquipment, type EquipmentRecord } from "@/combat/data";
import type { EquipmentSlot } from "@/combat/data/records";
import type { RegionId } from "@/league";
import { regionCrestPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import {
  clearEquipment,
  equipInSlot,
  EQUIPMENT_SLOTS,
  equipmentIdList,
  toggleUnlockPin,
  unlockOnlyIds,
  type Loadout,
} from "./useLoadout";

const REGION_NAMES = new Map(regionsData.records.map((r) => [r.id, r.name]));

type SortKey = "region" | "tier" | "name";
type RegionFilter = RegionId | "base" | "all";

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  mainhand: "Main-hand",
  offhand: "Off-hand",
  twohand: "Two-hand",
  helmet: "Helmet",
  body: "Body",
  legs: "Legs",
  gloves: "Gloves",
  boots: "Boots",
  cape: "Cape",
  amulet: "Amulet",
  ring: "Ring",
  pocket: "Pocket",
  ammo: "Ammo",
  aura: "Aura",
};

/** Paper-doll grid positions (CSS grid 3× rows). */
const DOLL_LAYOUT: Array<Array<EquipmentSlot | null>> = [
  [null, "helmet", null],
  ["cape", "amulet", "ammo"],
  ["mainhand", "body", "offhand"],
  [null, "twohand", null],
  ["gloves", "legs", "boots"],
  [null, "ring", null],
  [null, "pocket", null],
  [null, "aura", null],
];

function recordRegions(record: EquipmentRecord): RegionId[] {
  return record.unlock?.regions ?? [];
}

function regionLabel(record: EquipmentRecord): string {
  const regions = recordRegions(record);
  if (!regions.length) return "Base game";
  return regions.map((id) => REGION_NAMES.get(id) ?? id).join(", ");
}

function byId(id: string | null | undefined): EquipmentRecord | undefined {
  if (!id) return undefined;
  return combatEquipment.records.find((r) => r.id === id);
}

function styleMatches(record: EquipmentRecord, style: Loadout["style"]): boolean {
  if (!record.style || record.style === "hybrid") return true;
  return record.style === style;
}

/** Paper doll + item picker. Item bonuses unsourced — placement is organisational. */
export function GearPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const [activeSlot, setActiveSlot] = useState<EquipmentSlot | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("region");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  /** When on, only loadout.style / hybrid / no-style records. Off by default so the
   *  browser can still cross-style region browse (most weapons are style-tagged). */
  const [matchStyle, setMatchStyle] = useState(false);

  const slots = loadout.equipmentSlots ?? {};
  const unlockPins = new Set(unlockOnlyIds(loadout));
  const slottedCount = equipmentIdList(slots).length;

  const wearables = useMemo(
    () => combatEquipment.records.filter((r) => r.slot != null),
    [],
  );
  const unlocks = useMemo(
    () => combatEquipment.records.filter((r) => r.slot == null),
    [],
  );

  const pickerRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = wearables.filter((record) => {
      if (activeSlot && record.slot !== activeSlot) return false;
      if (matchStyle && !styleMatches(record, loadout.style)) return false;
      if (regionFilter === "base") {
        if (recordRegions(record).length > 0) return false;
      } else if (regionFilter !== "all") {
        if (!recordRegions(record).includes(regionFilter)) return false;
      }
      if (q && !record.name.toLowerCase().includes(q) && !record.id.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    const byRegion = (a: EquipmentRecord, b: EquipmentRecord) =>
      regionLabel(a).localeCompare(regionLabel(b));
    return [...filtered].sort((a, b) => {
      if (sortKey === "tier") return (b.tier ?? 0) - (a.tier ?? 0) || byRegion(a, b);
      if (sortKey === "name") return a.name.localeCompare(b.name);
      return byRegion(a, b) || (b.tier ?? 0) - (a.tier ?? 0);
    });
  }, [wearables, activeSlot, matchStyle, loadout.style, regionFilter, search, sortKey]);

  const unlockRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = unlocks.filter((record) => {
      if (matchStyle && !styleMatches(record, loadout.style)) return false;
      if (regionFilter === "base") {
        if (recordRegions(record).length > 0) return false;
      } else if (regionFilter !== "all") {
        if (!recordRegions(record).includes(regionFilter)) return false;
      }
      if (q && !record.name.toLowerCase().includes(q) && !record.id.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [unlocks, matchStyle, loadout.style, regionFilter, search]);

  const equip = (record: EquipmentRecord) => {
    if (!record.slot) return;
    setLoadout(equipInSlot(loadout, record.slot, record.id));
    setActiveSlot(record.slot);
  };

  const clearSlot = (slot: EquipmentSlot) => {
    setLoadout(equipInSlot(loadout, slot, null));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-medium text-parch-50">Paper doll</h2>
        <p className="mt-1 text-xs text-parch-300">
          Click a slot, then pick an item. Item bonuses empty until sourced — weapon tier still
          drives damage.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-1.5" role="group" aria-label="Equipment slots">
          {DOLL_LAYOUT.flatMap((row, rowIdx) =>
            row.map((slot, colIdx) => {
              if (!slot) {
                return <div key={`pad-${rowIdx}-${colIdx}`} className="min-h-[2.75rem]" />;
              }
              const id = slots[slot] ?? null;
              const item = byId(id);
              const selected = activeSlot === slot;
              const empty = !item;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setActiveSlot(selected ? null : slot)}
                  title={SLOT_LABELS[slot]}
                  className={`min-h-[2.75rem] border px-1.5 py-1 text-left text-[11px] leading-tight ${
                    selected
                      ? "border-gem-400 bg-stone-850 text-parch-50"
                      : empty
                        ? "border-dashed border-stone-750 text-parch-300 hover:border-stone-carve hover:text-parch-100"
                        : "border-stone-750 bg-stone-900 text-parch-50 hover:bg-stone-850"
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-wide text-parch-300">
                    {SLOT_LABELS[slot]}
                  </span>
                  <span className="block truncate">{item?.name ?? "Empty"}</span>
                </button>
              );
            }),
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {activeSlot ? (
            <button
              type="button"
              onClick={() => clearSlot(activeSlot)}
              className="border border-stone-750 px-2 py-1 text-parch-100 hover:text-parch-50"
            >
              Clear {SLOT_LABELS[activeSlot]}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setLoadout(clearEquipment(loadout))}
            className="border border-stone-750 px-2 py-1 text-parch-100 hover:text-parch-50"
          >
            Clear all gear
          </button>
          <span className="self-center text-parch-300">
            {slottedCount} slot{slottedCount === 1 ? "" : "s"} · {unlockPins.size} unlock pin
            {unlockPins.size === 1 ? "" : "s"}
          </span>
        </div>

        {/* Full slot list for a11y / narrow screens */}
        <div className="mt-3 border-t border-stone-750 lg:hidden">
          {EQUIPMENT_SLOTS.map((slot) => {
            const item = byId(slots[slot]);
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveSlot(slot)}
                className={`grid w-full grid-cols-[7rem_1fr] gap-2 border-b border-stone-750/70 px-2 py-1.5 text-left text-xs ${
                  activeSlot === slot ? "bg-stone-850 text-parch-50" : "text-parch-100"
                }`}
              >
                <span className="text-parch-300">{SLOT_LABELS[slot]}</span>
                <span className="truncate">{item?.name ?? "Empty"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-parch-100">
            Region
            <select
              value={regionFilter}
              onChange={(event) => setRegionFilter(event.target.value as RegionFilter)}
              className="border border-stone-750 bg-transparent px-2 py-1 text-sm text-parch-50"
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
          <label className="flex items-center gap-1 text-parch-100">
            Search
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name…"
              className="w-36 border border-stone-750 bg-transparent px-2 py-1 text-sm text-parch-50"
            />
          </label>
          <label className="flex items-center gap-1.5 text-parch-100">
            <input
              type="checkbox"
              checked={matchStyle}
              onChange={(event) => setMatchStyle(event.target.checked)}
            />
            Match style
          </label>
          <div className="flex gap-1" role="group" aria-label="Sort equipment">
            {(["region", "tier", "name"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortKey(key)}
                className={`border px-2 py-1 capitalize ${
                  sortKey === key
                    ? "border-stone-750 bg-stone-850 text-parch-50"
                    : "border-stone-750 text-parch-100 hover:text-parch-50"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          {activeSlot ? (
            <span className="text-gem-400">Filter: {SLOT_LABELS[activeSlot]}</span>
          ) : (
            <span className="text-parch-300">All wearable slots</span>
          )}
        </div>

        <h3 className="mt-3 text-xs font-medium uppercase tracking-wide text-parch-300">
          Wearables · {pickerRows.length}
        </h3>
        <div className="mt-1 border-t border-stone-750">
          {pickerRows.length === 0 ? (
            <p className="py-3 text-xs text-parch-300">
              No wearables match. Most corpus rows still lack a slot — check Unlocks below.
            </p>
          ) : (
            pickerRows.map((record) => {
              const equipped = slots[record.slot!] === record.id;
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => equip(record)}
                  className={`grid w-full grid-cols-[1fr_auto] items-center gap-2 border-b border-stone-750/70 px-2 py-1.5 text-left text-sm ${
                    equipped
                      ? "bg-stone-850 text-parch-50"
                      : "text-parch-100 hover:bg-white/[0.02] hover:text-parch-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{record.name}</span>
                    {record.tier != null ? (
                      <span className="font-mono text-parch-100">T{record.tier}</span>
                    ) : null}
                    <span className="text-[11px] text-parch-300">
                      {SLOT_LABELS[record.slot!]}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-parch-100">
                    {recordRegions(record).map((id) => (
                      <GameIcon key={id} src={regionCrestPath(id)} size={14} />
                    ))}
                    <span>{regionLabel(record)}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-parch-300">
          Unlocks &amp; materials · {unlockRows.length}
        </h3>
        <p className="mt-1 text-xs text-parch-300">
          No slot on the doll — pin for organisation only.
        </p>
        <div className="mt-1 border-t border-stone-750">
          {unlockRows.map((record) => {
            const pinned = unlockPins.has(record.id);
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => setLoadout(toggleUnlockPin(loadout, record.id))}
                className={`grid w-full grid-cols-[1fr_auto] items-center gap-2 border-b border-stone-750/70 px-2 py-1.5 text-left text-sm ${
                  pinned
                    ? "bg-stone-850 text-parch-50"
                    : "text-parch-100 hover:bg-white/[0.02] hover:text-parch-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{record.name}</span>
                  {record.tier != null ? (
                    <span className="font-mono text-parch-100">T{record.tier}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1.5 text-parch-100">
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
