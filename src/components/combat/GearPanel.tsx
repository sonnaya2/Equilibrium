"use client";

import { useMemo, useState } from "react";
import regionsData from "#shard/league/regions.json";
import { combatEquipment, type EquipmentRecord } from "@/combat/data";
import type { EquipmentSlot } from "@/combat/data/records";
import type { CombatStyle } from "@/combat/types";
import { equippedPassiveSummaries, type PassiveSupport } from "@/combat/shared/equipment";
import type { RegionId } from "@/league";
import { equipmentIconPath, styleIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { RegionCrest } from "../RegionCrest";
import { CombatFrameCorners } from "./CombatFrameCorners";
import {
  clearEquipment,
  equipInSlot,
  equipmentIdList,
  toggleUnlockPin,
  unlockOnlyIds,
  type Loadout,
} from "./useLoadout";

const REGION_NAMES = new Map(regionsData.records.map((r) => [r.id, r.name]));

type SortKey = "region" | "tier" | "name";
type RegionFilter = RegionId | "base" | "all";
/**
 * `setup` (default) = loadout.style + hybrid/unstyled only — other combat styles are hidden.
 * Use `all` or a style chip to browse the rest of the catalogue.
 */
type StyleBrowse = "setup" | "all" | CombatStyle;

const COMBAT_STYLES: CombatStyle[] = ["melee", "ranged", "magic", "necromancy"];

const STYLE_LABELS: Record<CombatStyle, string> = {
  melee: "Melee",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
};

const PASSIVE_STATUS: Record<PassiveSupport, string> = {
  modeled: "Modeled",
  "partially-modeled": "Partial",
  "not-modeled": "Not modeled",
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
};

type DollCell = EquipmentSlot | "weapons" | null;
type PickerSlot = EquipmentSlot | "weapon";

/** Equipment grid positions. Weapons render as one linked block. */
const DOLL_LAYOUT: DollCell[][] = [
  [null, "helmet", "pocket"],
  ["cape", "amulet", "ammo"],
  ["weapons"],
  ["gloves", "legs", "ring"],
  [null, "boots", null],
];

const WEARABLE_CAP = 80;

function recordRegions(record: EquipmentRecord): RegionId[] {
  const raw = record.unlock?.regions;
  if (!Array.isArray(raw)) return [];
  // Drop non-string / empty tokens so multi-crest map never sees null keys.
  return raw.filter((id): id is RegionId => typeof id === "string" && id.length > 0);
}

/** Short catalogue names (regions.json); multi-region stays comma-joined. */
function regionLabel(record: EquipmentRecord): string {
  const regions = recordRegions(record);
  if (!regions.length) return "Unverified";
  return regions.map((id) => REGION_NAMES.get(id) ?? id).join(", ");
}

/** Every region crest for multi-region unlocks; Unverified is muted metadata. */
function RegionMarks({ record }: { record: EquipmentRecord }) {
  const regions = recordRegions(record);
  const label = regionLabel(record);
  if (!regions.length) {
    return <span className="text-[11px] text-parch-300">{label}</span>;
  }
  return (
    <span className="flex shrink-0 items-center gap-1 text-parch-100" title={label}>
      {regions.map((id) => (
        <RegionCrest key={id} regionId={id} size={14} />
      ))}
      <span className="text-[11px]">{label}</span>
    </span>
  );
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
function styleRowTag(record: EquipmentRecord, referenceStyle: CombatStyle | null): string | null {
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

function emptyPickerCopy(activeSlotLabel: string | null): string {
  if (activeSlotLabel) {
    return `No wearables for ${activeSlotLabel} with this filter.`;
  }
  return "No wearables for this slot/filter.";
}

function EmptySlotMark() {
  return (
    <svg className="equipment-slot-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="m7 25 18-18M7 7l18 18M6 10l4-4 3 3M19 23l3 3 4-4M22 6l4 4-3 3M9 19l-3 3 4 4" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

function EquipmentSlotButton({
  slot,
  item,
  selected,
  disabled = false,
  onClick,
}: {
  slot: EquipmentSlot;
  item?: EquipmentRecord;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const empty = item == null;
  const noBonuses = item != null && !hasSourcedBonuses(item);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        disabled ? `${SLOT_LABELS[slot]} unavailable while Two-hand is equipped` : SLOT_LABELS[slot]
      }
      className={`equipment-slot${selected ? " is-selected" : ""}${empty ? " is-empty" : " is-filled"}${disabled ? " is-disabled" : ""}`}
    >
      <span className="equipment-slot__label">{SLOT_LABELS[slot]}</span>
      <span className="equipment-slot__well">
        {item ? <GameIcon src={equipmentIconPath(item.id)} size={28} /> : <EmptySlotMark />}
      </span>
      <span className="equipment-slot__name">{item?.name ?? (disabled ? "Locked" : "Empty")}</span>
      {item?.tier != null ? (
        <span className="equipment-slot__tier">
          T{item.tier}
          {item.slot === "twohand" ? " · 2H" : ""}
        </span>
      ) : null}
      {noBonuses ? <span className="equipment-slot__note">stats not sourced</span> : null}
    </button>
  );
}

/** Paper doll + item picker. Item bonuses unsourced — placement is organisational. */
export function GearPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const [activeSlot, setActiveSlot] = useState<PickerSlot | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tier");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  /** Default setup: loadout.style + hybrid/unstyled only (other styles hidden until All styles). */
  const [styleBrowse, setStyleBrowse] = useState<StyleBrowse>("setup");
  /** Cap long catalogues; toggle expands past the first 80. */
  const [showAllWearables, setShowAllWearables] = useState(false);
  /** Unlocks are secondary — collapsed so the wearable list owns the column. */
  const [unlocksOpen, setUnlocksOpen] = useState(false);

  const slots = loadout.equipmentSlots ?? {};
  const unlockPins = new Set(unlockOnlyIds(loadout));
  const slottedCount = equipmentIdList(slots).length;
  const passives = equippedPassiveSummaries({
    style: loadout.style,
    equipmentSlots: slots,
    enchantments: loadout.enchantments,
  });
  const primaryWeapon = byId(slots.twohand ?? slots.mainhand);
  const activeItem =
    activeSlot === "weapon" ? primaryWeapon : activeSlot ? byId(slots[activeSlot]) : undefined;
  const activeSlotLabel =
    activeSlot === "weapon" ? SLOT_LABELS.mainhand : activeSlot ? SLOT_LABELS[activeSlot] : null;
  const clearableSlot =
    activeSlot === "weapon" ? (slots.twohand ? "twohand" : "mainhand") : activeSlot;

  const matchStyle = styleBrowse === "setup";
  const browseStyle = effectiveBrowseStyle(styleBrowse, loadout.style);

  /** Doll-equipable only — materials, codices, and set aggregates stay in Unlocks. */
  const wearables = useMemo(
    () => combatEquipment.records.filter((r) => r.slot != null && r.unlock?.type !== "removed"),
    [],
  );
  const unlocks = useMemo(
    () => combatEquipment.records.filter((r) => r.slot == null && r.unlock?.type !== "removed"),
    [],
  );

  const pickerRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = wearables.filter((record) => {
      if (record.slot == null) return false;
      if (activeSlot === "weapon") {
        if (record.slot !== "mainhand" && record.slot !== "twohand") return false;
      } else if (activeSlot && record.slot !== activeSlot) {
        return false;
      }
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

  // Cap only on full unfiltered catalogue. Region / search / active slot filters
  // must not hide lower-tier matches under tier sort (All styles + weapon = 160+).
  const pickerFiltered = regionFilter !== "all" || search.trim().length > 0 || activeSlot != null;
  const wearablesCapped = !pickerFiltered && pickerRows.length > WEARABLE_CAP && !showAllWearables;
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
    if (activeSlot === "weapon") {
      if (record.slot !== "mainhand" && record.slot !== "twohand") return;
    } else if (activeSlot != null && record.slot !== activeSlot) {
      return;
    }
    setLoadout(equipInSlot(loadout, record.slot, record.id));
    setActiveSlot(record.slot === "mainhand" || record.slot === "twohand" ? "weapon" : record.slot);
  };

  const clearSlot = (slot: EquipmentSlot) => {
    setLoadout(equipInSlot(loadout, slot, null));
  };

  const countLine =
    styleBrowse === "setup"
      ? `Showing ${visiblePickerRows.length} of ${pickerRows.length} · ${STYLE_LABELS[loadout.style]} + hybrid`
      : `Showing ${visiblePickerRows.length} of ${pickerRows.length} · ${browseStyle ? STYLE_LABELS[browseStyle] : "all styles"}`;

  return (
    <div className="gear-layout grid gap-4 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)]">
      <div className="combat-frame paper-doll">
        <CombatFrameCorners />
        <h2 className="combat-section-title text-sm font-medium text-parch-50">Loadout</h2>

        <div
          className="paper-doll-grid mt-3 grid grid-cols-3 gap-1.5"
          role="group"
          aria-label="Equipment slots"
        >
          {DOLL_LAYOUT.flatMap((row, rowIdx) =>
            row.map((slot, colIdx) => {
              if (!slot) {
                return <div key={`pad-${rowIdx}-${colIdx}`} className="equipment-slot-pad" />;
              }
              if (slot === "weapons") {
                return (
                  <div
                    key="weapons"
                    className="weapon-slot-block"
                    role="group"
                    aria-label="Weapon and body slots"
                  >
                    <EquipmentSlotButton
                      slot="mainhand"
                      item={primaryWeapon}
                      selected={activeSlot === "weapon"}
                      onClick={() => setActiveSlot(activeSlot === "weapon" ? null : "weapon")}
                    />
                    <EquipmentSlotButton
                      slot="body"
                      item={byId(slots.body)}
                      selected={activeSlot === "body"}
                      onClick={() => setActiveSlot(activeSlot === "body" ? null : "body")}
                    />
                    <EquipmentSlotButton
                      slot="offhand"
                      item={byId(slots.offhand)}
                      selected={activeSlot === "offhand"}
                      disabled={Boolean(slots.twohand)}
                      onClick={() => setActiveSlot(activeSlot === "offhand" ? null : "offhand")}
                    />
                  </div>
                );
              }
              const id = slots[slot] ?? null;
              const item = byId(id);
              const selected = activeSlot === slot;
              return (
                <EquipmentSlotButton
                  key={slot}
                  slot={slot}
                  item={item}
                  selected={selected}
                  onClick={() => setActiveSlot(selected ? null : slot)}
                />
              );
            }),
          )}
        </div>

        {activeItem ? (
          <div className="combat-subpanel mt-3 px-2 py-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <GameIcon src={equipmentIconPath(activeItem.id)} size={24} className="shrink-0" />
              <span className="text-parch-50">{activeItem.name}</span>
              {activeItem.tier != null ? (
                <span className="font-mono text-parch-100">T{activeItem.tier}</span>
              ) : null}
              {activeSlotLabel ? <span className="text-parch-300">{activeSlotLabel}</span> : null}
            </div>
            {hasSourcedBonuses(activeItem) ? (
              <p className="mt-0.5 text-parch-100">
                {[
                  activeItem.bonuses.damage != null ? `dmg ${activeItem.bonuses.damage}` : null,
                  activeItem.bonuses.accuracy != null ? `acc ${activeItem.bonuses.accuracy}` : null,
                  activeItem.bonuses.armour != null ? `arm ${activeItem.bonuses.armour}` : null,
                  activeItem.bonuses.life != null ? `life ${activeItem.bonuses.life}` : null,
                  activeItem.bonuses.prayer != null ? `pray ${activeItem.bonuses.prayer}` : null,
                  activeItem.bonuses.critChance != null
                    ? `crit ${activeItem.bonuses.critChance}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : (
              <p className="mt-0.5 text-parch-300">stats not sourced</p>
            )}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {activeSlot ? (
            <button
              type="button"
              onClick={() => clearableSlot && clearSlot(clearableSlot)}
              className="combat-button border border-stone-750 px-2 py-1 text-parch-100 hover:text-parch-50"
            >
              Clear {activeSlotLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setLoadout(clearEquipment(loadout))}
            className="combat-button border border-stone-750 px-2 py-1 text-parch-100 hover:text-parch-50"
          >
            Clear all gear
          </button>
          <span className="self-center text-parch-300">
            {slottedCount} slot{slottedCount === 1 ? "" : "s"} · {unlockPins.size} unlock pin
            {unlockPins.size === 1 ? "" : "s"}
          </span>
        </div>

        <section className="gear-passives mt-4" aria-labelledby="gear-passives-title">
          <h3
            id="gear-passives-title"
            className="combat-section-title text-xs font-medium uppercase tracking-wide text-parch-300"
          >
            Passives from equipped gear
          </h3>
          {passives.length ? (
            <ul className="gear-passive-list mt-1.5">
              {passives.map((passive) => (
                <li key={passive.itemId} className="gear-passive-row">
                  <GameIcon
                    src={equipmentIconPath(passive.itemId)}
                    size={28}
                    className="gear-passive-row__icon"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm text-parch-50">{passive.label}</span>
                      <span className={`passive-status is-${passive.support}`}>
                        {PASSIVE_STATUS[passive.support]}
                      </span>
                    </div>
                    <ul className="mt-0.5 space-y-0.5 text-[11px] leading-snug text-parch-300">
                      {passive.effects.map((effect) => (
                        <li key={effect}>{effect}</li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[11px] text-parch-300">
                      From {passive.itemName} ·{" "}
                      <a
                        href={passive.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gem-400 underline underline-offset-2 hover:text-gem-300"
                      >
                        source
                      </a>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs text-parch-300">No equipped item grants a passive.</p>
          )}
        </section>
      </div>

      <div className="combat-frame wearables-browser">
        <CombatFrameCorners />
        <div className="gear-filterbar flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1 text-parch-100">
            Region
            <select
              value={regionFilter}
              onChange={(event) => {
                const next = event.target.value as RegionFilter;
                setRegionFilter(next);
                setShowAllWearables(false);
                // Region browse with Loadout style filter often looks empty —
                // open All styles so region gear is visible.
                if (next !== "all" && styleBrowse === "setup") {
                  setStyleBrowse("all");
                }
              }}
              className="border border-stone-750 bg-transparent px-2 py-1 text-sm text-parch-50"
            >
              <option value="all">All regions</option>
              <option value="base">Unverified</option>
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
              onChange={(event) => setStyleBrowseAndReset(event.target.checked ? "setup" : "all")}
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
                aria-pressed={sortKey === key}
                className={`combat-button border px-2 py-1 capitalize ${
                  sortKey === key
                    ? "border-stone-750 bg-stone-850 text-parch-50"
                    : "border-stone-750 text-parch-100 hover:text-parch-50"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          {activeSlotLabel ? (
            <span className="text-gem-400">{activeSlotLabel} only</span>
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
            title={`Follow loadout style (${STYLE_LABELS[loadout.style]}) + hybrid only — other styles stay hidden`}
          >
            Loadout
          </button>
          <button
            type="button"
            aria-pressed={styleBrowse === "all"}
            onClick={() => setStyleBrowseAndReset("all")}
            className="facet-chip"
            title="Browse every combat style (not limited to loadout)"
          >
            All styles
          </button>
          {COMBAT_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={styleBrowse === s}
              onClick={() => setStyleBrowseAndReset(s)}
              className="facet-chip flex items-center gap-1"
              title={`Show ${STYLE_LABELS[s]} + hybrid only`}
            >
              <GameIcon src={styleIconPath(s)} size={12} />
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
        {styleBrowse === "setup" ? (
          <p className="mt-1 text-[11px] text-parch-300">
            Loadout filter shows {STYLE_LABELS[loadout.style]} and hybrid gear only — pick All
            styles if an expected item is missing.
          </p>
        ) : null}

        <div className="wearables-heading mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="combat-section-title text-xs font-medium uppercase tracking-wide text-parch-300">
            Wearables
          </h3>
          <span className="text-xs text-parch-300">{countLine}</span>
        </div>
        <div className="wearables-list mt-1 max-h-[28rem] overflow-y-auto border-t border-stone-750">
          {pickerRows.length === 0 ? (
            <p className="px-2 py-2 text-xs text-parch-300">{emptyPickerCopy(activeSlotLabel)}</p>
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
                    className={`wearable-row grid w-full grid-cols-[1fr_auto] items-center gap-2 border-b border-stone-750/70 px-2 py-1.5 text-left text-sm ${
                      equipped
                        ? "bg-stone-850 text-parch-50"
                        : "text-parch-100 hover:bg-white/[0.02] hover:text-parch-50"
                    }`}
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <GameIcon src={equipmentIconPath(record.id)} size={20} className="shrink-0" />
                      <span>{record.name}</span>
                      {record.tier != null ? (
                        <span className="font-mono text-parch-100">T{record.tier}</span>
                      ) : null}
                      <span className="text-[11px] text-parch-300">{SLOT_SHORT[record.slot!]}</span>
                      {styleTag ? (
                        <span className="text-[11px] capitalize text-parch-300">{styleTag}</span>
                      ) : null}
                      {noBonuses ? (
                        <span className="text-[11px] text-parch-300">stats not sourced</span>
                      ) : null}
                    </span>
                    <RegionMarks record={record} />
                  </button>
                );
              })}
              {!pickerFiltered && pickerRows.length > WEARABLE_CAP ? (
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

        <div className="unlocks-panel mt-4 border-t border-stone-750 pt-2">
          <button
            type="button"
            aria-expanded={unlocksOpen}
            onClick={() => setUnlocksOpen((v) => !v)}
            className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left"
          >
            <h3 className="text-xs font-medium uppercase tracking-wide text-parch-300">
              Unlocks &amp; materials · {unlockRows.length}
            </h3>
            <span className="text-xs text-gem-400">{unlocksOpen ? "Hide pins" : "Show pins"}</span>
          </button>
          <p className="mt-1 text-xs text-parch-300">
            Materials and codices can be pinned, not equipped.
          </p>
          {unlocksOpen ? (
            <div className="mt-1 max-h-48 overflow-y-auto border-t border-stone-750">
              {unlockRows.length === 0 ? (
                <p className="px-2 py-2 text-xs text-parch-300">No unlocks match region/search</p>
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
                      <RegionMarks record={record} />
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
