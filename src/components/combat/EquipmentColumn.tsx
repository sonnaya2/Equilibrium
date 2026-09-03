"use client";

import { MAX_CONSTITUTION_LEVEL, MAX_DEFENCE_LEVEL } from "@/combat";
import { equipmentById, type EquipmentRecord } from "@/combat/data";
import type { CombatStyle } from "@/combat/types";
import {
  equippedPassiveSummaries,
  setEffectsSummary,
  type SetEffectSupport,
} from "@/combat/shared/equipment";
import { eofStorableSpecials } from "@/combat/shared/eofStoredSpecials";
import {
  ESSENCE_OF_FINALITY_ITEM_ID,
  hasEssenceOfFinalityEquipped,
} from "@/combat/shared/requirements";
import { resolveLeagueRules, setPieceContributionModifier } from "@/combat/league/ruleset";
import { useBuild } from "@/league/useBuild";
import { abilityIconPath, blessingIconPath, equipmentIconPath } from "@/lib/gameArt";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GameIcon } from "../GameIcon";
import { CombatFrame } from "./CombatFrame";
import { NumberField } from "./NumberField";
import { MagicSpellPicker } from "./MagicSpellPicker";
import { prayerIconPath } from "./PrayerPicker";
import {
  withAttackLevel,
  withStrengthLevel,
  withStyleLevel,
  normalizeEofStoredSpecialId,
  type Loadout,
  type SetLoadout,
} from "./useLoadout";
import { rangedAmmunitionEffectPresentation } from "./ammunitionEffectPresentation";

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

function isEssenceOfFinality(item: EquipmentRecord | undefined): boolean {
  if (!item) return false;
  return item.id === ESSENCE_OF_FINALITY_ITEM_ID || item.id.includes("essence-of-finality");
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

function EofSpecialDialog({
  open,
  loadout,
  setLoadout,
  onDismiss,
  onChangeAmulet,
}: {
  open: boolean;
  loadout: Loadout;
  setLoadout: SetLoadout;
  onDismiss: () => void;
  onChangeAmulet: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const specials = useMemo(() => eofStorableSpecials(), []);
  const selectedId = loadout.eofStoredSpecialId ?? "";
  const selected = specials.find((spec) => spec.id === selectedId) ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const setSpecial = (id: string | null) => {
    setLoadout((prev) => ({
      ...prev,
      eofStoredSpecialId: normalizeEofStoredSpecialId(prev.equipmentIds, id),
    }));
  };

  return (
    <CombatFrame
      as="dialog"
      frameRef={dialogRef}
      className="loadout-editor-dialog eof-special-dialog"
      aria-labelledby="eof-special-dialog-title"
      onClose={onDismiss}
    >
      <header className="loadout-editor-dialog__header">
        <h2 id="eof-special-dialog-title">EoF stored special</h2>
        <button type="button" aria-label="Close EoF special picker" onClick={onDismiss}>
          ×
        </button>
      </header>
      <div className="loadout-editor-dialog__body eof-special-dialog__body">
        <p className="eof-special-dialog__current">
          {selected ? (
            <>
              <GameIcon src={abilityIconPath(selected.id, selected.style)} size={32} />
              <span>
                <strong>{selected.name}</strong>
                <small>Stored special</small>
              </span>
            </>
          ) : (
            <span>
              <strong>None</strong>
              <small>Fail-closed until a special is stored</small>
            </span>
          )}
        </p>
        <ul className="eof-special-picker" aria-label="Storable weapon specials">
          <li>
            <button
              type="button"
              className={`eof-special-picker__option${selectedId === "" ? " is-selected" : ""}`}
              onClick={() => setSpecial(null)}
              aria-pressed={selectedId === ""}
            >
              <span className="eof-special-picker__well" aria-hidden>
                ×
              </span>
              <span>None</span>
            </button>
          </li>
          {specials.map((spec) => {
            const active = selectedId === spec.id;
            return (
              <li key={spec.id}>
                <button
                  type="button"
                  className={`eof-special-picker__option${active ? " is-selected" : ""}`}
                  onClick={() => {
                    setSpecial(spec.id);
                    onDismiss();
                  }}
                  aria-pressed={active}
                >
                  <span className="eof-special-picker__well">
                    <GameIcon src={abilityIconPath(spec.id, spec.style)} size={30} />
                  </span>
                  <span>{spec.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="setup-card-action eof-special-dialog__gear"
          onClick={() => {
            onDismiss();
            onChangeAmulet();
          }}
        >
          Change amulet
        </button>
      </div>
    </CombatFrame>
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
  const [eofPickerOpen, setEofPickerOpen] = useState(false);
  const slots = useMemo(() => loadout.equipmentSlots ?? {}, [loadout.equipmentSlots]);
  const pieceContribution = setPieceContributionModifier(
    resolveLeagueRules({ ruleset: "equilibrium", blessingPicks: build.blessingPicks }),
  );
  const twoHanded = hasTwoHandedWeapon(loadout);
  const eofEquipped = hasEssenceOfFinalityEquipped(loadout.equipmentIds);
  const storedSpecial = useMemo(() => {
    if (!loadout.eofStoredSpecialId) return null;
    return eofStorableSpecials().find((spec) => spec.id === loadout.eofStoredSpecialId) ?? null;
  }, [loadout.eofStoredSpecialId]);
  const passives = useMemo(
    () =>
      equippedPassiveSummaries({
        style: loadout.style,
        equipmentSlots: slots,
        enchantments: loadout.enchantments,
        agilityLevel: loadout.agilityLevel,
      }),
    [loadout.agilityLevel, loadout.enchantments, loadout.style, slots],
  );
  const sets = useMemo(
    () =>
      setEffectsSummary({
        equipmentSlots: slots,
        pieceContribution,
      }),
    [pieceContribution, slots],
  );
  const ammunitionEffect = rangedAmmunitionEffectPresentation(loadout);
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
    <>
      <CombatFrame
        as="section"
        className="setup-equipment-card"
        aria-labelledby="equipment-column-title"
      >
        <header className="setup-card-header">
          <h2 id="equipment-column-title" className="combat-section-title">
            Equipment
          </h2>
        </header>
        <div className="setup-equipment-grid" aria-label="Equipped equipment">
          {EQUIPMENT_SLOTS.map(({ key, label }) => {
            const locked = key === "offhand" && twoHanded;
            const item = locked ? undefined : itemFor(loadout, key);
            const eofSlot = isEssenceOfFinality(item);
            const detail = locked
              ? "2H"
              : eofSlot
                ? (storedSpecial?.name ?? "No special")
                : item?.tier != null
                  ? `T${item.tier}${key === "mainhand" && twoHanded ? " · 2H" : ""}`
                  : "None";
            const displayName = locked
              ? "Locked"
              : eofSlot
                ? (item?.name ?? "Essence of Finality")
                : (item?.name ?? "Empty");
            const ariaExtra =
              key === "mainhand" && genesisActive
                ? ", Genesis Essence active"
                : eofSlot
                  ? `, stored special ${storedSpecial?.name ?? "none"}`
                  : "";
            return (
              <button
                key={key}
                type="button"
                className={`setup-equipment-item setup-equipment-item--${key}${item || locked ? " is-filled" : ""}${eofSlot ? " is-eof" : ""}`}
                onClick={() => {
                  if (eofSlot) {
                    setEofPickerOpen(true);
                    return;
                  }
                  onEdit();
                }}
                aria-label={`${label}: ${locked ? "Locked, two-handed weapon" : (item?.name ?? "Empty")}${ariaExtra}`}
              >
                <span className="setup-equipment-item__label">{label}</span>
                <span className="setup-equipment-item__well">
                  {item ? (
                    <GameIcon src={equipmentIconPath(item.id)} size={36} />
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
                  {eofSlot ? (
                    <span
                      className={`setup-equipment-item__eof${storedSpecial ? " is-filled" : " is-empty"}`}
                      title={
                        storedSpecial ? `Stored: ${storedSpecial.name}` : "No special stored"
                      }
                    >
                      {storedSpecial ? (
                        <GameIcon
                          src={abilityIconPath(storedSpecial.id, storedSpecial.style)}
                          size={18}
                          alt=""
                        />
                      ) : (
                        <span aria-hidden="true">?</span>
                      )}
                      <span className="sr-only">
                        {storedSpecial
                          ? `Stored special ${storedSpecial.name}`
                          : "No special stored"}
                      </span>
                    </span>
                  ) : null}
                </span>
                <span className="setup-equipment-item__name">{displayName}</span>
                <span className="setup-equipment-item__tier">{detail}</span>
              </button>
            );
          })}
        </div>
        <MagicSpellPicker loadout={loadout} setLoadout={setLoadout} />
        <div className="setup-equipment-footer">
          <EquipmentLevels loadout={loadout} setLoadout={setLoadout} />
          <section className="setup-equipment-passives" aria-labelledby="passives-card-title">
            <header className="setup-equipment-passives__heading setup-subsection-header">
              <h3 id="passives-card-title">Passives &amp; set effects</h3>
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
            </header>
            {effectRows.length > 0 || ammunitionEffect ? (
              <ul className="setup-passive-list">
                {effectRows.map((effect) => (
                  <li key={effect.id} className="setup-status-row">
                    <GameIcon src={effect.icon} size={18} />
                    <span>
                      <strong>{effect.label}</strong>
                    </span>
                  </li>
                ))}
                {ammunitionEffect ? (
                  <li className="setup-status-row">
                    <GameIcon
                      src={ammunitionEffect.icon}
                      alt={ammunitionEffect.label}
                      size={18}
                    />
                    <span>
                      <strong>{ammunitionEffect.label}</strong>
                    </span>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="setup-empty-copy">No passives or set effects from equipped gear.</p>
            )}
          </section>
        </div>
      </CombatFrame>
      {eofEquipped ? (
        <EofSpecialDialog
          open={eofPickerOpen}
          loadout={loadout}
          setLoadout={setLoadout}
          onDismiss={() => setEofPickerOpen(false)}
          onChangeAmulet={onEdit}
        />
      ) : null}
    </>
  );
}
