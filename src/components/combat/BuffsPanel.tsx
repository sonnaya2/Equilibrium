"use client";

import {
  activeEquipmentEffects,
  activePassiveLabels,
  EQUIPMENT_ENCHANTMENTS,
  equipmentSetById,
  setCritChanceFromDef,
  setEffectsSummary,
  type EquipmentEnchantmentId,
} from "@/combat/shared/equipment";
import type { CombatStyle } from "@/combat/types";
import { GameIcon } from "../GameIcon";
import {
  toggleEquipmentEnchantment,
  type Loadout,
  type OverloadChoice,
  type StyleCurseChoice,
} from "./useLoadout";

/** Wiki art already published under public/game — one consumer, so no gameArt.ts entry. */
const CURSE_ICON = (id: Exclude<StyleCurseChoice, "none">) =>
  `/game/combat/prayers/ancient-curses/${id}.webp`;
const VULNERABILITY_ICON = "/game/upgrades/combat-utility/vulnerability-bomb.webp";
const OVERLOAD_ICON: Record<Exclude<OverloadChoice, "none">, string> = {
  overload: "/game/upgrades/skilling-production/overload.webp",
  supreme: "/game/upgrades/skilling-production/supreme-overload-potion.webp",
  elder: "/game/upgrades/skilling-production/elder-overload-potion.webp",
};
const ENCHANTMENT_ICON = (id: EquipmentEnchantmentId) => `/game/upgrades/enchantments/${id}.webp`;
const ENCHANTMENTS: Record<EquipmentEnchantmentId, { label: string; effect: string }> = {
  agony: {
    label: "Agony",
    effect: "Enhances Enduring Ruin while enhanced Gloves of Passage are equipped",
  },
  heroism: {
    label: "Heroism",
    effect: "Champion's ring: 4% crit chance and +1.5% crit damage per active bleed",
  },
  shadows: {
    label: "Shadows",
    effect: "Stalker's ring with a bow: 4% crit chance and +3% crit damage",
  },
  metaphysics: {
    label: "Metaphysics",
    effect: "Channeller's ring: +2.5% crit damage for each successive channel hit",
  },
};

const CURSE_OPTIONS: Array<{
  value: Exclude<StyleCurseChoice, "none">;
  label: string;
  effect: string;
  style: CombatStyle;
}> = [
  { value: "turmoil", label: "Turmoil", effect: "+10% melee damage", style: "melee" },
  { value: "anguish", label: "Anguish", effect: "+10% ranged damage", style: "ranged" },
  { value: "torment", label: "Torment", effect: "+10% magic damage", style: "magic" },
  { value: "sorrow", label: "Sorrow", effect: "+10% necromancy damage", style: "necromancy" },
  { value: "malevolence", label: "Malevolence", effect: "+12% melee damage", style: "melee" },
  { value: "desolation", label: "Desolation", effect: "+12% ranged damage", style: "ranged" },
  { value: "affliction", label: "Affliction", effect: "+12% magic damage", style: "magic" },
  { value: "ruination", label: "Ruination", effect: "+12% necromancy damage", style: "necromancy" },
];

const OVERLOAD_OPTIONS: Array<{
  value: Exclude<OverloadChoice, "none">;
  label: string;
  effect: string;
}> = [
  { value: "overload", label: "Overload", effect: "+15% of level +3 to every combat stat" },
  { value: "supreme", label: "Supreme overload", effect: "+16% of level +4 to every combat stat" },
  { value: "elder", label: "Elder overload", effect: "+17% of level +5 to every combat stat" },
];

/** Icon toggle. Name and effect live in the tooltip; sr-only text carries the a11y name. */
function BuffTile({
  icon,
  label,
  effect,
  pressed,
  onClick,
}: {
  icon: string | null;
  label: string;
  effect: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`icon-tile${icon ? "" : " icon-tile--text"}`}
    >
      {icon ? <GameIcon src={icon} size={34} className="icon-tile__icon" /> : <span>None</span>}
      <span className="sr-only">
        {label}: {effect}
      </span>
      <span className="icon-tip" role="tooltip">
        <strong>{label}</strong>
        {effect}
      </span>
    </button>
  );
}

/** Player-toggled buffs — wiki numbers only. */
export function BuffsPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  // Prefer same-style curses, but keep the active pick visible even if style mismatched.
  const curseOptions = CURSE_OPTIONS.filter(
    (opt) => opt.style === loadout.style || opt.value === loadout.buffs.styleCurse,
  );

  const setBuffs = (patch: Partial<Loadout["buffs"]>) =>
    setLoadout({ ...loadout, buffs: { ...loadout.buffs, ...patch } });

  const sets = setEffectsSummary({ equipmentSlots: loadout.equipmentSlots });
  const passives = activePassiveLabels(
    activeEquipmentEffects({
      style: loadout.style,
      equipmentSlots: loadout.equipmentSlots,
      enchantments: loadout.enchantments,
    }),
  );

  return (
    <div className="loadout-panel">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Buffs</h2>
      <p className="mt-1 text-xs text-parch-300">
        Hover an icon for its effect. Overloads boost every combat stat; curses are damage only.
      </p>

      <div className="buff-group mt-3" role="group" aria-label="Target debuff">
        <h3 className="buff-group__title">Debuff</h3>
        <div className="icon-tile-grid">
          <label className={`icon-tile${loadout.buffs.vulnerability ? " is-on" : ""}`}>
            {/* Real checkbox, transparent over the whole tile: keeps the a11y name e2e
                pins while staying a full-size click target. */}
            <input
              type="checkbox"
              className="icon-tile__input"
              checked={loadout.buffs.vulnerability}
              onChange={(event) => setBuffs({ vulnerability: event.target.checked })}
            />
            <GameIcon src={VULNERABILITY_ICON} size={34} className="icon-tile__icon" />
            <span className="sr-only">Vulnerability: +10% damage taken</span>
            <span className="icon-tip" role="tooltip">
              <strong>Vulnerability</strong>+10% damage taken by the target
            </span>
          </label>
        </div>
      </div>

      <div className="buff-group mt-3" role="group" aria-label="Account enchantments">
        <h3 className="buff-group__title">Account enchantments</h3>
        <div className="icon-tile-grid">
          {EQUIPMENT_ENCHANTMENTS.map((id) => (
            <BuffTile
              key={id}
              icon={ENCHANTMENT_ICON(id)}
              label={ENCHANTMENTS[id].label}
              effect={ENCHANTMENTS[id].effect}
              pressed={loadout.enchantments.includes(id)}
              onClick={() => setLoadout(toggleEquipmentEnchantment(loadout, id))}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-parch-300">
          Account unlocks default on and activate only with their matching item. Agony assumes the
          enhanced gloves were equipped at least 9 seconds before tick 0.
        </p>
      </div>

      <div className="buff-group mt-3" role="group" aria-label="Style curse">
        <h3 className="buff-group__title">Style curse</h3>
        <div className="icon-tile-grid">
          <BuffTile
            icon={null}
            label="No curse"
            effect="No prayer damage bonus"
            pressed={loadout.buffs.styleCurse === "none"}
            onClick={() => setBuffs({ styleCurse: "none" })}
          />
          {curseOptions.map((opt) => (
            <BuffTile
              key={opt.value}
              icon={CURSE_ICON(opt.value)}
              label={opt.label}
              effect={opt.effect}
              pressed={loadout.buffs.styleCurse === opt.value}
              onClick={() =>
                setBuffs({
                  styleCurse: loadout.buffs.styleCurse === opt.value ? "none" : opt.value,
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="buff-group mt-3" role="group" aria-label="Overload">
        <h3 className="buff-group__title">Overload</h3>
        <div className="icon-tile-grid">
          <BuffTile
            icon={null}
            label="No overload"
            effect="Unboosted combat stats"
            pressed={loadout.buffs.overload === "none"}
            onClick={() => setBuffs({ overload: "none" })}
          />
          {OVERLOAD_OPTIONS.map((opt) => (
            <BuffTile
              key={opt.value}
              icon={OVERLOAD_ICON[opt.value]}
              label={opt.label}
              effect={opt.effect}
              pressed={loadout.buffs.overload === opt.value}
              onClick={() =>
                setBuffs({ overload: loadout.buffs.overload === opt.value ? "none" : opt.value })
              }
            />
          ))}
        </div>
      </div>

      <div className="buff-group mt-3">
        <h3 className="buff-group__title">Set effects</h3>
        {sets.length === 0 ? (
          <p className="mt-1 text-xs text-parch-300">
            Equip set pieces in Gear to activate their effects.
          </p>
        ) : (
          <ul className="set-effect-list mt-1">
            {sets.map((s) => {
              const def = equipmentSetById(s.setId);
              const crit = def ? setCritChanceFromDef(def, s.pieces) : 0;
              return (
                <li key={s.setId} className="set-effect-row" tabIndex={0}>
                  <span className="text-parch-50">{s.label}</span>
                  <span className="font-mono text-parch-300">
                    {s.pieces}/{def?.maxPieces ?? s.pieces} pieces
                  </span>
                  <span className="icon-tip" role="tooltip">
                    <strong>{s.label}</strong>
                    <ul>
                      {crit > 0 ? (
                        <li>Active: +{Math.round(crit * 1000) / 10}% critical strike chance</li>
                      ) : null}
                      {def?.facts?.length ? (
                        def.facts.map((fact) => <li key={fact}>{fact}</li>)
                      ) : crit > 0 ? null : (
                        <li>No combat set bonus sourced.</li>
                      )}
                    </ul>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="buff-group mt-3">
        <h3 className="buff-group__title">Persistent passive effects</h3>
        {passives.length > 0 ? (
          <ul className="mt-1 space-y-1 text-xs text-parch-100">
            {passives.map((passive) => (
              <li key={passive}>{passive}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-parch-300">No modeled item passives are active.</p>
        )}
      </div>
    </div>
  );
}
