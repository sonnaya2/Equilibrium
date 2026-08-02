"use client";

import { useState } from "react";
import { GameIcon } from "../GameIcon";
import {
  GIZMO_CAPACITY,
  GIZMO_SLOTS,
  PERK_GIZMO_KIND,
  gizmoAccepts,
  gizmoSlotOf,
  placePerkOnGizmo,
  removePerkFromGizmos,
  type GizmoSlotId,
  type Loadout,
  type PerkRankKey,
} from "./useLoadout";

const PERK_ICON = (id: string) => `/game/combat/perks/${id}.webp`;

interface PerkDef {
  key: PerkRankKey;
  label: string;
  effect: string;
  max: number;
  icon: string | null;
}

const PERKS: readonly PerkDef[] = [
  {
    key: "equilibrium",
    label: "Equilibrium",
    effect: "+8% to +14% base ability damage; critical strikes disabled",
    max: 4,
    icon: PERK_ICON("equilibrium"),
  },
  {
    key: "eruptive",
    label: "Eruptive",
    effect: "+0.5% base ability damage per rank",
    max: 4,
    icon: null,
  },
  {
    key: "biting",
    label: "Biting",
    effect: "+2% critical chance per rank; +2.2% on level-20 gear",
    max: 4,
    icon: PERK_ICON("biting"),
  },
  {
    key: "ultimatums",
    label: "Ultimatums",
    effect: "+4% to +7% ultimate ability damage",
    max: 4,
    icon: PERK_ICON("ultimatums"),
  },
  {
    key: "lunging",
    label: "Lunging",
    effect: "+13% to +22% Combust and Dismember damage",
    max: 4,
    icon: PERK_ICON("lunging"),
  },
  {
    key: "energising",
    label: "Energising",
    effect: "+75 to +150 flat accuracy",
    max: 4,
    icon: PERK_ICON("energising"),
  },
  {
    key: "invigorating",
    label: "Invigorating",
    effect: "+5% basic-ability adrenaline gain per rank",
    max: 4,
    icon: PERK_ICON("invigorating"),
  },
  {
    key: "impatient",
    label: "Impatient",
    effect: "9% chance per rank for basics to grant 3 extra adrenaline",
    max: 4,
    icon: PERK_ICON("impatient"),
  },
  {
    key: "relentless",
    label: "Relentless",
    effect: "1% chance per rank to refund an ability's adrenaline cost; 30s cooldown",
    max: 5,
    icon: PERK_ICON("relentless"),
  },
  {
    key: "crackling",
    label: "Crackling",
    effect: "Next attack zaps for 50% ability damage per rank; 60s cooldown",
    max: 4,
    icon: PERK_ICON("crackling"),
  },
  {
    key: "aftershock",
    label: "Aftershock",
    effect: "Blast after 50,000 damage; 24% to 39.6% ability damage per rank; 6s minimum",
    max: 4,
    icon: PERK_ICON("aftershock"),
  },
] as const;

const PERK_BY_KEY = new Map(PERKS.map((perk) => [perk.key, perk]));

const LEVEL_20_FLAGS: readonly {
  perk: PerkRankKey;
  key: "bitingLevel20" | "impatientLevel20" | "relentlessLevel20";
  label: string;
}[] = [
  { perk: "biting", key: "bitingLevel20", label: "Biting on a level-20 item" },
  { perk: "impatient", key: "impatientLevel20", label: "Impatient on a level-20 item" },
  { perk: "relentless", key: "relentlessLevel20", label: "Relentless on a level-20 item" },
];

const GIZMO_LABELS: Record<GizmoSlotId, string> = {
  weapon1: "Weapon gizmo 1",
  weapon2: "Weapon gizmo 2",
  armour1: "Armour gizmo 1",
  armour2: "Armour gizmo 2",
};

function withPerkRank(loadout: Loadout, key: PerkRankKey, rank: number): Loadout {
  return { ...loadout, perks: { ...loadout.perks, [key]: rank } };
}

function removePerk(loadout: Loadout, key: PerkRankKey): Loadout {
  const next = removePerkFromGizmos(loadout, key);
  const flag = LEVEL_20_FLAGS.find((entry) => entry.perk === key);
  return {
    ...next,
    perks: {
      ...next.perks,
      [key]: 0,
      ...(flag ? { [flag.key]: false } : {}),
    },
  };
}

function addPerk(loadout: Loadout, slot: GizmoSlotId, key: PerkRankKey): Loadout {
  return withPerkRank(placePerkOnGizmo(loadout, slot, key), key, Math.max(1, loadout.perks[key]));
}

function clearGizmo(loadout: Loadout, slot: GizmoSlotId): Loadout {
  return (loadout.gizmos[slot] ?? []).reduce(removePerk, loadout);
}

function clearAllGizmos(loadout: Loadout): Loadout {
  return PERKS.reduce((next, perk) => removePerk(next, perk.key), loadout);
}

function RankStepper({
  perk,
  rank,
  onChange,
}: {
  perk: PerkDef;
  rank: number;
  onChange: (rank: number) => void;
}) {
  return (
    <span className="perk-rank-stepper">
      <button
        type="button"
        aria-label={`Decrease ${perk.label} rank`}
        disabled={rank <= 1}
        onClick={() => onChange(rank - 1)}
      >
        −
      </button>
      <output aria-label={`${perk.label} rank`}>R{rank}</output>
      <button
        type="button"
        aria-label={`Increase ${perk.label} rank`}
        disabled={rank >= perk.max}
        onClick={() => onChange(rank + 1)}
      >
        +
      </button>
    </span>
  );
}

function GizmoCard({
  slot,
  active,
  loadout,
  setLoadout,
  onActivate,
}: {
  slot: GizmoSlotId;
  active: boolean;
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
  onActivate: () => void;
}) {
  const held = loadout.gizmos[slot] ?? [];
  return (
    <section
      className={`gizmo-card${active ? " is-active" : ""}`}
      aria-labelledby={`gizmo-${slot}`}
    >
      <div className="gizmo-card__head">
        <button
          type="button"
          aria-pressed={active}
          className="gizmo-card__activate"
          onClick={onActivate}
        >
          <span id={`gizmo-${slot}`}>{GIZMO_LABELS[slot]}</span>
          <span className="font-mono">
            {held.length}/{GIZMO_CAPACITY}
          </span>
        </button>
        {held.length ? (
          <button
            type="button"
            className="gizmo-card__clear"
            aria-label={`Clear ${GIZMO_LABELS[slot]}`}
            onClick={() => setLoadout(clearGizmo(loadout, slot))}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="gizmo-card__body">
        {held.length ? (
          held.map((key) => {
            const perk = PERK_BY_KEY.get(key);
            if (!perk) return null;
            return (
              <div key={key} className="gizmo-perk-block">
                <div className="gizmo-perk">
                  {perk.icon ? (
                    <GameIcon src={perk.icon} size={26} className="shrink-0" />
                  ) : (
                    <span className="gizmo-perk__fallback" aria-hidden>
                      E
                    </span>
                  )}
                  <span className="gizmo-perk__name">{perk.label}</span>
                  <RankStepper
                    perk={perk}
                    rank={loadout.perks[key]}
                    onChange={(rank) => setLoadout(withPerkRank(loadout, key, rank))}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${perk.label} from ${GIZMO_LABELS[slot]}`}
                    onClick={() => setLoadout(removePerk(loadout, key))}
                    className="gizmo-perk__remove"
                  >
                    ×
                  </button>
                </div>
                <p className="gizmo-perk__effect">{perk.effect}</p>
              </div>
            );
          })
        ) : (
          <p className="gizmo-card__empty">Select this gizmo, then choose a compatible perk.</p>
        )}
      </div>
    </section>
  );
}

export function PerksPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const [activeSlot, setActiveSlot] = useState<GizmoSlotId>("weapon1");
  const activeHeld = loadout.gizmos[activeSlot] ?? [];
  const activeFull = activeHeld.length >= GIZMO_CAPACITY;
  const hasGizmoPerks = PERKS.some((perk) => loadout.perks[perk.key] > 0);

  return (
    <div className="loadout-panel loadout-panel-wide">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="combat-section-title text-sm font-medium text-parch-50">Invention</h2>
          <p className="mt-1 text-xs text-parch-300">
            Choose an active gizmo, then add compatible perks from the library.
          </p>
        </div>
        <button
          type="button"
          disabled={!hasGizmoPerks}
          onClick={() => setLoadout(clearAllGizmos(loadout))}
          className="combat-button px-3 py-1 text-xs"
        >
          Clear all gizmos
        </button>
      </div>

      <div className="invention-layout mt-3">
        <section aria-labelledby="perk-library-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="perk-library-title" className="buff-group__title">
              Available perks
            </h3>
            <span className="text-xs text-gem-300">
              Active · {GIZMO_LABELS[activeSlot]} · {activeHeld.length}/{GIZMO_CAPACITY}
            </span>
          </div>
          <div className="perk-library mt-1.5" role="group" aria-label="Available perks">
            {PERKS.map((perk) => {
              const assigned = gizmoSlotOf(loadout.gizmos, perk.key);
              const compatible = gizmoAccepts(activeSlot, perk.key);
              const blocked = assigned == null && (!compatible || activeFull);
              const detail = assigned
                ? `Assigned to ${GIZMO_LABELS[assigned]}`
                : !compatible
                  ? `Weapon-only perk; ${GIZMO_LABELS[activeSlot]} is incompatible`
                  : activeFull
                    ? `${GIZMO_LABELS[activeSlot]} is full`
                    : `Add to ${GIZMO_LABELS[activeSlot]}`;
              return (
                <button
                  key={perk.key}
                  type="button"
                  aria-pressed={assigned != null}
                  aria-disabled={blocked}
                  title={`${perk.effect}. ${detail}`}
                  className="perk-library-row"
                  onClick={() => {
                    if (assigned) setActiveSlot(assigned);
                    else if (!blocked) setLoadout(addPerk(loadout, activeSlot, perk.key));
                  }}
                >
                  {perk.icon ? (
                    <GameIcon src={perk.icon} size={38} className="shrink-0" />
                  ) : (
                    <span className="perk-library-row__fallback" aria-hidden>
                      E
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="perk-library-row__name">{perk.label}</span>
                    <span className="sr-only">{perk.effect}</span>
                  </span>
                  <span className="perk-library-row__meta">
                    {assigned
                      ? `R${loadout.perks[perk.key]} · ${GIZMO_LABELS[assigned].replace(" gizmo", "")}`
                      : PERK_GIZMO_KIND[perk.key] === "weapon"
                        ? "Weapon only"
                        : "Any gizmo"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="invention-gizmos" aria-labelledby="gizmo-builder-title">
          <h3 id="gizmo-builder-title" className="buff-group__title">
            Gizmo builder
          </h3>
          <div className="gizmo-list mt-1.5" role="group" aria-label="Gizmo layout">
            {GIZMO_SLOTS.map((slot) => (
              <GizmoCard
                key={slot}
                slot={slot}
                active={activeSlot === slot}
                loadout={loadout}
                setLoadout={setLoadout}
                onActivate={() => setActiveSlot(slot)}
              />
            ))}
          </div>
        </section>
      </div>

      <section className="item-modifiers mt-3" aria-labelledby="item-modifiers-title">
        <h3 id="item-modifiers-title" className="buff-group__title">
          Item-level modifiers
        </h3>
        <div className="item-modifier-grid mt-1.5">
          {LEVEL_20_FLAGS.map((flag) => (
            <label key={flag.key} className="perk-flag">
              <input
                type="checkbox"
                checked={loadout.perks[flag.key]}
                disabled={loadout.perks[flag.perk] === 0}
                onChange={(event) =>
                  setLoadout({
                    ...loadout,
                    perks: { ...loadout.perks, [flag.key]: event.target.checked },
                  })
                }
              />
              {flag.label}
            </label>
          ))}
          <label className="perk-flag">
            <input
              type="checkbox"
              checked={loadout.perks.plantedFeet}
              onChange={(event) =>
                setLoadout({
                  ...loadout,
                  perks: { ...loadout.perks, plantedFeet: event.target.checked },
                })
              }
            />
            Planted Feet · +25% Sunshine and Death&apos;s Swiftness duration
          </label>
        </div>
      </section>
    </div>
  );
}
