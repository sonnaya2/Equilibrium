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
  type LoadoutPerks,
  type PerkRankKey,
} from "./useLoadout";

const PERK_ICON = (id: string) => `/game/combat/perks/${id}.webp`;

type GizmoKind = "weapon" | "armour" | "both";
const KIND_ORDER: Record<GizmoKind, number> = { weapon: 0, armour: 1, both: 2 };

interface PerkDef {
  key: PerkRankKey;
  label: string;
  effect: string;
  max: number;
  icon: string | null;
}

const PERKS: readonly PerkDef[] = [
  {
    key: "plantedFeet",
    label: "Planted Feet",
    effect: "+25% Sunshine and Death's Swiftness base duration (→ 63 ticks)",
    max: 1,
    icon: PERK_ICON("planted-feet"),
  },
  {
    key: "eruptive",
    label: "Eruptive",
    effect: "+0.5% base ability damage per rank (R4 +2%)",
    max: 4,
    icon: PERK_ICON("eruptive"),
  },
  {
    key: "precise",
    label: "Precise",
    effect: "Raises minimum ability damage by 1.5% of maximum per rank",
    max: 6,
    icon: PERK_ICON("precise"),
  },
  {
    key: "lunging",
    label: "Lunging",
    effect: "+13% to +22% Combust and Dismember damage",
    max: 4,
    icon: PERK_ICON("lunging"),
  },
  {
    key: "aftershock",
    label: "Aftershock",
    effect: "Blast after 50,000 damage; 24% to 39.6% ability damage per rank; 6s minimum",
    max: 4,
    icon: PERK_ICON("aftershock"),
  },
  {
    key: "demonSlayer",
    label: "Demon Slayer",
    effect: "+7% damage vs demons (target flag)",
    max: 1,
    icon: PERK_ICON("demon-slayer"),
  },
  {
    key: "dragonSlayer",
    label: "Dragon Slayer",
    effect: "+7% damage vs dragons (target flag)",
    max: 1,
    icon: PERK_ICON("dragon-slayer"),
  },
  {
    key: "undeadSlayer",
    label: "Undead Slayer",
    effect: "+7% damage vs undead (target flag)",
    max: 1,
    icon: PERK_ICON("undead-slayer"),
  },
  {
    key: "equilibrium",
    label: "Equilibrium",
    effect: "+8% to +14% base ability damage; critical strikes disabled",
    max: 4,
    icon: PERK_ICON("equilibrium"),
  },
  {
    key: "biting",
    label: "Biting",
    effect: "+2% crit chance per rank (+2.2% on level-20 gear)",
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
    effect: "9% chance per rank for +3 adren on basics (9.9% on level-20 gear)",
    max: 4,
    icon: PERK_ICON("impatient"),
  },
  {
    key: "relentless",
    label: "Relentless",
    effect: "1% chance per rank to refund adrenaline (1.1% on level-20 gear); 30s cooldown",
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
] as const;

const PERK_BY_KEY = new Map(PERKS.map((perk) => [perk.key, perk]));

/** Wiki: Equipment level → Perk benefits (×1.1 chance). Modeled: Biting, Impatient, Relentless. */
const LEVEL_20_BY_PERK: Partial<
  Record<PerkRankKey, { key: keyof LoadoutPerks; detail: string }>
> = {
  biting: { key: "bitingLevel20", detail: "L20 ×1.1 → +2.2% crit per rank" },
  impatient: { key: "impatientLevel20", detail: "L20 ×1.1 → 9.9% proc per rank" },
  relentless: { key: "relentlessLevel20", detail: "L20 ×1.1 → 1.1% refund per rank" },
};

function level20Meta(perk: PerkRankKey) {
  return LEVEL_20_BY_PERK[perk] ?? null;
}

const GIZMO_LABELS: Record<GizmoSlotId, string> = {
  weapon1: "Weapon 1",
  weapon2: "Weapon 2",
  armour1: "Armour 1",
  armour2: "Armour 2",
};

function kindLabel(kind: GizmoKind): string {
  if (kind === "weapon") return "Weapon";
  if (kind === "armour") return "Armour";
  return "Any";
}

function sortedPerks(): readonly PerkDef[] {
  return [...PERKS].sort((a, b) => {
    const byKind = KIND_ORDER[PERK_GIZMO_KIND[a.key]] - KIND_ORDER[PERK_GIZMO_KIND[b.key]];
    if (byKind !== 0) return byKind;
    // Rankless (max 1) first within a kind, then multi-rank.
    if (a.max !== b.max) return a.max === 1 ? -1 : 1;
    return 0;
  });
}

const LIBRARY_PERKS = sortedPerks();

function withPerkRank(loadout: Loadout, key: PerkRankKey, rank: number): Loadout {
  return { ...loadout, perks: { ...loadout.perks, [key]: rank } };
}

function removePerk(loadout: Loadout, key: PerkRankKey): Loadout {
  const next = removePerkFromGizmos(loadout, key);
  const l20 = level20Meta(key);
  return {
    ...next,
    perks: {
      ...next.perks,
      [key]: 0,
      ...(l20 ? { [l20.key]: false } : {}),
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
            const l20 = level20Meta(key);
            const l20On = l20 ? loadout.perks[l20.key] === true : false;
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
                  <span className="gizmo-perk__identity">
                    <span className="gizmo-perk__name">{perk.label}</span>
                    {l20 ? (
                      <label
                        className={`gizmo-perk__l20${l20On ? " is-on" : ""}`}
                        title={l20.detail}
                      >
                        <input
                          type="checkbox"
                          checked={l20On}
                          onChange={(event) =>
                            setLoadout({
                              ...loadout,
                              perks: {
                                ...loadout.perks,
                                [l20.key]: event.target.checked,
                              },
                            })
                          }
                        />
                        <span className="gizmo-perk__l20-mark">20</span>
                      </label>
                    ) : null}
                  </span>
                  {perk.max > 1 ? (
                    <RankStepper
                      perk={perk}
                      rank={loadout.perks[key]}
                      onChange={(rank) => setLoadout(withPerkRank(loadout, key, rank))}
                    />
                  ) : (
                    <span className="gizmo-perk__on" aria-label={`${perk.label} on`}>
                      On
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${perk.label} from ${GIZMO_LABELS[slot]}`}
                    onClick={() => setLoadout(removePerk(loadout, key))}
                    className="gizmo-perk__remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="gizmo-card__empty">Empty</p>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="combat-section-title text-sm font-medium text-parch-50">Invention</h2>
        <button
          type="button"
          disabled={!hasGizmoPerks}
          onClick={() => setLoadout(clearAllGizmos(loadout))}
          className="combat-button px-3 py-1 text-xs"
        >
          Clear all
        </button>
      </div>

      <div className="invention-layout mt-3">
        <section aria-labelledby="perk-library-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="perk-library-title" className="buff-group__title">
              Perks
            </h3>
            <span className="text-xs text-gem-300">
              {GIZMO_LABELS[activeSlot]} · {activeHeld.length}/{GIZMO_CAPACITY}
            </span>
          </div>
          <div className="perk-library mt-1.5" role="group" aria-label="Perks">
            {LIBRARY_PERKS.map((perk) => {
              const kind = PERK_GIZMO_KIND[perk.key];
              const assigned = gizmoSlotOf(loadout.gizmos, perk.key);
              const compatible = gizmoAccepts(activeSlot, perk.key);
              const blocked = assigned == null && (!compatible || activeFull);
              const detail = assigned
                ? `On ${GIZMO_LABELS[assigned]}`
                : !compatible
                  ? `${kindLabel(kind)}; not for ${GIZMO_LABELS[activeSlot]}`
                  : activeFull
                    ? `${GIZMO_LABELS[activeSlot]} full`
                    : `Add to ${GIZMO_LABELS[activeSlot]}`;
              const meta = assigned
                ? perk.max > 1
                  ? `R${loadout.perks[perk.key]} · ${GIZMO_LABELS[assigned]}`
                  : `On · ${GIZMO_LABELS[assigned]}`
                : kindLabel(kind);
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
                    <GameIcon src={perk.icon} size={28} className="shrink-0" />
                  ) : (
                    <span className="perk-library-row__fallback" aria-hidden>
                      E
                    </span>
                  )}
                  <span className="perk-library-row__text min-w-0">
                    <span className="perk-library-row__name">{perk.label}</span>
                    <span className="perk-library-row__meta">{meta}</span>
                  </span>
                  <span className="sr-only">{perk.effect}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="invention-gizmos" aria-labelledby="gizmos-title">
          <h3 id="gizmos-title" className="buff-group__title">
            Gizmos
          </h3>
          <div className="gizmo-list mt-1.5" role="group" aria-label="Gizmos">
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
    </div>
  );
}
