import { ticksToSeconds } from "@/combat/core/ticks";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import type { CalcStats } from "./loadoutStats";

const PERCENT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

/**
 * `scenario-dependent` is deliberately distinct from `not modelled`: the
 * mechanic is implemented and waiting on an input, so its absence from the
 * totals is not a claim that it deals no damage.
 */
const SUPPORT_LABEL: Record<string, string> = {
  modeled: "modelled",
  "partially-modeled": "partially modelled",
  "scenario-dependent": "scenario-dependent",
  "not-modeled": "not modelled",
};

export function CalculationAssumptions({
  stats,
  result,
}: {
  stats: CalcStats;
  result?: RotationSummary | null;
}) {
  const manualInputsOnly = stats.baseDamageMode === "manual" && stats.mainhandTier === 0;
  const barkscalesPicked = stats.league.blessings.some((choice) => choice.id === "barkscales");
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
    ["Damage Potential", `${PERCENT_FORMAT.format(stats.dp)} · ${stats.damagePotentialSource}`],
    ["Critical chance", PERCENT_FORMAT.format(stats.critChance)],
    ["Critical damage", `+${PERCENT_FORMAT.format(stats.totalCritDamageBonus)}`],
    ["30,000 cap", stats.cap.bypass ? "Off" : "On · effect exceptions preserved"],
    ...(stats.league.blessings.length > 0
      ? ([
          ["Equilibrium blessings", stats.league.blessings.map((choice) => choice.name).join(", ")],
          [
            "Blessing support",
            stats.league.blessings
              .map(
                (choice) =>
                  `${choice.name}: ${SUPPORT_LABEL[choice.support.status]}${
                    choice.support.mechanicsUnverified ? " (mechanics unverified)" : ""
                  }`,
              )
              .join("; "),
          ],
        ] as Array<[string, string | number]>)
      : []),
    // Aegis converts armour into flat base damage, so a wrong armour basis or a
    // stale off-hand is invisible in the total. Show the whole conversion.
    ...(stats.aegis.armourPercent > 0
      ? ([
          [
            "Aegis qualifying armour",
            `${formatNumber(stats.aegis.qualifyingArmour)} · ${PERCENT_FORMAT.format(
              stats.aegis.armourPercent,
            )} · off-hand ${stats.aegis.offhand}`,
          ],
          [
            "Aegis base-damage bonus",
            `+${formatNumber(stats.aegis.baseAbilityDamageBonus)} (${formatNumber(
              stats.aegis.excludedBlockArmour,
            )} block-only armour excluded)`,
          ],
        ] as Array<[string, string | number]>)
      : []),
    ...(barkscalesPicked
      ? ([
          [
            "Barkscales",
            stats.barkscales.support === "scenario-dependent"
              ? `No outgoing damage calculated — needs ${stats.barkscales.missingInputs.join(", ").toLowerCase()}`
              : `${stats.barkscales.triggers} Grasp triggers · one per ${stats.barkscales.secondsPerTrigger}s (scenario only — not in rotation damage)`,
          ],
          [
            "Barkscales mitigation",
            `−${formatNumber(stats.barkscales.perHit)} per incoming hit · ${stats.barkscales.hitsPerTrigger} to trigger (incoming damage only)`,
          ],
        ] as Array<[string, string | number]>)
      : []),
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
