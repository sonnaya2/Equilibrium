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
import { styleIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
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
    <div className="grid gap-5 py-5 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-medium text-parch-50">Quick</h2>
        <p className="mt-1 text-xs text-parch-300">
          Full post-CSM kit for every style. Necromancy Residual Souls scale Volley of Souls.
        </p>
        <div className="mt-3 flex gap-1">
          {AVAILABLE_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStyle(s);
                setAbilityId(firstDamagingId(s));
              }}
              className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs ${
                style === s
                  ? "border-stone-700 bg-stone-850 text-parch-50"
                  : "border-stone-750 text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
              }`}
            >
              <GameIcon src={styleIconPath(s)} size={16} />
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="mt-3 border-t border-stone-750">
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
        <div className="mt-3 border-t border-stone-750">
          {palette.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAbilityId(a.id)}
              className={`grid w-full grid-cols-[1fr_auto] gap-2 border-b border-stone-750/70 px-2 py-2 text-left text-xs ${
                a.id === selectedId ? "bg-stone-850 text-parch-50" : "text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
              }`}
            >
              <span>{a.name}</span>
              <span className="font-mono">{hitBandLabel(a)}</span>
            </button>
          ))}
        </div>
      </div>

      {ability && result ? (
        <div>
          <h2 className="text-sm font-medium text-parch-50">{ability.name}</h2>
          <p className="mt-1 text-xs text-parch-300">
            {[
              ability.category,
              ability.adrenaline?.gain ? `+${ability.adrenaline.gain}% adrenaline` : null,
              ability.adrenaline?.cost ? `${ability.adrenaline.cost}% adrenaline cost` : null,
              ability.cooldownSeconds ? `${ability.cooldownSeconds}s cooldown` : null,
              (ability as RangedAbilitySpec).guaranteedCrit ? "guaranteed crit" : null,
              (ability as MagicAbilitySpec).requiresAnima ? "needs an active Runic Charge" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <dl className="mt-3 border-t border-stone-750 text-sm">
            <div className="grid grid-cols-2 border-b border-stone-750/70 py-2">
              <dt className="text-parch-300">Expected</dt>
              <dd className="text-right font-mono text-parch-50">{formatNumber(result.expected)}</dd>
            </div>
            <div className="grid grid-cols-2 border-b border-stone-750/70 py-2">
              <dt className="text-parch-300">Min – max</dt>
              <dd className="text-right font-mono text-parch-50">
                {formatNumber(result.min)} – {formatNumber(result.max)}
              </dd>
            </div>
            <div className="grid grid-cols-2 border-b border-stone-750/70 py-2">
              <dt className="text-parch-300">Crit min – max</dt>
              <dd className="text-right font-mono text-parch-50">
                {formatNumber(result.hits.reduce((n, h) => n + h.critMin, 0))} –{" "}
                {formatNumber(result.hits.reduce((n, h) => n + h.critMax, 0))}
              </dd>
            </div>
            <div className="grid grid-cols-2 border-b border-stone-750/70 py-2">
              <dt className="text-parch-300">Damage Potential</dt>
              <dd className="text-right font-mono text-parch-50">
                {Math.round((result.hits[0]?.potential ?? 0) * 1000) / 10}%
              </dd>
            </div>
            <div className="grid grid-cols-2 border-b border-stone-750/70 py-2">
              <dt className="text-parch-300">Adrenaline after cast</dt>
              <dd className="text-right font-mono text-parch-50">
                {result.adrenalineDelta >= 0 ? "+" : ""}
                {result.adrenalineDelta}%
              </dd>
            </div>
            {(ability as MeleeAbilitySpec).bloodlustGain ? (
              <div className="grid grid-cols-2 border-b border-stone-750/70 py-2">
                <dt className="text-parch-300">Bloodlust</dt>
                <dd className="text-right font-mono text-parch-50">
                  +{(ability as MeleeAbilitySpec).bloodlustGain} stack{(ability as MeleeAbilitySpec).bloodlustGain! > 1 ? "s" : ""}
                </dd>
              </div>
            ) : null}
            {(ability as MeleeAbilitySpec).bloodlustScale ? (
              <div className="grid grid-cols-2 border-b border-stone-750/70 py-2">
                <dt className="text-parch-300">At {(ability as MeleeAbilitySpec).bloodlustScale!.threshold} Bloodlust</dt>
                <dd className="text-right font-mono text-parch-50">
                  {(ability as MeleeAbilitySpec).bloodlustScale!.band.minPct}–
                  {(ability as MeleeAbilitySpec).bloodlustScale!.band.maxPct}% per hit
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
