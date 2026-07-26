"use client";

import { useMemo, useState } from "react";
import regionsData from "#data/league/regions.json";
import { combatEquipment, type EquipmentRecord } from "@/combat/data";
import type { EquipmentSlot } from "@/combat/data/records";
import type { CombatStyle } from "@/combat/types";
import type { RegionId } from "@/league";
import { regionCrestPath, styleIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { setEffectsSummary } from "@/combat/shared/equipment";
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
/** `setup` follows loadout.style; `all` shows every style; else browse that style only. */
type StyleBrowse = "setup" | "all" | CombatStyle;

const COMBAT_STYLES: CombatStyle[] = ["melee", "ranged", "magic", "necromancy"];

const STYLE_LABELS: Record<CombatStyle, string> = {
  melee: "Melee",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
};

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

/** Compact slot tag on picker rows. */
const SLOT_SHORT: Record<EquipmentSlot, string> = {
  mainhand: "MH",
  offhand: "OH",
  twohand: "2H",
  helmet: "Helm",
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

const WEARABLE_CAP = 80;

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

function styleMatches(record: EquipmentRecord, style: CombatStyle): boolean {
  if (!record.style || record.style === "hybrid") return true;
  return record.style === style;
}

/** Effective combat style for the wearable list, or null when browsing all styles. */
function effectiveBrowseStyle(
  styleBrowse: StyleBrowse,
  loadoutStyle: CombatStyle,
): CombatStyle | null {
  if (styleBrowse === "all") return null;
  if (styleBrowse === "setup") return loadoutStyle;
  return styleBrowse;
}

/** Show style tag when item is hybrid, mismatched, or browsing all styles. */
function styleRowTag(
  record: EquipmentRecord,
  referenceStyle: CombatStyle | null,
): string | null {
  if (!record.style) return null;
  if (record.style === "hybrid") return "hybrid";
  if (referenceStyle == null) return record.style;
  if (record.style !== referenceStyle) return record.style;
  return null;
}

/** True when any numeric bonus field is present and non-zero. Empty `{}` is the corpus default. */
function hasSourcedBonuses(record: EquipmentRecord): boolean {
  const b = record.bonuses;
  if (!b) return false;
  for (const v of Object.values(b)) {
    if (typeof v === "number" && v !== 0) return true;
  }
  return false;
}

function emptyPickerCopy(
  activeSlot: EquipmentSlot | null,
  styleBrowse: StyleBrowse,
  style: CombatStyle,
): string {
  const slotBit = activeSlot ? SLOT_LABELS[activeSlot] : null;
  const styleOn = styleBrowse !== "all";
  const styleName =
    styleBrowse === "setup" || styleBrowse === "all"
      ? style
      : styleBrowse;
  if (slotBit && styleOn) {
    return `No wearables for ${slotBit} under ${styleName} (or hybrid). Browse all styles, pick another slot, or broaden region/search.`;
  }
  if (slotBit) {
    return `No wearables for ${slotBit} with the current region/search. Materials and set aggregates stay under Unlocks.`;
  }
  if (styleOn) {
    return `No wearables match ${styleName} (or hybrid) with the current filters. Wearables need a slot; try Browse all styles or region/search.`;
  }
  return "No wearables match. Wearables need a slot; materials and set aggregates stay under Unlocks.";
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
  const [sortKey, setSortKey] = useState<SortKey>("tier");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  /** Default setup: only loadout.style / hybrid / unstyled. `all` = browse every style. */
  const [styleBrowse, setStyleBrowse] = useState<StyleBrowse>("setup");
  /** Cap long catalogues; toggle expands past the first 80. */
  const [showAllWearables, setShowAllWearables] = useState(false);
  /** Unlocks are secondary — collapsed so the wearable list owns the column. */
  const [unlocksOpen, setUnlocksOpen] = useState(false);

  const slots = loadout.equipmentSlots ?? {};
  const unlockPins = new Set(unlockOnlyIds(loadout));
  const slottedCount = equipmentIdList(slots).length;
  const activeItem = activeSlot ? byId(slots[activeSlot]) : undefined;

  const matchStyle = styleBrowse === "setup";
  const styleFilterOn = styleBrowse !== "all";
  const browseStyle = effectiveBrowseStyle(styleBrowse, loadout.style);

  /** Doll-equipable only — materials, codices, and set aggregates stay in Unlocks. */
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
      if (record.slot == null) return false;
      if (activeSlot && record.slot !== activeSlot) return false;
      if (browseStyle != null && !styleMatches(record, browseStyle)) return false;
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
    const byName = (a: EquipmentRecord, b: EquipmentRecord) => a.name.localeCompare(b.name);
    const byRegion = (a: EquipmentRecord, b: EquipmentRecord) =>
      regionLabel(a).localeCompare(regionLabel(b));
    return [...filtered].sort((a, b) => {
      if (sortKey === "tier") return (b.tier ?? 0) - (a.tier ?? 0) || byName(a, b);
      if (sortKey === "name") return byName(a, b);
      return byRegion(a, b) || (b.tier ?? 0) - (a.tier ?? 0) || byName(a, b);
    });
  }, [wearables, activeSlot, browseStyle, regionFilter, search, sortKey]);

  const wearablesCapped = pickerRows.length > WEARABLE_CAP && !showAllWearables;
  const visiblePickerRows = wearablesCapped ? pickerRows.slice(0, WEARABLE_CAP) : pickerRows;

  const unlockRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    // No-slot only: materials, codices, set aggregates — never equip onto the doll.
    const filtered = unlocks.filter((record) => {
      if (record.slot != null) return false;
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
  }, [unlocks, regionFilter, search]);

  const setStyleBrowseAndReset = (next: StyleBrowse) => {
    setStyleBrowse(next);
    setShowAllWearables(false);
  };

  const equip = (record: EquipmentRecord) => {
    if (record.slot == null) return;
    // Active slot filter is strict: twohand is its own doll cell (MH/OH exclusivity is
    // handled inside equipInSlot when that cell is chosen).
    if (activeSlot != null && record.slot !== activeSlot) return;
    setLoadout(equipInSlot(loadout, record.slot, record.id));
    setActiveSlot(record.slot);
  };

  const clearSlot = (slot: EquipmentSlot) => {
    setLoadout(equipInSlot(loadout, slot, null));
  };

  const countLine = `${pickerRows.length} wearable${pickerRows.length === 1 ? "" : "s"} · style filter ${styleFilterOn ? "on" : "off"}`;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-medium text-parch-50">Paper doll</h2>
        <p className="mt-1 text-xs text-parch-300">
          Wearables require a slot. Style filter defaults to setup (and hybrid). Browse chips let
          you page another style without changing Setup. Item combat stats and set piece counts
          come from the wiki where sourced; weapon tier still drives base AD.
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
              const noBonuses = item != null && !hasSourcedBonuses(item);
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
                  <span className="block text-[11px] uppercase tracking-wide text-parch-300">
                    {SLOT_LABELS[slot]}
                  </span>
                  <span className="block truncate">{item?.name ?? "Empty"}</span>
                  {item?.tier != null ? (
                    <span className="block font-mono text-[11px] text-parch-100">T{item.tier}</span>
                  ) : null}
                  {noBonuses ? (
                    <span className="block text-[11px] text-parch-300">no bonus numbers</span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>

        {(() => {
          const sets = setEffectsSummary(loadout);
          if (sets.length === 0) return null;
          return (
            <div className="mt-3 border border-stone-750 bg-stone-900 px-2 py-1.5 text-xs">
              <div className="text-[11px] uppercase tracking-wide text-parch-300">Set pieces equipped</div>
              <ul className="mt-1 space-y-0.5 text-parch-100">
                {sets.map((s) => (
                  <li key={s.setId}>
                    <span className="text-parch-50">{s.label}</span>
                    <span className="ml-1.5 font-mono text-parch-300">×{s.pieces}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-parch-300">
                Combat-relevant set crits (Tectonic / Tumeken) apply automatically from gear.
              </p>
            </div>
          );
        })()}

        {activeItem ? (
          <div className="mt-3 border border-stone-750 bg-stone-900 px-2 py-1.5 text-xs">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-parch-50">{activeItem.name}</span>
              {activeItem.tier != null ? (
                <span className="font-mono text-parch-100">T{activeItem.tier}</span>
              ) : null}
              {activeSlot ? (
                <span className="text-parch-300">{SLOT_LABELS[activeSlot]}</span>
              ) : null}
            </div>
            {hasSourcedBonuses(activeItem) ? (
              <p className="mt-0.5 text-parch-100">
                {[
                  activeItem.bonuses.damage != null ? `dmg ${activeItem.bonuses.damage}` : null,
                  activeItem.bonuses.accuracy != null ? `acc ${activeItem.bonuses.accuracy}` : null,
                  activeItem.bonuses.armour != null ? `arm ${activeItem.bonuses.armour}` : null,
                  activeItem.bonuses.prayer != null ? `pray ${activeItem.bonuses.prayer}` : null,
                  activeItem.bonuses.critChance != null
                    ? `crit ${activeItem.bonuses.critChance}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : (
              <p className="mt-0.5 text-parch-300">no bonus numbers</p>
            )}
          </div>
        ) : null}

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
                <span className="min-w-0">
                  <span className="block truncate">{item?.name ?? "Empty"}</span>
                  {item && !hasSourcedBonuses(item) ? (
                    <span className="block text-[11px] text-parch-300">no bonus numbers</span>
                  ) : null}
                </span>
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
              onChange={(event) => {
                setRegionFilter(event.target.value as RegionFilter);
                setShowAllWearables(false);
              }}
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
              onChange={(event) => {
                setSearch(event.target.value);
                setShowAllWearables(false);
              }}
              placeholder="Name…"
              className="w-36 border border-stone-750 bg-transparent px-2 py-1 text-sm text-parch-50"
            />
          </label>
          {/* Kept for e2e + keyboard: checked = follow setup style. */}
          <label className="flex items-center gap-1.5 text-parch-100">
            <input
              type="checkbox"
              checked={matchStyle}
              onChange={(event) =>
                setStyleBrowseAndReset(event.target.checked ? "setup" : "all")
              }
            />
            Match style
          </label>
          <div className="flex gap-1" role="group" aria-label="Sort equipment">
            {(["tier", "name", "region"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSortKey(key);
                  setShowAllWearables(false);
                }}
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
            <span className="text-gem-400">Filtering: {SLOT_LABELS[activeSlot]}</span>
          ) : (
            <span className="text-parch-300">All wearable slots</span>
          )}
        </div>

        {/* Browse-style chips — independent of loadout; Setup chip follows loadout.style. */}
        <div
          className="mt-2 flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Browse combat style"
        >
          <button
            type="button"
            aria-pressed={styleBrowse === "setup"}
            onClick={() => setStyleBrowseAndReset("setup")}
            className="facet-chip"
            title={`Follow setup (${STYLE_LABELS[loadout.style]})`}
          >
            Setup
          </button>
          <button
            type="button"
            aria-pressed={styleBrowse === "all"}
            onClick={() => setStyleBrowseAndReset("all")}
            className="facet-chip"
            title="Browse all styles"
          >
            Browse all styles
          </button>
          {COMBAT_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={styleBrowse === s}
              onClick={() => setStyleBrowseAndReset(s)}
              className="facet-chip flex items-center gap-1"
              title={`Browse ${STYLE_LABELS[s]} only (does not change Setup)`}
            >
              <GameIcon src={styleIconPath(s)} size={12} />
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-parch-300">
            Wearables
          </h3>
          <span className="text-xs text-parch-300">
            {countLine}
            {wearablesCapped
              ? ` · showing ${visiblePickerRows.length}`
              : pickerRows.length > 0
                ? " · showing all"
                : ""}
          </span>
        </div>
        <div className="mt-1 max-h-[28rem] overflow-y-auto border-t border-stone-750">
          {pickerRows.length === 0 ? (
            <p className="px-2 py-3 text-xs leading-relaxed text-parch-300">
              {emptyPickerCopy(activeSlot, styleBrowse, loadout.style)}
            </p>
          ) : (
            <>
              {visiblePickerRows.map((record) => {
                const equipped = slots[record.slot!] === record.id;
                const noBonuses = !hasSourcedBonuses(record);
                const styleTag = styleRowTag(record, browseStyle);
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
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{record.name}</span>
                      {record.tier != null ? (
                        <span className="font-mono text-parch-100">T{record.tier}</span>
                      ) : null}
                      <span className="text-[11px] text-parch-300">
                        {SLOT_SHORT[record.slot!]}
                      </span>
                      {styleTag ? (
                        <span className="text-[11px] capitalize text-parch-300">{styleTag}</span>
                      ) : null}
                      {noBonuses ? (
                        <span className="text-[11px] text-parch-300">no bonus numbers</span>
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
              {pickerRows.length > WEARABLE_CAP ? (
                <div className="sticky bottom-0 border-t border-stone-750 bg-stone-900 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAllWearables((v) => !v)}
                    className="text-xs text-gem-400 hover:text-gem-300"
                  >
                    {showAllWearables
                      ? `Show first ${WEARABLE_CAP}`
                      : `Show all ${pickerRows.length}`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-4 border-t border-stone-750 pt-2">
          <button
            type="button"
            aria-expanded={unlocksOpen}
            onClick={() => setUnlocksOpen((v) => !v)}
            className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left"
          >
            <h3 className="text-xs font-medium uppercase tracking-wide text-parch-300">
              Unlocks &amp; materials · {unlockRows.length}
            </h3>
            <span className="text-xs text-gem-400">
              {unlocksOpen ? "Hide" : "Show"} · pin only
            </span>
          </button>
          <p className="mt-1 text-xs text-parch-300">
            No slot — materials, codices, and set aggregates. Never equip on the doll.
          </p>
          {unlocksOpen ? (
            <div className="mt-1 max-h-48 overflow-y-auto border-t border-stone-750">
              {unlockRows.length === 0 ? (
                <p className="px-2 py-3 text-xs text-parch-300">
                  No unlocks match the current region/search.
                </p>
              ) : (
                unlockRows.map((record) => {
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
                })
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
