import { ticksToSeconds } from "@/combat/core/ticks";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import type { CalcStats } from "./loadoutStats";
import { adrenEconomyAssumptionRows } from "./adrenalinePresentation";
import { BIG_BONED_OUTGOING_ASSUMPTIONS } from "@/combat/league/ruleset";
import { barkscalesGraspNote } from "@/combat/league/barkscales";
import {
  icyenicProtectionNote,
  icyenicSoulSplitHeal,
  icyenicSoulSplitNote,
} from "@/combat/league/icyenicFaith";
import { stochasticAssumptionRows } from "./revoStochasticLabels";

const PERCENT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

/** scenario-dependent: implemented but waiting on an input; not a zero-damage claim. */
const SUPPORT_LABEL: Record<string, string> = {
  modeled: "active",
  "partially-modeled": "partial",
  "scenario-dependent": "scenario",
  "not-modeled": "unmodeled",
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
  const bigBonedPicked = stats.league.blessings.some((choice) => choice.id === "big-boned");
  const icyenicActive = stats.league.relicNames?.has("Icyenic Faith") === true;
  const protectOn =
    icyenicActive &&
    stats.icyenicProtection.unavailability !== "protection-off" &&
    stats.icyenicProtection.unavailability !== "relic-inactive";
  const icyenicSoulSplit = icyenicSoulSplitHeal(result?.totalExpected ?? 0, {
    relicActive: icyenicActive,
    protectionActive: protectOn,
  });
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
    ["Max adrenaline", `${stats.maxAdrenaline}%`],
    ...adrenEconomyAssumptionRows(stats),
    ["Damage Potential", `${PERCENT_FORMAT.format(stats.dp)} · ${stats.damagePotentialSource}`],
    ["Critical chance", PERCENT_FORMAT.format(stats.critChance)],
    ["Critical damage", `+${PERCENT_FORMAT.format(stats.totalCritDamageBonus)}`],
    ["30,000 cap", stats.cap.bypass ? "Off" : "On · effect exceptions"],
    ...(stats.league.blessings.length > 0
      ? ([
          ["Equilibrium blessings", stats.league.blessings.map((choice) => choice.name).join(", ")],
          [
            "Blessing support",
            stats.league.blessings
              .map(
                (choice) =>
                  `${choice.name}: ${SUPPORT_LABEL[choice.support.status]}${
                    choice.support.mechanicsUnverified ? " (unverified)" : ""
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
    ...(bigBonedPicked
      ? ([["Big Boned outgoing", BIG_BONED_OUTGOING_ASSUMPTIONS.join("; ")]] as Array<
          [string, string | number]
        >)
      : []),
    ...(barkscalesPicked
      ? ([
          ["Barkscales", barkscalesGraspNote(stats.barkscales)],
          [
            "Barkscales mitigation",
            `−${formatNumber(stats.barkscales.perHit)} per incoming hit · ${stats.barkscales.hitsPerTrigger} to trigger (incoming damage only)`,
          ],
        ] as Array<[string, string | number]>)
      : []),
    ...(icyenicActive
      ? ([
          [
            "Icyenic Faith",
            stats.tomeOfTheIcyeneWorn
              ? `Tome worn · Prayer ${formatNumber(stats.icyenic.totalPrayerBonus)} · +${PERCENT_FORMAT.format(
                  stats.icyenic.critChanceBonus,
                )} crit · ×${stats.icyenic.baseAbilityDamageMultiplier.toFixed(3)} base AD`
              : "Tome of the Icyene not equipped (pocket) - no prayer scaling",
          ],
          ["Icyenic protection", icyenicProtectionNote(stats.icyenicProtection)],
          [
            "Icyenic Soul Split",
            icyenicSoulSplitNote(icyenicSoulSplit, {
              relicActive: icyenicActive,
              protectionActive: protectOn,
            }),
          ],
        ] as Array<[string, string | number]>)
      : []),
    ...(stats.berserkersFury.active
      ? ([
          [
            "Berserker's Fury",
            `+${PERCENT_FORMAT.format(stats.berserkersFury.bonus)} · ${formatNumber(
              stats.berserkersFury.currentLifePoints,
            )}/${formatNumber(stats.berserkersFury.maximumLifePoints)} LP (${stats.berserkersFury.currentHealthPercent.toFixed(0)}%) · after roll, before crit · not bleeds`,
          ],
        ] as Array<[string, string | number]>)
      : []),
    ...(stats.league.relics?.length
      ? ([["Equilibrium relics", stats.league.relics.join(", ")]] as Array<
          [string, string | number]
        >)
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
    for (const row of stochasticAssumptionRows(result)) {
      rows.push(row);
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
            Partial: no Haunted or Ghost healing; Spectral Scythe soul rolls are fixed.
          </p>
        ) : null}
      </div>
    </details>
  );
}
