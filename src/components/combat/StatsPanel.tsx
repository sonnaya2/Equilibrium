"use client";

import { NumberField } from "./NumberField";
import { loadoutOverloadTier, loadoutStats } from "./loadoutStats";
import { MAX_CONSTITUTION_LEVEL, MAX_DEFENCE_LEVEL } from "@/combat";
import { overloadBoostedLevel } from "@/combat/shared/potions";
import {
  weaponConfigurationFor,
  withAttackLevel,
  withStrengthLevel,
  withStyleLevel,
  type Loadout,
} from "./useLoadout";
import type { CombatStyle } from "@/combat/types";
import { unlockedRegions } from "@/league";
import { useBuild } from "@/league/useBuild";

/** Skill each style draws its damage level from. */
const DAMAGE_SKILL: Record<CombatStyle, string> = {
  melee: "Strength",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
};

function StatsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stats-group">
      <h3 className="buff-group__title">{title}</h3>
      <div className="loadout-fields mt-1.5">{children}</div>
    </section>
  );
}

/**
 * Numeric row whose value is engine-derived until the user takes it over. The
 * checkbox sits beside the number so the two read as one control.
 */
function AutoNumberField({
  label,
  value,
  auto,
  onAutoChange,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  auto: boolean;
  onAutoChange: (auto: boolean) => void;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="loadout-number">
      <span>{label}</span>
      <span className="loadout-control">
        <input
          type="checkbox"
          checked={auto}
          aria-label={`${label} automatic`}
          title="Follow the calculated value"
          onChange={(event) => onAutoChange(event.target.checked)}
        />
        <input
          type="number"
          aria-label={label}
          value={value}
          min={min}
          max={max}
          disabled={auto}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </span>
    </div>
  );
}

/** Engine output, not an input - reads as a result, never as an empty field. */
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
  const { build } = useBuild();
  const stats = loadoutStats(loadout, {
    blessingPicks: build.blessingPicks,
    relics: Object.values(build.relics).filter(Boolean),
    unlockedRegions: unlockedRegions(build),
  });
  const overloadTier = loadoutOverloadTier(loadout);
  const automatic = (patch: Partial<Loadout>) =>
    setLoadout({
      ...loadout,
      ...patch,
      baseDamage: { ...loadout.baseDamage, mode: "automatic" },
    });

  const boostNote = (base: number) =>
    overloadTier ? `+${overloadBoostedLevel(base, overloadTier) - base} from overload` : undefined;
  const format = (value: number, maximumFractionDigits = 0) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);

  return (
    <div className="loadout-panel">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Stats</h2>

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
              label={`${DAMAGE_SKILL[loadout.style]} level`}
              value={loadout.level}
              onChange={(level) => setLoadout(withStyleLevel(loadout, level))}
            />
          )}
          <DerivedRow
            label={`Boosted ${DAMAGE_SKILL[loadout.style]} level`}
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
                value={
                  // Shield / defender come only from equipped gear; map to the
                  // nearest manual option so the disabled control stays valid.
                  loadout.weaponConfiguration === "shield"
                    ? "mainhand"
                    : loadout.weaponConfiguration === "defender"
                      ? "dualwield"
                      : loadout.weaponConfiguration
                }
                disabled={weaponConfigurationFor(loadout) != null}
                title={
                  weaponConfigurationFor(loadout) != null
                    ? "Set by the weapon you have equipped"
                    : undefined
                }
                onChange={(event) =>
                  automatic({
                    weaponConfiguration: event.target.value as Loadout["weaponConfiguration"],
                  })
                }
              >
                <option value="twohand">Two-handed</option>
                <option value="dualwield">Dual wield</option>
                <option value="mainhand">Main-hand</option>
              </select>
            </label>
          ) : null}
          <NumberField
            label={loadout.style === "necromancy" ? "Death guard tier" : "Main weapon tier"}
            value={loadout.weaponTier}
            onChange={(weaponTier) => automatic({ weaponTier })}
          />
          {loadout.style === "necromancy" ||
          loadout.weaponConfiguration === "dualwield" ||
          loadout.weaponConfiguration === "defender" ? (
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
          <AutoNumberField
            label="Base ability damage"
            value={
              loadout.baseDamage.mode === "manual" ? loadout.baseDamage.manualValue : stats.rawBase
            }
            auto={loadout.baseDamage.mode === "automatic"}
            onAutoChange={(auto) =>
              setLoadout({
                ...loadout,
                baseDamage: {
                  mode: auto ? "automatic" : "manual",
                  // Freeze pre-perk / pre-Aegis entered base; loadoutBase + Aegis re-apply once.
                  manualValue: auto ? loadout.baseDamage.manualValue : stats.rawBase,
                },
              })
            }
            onChange={(manualValue) =>
              setLoadout({
                ...loadout,
                baseDamage: { mode: "manual", manualValue: Math.max(1, manualValue) },
              })
            }
          />
          {/* Engine total after Invention perks and Teragard's Aegis when it differs from the field. */}
          {stats.base !==
          (loadout.baseDamage.mode === "manual"
            ? loadout.baseDamage.manualValue
            : stats.rawBase) ? (
            <DerivedRow label="After modifiers" value={format(stats.base)} />
          ) : null}
        </StatsGroup>

        <StatsGroup title="Defence & life">
          <NumberField
            label="Defence level"
            value={loadout.defenceLevel}
            min={1}
            max={MAX_DEFENCE_LEVEL}
            onChange={(defenceLevel) => setLoadout({ ...loadout, defenceLevel })}
          />
          <NumberField
            label="Constitution level"
            value={loadout.constitutionLevel}
            min={10}
            max={MAX_CONSTITUTION_LEVEL}
            onChange={(constitutionLevel) => setLoadout({ ...loadout, constitutionLevel })}
          />
          <DerivedRow
            label="Defence"
            value={format(stats.defence.visibleLevel)}
            note={boostNote(loadout.defenceLevel)}
          />
          {stats.defence.blockLevel !== stats.defence.visibleLevel ? (
            <DerivedRow
              label="Block level"
              value={format(stats.defence.blockLevel, 2)}
              note={
                loadout.buffs.fortitude
                  ? "Fortitude"
                  : loadout.buffs.styleCurse !== "none"
                    ? loadout.buffs.styleCurse
                    : undefined
              }
            />
          ) : null}
          {/* Two different numbers: the Loadout screen's Armour stat, which every
              "% of your armour value" effect reads, and the hit-chance rating
              that Defence level, curses and Fortitude also feed. */}
          <DerivedRow label="Armour" value={format(stats.defence.totalArmour)} />
          <DerivedRow
            label="Armour rating"
            value={format(stats.defence.blockArmourRating)}
            note="hit chance only"
          />
          {/* null current life means "follow the maximum", so it never goes stale
              when a buff moves the maximum underneath it. */}
          <AutoNumberField
            label="Current HP"
            value={stats.life.currentLife}
            min={0}
            max={stats.life.overhealCeiling}
            auto={loadout.currentLife == null}
            onAutoChange={(auto) =>
              setLoadout({
                ...loadout,
                currentLife: auto ? null : stats.life.currentLife,
                // Keep shared percent aligned when leaving Auto (percent-driven) mode.
                ...(auto
                  ? {}
                  : {
                      currentHealthPercent:
                        stats.life.temporaryMaxLife > 0
                          ? Math.min(
                              100,
                              Math.max(
                                0,
                                (stats.life.currentLife / stats.life.temporaryMaxLife) * 100,
                              ),
                            )
                          : loadout.currentHealthPercent,
                    }),
              })
            }
            onChange={(currentLife) => {
              const max = stats.life.temporaryMaxLife;
              setLoadout({
                ...loadout,
                currentLife,
                currentHealthPercent:
                  max > 0
                    ? Math.min(100, Math.max(0, (currentLife / max) * 100))
                    : loadout.currentHealthPercent,
              });
            }}
          />
          <DerivedRow
            label="Maximum HP"
            value={format(stats.life.temporaryMaxLife)}
            note={
              stats.life.powerburstActive
                ? "Powerburst active"
                : stats.life.temporaryMaxLife !== stats.life.normalMaxLife
                  ? "Includes temporary effects"
                  : undefined
            }
          />
          {stats.life.overhealCeiling > stats.life.temporaryMaxLife ? (
            <DerivedRow label="Overheal cap" value={format(stats.life.overhealCeiling)} />
          ) : null}
        </StatsGroup>

        <StatsGroup title="Combat assumptions">
          <NumberField
            label="Starting adrenaline"
            value={loadout.startingAdrenaline}
            onChange={(startingAdrenaline) =>
              setLoadout({
                ...loadout,
                startingAdrenaline: Math.min(stats.maxAdrenaline, Math.max(0, startingAdrenaline)),
              })
            }
            suffix="%"
          />
          <NumberField
            label="Assumed Damage Potential"
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
          <DerivedRow
            label="Damage Potential"
            value={`${Math.round(stats.dp * 1000) / 10}%`}
            note={stats.damagePotentialSource}
          />
        </StatsGroup>
      </div>
    </div>
  );
}
