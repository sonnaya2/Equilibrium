import { baseCritDamageMultiplier } from "@/combat/core/critical";
import { ticksToSeconds } from "@/combat/core/ticks";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import type { CalcStats } from "./loadoutStats";

export function CalculationAssumptions({
  stats,
  result,
}: {
  stats: CalcStats;
  result?: RotationSummary | null;
}) {
  const manualInputsOnly = stats.baseDamageMode === "manual" && stats.mainhandTier === 0;
  const rows: Array<[string, string | number]> = [
    ["Style / effective level", `${stats.combatStyle} · ${stats.effectiveDamageLevel}`],
    ["Weapon", manualInputsOnly ? "Not applied" : stats.weaponConfiguration],
    ...(manualInputsOnly
      ? []
      : ([
          [
            stats.weaponConfiguration === "twohand" ? "Two-hand tier" : "Main-hand tier",
            stats.mainhandTier,
          ],
          [
            stats.combatStyle === "necromancy" ? "Conduit tier" : "Off-hand tier",
            stats.offhandTier ?? "Not set",
          ],
        ] as Array<[string, string | number]>)),
    ["Equipment style damage", stats.equipmentStyleDamageBonus],
    ["Base-damage mode", stats.baseDamageMode],
    ["Effective base damage", stats.base],
    ["Starting adrenaline", `${stats.startingAdrenaline}%`],
    ["Damage Potential", `${Math.round(stats.dp * 1000) / 10}% · ${stats.damagePotentialSource}`],
    ["Critical chance", `${Math.round(stats.critChance * 1000) / 10}%`],
    [
      "Critical damage",
      `+${Math.round((baseCritDamageMultiplier(stats.level, stats.critDamageBonus) - 1) * 100)}%`,
    ],
    ["30,000 cap", stats.cap.bypass ? "Off" : "On · effect exceptions preserved"],
    ...(stats.activePassives.length > 0
      ? ([["Equipment passives", stats.activePassives.join(", ")]] as Array<
          [string, string | number]
        >)
      : []),
    ...(stats.procs?.cracklingRank || stats.procs?.aftershockRank
      ? ([
          [
            "Invention proc timing",
            "Crackling ready at tick 0; Aftershock starts at 0/50,000 and charges from expected landed damage",
          ],
        ] as Array<[string, string | number]>)
      : []),
  ];
  if (!manualInputsOnly && stats.combatStyle === "magic")
    rows.splice(4, 0, ["Spell tier", stats.spellTier ?? "Not set"]);
  if (!manualInputsOnly && stats.combatStyle === "ranged")
    rows.splice(4, 0, ["Ammunition tier", stats.ammunitionTier ?? "Not set"]);
  if (result) {
    const denominator = Math.round(result.metric.denominatorTicks * 100) / 100;
    rows.push(
      ["DPM metric", result.metric.type],
      ["Damage counted", Math.round(result.metric.damageCounted)],
      [
        "Denominator",
        `${denominator} ticks · ${ticksToSeconds(result.metric.denominatorTicks).toFixed(1)}s`,
      ],
      ["Post-window tails", result.metric.tails],
    );
    if (result.rng) {
      rows.push([
        "Timeline path",
        `${result.rng.representativeClassTicks} ticks · ${(result.rng.representativeClassWeight * 100).toFixed(1)}% terminal class`,
      ]);
    }
  }

  return (
    <details className="border-t border-stone-750 pt-2">
      <summary className="cursor-pointer text-[11px] uppercase tracking-[0.1em] text-parch-300 hover:text-parch-50">
        Assumptions
      </summary>
      <div className="pt-1">
        <dl className="grid gap-x-4 text-xs sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-2 border-b border-stone-750/60 py-1"
            >
              <dt className="text-parch-300">{label}</dt>
              <dd className="text-right font-mono text-parch-50">{value}</dd>
            </div>
          ))}
        </dl>
        {stats.combatStyle.includes("necromancy") ? (
          <p className="mt-2 text-xs text-chaos-300">
            Partial: Haunted and Ghost healing are not included; Spectral Scythe soul rolls remain
            deterministic-only.
          </p>
        ) : null}
      </div>
    </details>
  );
}
