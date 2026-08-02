"use client";

import { NumberField } from "./NumberField";
import { loadoutOverloadTier, loadoutStats } from "./loadoutStats";
import { overloadBoostedLevel } from "@/combat/shared/potions";
import { withAttackLevel, withStrengthLevel, withStyleLevel, type Loadout } from "./useLoadout";

function StatsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stats-group">
      <h3 className="buff-group__title">{title}</h3>
      <div className="loadout-fields mt-1.5">{children}</div>
    </section>
  );
}

/** Engine output, not an input — reads as a result, never as an empty field. */
function DerivedRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stats-derived">
      <span className="stats-derived__label">
        {label}
        {note ? <em className="stats-derived__note">{note}</em> : null}
      </span>
      <strong className="stats-derived__value">{value}</strong>
    </div>
  );
}

export function StatsPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const stats = loadoutStats(loadout);
  const overloadTier = loadoutOverloadTier(loadout);
  const automatic = (patch: Partial<Loadout>) =>
    setLoadout({
      ...loadout,
      ...patch,
      baseDamage: { ...loadout.baseDamage, mode: "automatic" },
    });

  const boostNote = (base: number) =>
    overloadTier ? `+${overloadBoostedLevel(base, overloadTier) - base} from overload` : undefined;

  return (
    <div className="loadout-panel">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Stats</h2>
      <p className="mt-1 text-xs text-parch-300">
        Levels and weapon tiers feed base ability damage. Editing any of them switches base damage
        back to automatic.
      </p>

      <div className="stats-layout mt-3">
        <StatsGroup title="Levels">
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
          <DerivedRow
            label="Damage level in play"
            value={String(stats.effectiveDamageLevel)}
            note={boostNote(loadout.style === "melee" ? loadout.strengthLevel : loadout.level)}
          />
        </StatsGroup>

        <StatsGroup title="Weapon">
          {loadout.style !== "necromancy" ? (
            <label className="loadout-select">
              <span>Weapon setup</span>
              <select
                aria-label="Weapon setup"
                value={loadout.weaponConfiguration}
                onChange={(event) =>
                  automatic({
                    weaponConfiguration: event.target.value as Loadout["weaponConfiguration"],
                  })
                }
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
        </StatsGroup>

        <StatsGroup title="Base damage">
          <label className="loadout-select">
            <span>Source</span>
            {/* Group heading carries "Base damage" visually; the control keeps it
                as its accessible name so it still stands alone. */}
            <select
              aria-label="Base damage"
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
          <DerivedRow
            label="Effective base ability damage"
            value={new Intl.NumberFormat("en-US").format(stats.base)}
            note={
              loadout.perks.equilibrium > 0 || loadout.perks.eruptive > 0
                ? "perks applied"
                : undefined
            }
          />
        </StatsGroup>

        <StatsGroup title="Combat assumptions">
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
          <label className="loadout-toggle">
            <span>30,000 hit cap</span>
            <input
              type="checkbox"
              checked={loadout.hitCapEnabled}
              onChange={(event) => setLoadout({ ...loadout, hitCapEnabled: event.target.checked })}
            />
          </label>
          <DerivedRow
            label="Damage Potential in play"
            value={`${Math.round(stats.dp * 1000) / 10}%`}
            note={stats.damagePotentialSource}
          />
        </StatsGroup>
      </div>
    </div>
  );
}
