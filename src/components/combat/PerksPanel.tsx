"use client";

import { GameIcon } from "../GameIcon";
import {
  GIZMO_CAPACITY,
  GIZMO_SLOTS,
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

const LEVEL_20_FLAGS: Partial<
  Record<
    PerkRankKey,
    { key: "bitingLevel20" | "impatientLevel20" | "relentlessLevel20"; label: string }
  >
> = {
  biting: { key: "bitingLevel20", label: "Level-20 item" },
  impatient: { key: "impatientLevel20", label: "Level-20 item" },
  relentless: { key: "relentlessLevel20", label: "Level-20 item" },
};

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
  const flag = LEVEL_20_FLAGS[key];
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

function GizmoCard({
  slot,
  loadout,
  setLoadout,
}: {
  slot: GizmoSlotId;
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const held = loadout.gizmos[slot] ?? [];
  const available = PERKS.filter(
    (perk) => gizmoAccepts(slot, perk.key) && gizmoSlotOf(loadout.gizmos, perk.key) == null,
  );

  return (
    <section className="gizmo-card" aria-labelledby={`gizmo-${slot}`}>
      <h4 id={`gizmo-${slot}`} className="gizmo-card__title">
        {GIZMO_LABELS[slot]}
        <span className="font-mono text-parch-300">
          {held.length}/{GIZMO_CAPACITY}
        </span>
      </h4>
      <div className="space-y-2">
        {held.map((key) => {
          const perk = PERK_BY_KEY.get(key);
          if (!perk) return null;
          const level20 = LEVEL_20_FLAGS[key];
          return (
            <div key={key} className="gizmo-perk-block">
              <div className="gizmo-perk">
                {perk.icon ? <GameIcon src={perk.icon} size={22} className="shrink-0" /> : null}
                <select
                  value={key}
                  aria-label={`Perk on ${GIZMO_LABELS[slot]}`}
                  onChange={(event) => {
                    const replacement = event.target.value as PerkRankKey;
                    setLoadout(addPerk(removePerk(loadout, key), slot, replacement));
                  }}
                  className="gizmo-perk__name"
                >
                  <option value={key}>{perk.label}</option>
                  {available.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={loadout.perks[key]}
                  aria-label={`${perk.label} rank`}
                  onChange={(event) =>
                    setLoadout(withPerkRank(loadout, key, Number(event.target.value)))
                  }
                  className="gizmo-perk__rank"
                >
                  {Array.from({ length: perk.max }, (_, index) => index + 1).map((rank) => (
                    <option key={rank} value={rank}>
                      R{rank}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Remove ${perk.label} from ${GIZMO_LABELS[slot]}`}
                  onClick={() => setLoadout(removePerk(loadout, key))}
                  className="gizmo-perk__remove"
                >
                  ×
                </button>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-parch-300">{perk.effect}</p>
              {level20 ? (
                <label className="perk-flag mt-1">
                  <input
                    type="checkbox"
                    checked={loadout.perks[level20.key]}
                    onChange={(event) =>
                      setLoadout({
                        ...loadout,
                        perks: { ...loadout.perks, [level20.key]: event.target.checked },
                      })
                    }
                  />
                  {level20.label}
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
      {held.length < GIZMO_CAPACITY && available.length > 0 ? (
        <select
          value=""
          aria-label={`Add a perk to ${GIZMO_LABELS[slot]}`}
          onChange={(event) => {
            if (event.target.value) {
              setLoadout(addPerk(loadout, slot, event.target.value as PerkRankKey));
            }
          }}
          className="gizmo-card__add mt-2"
        >
          <option value="">Add perk</option>
          {available.map((perk) => (
            <option key={perk.key} value={perk.key}>
              {perk.label}
            </option>
          ))}
        </select>
      ) : null}
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
  const unassigned = PERKS.filter(
    (perk) => loadout.perks[perk.key] > 0 && gizmoSlotOf(loadout.gizmos, perk.key) == null,
  );

  return (
    <div className="loadout-panel loadout-panel-wide">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Invention</h2>
      <p className="mt-1 text-xs text-parch-300">
        Four persistent gizmos, two perks each. Weapon-only perks cannot be placed on armour.
      </p>

      <div className="gizmo-list mt-3" role="group" aria-label="Gizmo layout">
        {GIZMO_SLOTS.map((slot) => (
          <GizmoCard key={slot} slot={slot} loadout={loadout} setLoadout={setLoadout} />
        ))}
      </div>

      {unassigned.length > 0 ? (
        <div className="combat-subpanel mt-3 p-2 text-xs">
          <h3 className="text-parch-50">Unassigned saved perks</h3>
          <p className="mt-1 text-parch-300">Place or remove these legacy ranks.</p>
          <div className="mt-2 space-y-1.5">
            {unassigned.map((perk) => {
              const slots = GIZMO_SLOTS.filter(
                (slot) =>
                  gizmoAccepts(slot, perk.key) &&
                  (loadout.gizmos[slot]?.length ?? 0) < GIZMO_CAPACITY,
              );
              return (
                <div key={perk.key} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-28 text-parch-100">
                    {perk.label} R{loadout.perks[perk.key]}
                  </span>
                  <select
                    value=""
                    aria-label={`Place ${perk.label}`}
                    onChange={(event) =>
                      setLoadout(addPerk(loadout, event.target.value as GizmoSlotId, perk.key))
                    }
                    className="border border-stone-750 bg-stone-900 px-2 py-1 text-parch-50"
                  >
                    <option value="">Place on</option>
                    {slots.map((slot) => (
                      <option key={slot} value={slot}>
                        {GIZMO_LABELS[slot]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setLoadout(removePerk(loadout, perk.key))}
                    className="text-parch-300 hover:text-parch-50"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <label className="perk-flag mt-3">
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
        Planted Feet: base Sunshine and Death&apos;s Swiftness last 25% longer
      </label>
    </div>
  );
}
