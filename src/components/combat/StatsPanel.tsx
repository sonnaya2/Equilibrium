"use client";

import { NumberField } from "./NumberField";
import { loadoutStats } from "./loadoutStats";
import { withAttackLevel, withStrengthLevel, withStyleLevel, type Loadout } from "./useLoadout";

export function StatsPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const stats = loadoutStats(loadout);
  const automatic = (patch: Partial<Loadout>) =>
    setLoadout({
      ...loadout,
      ...patch,
      baseDamage: { ...loadout.baseDamage, mode: "automatic" },
    });

  return (
    <div className="loadout-panel">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Stats</h2>
      <div className="loadout-fields mt-3">
        {loadout.style === "melee" ? (
          <>
            <NumberField
              label="Attack level"
              value={loadout.attackLevel}
              onChange={(attackLevel) => setLoadout(withAttackLevel(loadout, attackLevel))}
            />
            <NumberField
              label="Strength level"
              value={loadout.strengthLevel}
              onChange={(strengthLevel) => setLoadout(withStrengthLevel(loadout, strengthLevel))}
            />
          </>
        ) : (
          <NumberField
            label="Style level"
            value={loadout.level}
            onChange={(level) => setLoadout(withStyleLevel(loadout, level))}
          />
        )}
        {loadout.style !== "necromancy" ? (
          <label className="grid grid-cols-[1fr_110px] items-center gap-3 border-b border-stone-750/70 py-2 text-xs text-parch-100">
            <span>Weapon setup</span>
            <select
              value={loadout.weaponConfiguration}
              onChange={(event) =>
                automatic({
                  weaponConfiguration: event.target.value as Loadout["weaponConfiguration"],
                })
              }
              className="w-full border border-stone-750 bg-transparent px-2 py-1 text-sm text-parch-50"
            >
              <option value="twohand">Two-handed</option>
              <option value="dualwield">Dual wield</option>
              <option value="mainhand">Main-hand only</option>
            </select>
          </label>
        ) : null}
        <NumberField
          label={loadout.style === "necromancy" ? "Death guard tier" : "Main weapon tier"}
          value={loadout.weaponTier}
          onChange={(weaponTier) => automatic({ weaponTier })}
        />
        {loadout.style === "necromancy" || loadout.weaponConfiguration === "dualwield" ? (
          <NumberField
            label={loadout.style === "necromancy" ? "Conduit tier" : "Off-hand tier"}
            value={loadout.offhandTier}
            onChange={(offhandTier) => automatic({ offhandTier })}
          />
        ) : null}
        {loadout.style === "magic" ? (
          <NumberField
            label="Spell tier"
            value={loadout.spellTier}
            onChange={(spellTier) => automatic({ spellTier })}
          />
        ) : null}
        {loadout.style === "ranged" ? (
          <NumberField
            label="Ammunition tier"
            value={loadout.ammunitionTier}
            onChange={(ammunitionTier) => automatic({ ammunitionTier })}
          />
        ) : null}
        <NumberField
          label="Other style damage bonus"
          value={loadout.styleDamageBonus}
          onChange={(styleDamageBonus) => automatic({ styleDamageBonus })}
        />
        <label className="grid grid-cols-[1fr_110px] items-center gap-3 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <span>Base damage</span>
          <select
            value={loadout.baseDamage.mode}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                baseDamage: {
                  ...loadout.baseDamage,
                  mode: event.target.value === "manual" ? "manual" : "automatic",
                },
              })
            }
            className="w-full border border-stone-750 bg-transparent px-2 py-1 text-sm text-parch-50"
          >
            <option value="automatic">Automatic</option>
            <option value="manual">Manual override</option>
          </select>
        </label>
        {loadout.baseDamage.mode === "manual" ? (
          <NumberField
            label="Manual base override"
            value={loadout.baseDamage.manualValue}
            onChange={(manualValue) =>
              setLoadout({
                ...loadout,
                baseDamage: { mode: "manual", manualValue: Math.max(1, manualValue) },
              })
            }
          />
        ) : null}
        <div className="flex justify-between gap-3 border-b border-stone-750/70 py-2 text-xs">
          <span className="text-parch-300">Effective base ability damage</span>
          <strong className="font-mono font-medium text-parch-50">{stats.base}</strong>
        </div>
        <NumberField
          label="Starting adrenaline"
          value={loadout.startingAdrenaline}
          onChange={(startingAdrenaline) =>
            setLoadout({
              ...loadout,
              startingAdrenaline: Math.min(100, Math.max(0, startingAdrenaline)),
            })
          }
          suffix="%"
        />
        <label className="flex items-center justify-between gap-3 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <span>30,000 hit cap</span>
          <input
            type="checkbox"
            checked={loadout.hitCapEnabled}
            onChange={(event) => setLoadout({ ...loadout, hitCapEnabled: event.target.checked })}
          />
        </label>
        <NumberField
          label="Damage Potential assumption"
          value={loadout.accuracy}
          onChange={(accuracy) => setLoadout({ ...loadout, accuracy })}
          suffix="%"
        />
        <NumberField
          label="Crit chance"
          value={loadout.critChance}
          onChange={(critChance) => setLoadout({ ...loadout, critChance })}
          suffix="%"
        />
      </div>
    </div>
  );
}
