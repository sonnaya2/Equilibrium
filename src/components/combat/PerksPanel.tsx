"use client";

import { useEffect, useRef } from "react";
import type { CombatStyle } from "@/combat/types";
import { GameIcon } from "../GameIcon";
import {
  GIZMO_CAPACITY,
  GIZMO_SLOTS,
  gizmoSlotOf,
  placePerkOnGizmo,
  removePerkFromGizmos,
  type GizmoSlotId,
  type Loadout,
  type LoadoutPerks,
  type PerkRankKey,
} from "./useLoadout";

const PERK_ICON = (id: string) => `/game/combat/perks/${id}.webp`;
/** Eruptive and Planted Feet have no synced icon; a named tile beats a wrong glyph. */
const NO_ICON = null;

type FlagKey = {
  [K in keyof LoadoutPerks]: LoadoutPerks[K] extends boolean ? K : never;
}[keyof LoadoutPerks];

/**
 * Styles an entry can affect. Grounded in this repo, not memory:
 * Lunging targets dismember/combust (shared/perks.ts LUNGING_ABILITY_IDS); the
 * tectonic and Tumeken records are style "magic" in the equipment catalogue;
 * Sunshine is a magic ability and Death's Swiftness a ranged one. Omitted =
 * every style.
 */
type StyleScope = readonly CombatStyle[] | undefined;
const MAGIC_ONLY: StyleScope = ["magic"];

interface RankTile {
  key: PerkRankKey;
  label: string;
  effect: string;
  max: number;
  icon: string | null;
  /** Plural noun in the rank readout — perks have ranks, sets have pieces. */
  unit?: string;
  styles?: StyleScope;
}

const PERK_RANKS: RankTile[] = [
  {
    key: "equilibrium",
    label: "Equilibrium",
    effect: "R1 +8% AD, +2%/rank to +14%, no crits",
    max: 4,
    icon: PERK_ICON("equilibrium"),
  },
  {
    key: "eruptive",
    label: "Eruptive",
    effect: "R1 +0.5% AD, +0.5%/rank to +2%",
    max: 4,
    icon: NO_ICON,
  },
  {
    key: "biting",
    label: "Biting",
    effect: "R1 +2% crit, +2%/rank; +2.2% if lvl20",
    max: 4,
    icon: PERK_ICON("biting"),
  },
  {
    key: "ultimatums",
    label: "Ultimatums",
    effect: "R1 +4% ult, +1%/rank to +7%",
    max: 4,
    icon: PERK_ICON("ultimatums"),
  },
  {
    key: "lunging",
    label: "Lunging",
    effect: "R1 +13% Combust/Dismember, +3%/rank",
    max: 4,
    icon: PERK_ICON("lunging"),
    styles: ["melee", "magic"],
  },
  {
    key: "energising",
    label: "Energising",
    effect: "R1 +75 accuracy, +25/rank",
    max: 4,
    icon: PERK_ICON("energising"),
  },
  {
    key: "invigorating",
    label: "Invigorating",
    effect: "Basic adren x1.05 per rank; R4 x1.20",
    max: 4,
    icon: PERK_ICON("invigorating"),
  },
  {
    key: "impatient",
    label: "Impatient",
    effect: "R1 9% for +3 adren on basics; 9.9% if lvl20",
    max: 4,
    icon: PERK_ICON("impatient"),
  },
  {
    key: "relentless",
    label: "Relentless",
    effect: "R1 1% EV adren refund on costs; 1.1% if lvl20",
    max: 5,
    icon: PERK_ICON("relentless"),
  },
  {
    key: "crackling",
    label: "Crackling",
    effect: "PvM zap 50% AD x rank, 60s cooldown",
    max: 4,
    icon: PERK_ICON("crackling"),
  },
  {
    key: "aftershock",
    label: "Aftershock",
    effect: "AoE after 50k damage, 40% AD x rank, 6s min",
    max: 4,
    icon: PERK_ICON("aftershock"),
  },
];

const SET_RANKS: RankTile[] = [
  {
    key: "tectonicPieces",
    label: "Tectonic",
    effect: "+1% crit chance per piece (+2% when elite)",
    max: 5,
    icon: "/game/combat/equipment/tectonic-body.webp",
    unit: "pieces",
    styles: MAGIC_ONLY,
  },
  {
    key: "tumekensPieces",
    label: "Tumeken's resplendence",
    effect: "+1.5% crit chance per piece, inside Sunshine only",
    max: 5,
    icon: "/game/combat/equipment/tumekens-resplendence-body.webp",
    unit: "pieces",
    styles: MAGIC_ONLY,
  },
];

interface FlagTile {
  key: FlagKey;
  label: string;
  effect: string;
  icon: string | null;
  styles?: StyleScope;
}

const SET_FLAGS: FlagTile[] = [
  {
    key: "eliteTectonic",
    label: "Elite tectonic",
    effect: "Tectonic pieces give +2% crit each instead of +1%",
    icon: "/game/combat/equipment/elite-tectonic-robe-top.webp",
    styles: MAGIC_ONLY,
  },
  {
    key: "insideSunshine",
    label: "Inside Sunshine",
    effect: "Gates the Tumeken set(3) crit bonus",
    icon: "/game/combat/abilities/magic/sunshine.webp",
    styles: MAGIC_ONLY,
  },
  {
    key: "plantedFeet",
    label: "Planted Feet",
    effect: "Base Sunshine / Death's Swiftness x1.25 duration",
    icon: NO_ICON,
    styles: ["magic", "ranged"],
  },
];

/** Level-20 gear variants — modifiers of a perk, not perks, so they stay named controls. */
const LEVEL_20_FLAGS: Array<{ key: FlagKey; label: string }> = [
  { key: "bitingLevel20", label: "Biting on level-20 item (+2.2%/rank)" },
  { key: "impatientLevel20", label: "Impatient on level-20 item (9.9%/rank)" },
  { key: "relentlessLevel20", label: "Relentless on level-20 item (1.1%/rank)" },
];

const GIZMO_LABELS: Record<GizmoSlotId, string> = {
  weapon1: "Weapon gizmo 1",
  weapon2: "Weapon gizmo 2",
  armour1: "Armour gizmo 1",
  armour2: "Armour gizmo 2",
};

const PERK_BY_KEY = new Map([...PERK_RANKS, ...SET_RANKS].map((t) => [t.key, t]));

const inStyle = (styles: StyleScope, style: CombatStyle) =>
  styles == null || styles.includes(style);

/**
 * Off-style entries hide, but only at zero. A magic-only set left at 3 pieces
 * still feeds loadoutSetCritChance regardless of style, so hiding a non-zero
 * one would put a live modifier out of reach — same guard BuffsPanel uses to
 * keep a mismatched curse on screen.
 */
const visibleUnderStyle = (styles: StyleScope, style: CombatStyle, value: number | boolean) =>
  inStyle(styles, style) || Boolean(value);

/** Wheel-to-adjust. Native listener because React's delegated wheel is passive. */
function useWheelStep(onStep: (delta: number) => void) {
  const ref = useRef<HTMLButtonElement>(null);
  const latest = useRef(onStep);
  latest.current = onStep;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handler = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      latest.current(event.deltaY < 0 ? 1 : -1);
    };
    node.addEventListener("wheel", handler, { passive: false });
    return () => node.removeEventListener("wheel", handler);
  }, []);

  return ref;
}

/** Icon stepper: click raises the rank and wraps at max; wheel and arrows step by one. */
function RankTileButton({
  tile,
  value,
  offStyle,
  onChange,
}: {
  tile: RankTile;
  value: number;
  offStyle: boolean;
  onChange: (next: number) => void;
}) {
  const unit = tile.unit ?? "rank";
  const valueText = value === 0 ? `no ${unit}` : `${value} of ${tile.max} ${unit}`;
  const step = (delta: number) => onChange(Math.min(tile.max, Math.max(0, value + delta)));
  const ref = useWheelStep(step);

  return (
    <button
      ref={ref}
      type="button"
      role="spinbutton"
      aria-label={`${tile.label} — ${tile.effect}`}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={tile.max}
      aria-valuetext={valueText}
      onClick={() => onChange(value >= tile.max ? 0 : value + 1)}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowRight") step(1);
        else if (event.key === "ArrowDown" || event.key === "ArrowLeft") step(-1);
        else if (event.key === "Home") onChange(0);
        else if (event.key === "End") onChange(tile.max);
        else return;
        event.preventDefault();
      }}
      className={`icon-tile${value > 0 ? " is-on" : ""}${tile.icon ? "" : " icon-tile--text"}${
        offStyle ? " is-off-style" : ""
      }`}
    >
      {tile.icon ? (
        <GameIcon src={tile.icon} size={34} className="icon-tile__icon" />
      ) : (
        <span>{tile.label}</span>
      )}
      <span className="icon-tile__rank" aria-hidden="true">
        {value}/{tile.max}
      </span>
      <span className="icon-tip" role="tooltip">
        <strong>{tile.label}</strong>
        {tile.effect}
        {offStyle ? (
          <em className="icon-tip__warn">Set while on another style — still counted.</em>
        ) : null}
        <em className="icon-tip__hint">{valueText} · click, wheel or arrows to adjust</em>
      </span>
    </button>
  );
}

function FlagTileButton({
  label,
  effect,
  icon,
  pressed,
  offStyle,
  onToggle,
}: {
  label: string;
  effect: string;
  icon: string | null;
  pressed: boolean;
  offStyle: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`icon-tile${icon ? "" : " icon-tile--text"}${offStyle ? " is-off-style" : ""}`}
    >
      {icon ? <GameIcon src={icon} size={34} className="icon-tile__icon" /> : <span>{label}</span>}
      <span className="sr-only">
        {label} — {effect}
      </span>
      <span className="icon-tip" role="tooltip">
        <strong>{label}</strong>
        {effect}
        {offStyle ? (
          <em className="icon-tip__warn">Set while on another style — still counted.</em>
        ) : null}
      </span>
    </button>
  );
}

/** One gizmo: up to two perks, each with a typed rank. */
function GizmoCard({
  slot,
  loadout,
  setLoadout,
  assignable,
}: {
  slot: GizmoSlotId;
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
  assignable: RankTile[];
}) {
  const held = loadout.gizmos?.[slot] ?? [];
  const free = GIZMO_CAPACITY - held.length;

  return (
    <div className="gizmo-card">
      <h4 className="gizmo-card__title">{GIZMO_LABELS[slot]}</h4>
      {held.map((key) => {
        const tile = PERK_BY_KEY.get(key);
        if (!tile) return null;
        return (
          <div key={key} className="gizmo-perk">
            <span className="gizmo-perk__name" title={tile.effect}>
              {tile.label}
            </span>
            <input
              type="number"
              min={0}
              max={tile.max}
              value={loadout.perks[key]}
              aria-label={`${tile.label} rank`}
              onChange={(event) =>
                setLoadout({
                  ...loadout,
                  perks: {
                    ...loadout.perks,
                    [key]: Math.min(tile.max, Math.max(0, Math.floor(Number(event.target.value)))),
                  },
                })
              }
              className="gizmo-perk__rank"
            />
            <button
              type="button"
              aria-label={`Remove ${tile.label} from ${GIZMO_LABELS[slot]}`}
              onClick={() => setLoadout(removePerkFromGizmos(loadout, key))}
              className="gizmo-perk__remove"
            >
              ×
            </button>
          </div>
        );
      })}
      {free > 0 ? (
        <select
          value=""
          aria-label={`Add a perk to ${GIZMO_LABELS[slot]}`}
          onChange={(event) => {
            const key = event.target.value as PerkRankKey;
            if (key) setLoadout(placePerkOnGizmo(loadout, slot, key));
          }}
          className="gizmo-card__add"
        >
          <option value="">Add perk…</option>
          {assignable.map((tile) => (
            <option key={tile.key} value={tile.key}>
              {tile.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

/** Sourced perk ranks and set toggles — unsourced perks stay out. */
export function PerksPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const style = loadout.style;
  const setPerk = (key: keyof LoadoutPerks, value: number | boolean) =>
    setLoadout({ ...loadout, perks: { ...loadout.perks, [key]: value } });

  const perkTiles = PERK_RANKS.filter((t) =>
    visibleUnderStyle(t.styles, style, loadout.perks[t.key]),
  );
  const setTiles = SET_RANKS.filter((t) =>
    visibleUnderStyle(t.styles, style, loadout.perks[t.key]),
  );
  const flagTiles = SET_FLAGS.filter((f) =>
    visibleUnderStyle(f.styles, style, loadout.perks[f.key]),
  );
  const hiddenCount =
    PERK_RANKS.length +
    SET_RANKS.length +
    SET_FLAGS.length -
    (perkTiles.length + setTiles.length + flagTiles.length);

  // Only unplaced perks are offered, so a perk never lands on two gizmos.
  const assignable = [...PERK_RANKS, ...SET_RANKS].filter(
    (t) => gizmoSlotOf(loadout.gizmos ?? {}, t.key) == null,
  );

  return (
    <div className="loadout-panel loadout-panel-wide">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Perks &amp; sets</h2>
      <p className="mt-1 text-xs text-parch-300">
        Hover for the effect. Click a tile to raise its rank, or use the wheel and arrow keys.
        {hiddenCount > 0 ? ` ${hiddenCount} entries don't affect ${style} and are hidden.` : ""}
      </p>

      <div className="perks-layout mt-3">
        <div className="perks-column">
          <div className="buff-group" role="group" aria-label="Invention perks">
            <h3 className="buff-group__title">Perks</h3>
            <div className="icon-tile-grid">
              {perkTiles.map((tile) => (
                <RankTileButton
                  key={tile.key}
                  tile={tile}
                  value={loadout.perks[tile.key]}
                  offStyle={!inStyle(tile.styles, style)}
                  onChange={(next) => setPerk(tile.key, next)}
                />
              ))}
            </div>
            <div className="perk-flag-list mt-2">
              {LEVEL_20_FLAGS.map((flag) => (
                <label key={flag.key} className="perk-flag">
                  <input
                    type="checkbox"
                    checked={loadout.perks[flag.key]}
                    onChange={(event) => setPerk(flag.key, event.target.checked)}
                  />
                  {flag.label}
                </label>
              ))}
            </div>
          </div>

          {setTiles.length || flagTiles.length ? (
            <div className="buff-group mt-3" role="group" aria-label="Set bonuses">
              <h3 className="buff-group__title">Sets</h3>
              <div className="icon-tile-grid">
                {setTiles.map((tile) => (
                  <RankTileButton
                    key={tile.key}
                    tile={tile}
                    value={loadout.perks[tile.key]}
                    offStyle={!inStyle(tile.styles, style)}
                    onChange={(next) => setPerk(tile.key, next)}
                  />
                ))}
                {flagTiles.map((flag) => (
                  <FlagTileButton
                    key={flag.key}
                    label={flag.label}
                    effect={flag.effect}
                    icon={flag.icon}
                    pressed={loadout.perks[flag.key]}
                    offStyle={!inStyle(flag.styles, style)}
                    onToggle={() => setPerk(flag.key, !loadout.perks[flag.key])}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-parch-300">
                Manual overrides. Equipped set pieces count on their own — the engine takes
                whichever is higher, so it never double-counts.
              </p>
            </div>
          ) : null}
        </div>

        <div className="perks-gizmos" role="group" aria-label="Gizmo layout">
          <h3 className="buff-group__title">Gizmos</h3>
          <p className="mt-1 text-[11px] text-parch-300">
            Your own layout — the calculator reads the ranks, not the placement.
          </p>
          <div className="gizmo-list mt-2">
            {GIZMO_SLOTS.map((slot) => (
              <GizmoCard
                key={slot}
                slot={slot}
                loadout={loadout}
                setLoadout={setLoadout}
                assignable={assignable}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
