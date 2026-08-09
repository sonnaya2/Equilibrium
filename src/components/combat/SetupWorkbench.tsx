"use client";

import {
  MONOLITH_ACTIVE_LIMIT,
  relicById,
  totalEnergyUsed,
} from "@/combat/shared/archaeologyRelics";
import type { ReactNode } from "react";
import { GameIcon } from "../GameIcon";
import { CombatFrame } from "./CombatFrame";
import { CompactRotation } from "./CompactRotation";
import type { CalcStats } from "./loadoutStats";
import {
  formatLifePoints,
  targetSummaryView,
} from "./targetSummaryPresentation";
import { isTargetModifiedFromPreset } from "./targetPresetUi";
import { GIZMO_SLOTS, gizmoCapacity, type Loadout, type PerkRankKey } from "./useLoadout";
const PERK_LABELS: Record<PerkRankKey, string> = {
  equilibrium: "Equilibrium",
  eruptive: "Eruptive",
  biting: "Biting",
  invigorating: "Invigorating",
  impatient: "Impatient",
  ultimatums: "Ultimatums",
  lunging: "Lunging",
  caroming: "Caroming",
  energising: "Energising",
  crackling: "Crackling",
  aftershock: "Aftershock",
  relentless: "Relentless",
  precise: "Precise",
  plantedFeet: "Planted Feet",
  demonSlayer: "Demon Slayer",
  dragonSlayer: "Dragon Slayer",
  undeadSlayer: "Undead Slayer",
};

const EFFECT_ICONS = {
  vulnerability: "/game/upgrades/combat-utility/vulnerability-bomb.webp",
  overload: "/game/upgrades/skilling-production/elder-overload-potion.webp",
  weaponPoison: "/game/upgrades/skilling-production/weapon-poison-plus-plus.webp",
  protectionPrayer: "/game/combat/prayers/standard/protect-from-necromancy.webp",
  fortitude: "/game/combat/prayers/ancient-curses/fortitude.webp",
  reaperCrew: "/game/upgrades/permanent-unlocks/reaper-crew.webp",
  fontOfLife: "/game/upgrades/permanent-unlocks/font-of-life.webp",
  boonOfHet: "/game/upgrades/permanent-unlocks/blessing-of-het.webp",
  totemOfVitality: "/game/upgrades/permanent-unlocks/totem-of-vitality.webp",
  ringOfVigour: "/game/upgrades/permanent-unlocks/ring-of-vigour.webp",
} as const;

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function perkIcon(key: PerkRankKey): string {
  return `/game/combat/perks/${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}.webp`;
}

function WorkbenchCard({
  cardId,
  title,
  meta,
  children,
  action,
  onAction,
  actionLabel,
}: {
  cardId: string;
  title: string;
  meta?: string;
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <CombatFrame
      as="section"
      id={cardId}
      className="setup-workbench-card"
      aria-labelledby={`${cardId}-title`}
    >
      <header className="setup-card-header">
        <h2 id={`${cardId}-title`} className="combat-section-title">
          {title}
        </h2>
        {meta ? <span>{meta}</span> : null}
      </header>
      {children != null ? <div className="setup-workbench-card__body">{children}</div> : null}
      {action && onAction ? (
        <button
          type="button"
          className="setup-card-action"
          aria-label={actionLabel ?? action}
          title={actionLabel ?? action}
          onClick={onAction}
        >
          {action}
        </button>
      ) : null}
    </CombatFrame>
  );
}

type ActiveEffect = { id: string; label: string; detail: string; icon: string };

function ActiveEffects({
  loadout,
  ringOfVigourPassive,
}: {
  loadout: Loadout;
  ringOfVigourPassive: boolean;
}) {
  const buffs = loadout.buffs;
  const effects: Array<ActiveEffect | null> = [
    buffs.overload !== "none"
      ? {
          id: "overload",
          label: titleCase(buffs.overload),
          detail: "Combat stat boost",
          icon: EFFECT_ICONS.overload,
        }
      : null,
    buffs.vulnerability
      ? {
          id: "vulnerability",
          label: "Vulnerability",
          detail: "Target damage taken modifier",
          icon: EFFECT_ICONS.vulnerability,
        }
      : null,
    buffs.weaponPoison !== "none"
      ? {
          id: "weapon-poison",
          label: titleCase(buffs.weaponPoison),
          detail: "Selected weapon poison",
          icon: EFFECT_ICONS.weaponPoison,
        }
      : null,
    buffs.kwuarmPotency > 0
      ? {
          id: "kwuarm",
          label: "Kwuarm incense",
          detail: `Potency ${buffs.kwuarmPotency}`,
          icon: EFFECT_ICONS.weaponPoison,
        }
      : null,
    buffs.protectionPrayer
      ? {
          id: "protection-prayer",
          label: "Protection prayer",
          detail: "Incoming protection selected",
          icon: EFFECT_ICONS.protectionPrayer,
        }
      : null,
    buffs.fortitude
      ? {
          id: "fortitude",
          label: "Fortitude",
          detail: "Defence and Hitpoints effect",
          icon: EFFECT_ICONS.fortitude,
        }
      : null,
    buffs.reaperCrew
      ? {
          id: "reaper-crew",
          label: "Reaper Crew",
          detail: "Maximum Hitpoints effect",
          icon: EFFECT_ICONS.reaperCrew,
        }
      : null,
    buffs.fontOfLife
      ? {
          id: "font-of-life",
          label: "Font of Life",
          detail: "Maximum Hitpoints effect",
          icon: EFFECT_ICONS.fontOfLife,
        }
      : null,
    buffs.boonOfHet
      ? {
          id: "boon-of-het",
          label: "Boon of Het",
          detail: "Maximum Hitpoints effect",
          icon: EFFECT_ICONS.boonOfHet,
        }
      : null,
    buffs.totemOfVitality
      ? {
          id: "totem-of-vitality",
          label: "Totem of Vitality",
          detail: "Maximum Hitpoints effect",
          icon: EFFECT_ICONS.totemOfVitality,
        }
      : null,
    ringOfVigourPassive
      ? {
          id: "ring-of-vigour",
          label: "Ring of Vigour",
          detail: "Passive unlock",
          icon: EFFECT_ICONS.ringOfVigour,
        }
      : null,
  ];
  const selectedEffects = effects.filter((effect): effect is ActiveEffect => effect !== null);

  return selectedEffects.length ? (
    <>
      <ul className="setup-effect-strip">
        {selectedEffects.slice(0, 4).map((effect) => (
          <li key={effect.id} className="setup-effect-tile">
            <GameIcon src={effect.icon} size={24} />
            <span>
              <strong>{effect.label}</strong>
              <small>{effect.detail}</small>
            </span>
          </li>
        ))}
      </ul>
      {selectedEffects.length > 4 ? (
        <p className="setup-inline-note">+{selectedEffects.length - 4} more selected</p>
      ) : null}
    </>
  ) : null;
}

function InventionSummary({ loadout, onEdit }: { loadout: Loadout; onEdit: () => void }) {
  return (
    <div className="setup-gizmo-list">
      {GIZMO_SLOTS.map((slot) => {
        const held = loadout.gizmos?.[slot] ?? [];
        const capacity = gizmoCapacity(slot);
        const slotLabel = slot.startsWith("weapon")
          ? `Weapon ${slot.slice(-1)}`
          : `Armour ${slot.slice(-1)}`;
        return (
          <section key={slot} className="setup-gizmo-shell">
            <header>
              <strong>{slotLabel}</strong>
              <span>
                {held.length} / {capacity}
              </span>
            </header>
            <ul aria-label={`${slot} perk slots`}>
              {Array.from({ length: capacity }, (_, index) => {
                const key = held[index];
                return (
                  <li key={key ?? `empty-${index}`} className={key ? undefined : "is-empty"}>
                    <button
                      type="button"
                      className="setup-gizmo-slot"
                      onClick={onEdit}
                      aria-label={
                        key
                          ? `Change ${slotLabel} ${PERK_LABELS[key]}`
                          : `Set ${slotLabel} empty perk slot ${index + 1}`
                      }
                    >
                      <span className="setup-gizmo-slot__well" aria-hidden={!key}>
                        {key ? <GameIcon src={perkIcon(key)} size={22} /> : <span />}
                      </span>
                      <span>{key ? PERK_LABELS[key] : "Empty Slot"}</span>
                      {key ? <em>R{loadout.perks[key]}</em> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ArchaeologySummary({ loadout, onEdit }: { loadout: Loadout; onEdit: () => void }) {
  const selected = loadout.archaeology.selectedIds
    .slice(0, MONOLITH_ACTIVE_LIMIT)
    .map((id) => relicById(id))
    .filter((relic): relic is NonNullable<typeof relic> => relic != null);
  const energyUsed = totalEnergyUsed(selected.map((relic) => relic.id));
  const energyCap = loadout.archaeology.energyCap;
  const energyPercent = energyCap > 0 ? Math.min(100, (energyUsed / energyCap) * 100) : 0;
  const slots = Array.from(
    { length: MONOLITH_ACTIVE_LIMIT },
    (_, index) => selected[index] ?? null,
  );
  return (
    <div className="setup-relic-summary">
      <div className="setup-energy-meter">
        <span>Monolith Energy</span>
        <strong>
          {energyUsed} / {energyCap}
        </strong>
      </div>
      <div
        className="setup-energy-bar"
        role="progressbar"
        aria-label="Monolith Energy used"
        aria-valuemin={0}
        aria-valuemax={energyCap}
        aria-valuenow={energyUsed}
      >
        <span style={{ width: `${energyPercent}%` }} />
      </div>
      <div className="setup-relic-slots" aria-label="Selected Archaeology relics">
        {slots.map((relic, index) => (
          <button
            key={relic?.id ?? `empty-${index}`}
            type="button"
            className={`setup-relic-slot${relic ? " is-filled" : " is-empty"}`}
            onClick={onEdit}
            aria-label={relic ? `Change relic ${relic.name}` : "Click here to update relic"}
          >
            {relic ? (
              <GameIcon src={relic.icon} size={32} />
            ) : (
              <span className="setup-relic-slot__empty">Click here to update relic</span>
            )}
            {relic ? (
              <span className="setup-relic-slot__copy">
                <strong>{relic.name}</strong>
                <small>{relic.energyCost} Energy</small>
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function TargetSummary({
  target,
  style,
  damagePotential,
}: {
  target: Loadout["target"];
  style: Loadout["style"];
  damagePotential: number;
}) {
  const view = targetSummaryView(target, {
    modified: target != null && isTargetModifiedFromPreset(target, style),
  });
  if (!view) {
    return (
      <div className="setup-target-summary setup-target-summary--empty">
        <p>No NPC target. Damage Potential uses the manual accuracy slider.</p>
      </div>
    );
  }
  return (
    <div className="setup-target-summary">
      <div className="setup-target-identity">
        <span className="setup-target-identity__icon" aria-hidden>
          <GameIcon src={view.iconSrc} size={40} />
        </span>
        <div className="setup-target-identity__copy">
          <strong>{view.name}</strong>
          <span>
            {view.modifiedHint ?? "Custom"}
            {view.flags.length ? ` ┬╖ ${view.flags.join(" ┬╖ ")}` : ""}
          </span>
        </div>
      </div>
      <dl>
        <div>
          <dt>Defence</dt>
          <dd>{view.defenceLevel}</dd>
        </div>
        <div>
          <dt>Armour</dt>
          <dd>{view.armour}</dd>
        </div>
        <div>
          <dt>Affinity</dt>
          <dd>{view.affinity}</dd>
        </div>
        <div>
          <dt>Damage Potential</dt>
          <dd>{Math.round(damagePotential * 100)}%</dd>
        </div>
        <div>
          <dt>Life points</dt>
          <dd>{formatLifePoints(view.maximumLifePoints)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function SetupWorkbench({
  loadout,
  stats,
  ringOfVigourPassive,
  onOpenEffects,
  onOpenPerks,
  onOpenRelics,
  onOpenTarget,
  onOpenRotation,
}: {
  loadout: Loadout;
  stats: CalcStats;
  ringOfVigourPassive: boolean;
  onOpenEffects: () => void;
  onOpenPerks: () => void;
  onOpenRelics: () => void;
  onOpenTarget: () => void;
  onOpenRotation: () => void;
}) {
  return (
    <div className="setup-workbench-column">
      <WorkbenchCard
        cardId="active-effects"
        title="Active Effects"
        action="Show all active effects"
        onAction={onOpenEffects}
      >
        <ActiveEffects loadout={loadout} ringOfVigourPassive={ringOfVigourPassive} />
      </WorkbenchCard>

      <div className="setup-workbench-duo">
        <WorkbenchCard cardId="invention-perks" title="Invention" meta="4 Gizmos">
          <InventionSummary loadout={loadout} onEdit={onOpenPerks} />
        </WorkbenchCard>
        <WorkbenchCard
          cardId="archaeology-relics"
          title="Archaeology"
          meta={`${loadout.archaeology.selectedIds.length} / ${MONOLITH_ACTIVE_LIMIT} Active`}
        >
          <ArchaeologySummary loadout={loadout} onEdit={onOpenRelics} />
        </WorkbenchCard>
      </div>

      <CompactRotation
        style={loadout.style}
        stats={stats}
        loadout={loadout}
        onOpenRotation={onOpenRotation}
        onOpenTarget={onOpenTarget}
      />

      <WorkbenchCard
        cardId="target"
        title="Target"
        meta={
          loadout.target?.targetPresetId
            ? (targetSummaryView(loadout.target)?.name ?? "Boss")
            : loadout.target
              ? "Custom"
              : "None"
        }
        action="Edit target"
        onAction={onOpenTarget}
        actionLabel="Edit target"
      >
        <TargetSummary
          target={loadout.target}
          style={loadout.style}
          damagePotential={stats.dp}
        />
      </WorkbenchCard>
    </div>
  );
}
