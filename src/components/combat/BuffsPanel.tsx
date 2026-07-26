"use client";

import type { CombatStyle } from "@/combat/types";
import type { Loadout, StyleCurseChoice } from "./useLoadout";

const CURSE_OPTIONS: Array<{
  value: StyleCurseChoice;
  label: string;
  style?: CombatStyle;
}> = [
  { value: "none", label: "None" },
  { value: "turmoil", label: "Turmoil (melee +10%)", style: "melee" },
  { value: "anguish", label: "Anguish (ranged +10%)", style: "ranged" },
  { value: "torment", label: "Torment (magic +10%)", style: "magic" },
  { value: "sorrow", label: "Sorrow (necro +10%)", style: "necromancy" },
  { value: "malevolence", label: "Malevolence (melee +12%)", style: "melee" },
  { value: "desolation", label: "Desolation (ranged +12%)", style: "ranged" },
  { value: "affliction", label: "Affliction (magic +12%)", style: "magic" },
  { value: "ruination", label: "Ruination (necro +12%)", style: "necromancy" },
];

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
    (opt) =>
      opt.value === "none" ||
      opt.style === loadout.style ||
      opt.value === loadout.buffs.styleCurse,
  );

  return (
    <div>
      <h2 className="text-sm font-medium text-parch-50">Buffs</h2>
      <p className="mt-1 text-xs text-parch-300">
        Overload raises accuracy levels, not ability damage
      </p>
      <div className="mt-3 border-t border-stone-750">
        <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <input
            type="checkbox"
            checked={loadout.buffs.vulnerability}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                buffs: { ...loadout.buffs, vulnerability: event.target.checked },
              })
            }
          />
          Vulnerability (+10% damage taken)
        </label>
        <label className="grid grid-cols-[1fr_140px] items-center gap-3 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <span>Style curse</span>
          <select
            value={loadout.buffs.styleCurse}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                buffs: {
                  ...loadout.buffs,
                  styleCurse: event.target.value as StyleCurseChoice,
                },
              })
            }
            className="w-full border border-stone-750 bg-transparent px-2 py-1 text-sm text-parch-50"
          >
            {curseOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid grid-cols-[1fr_140px] items-center gap-3 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <span>Overload</span>
          <select
            value={loadout.buffs.overload}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                buffs: {
                  ...loadout.buffs,
                  overload: event.target.value as typeof loadout.buffs.overload,
                },
              })
            }
            className="w-full border border-stone-750 bg-transparent px-2 py-1 text-sm text-parch-50"
          >
            <option value="none">None</option>
            <option value="overload">Overload</option>
            <option value="supreme">Supreme overload</option>
            <option value="elder">Elder overload</option>
          </select>
        </label>
      </div>
    </div>
  );
}
