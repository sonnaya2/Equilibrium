"use client";

import { MAGIC_COMBAT_SPELLS } from "@/combat/styles/magic/ancientSpells";
import { GameIcon } from "../GameIcon";
import type { Loadout, SetLoadout } from "./useLoadout";

export function MagicSpellPicker({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: SetLoadout;
}) {
  if (loadout.style !== "magic") return null;
  const selected = MAGIC_COMBAT_SPELLS.find((spell) => spell.id === loadout.magicSpell);

  return (
    <div className="magic-spell-picker" role="group" aria-label="Active Magic spell">
      <div className="magic-spell-picker__heading">
        <span>Combat spell</span>
        <span>T{loadout.magicSpell === "none" ? loadout.spellTier : 100}</span>
      </div>
      <div className="magic-spell-picker__options">
        {MAGIC_COMBAT_SPELLS.map((spell) => (
          <button
            key={spell.id}
            type="button"
            className="magic-spell-option"
            aria-pressed={loadout.magicSpell === spell.id}
            title={spell.summary}
            onClick={() => setLoadout((current) => ({ ...current, magicSpell: spell.id }))}
          >
            <span className="magic-spell-option__icon" aria-hidden="true">
              {spell.icon ? <GameIcon src={spell.icon} size={28} /> : "-"}
            </span>
            <span>{spell.id === "none" ? "Manual" : spell.name}</span>
          </button>
        ))}
      </div>
      <p className="magic-spell-picker__summary">{selected?.summary}</p>
    </div>
  );
}
