"use client";

import { useState } from "react";
import { calculateAbility } from "@/combat/pipeline/calculateAbility";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { CombatStyle } from "@/combat/types";
import { MELEE_ABILITIES, type MeleeAbilitySpec } from "@/combat/styles/melee/abilities";
import { RANGED_ABILITIES, type RangedAbilitySpec } from "@/combat/styles/ranged/abilities";
import { MAGIC_ABILITIES, type MagicAbilitySpec } from "@/combat/styles/magic/abilities";
import {
  MAX_SOULS,
  NECROMANCY_ABILITIES,
  VOLLEY_MIN_SOULS,
  volleyOfSouls,
} from "@/combat/styles/necromancy/abilities";
import { abilityIconPath, styleIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { AbilityCategoryChip } from "./AbilityCategoryChip";
import { NumberField } from "./NumberField";

const STYLE_ABILITIES: Record<CombatStyle, AbilitySpec[]> = {
  melee: MELEE_ABILITIES,
  ranged: RANGED_ABILITIES,
  magic: MAGIC_ABILITIES,
  necromancy: NECROMANCY_ABILITIES,
};

const STYLE_LABELS: Record<CombatStyle, string> = {
  melee: "Melee",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
};

const AVAILABLE_STYLES: CombatStyle[] = ["melee", "ranged", "magic", "necromancy"];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

/** Number inputs yield NaN/Infinity on partial input or 1e999 — keep them out of the engine. */
function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function firstDamagingId(style: CombatStyle): string {
  const first = STYLE_ABILITIES[style].find((a) => a.hits.length > 0);
  return first?.id ?? STYLE_ABILITIES[style][0]?.id ?? "attack";
}

/** Quick palette: damaging casts always; conjure_* (empty hits) listed as summons when present. */
function necroPalette(souls: number): AbilitySpec[] {
  const clamped = Math.min(Math.max(VOLLEY_MIN_SOULS, Math.floor(souls)), MAX_SOULS);
  const fromKit = NECROMANCY_ABILITIES.filter(
    (a) => a.hits.length > 0 || a.id.startsWith("conjure_"),
  );
  return [...fromKit, volleyOfSouls(clamped)];
}

function hitBandLabel(a: AbilitySpec): string {
  if (a.hits.length === 0) {
    return a.id.startsWith("conjure_") ? "summon" : "—";
  }
  const multi = a.hits.length > 1 ? `${a.hits.length}× ` : "";
  return `${multi}${a.hits[0].band.minPct}–${a.hits[0].band.maxPct}%`;
}

function abilityMeta(ability: AbilitySpec): string {
  // Category is shown as a chip next to the name — meta is the rest only.
  return [
    ability.adrenaline?.gain ? `+${ability.adrenaline.gain}% adrenaline` : null,
    ability.adrenaline?.cost ? `${ability.adrenaline.cost}% adrenaline cost` : null,
    ability.cooldownSeconds ? `${ability.cooldownSeconds}s cooldown` : null,
    (ability as RangedAbilitySpec).guaranteedCrit ? "guaranteed crit" : null,
    (ability as MagicAbilitySpec).requiresAnima ? "needs an active Runic Charge" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function QuickCalculator() {
  const [style, setStyle] = useState<CombatStyle>("melee");
  const [level, setLevel] = useState(99);
  const [base, setBase] = useState(1000);
  const [accuracy, setAccuracy] = useState(100);
  const [critChance, setCritChance] = useState(10);
  const [abilityId, setAbilityId] = useState("attack");
  const [souls, setSouls] = useState(3);

  // Quick is for damaging casts; buff-only records (e.g. Living Death) live on Rotation.
  // Necromancy: full post-CSM kit + Volley scaled by Residual Souls.
  const palette = style === "necromancy" ? necroPalette(souls) : STYLE_ABILITIES[style].filter((a) => a.hits.length > 0);
  const ability = palette.find((a) => a.id === abilityId) ?? palette[0];
  const selectedId = ability?.id;

  const result =
    ability && ability.hits.length > 0
      ? calculateAbility(ability, {
          base: Math.max(0, finite(base, 0)),
          level: Math.min(Math.max(1, finite(level, 99)), 145),
          accuracy: Math.min(Math.max(0, finite(accuracy, 100)), 100) / 100,
          crit: {
            chance: Math.min(Math.max(0, finite(critChance, 10)), 100) / 100,
            guaranteed: (ability as RangedAbilitySpec).guaranteedCrit,
          },
          context: { style },
        })
      : null;

  return (
    <div className="combat-quick">
      <div
        className="flex flex-wrap items-center gap-2 border-b border-stone-750 px-2 py-1.5"
        style={{ background: "var(--echo-shell, var(--color-stone-900))" }}
      >
        <h2 className="m-0 text-[15px] font-medium text-parch-50">Quick</h2>
        <span className="font-mono text-[11px] text-parch-300">facet desk · live math</span>
        <div role="group" aria-label="Combat style" className="ml-auto flex flex-wrap gap-1">
          {AVAILABLE_STYLES.map((s) => {
            const active = style === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStyle(s);
                  setAbilityId(firstDamagingId(s));
                }}
                aria-pressed={active}
                className={`comp-facet inline-flex items-center gap-1.5${active ? " is-on" : ""}`}
              >
                <GameIcon src={styleIconPath(s)} size={14} />
                {STYLE_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="combat-quick-grid">
        <section className="flex min-h-0 flex-col border-r border-stone-750">
          <div className="grid grid-cols-2 gap-x-2 border-b border-stone-750 px-2 sm:grid-cols-4">
            <NumberField label={`${STYLE_LABELS[style]} level`} value={level} onChange={setLevel} />
            <NumberField label="Base ability damage" value={base} onChange={setBase} />
            <NumberField label="Accuracy" value={accuracy} onChange={setAccuracy} suffix="%" />
            <NumberField label="Crit chance" value={critChance} onChange={setCritChance} suffix="%" />
            {style === "necromancy" && selectedId === "volley_of_souls" ? (
              <NumberField
                label="Residual Souls"
                value={souls}
                onChange={(value) =>
                  setSouls(Math.min(Math.max(VOLLEY_MIN_SOULS, Math.floor(value)), MAX_SOULS))
                }
              />
            ) : null}
          </div>

          <div
            role="listbox"
            aria-label={`${STYLE_LABELS[style]} abilities`}
            className="combat-ability-scroll"
          >
            <table className="comp-table w-full">
              <thead>
                <tr>
                  <th scope="col">Ability</th>
                  <th scope="col">Band</th>
                </tr>
              </thead>
              <tbody>
                {palette.map((a) => {
                  const selected = a.id === selectedId;
                  return (
                    <tr
                      key={a.id}
                      role="option"
                      aria-selected={selected}
                      className={selected ? "is-selected" : undefined}
                      tabIndex={0}
                      onClick={() => setAbilityId(a.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setAbilityId(a.id);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="font-medium">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <GameIcon
                            src={abilityIconPath(a.id, a.style)}
                            size={18}
                            className="shrink-0"
                          />
                          <span className="min-w-0 truncate">{a.name}</span>
                          <AbilityCategoryChip category={a.category} />
                        </span>
                      </td>
                      <td className="mono secondary">{hitBandLabel(a)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      {ability && result ? (
        <div className="panel panel--facet min-w-0">
          <div className="panel-head flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 flex min-w-0 items-center gap-2 text-inherit font-medium">
              <GameIcon
                src={abilityIconPath(ability.id, ability.style)}
                size={22}
                className="shrink-0"
              />
              <span className="min-w-0 truncate">{ability.name}</span>
              <AbilityCategoryChip category={ability.category} />
            </h3>
            <span className="font-mono text-[11px] font-normal normal-case tracking-normal text-parch-300">
              {hitBandLabel(ability)}
            </span>
          </div>
          <div className="panel-body space-y-3">
            <p className="text-xs leading-5 text-parch-300">{abilityMeta(ability)}</p>

            <div className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-stone-750 pb-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-parch-300">Expected</div>
                <div className="stat-key mt-1">{formatNumber(result.expected)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-parch-300">Min – max</div>
                <div className="mt-1 font-mono text-lg text-parch-50">
                  {formatNumber(result.min)} – {formatNumber(result.max)}
                </div>
              </div>
            </div>

            <dl className="text-sm">
              <div className="grid grid-cols-2 border-b border-stone-750/70 py-1.5">
                <dt className="text-parch-300">Crit min – max</dt>
                <dd className="text-right font-mono text-parch-50">
                  {formatNumber(result.hits.reduce((n, h) => n + h.critMin, 0))} –{" "}
                  {formatNumber(result.hits.reduce((n, h) => n + h.critMax, 0))}
                </dd>
              </div>
              <div className="grid grid-cols-2 border-b border-stone-750/70 py-1.5">
                <dt className="text-parch-300">Damage Potential</dt>
                <dd className="text-right font-mono text-parch-50">
                  {Math.round((result.hits[0]?.potential ?? 0) * 1000) / 10}%
                </dd>
              </div>
              <div className="grid grid-cols-2 border-b border-stone-750/70 py-1.5">
                <dt className="text-parch-300">Adrenaline after cast</dt>
                <dd className="text-right font-mono text-parch-50">
                  {result.adrenalineDelta >= 0 ? "+" : ""}
                  {result.adrenalineDelta}%
                </dd>
              </div>
              {(ability as MeleeAbilitySpec).bloodlustGain ? (
                <div className="grid grid-cols-2 border-b border-stone-750/70 py-1.5">
                  <dt className="text-parch-300">Bloodlust</dt>
                  <dd className="text-right font-mono text-parch-50">
                    +{(ability as MeleeAbilitySpec).bloodlustGain} stack
                    {(ability as MeleeAbilitySpec).bloodlustGain! > 1 ? "s" : ""}
                  </dd>
                </div>
              ) : null}
              {(ability as MeleeAbilitySpec).bloodlustScale ? (
                <div className="grid grid-cols-2 border-b border-stone-750/70 py-1.5">
                  <dt className="text-parch-300">
                    At {(ability as MeleeAbilitySpec).bloodlustScale!.threshold} Bloodlust
                  </dt>
                  <dd className="text-right font-mono text-parch-50">
                    {(ability as MeleeAbilitySpec).bloodlustScale!.band.minPct}–
                    {(ability as MeleeAbilitySpec).bloodlustScale!.band.maxPct}% per hit
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      ) : ability && ability.hits.length === 0 ? (
        <div className="panel panel--facet min-w-0">
          <div className="panel-head">
            <h3 className="m-0 flex items-center gap-2 text-inherit font-medium">
              <GameIcon
                src={abilityIconPath(ability.id, ability.style)}
                size={22}
                className="shrink-0"
              />
              <span>{ability.name}</span>
              <AbilityCategoryChip category={ability.category} />
            </h3>
          </div>
          <div className="panel-body">
            <p className="text-xs leading-5 text-parch-300">{abilityMeta(ability) || "Summon"}</p>
            <p className="mt-2 text-sm text-parch-300">
              No damage hits — summons and buffs do not produce an expected damage figure here.
            </p>
          </div>
        </div>
      ) : (
        <div className="panel panel--facet min-w-0 p-3 text-sm text-parch-300">
          Select an ability.
        </div>
      )}
      </div>
    </div>
  );
}
