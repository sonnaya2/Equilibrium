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
import {
  NARAGI_ACTIVE_DURATION_SECONDS,
  NARAGI_COOLDOWN_SECONDS,
  NARAGI_EDICT_RELIC,
  NARAGI_HEAL_AMOUNT,
  NARAGI_HEAL_COUNT,
  NARAGI_LEVEL_OVERRIDE,
  SLIVER_OF_EDICTS_ID,
  SLIVER_PASSIVE,
} from "@/combat/league/naragiEdict";
import {
  conjurePactAssumptionNote,
  conjureStAreaAssumptionRows,
  rotationHasConjureCast,
} from "./conjurePresentation";
import {
  lordOfLightAssumptionRows,
  strikingLightAssumptionRows,
  temperedHeartAssumptionRows,
} from "./blessingPresentation";
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
  const unholyPicked = stats.league.blessings.some((choice) => choice.id === "unholy-critual");
  const icyenicActive = stats.league.relicNames?.has("Icyenic Faith") === true;
  const naragiActive = stats.league.relicNames?.has(NARAGI_EDICT_RELIC) === true;
  const sliverWorn = stats.equipmentIds?.includes(SLIVER_OF_EDICTS_ID) === true;
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
    [
      "Damage Potential",
      stats.damagePotentialSource === "100% assumption"
        ? PERCENT_FORMAT.format(stats.dp)
        : `${PERCENT_FORMAT.format(stats.dp)} · ${stats.damagePotentialSource}`,
    ],
    ["Critical chance", PERCENT_FORMAT.format(stats.critChance)],
    ...(unholyPicked
      ? ([
          ["Uncapped critical chance", PERCENT_FORMAT.format(stats.uncappedCritChance)],
          ["Effective critical chance", PERCENT_FORMAT.format(stats.critChance)],
          [
            "Converted critical chance",
            `+${PERCENT_FORMAT.format(stats.convertedCritChance)} damage`,
          ],
        ] as Array<[string, string | number]>)
      : []),
    ["Critical damage", `+${PERCENT_FORMAT.format(stats.totalCritDamageBonus)}`],
    ...(result?.playerPoison?.targetState
      ? ([
          ["Current Bik-arrow stacks", formatNumber(result.playerPoison.targetState.bikStacks)],
        ] as Array<[string, string | number]>)
      : []),
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
    // Aegis converts Total Armour Value into flat base damage.
    ...(stats.aegis.armourPercent > 0
      ? ([
          [
            "Aegis Total Armour Value",
            `${formatNumber(stats.defence.blockArmourRating)} · ${PERCENT_FORMAT.format(
              stats.aegis.armourPercent,
            )} · off-hand ${stats.aegis.offhand}`,
          ],
          [
            "Aegis base-damage bonus",
            `+${formatNumber(stats.aegis.baseAbilityDamageBonus)} (Total Armour Value)`,
          ],
        ] as Array<[string, string | number]>)
      : []),
    ...strikingLightAssumptionRows(stats.league.blessings, stats.defence.totalArmour),
    ...lordOfLightAssumptionRows(
      stats.league.blessings,
      stats.defence.totalArmour,
      stats.league.prayerBonus,
      stats.league.areaTargets,
    ),
    ...temperedHeartAssumptionRows(stats.league.blessings),
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
    ...(naragiActive
      ? ([
          [
            "Naragi Edict",
            sliverWorn
              ? `Sliver worn · +${SLIVER_PASSIVE.armour} armour · +${SLIVER_PASSIVE.styleDamage} style damage · +${formatNumber(SLIVER_PASSIVE.life)} Hitpoints · +${SLIVER_PASSIVE.prayer} prayer`
              : "Sliver of Edicts not equipped (pocket) - no passive or activation",
          ],
          [
            "Sliver activation",
            sliverWorn
              ? `${NARAGI_COOLDOWN_SECONDS}s CD · ${NARAGI_ACTIVE_DURATION_SECONDS}s · ${NARAGI_HEAL_COUNT}×${formatNumber(NARAGI_HEAL_AMOUNT)} Hitpoints · levels ${NARAGI_LEVEL_OVERRIDE} · one revive · auto re-use when toggle On`
              : "Equip Sliver to activate in sim",
          ],
        ] as Array<[string, string | number]>)
      : []),
    ...(stats.berserkersFury.active
      ? ([
          [
            "Berserker's Fury",
            `+${PERCENT_FORMAT.format(stats.berserkersFury.bonus)} · ${formatNumber(
              stats.berserkersFury.currentLifePoints,
            )}/${formatNumber(stats.berserkersFury.maximumLifePoints)} Hitpoints (${stats.berserkersFury.currentHealthPercent.toFixed(0)}%) · after roll, before crit · not bleeds`,
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
    ...(rotationHasConjureCast(result?.casts)
      ? ([["Spirit Pact III", conjurePactAssumptionNote(stats.conjureDurationMult ?? 1)]] as Array<
          [string, string | number]
        >)
      : []),
    ...conjureStAreaAssumptionRows(result?.casts),
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
        `${result.rng.representative.ticks} ticks · ${(result.rng.representative.historyWeight * 100).toFixed(1)}% representative history`,
      ]);
    }
    for (const row of stochasticAssumptionRows(result)) {
      rows.push(row);
    }
  }

  return (
    <details className="calculation-assumptions">
      <summary>Assumptions</summary>
      <div className="calculation-assumptions__body">
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {stats.combatStyle.includes("necromancy") ? (
          <p className="calculation-assumptions__note">
            Partial: Phantom Guardian defence is unmodeled; Ghost heal uses final basic damage.
          </p>
        ) : null}
      </div>
    </details>
  );
}
