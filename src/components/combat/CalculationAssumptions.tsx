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

const SUPPORT_LABEL: Record<string, string> = {
  modeled: "on",
  "partially-modeled": "partial",
  "scenario-dependent": "needs input",
  "not-modeled": "off",
};

export function CalculationAssumptions({
  stats,
  result,
  variant = "details",
  heading = "Assumptions",
}: {
  stats: CalcStats;
  result?: RotationSummary | null;
  /** details = collapsible; panel = always open, fills parent. */
  variant?: "details" | "panel";
  /** Null hides the inner title (parent supplies one). */
  heading?: string | null;
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
    ["Style", `${stats.combatStyle} · ${stats.effectiveDamageLevel}`],
    ["Weapon", manualInputsOnly ? "—" : stats.weaponConfiguration],
    ...(manualInputsOnly
      ? []
      : ([
          [
            stats.weaponConfiguration === "twohand" ? "Two-hand" : "Main-hand",
            stats.mainhandTier,
          ],
          [
            stats.combatStyle === "necromancy" ? "Conduit" : "Off-hand",
            stats.offhandTier ?? "—",
          ],
        ] as Array<[string, string | number]>)),
    ["Style damage", stats.equipmentStyleDamageBonus],
    ["Base mode", stats.baseDamageMode],
    ["Base damage", stats.base],
    ["Start adren", `Open at max (${stats.maxAdrenaline}%)`],
    ["Max adren", `${stats.maxAdrenaline}%`],
    ...adrenEconomyAssumptionRows(stats),
    [
      "Damage Potential",
      stats.damagePotentialSource === "100% assumption"
        ? PERCENT_FORMAT.format(stats.dp)
        : `${PERCENT_FORMAT.format(stats.dp)} · ${stats.damagePotentialSource}`,
    ],
    ["Crit chance", PERCENT_FORMAT.format(stats.critChance)],
    ...(unholyPicked
      ? ([
          ["Uncapped crit", PERCENT_FORMAT.format(stats.uncappedCritChance)],
          ["Crit (capped)", PERCENT_FORMAT.format(stats.critChance)],
          ["Crit → damage", `+${PERCENT_FORMAT.format(stats.convertedCritChance)}`],
        ] as Array<[string, string | number]>)
      : []),
    ["Crit damage", `+${PERCENT_FORMAT.format(stats.totalCritDamageBonus)}`],
    ...(result?.playerPoison?.targetState
      ? ([
          ["Bik stacks", formatNumber(result.playerPoison.targetState.bikStacks)],
        ] as Array<[string, string | number]>)
      : []),
    ["Hit cap", stats.cap.bypass ? "Off" : "On (30k)"],
    ...(stats.league.blessings.length > 0
      ? ([
          ["Blessings", stats.league.blessings.map((choice) => choice.name).join(", ")],
          [
            "Blessing status",
            stats.league.blessings
              .map(
                (choice) =>
                  `${choice.name}: ${SUPPORT_LABEL[choice.support.status] ?? choice.support.status}`,
              )
              .join("; "),
          ],
        ] as Array<[string, string | number]>)
      : []),
    ...(stats.aegis.armourPercent > 0
      ? ([
          [
            "Aegis armour",
            `${formatNumber(stats.defence.blockArmourRating)} · ${PERCENT_FORMAT.format(
              stats.aegis.armourPercent,
            )}`,
          ],
          ["Aegis base", `+${formatNumber(stats.aegis.baseAbilityDamageBonus)}`],
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
      ? ([["Big Boned", BIG_BONED_OUTGOING_ASSUMPTIONS.join("; ")]] as Array<
          [string, string | number]
        >)
      : []),
    ...(barkscalesPicked
      ? ([
          ["Barkscales", barkscalesGraspNote(stats.barkscales)],
          [
            "Barkscales mit.",
            `−${formatNumber(stats.barkscales.perHit)} / hit · ${stats.barkscales.hitsPerTrigger} to trigger`,
          ],
        ] as Array<[string, string | number]>)
      : []),
    ...(icyenicActive
      ? ([
          [
            "Icyenic Faith",
            stats.tomeOfTheIcyeneWorn
              ? `Tome · Prayer ${formatNumber(stats.icyenic.totalPrayerBonus)} · +${PERCENT_FORMAT.format(
                  stats.icyenic.critChanceBonus,
                )} crit · ×${stats.icyenic.baseAbilityDamageMultiplier.toFixed(3)} base`
              : "No Tome of the Icyene",
          ],
          ["Icyenic protect", icyenicProtectionNote(stats.icyenicProtection)],
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
              ? `Sliver · +${SLIVER_PASSIVE.armour} armour · +${SLIVER_PASSIVE.styleDamage} style · +${formatNumber(SLIVER_PASSIVE.life)} LP · +${SLIVER_PASSIVE.prayer} prayer`
              : "No Sliver of Edicts",
          ],
          [
            "Sliver use",
            sliverWorn
              ? `${NARAGI_COOLDOWN_SECONDS}s CD · ${NARAGI_ACTIVE_DURATION_SECONDS}s · ${NARAGI_HEAL_COUNT}×${formatNumber(NARAGI_HEAL_AMOUNT)} LP · lv ${NARAGI_LEVEL_OVERRIDE}`
              : "Equip Sliver",
          ],
        ] as Array<[string, string | number]>)
      : []),
    ...(stats.berserkersFury.active
      ? ([
          [
            "Berserker's Fury",
            `+${PERCENT_FORMAT.format(stats.berserkersFury.bonus)} · ${formatNumber(
              stats.berserkersFury.currentLifePoints,
            )}/${formatNumber(stats.berserkersFury.maximumLifePoints)} LP`,
          ],
        ] as Array<[string, string | number]>)
      : []),
    ...(stats.league.relics?.length
      ? ([["Relics", stats.league.relics.join(", ")]] as Array<[string, string | number]>)
      : []),
    ...(stats.activePassives.length > 0
      ? ([["Passives", stats.activePassives.join(", ")]] as Array<[string, string | number]>)
      : []),
    ...(stats.procs?.cracklingRank || stats.procs?.aftershockRank
      ? ([["Invention", "Crackling ready t0; Aftershock charges from damage"]] as Array<
          [string, string | number]
        >)
      : []),
    ...((stats.caromingRank ?? 0) > 0
      ? ([
          [
            "Caroming",
            `rank ${stats.caromingRank} · +${(stats.caromingRank ?? 0) * 4}% AD per Ricochet/GRico hit`,
          ],
        ] as Array<[string, string | number]>)
      : []),
    ...((stats.preciseRank ?? 0) > 0
      ? ([["Precise", `rank ${stats.preciseRank}`]] as Array<[string, string | number]>)
      : []),
    ...(rotationHasConjureCast(result?.casts)
      ? ([["Spirit Pact III", conjurePactAssumptionNote(stats.conjureDurationMult ?? 1)]] as Array<
          [string, string | number]
        >)
      : []),
    ...conjureStAreaAssumptionRows(result?.casts),
  ];
  if (!manualInputsOnly && stats.combatStyle === "magic")
    rows.splice(4, 0, ["Spell tier", stats.spellTier ?? "—"]);
  if (!manualInputsOnly && stats.combatStyle === "ranged")
    rows.splice(4, 0, ["Ammo tier", stats.ammunitionTier ?? "—"]);
  if (result) {
    const denominator = Math.round(result.metric.denominatorTicks * 100) / 100;
    rows.push(
      ["Metric", result.metric.type],
      ["Damage", Math.round(result.metric.damageCounted)],
      [
        "Window",
        `${denominator} ticks · ${ticksToSeconds(result.metric.denominatorTicks).toFixed(1)}s`,
      ],
      ["Tails", result.metric.tails],
    );
    if (result.rng) {
      rows.push([
        "Path",
        `${result.rng.representative.ticks} ticks · ${(result.rng.representative.historyWeight * 100).toFixed(1)}%`,
      ]);
    }
    for (const row of stochasticAssumptionRows(result)) {
      rows.push(row);
    }
  }

  const body = (
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
          Necro: Phantom Guardian defence off; Ghost heal uses final basic.
        </p>
      ) : null}
    </div>
  );

  if (variant === "panel") {
    return (
      <div className="calculation-assumptions calculation-assumptions--panel">
        {heading ? <h3 className="calculation-assumptions__title">{heading}</h3> : null}
        {body}
      </div>
    );
  }

  return (
    <details className="calculation-assumptions">
      <summary>{heading ?? "Assumptions"}</summary>
      {body}
    </details>
  );
}
