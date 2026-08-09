"use client";

import { MAX_CONSTITUTION_LEVEL, MAX_DEFENCE_LEVEL } from "@/combat";
import { equipmentById, type EquipmentRecord } from "@/combat/data";
import type { CombatStyle } from "@/combat/types";
import {
  equippedPassiveSummaries,
  setEffectsSummary,
  type SetEffectSupport,
} from "@/combat/shared/equipment";
import { resolveLeagueRules, setPieceContributionModifier } from "@/combat/league/ruleset";
import { useBuild } from "@/league/useBuild";
import { blessingIconPath, equipmentIconPath } from "@/lib/gameArt";
import { useMemo, type ReactNode } from "react";
import { GameIcon } from "../GameIcon";
import { CombatFrame } from "./CombatFrame";
import { NumberField } from "./NumberField";
import { prayerIconPath } from "./PrayerPicker";
import {
  withAttackLevel,
  withStrengthLevel,
  withStyleLevel,
  type Loadout,
  type SetLoadout,
} from "./useLoadout";

const DAMAGE_SKILL: Record<CombatStyle, string> = {
  melee: "Strength",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
};

const EQUIPMENT_SLOTS = [
  { key: "helmet", label: "Helmet" },
  { key: "pocket", label: "Pocket" },
  { key: "cape", label: "Cape" },
  { key: "amulet", label: "Amulet" },
  { key: "ammo", label: "Ammo" },
  { key: "mainhand", label: "Main Hand" },
  { key: "body", label: "Body" },
  { key: "offhand", label: "Off-hand" },
  { key: "gloves", label: "Gloves" },
  { key: "legs", label: "Legs" },
  { key: "ring", label: "Ring" },
  { key: "boots", label: "Boots" },
] as const;

const MODEL_SLOT_KEYS = [
  "mainhand",
  "offhand",
  "twohand",
  "helmet",
  "body",
  "legs",
  "gloves",
  "boots",
  "cape",
  "amulet",
  "ring",
  "pocket",
  "ammo",
] as const;

const SET_STATUS: Record<SetEffectSupport, string> = {
  modeled: "Active",
  "outgoing-only": "Partial",
  "not-modeled": "Unmodeled",
  none: "No combat effect",
};

function itemFor(
  loadout: Loadout,
  key: (typeof EQUIPMENT_SLOTS)[number]["key"],
): EquipmentRecord | undefined {
  const slots = loadout.equipmentSlots ?? {};
  const id = key === "mainhand" ? (slots.twohand ?? slots.mainhand) : slots[key];
  return id ? equipmentById(id) : undefined;
}

function hasTwoHandedWeapon(loadout: Loadout): boolean {
  return Boolean(loadout.equipmentSlots?.twohand);
}

function prayerLabel(loadout: Loadout): string {
  const value = loadout.buffs.styleCurse;
  if (value === "none") return "No damage prayer";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function StatLabel({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="setup-stat-label">
      <GameIcon src={icon} size={18} />
      <span>{children}</span>
    </span>
  );
}

function EquipmentLevels({ loadout, setLoadout }: { loadout: Loadout; setLoadout: SetLoadout }) {
  return (
    <section className="setup-equipment-levels" aria-labelledby="equipment-levels-title">
      <header className="setup-equipment-levels__heading setup-subsection-header">
        <h3 id="equipment-levels-title">Levels</h3>
      </header>
      <div className="setup-equipment-levels__fields">
        {loadout.style === "melee" ? (
          <>
            <NumberField
              label={<StatLabel icon="/game/skills/attack.webp">Attack</StatLabel>}
              value={loadout.attackLevel}
              min={1}
              max={120}
              onChange={(value) => setLoadout(withAttackLevel(loadout, value))}
            />
            <NumberField
              label={<StatLabel icon="/game/skills/strength.webp">Strength</StatLabel>}
              value={loadout.strengthLevel}
              min={1}
              max={120}
              onChange={(value) => setLoadout(withStrengthLevel(loadout, value))}
            />
          </>
        ) : (
          <NumberField
            label={
              <StatLabel icon={`/game/skills/${loadout.style}.webp`}>
                {DAMAGE_SKILL[loadout.style]}
              </StatLabel>
            }
            value={loadout.level}
            min={1}
            max={120}
            onChange={(value) => setLoadout(withStyleLevel(loadout, value))}
          />
        )}
        <NumberField
          label={<StatLabel icon="/game/skills/defence.webp">Defence</StatLabel>}
          value={loadout.defenceLevel}
          min={1}
          max={MAX_DEFENCE_LEVEL}
          onChange={(value) => setLoadout({ ...loadout, defenceLevel: value })}
        />
        <NumberField
          label={<StatLabel icon="/game/skills/constitution.webp">Constitution</StatLabel>}
          value={loadout.constitutionLevel}
          min={10}
          max={MAX_CONSTITUTION_LEVEL}
          onChange={(value) => setLoadout({ ...loadout, constitutionLevel: value })}
        />
        <NumberField
          label={<StatLabel icon="/game/skills/herblore.webp">Herblore</StatLabel>}
          value={loadout.buffs.herbloreLevel}
          min={1}
          max={120}
          onChange={(value) =>
            setLoadout({ ...loadout, buffs: { ...loadout.buffs, herbloreLevel: value } })
          }
        />
      </div>
    </section>
  );
}

export function EquipmentColumn({
  loadout,
  setLoadout,
  genesisActive,
  onEdit,
  onOpenPrayers,
}: {
  loadout: Loadout;
  setLoadout: SetLoadout;
  genesisActive: boolean;
  onEdit: () => void;
  onOpenPrayers: () => void;
}) {
  const { build } = useBuild();
  const slots = useMemo(() => loadout.equipmentSlots ?? {}, [loadout.equipmentSlots]);
  const pieceContribution = setPieceContributionModifier(
    resolveLeagueRules({ ruleset: "equilibrium", blessingPicks: build.blessingPicks }),
  );
  const filled = useMemo(
    () => MODEL_SLOT_KEYS.filter((key) => Boolean(slots[key])).length,
    [slots],
  );
  const twoHanded = hasTwoHandedWeapon(loadout);
  const passives = useMemo(
    () =>
      equippedPassiveSummaries({
        style: loadout.style,
        equipmentSlots: slots,
        enchantments: loadout.enchantments,
      }),
    [loadout.enchantments, loadout.style, slots],
  );
  const sets = useMemo(
    () =>
      setEffectsSummary({
        equipmentSlots: slots,
        equipmentIds: loadout.equipmentIds,
        pieceContribution,
      }),
    [loadout.equipmentIds, pieceContribution, slots],
  );
  const effectRows = [
    ...passives.map((passive) => ({
      id: `${passive.itemId}:${passive.passiveId}`,
      icon: equipmentIconPath(passive.itemId),
      label: passive.label,
    })),
    ...sets
      .filter((set) => SET_STATUS[set.support] !== "No combat effect")
      .map((set) => ({
        id: set.setId,
        icon: "/game/skills/defence.webp",
        label: set.label,
      })),
  ];

  return (
    <aside className="setup-equipment-column">
      <CombatFrame
        as="section"
        className="setup-equipment-card"
        aria-labelledby="equipment-column-title"
      >
        <header className="setup-card-header">
          <h2 id="equipment-column-title" className="combat-section-title">
            Equipment
          </h2>
          <span>{filled} / 13 slots</span>
        </header>
        <div className="setup-equipment-grid" role="list" aria-label="Equipped equipment">
          {EQUIPMENT_SLOTS.map(({ key, label }) => {
            const locked = key === "offhand" && twoHanded;
            const item = locked ? undefined : itemFor(loadout, key);
            const detail = locked
              ? "2H"
              : item?.tier != null
                ? `T${item.tier}${key === "mainhand" && twoHanded ? " · 2H" : ""}`
                : "None";
            return (
              <button
                key={key}
                type="button"
                className={`setup-equipment-item setup-equipment-item--${key}${item || locked ? " is-filled" : ""}`}
                onClick={onEdit}
                aria-label={`${label}: ${locked ? "Locked, two-handed weapon" : (item?.name ?? "Empty")}${key === "mainhand" && genesisActive ? ", Genesis Essence active" : ""}`}
              >
                <span className="setup-equipment-item__label">{label}</span>
                <span className="setup-equipment-item__well">
                  {item ? (
                    <GameIcon src={equipmentIconPath(item.id)} size={30} />
                  ) : locked ? (
                    <span className="setup-equipment-item__locked" aria-hidden="true">
                      Locked
                    </span>
                  ) : (
                    <span aria-hidden="true">×</span>
                  )}
                  {key === "mainhand" && genesisActive ? (
                    <span className="setup-equipment-item__genesis" title="Genesis Essence active">
                      <GameIcon src={blessingIconPath("Genesis Essence")} size={16} />
                      <span className="sr-only">Genesis Essence active</span>
                    </span>
                  ) : null}
                </span>
                <span className="setup-equipment-item__name">
                  {locked ? "Locked" : (item?.name ?? "Empty")}
                </span>
                <span className="setup-equipment-item__tier">{detail}</span>
              </button>
            );
          })}
        </div>
        <div className="setup-equipment-footer">
          <EquipmentLevels loadout={loadout} setLoadout={setLoadout} />
          <section className="setup-equipment-passives" aria-labelledby="passives-card-title">
            <header className="setup-equipment-passives__heading setup-subsection-header">
              <h3 id="passives-card-title">Passives &amp; Set Effects</h3>
            </header>
            {effectRows.length > 0 ? (
              <ul className="setup-passive-list">
                {effectRows.map((effect) => (
                  <li key={effect.id} className="setup-status-row">
                    <GameIcon src={effect.icon} size={22} />
                    <span>
                      <strong>{effect.label}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              className="setup-prayer-compact"
              onClick={onOpenPrayers}
              aria-label={`Prayer: ${prayerLabel(loadout)}`}
              title={prayerLabel(loadout)}
            >
              <GameIcon
                src={
                  loadout.buffs.styleCurse === "none"
                    ? "/game/skills/prayer.webp"
                    : prayerIconPath(loadout.buffs.styleCurse)
                }
                size={22}
              />
              <span className="sr-only">{prayerLabel(loadout)}</span>
            </button>
          </section>
        </div>
      </CombatFrame>
    </aside>
  );
}
