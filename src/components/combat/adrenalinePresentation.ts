/**
 * UI presentation for pure adrenaline transactions.
 * Mirrors previewAdrenalineTransaction; never invents gain/refund math.
 */
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { AdrenalineRules } from "@/combat/engine/simulation/contracts";
import {
  netAdrenalineDeltaFromTransaction,
  previewAdrenalineTransaction,
  type AdrenalineTransaction,
} from "@/combat/shared/adrenalineTransaction";
import { RING_OF_VIGOUR_REFUND } from "@/combat/shared/ringOfVigour";
import type { CalcStats } from "./loadoutStats";

export type AnalysisAdrenRules = Pick<
  AdrenalineRules,
  | "basicAdrenalineFlatBonus"
  | "basicGainMultiplier"
  | "abilityGainMultiplier"
  | "conservationOfEnergyRefund"
  | "ringOfVigour"
>;

/** Same pure path as league analysisAdrenalineDelta; returns full ledger for UI. */
export function analysisAdrenalineTransaction(
  ability: AbilitySpec,
  adren: AnalysisAdrenRules | undefined,
): AdrenalineTransaction {
  return previewAdrenalineTransaction(ability, adren);
}

export function netAdrenalineDelta(tx: AdrenalineTransaction): number {
  return netAdrenalineDeltaFromTransaction(tx);
}

export function formatAdrenPct(value: number, signed = true): string {
  const rounded = Math.round(value * 10) / 10;
  if (!signed) return `${rounded}%`;
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

export type AdrenBreakdownRow = { label: string; value: string };

/** Compact ledger rows for Analysis (skip zero lines). */
export function analysisAdrenalineBreakdownRows(
  tx: AdrenalineTransaction,
): AdrenBreakdownRow[] {
  const rows: AdrenBreakdownRow[] = [];

  if (tx.totalAbilityGain > 0 || tx.listedGain > 0) {
    const parts: string[] = [];
    if (tx.listedGain > 0) parts.push(`listed ${formatAdrenPct(tx.listedGain, false)}`);
    if (tx.furyOfTheSmallGain > 0) parts.push(`FotS ${formatAdrenPct(tx.furyOfTheSmallGain)}`);
    if (tx.invigoratingMultiplier !== 1) {
      parts.push(`Invigorating ×${tx.invigoratingMultiplier.toFixed(2)}`);
    }
    if (tx.abilityGainMultiplier !== 1) {
      parts.push(`AJ ×${tx.abilityGainMultiplier.toFixed(2)}`);
    }
    rows.push({
      label: "Gain",
      value:
        parts.length > 0
          ? `${formatAdrenPct(tx.totalAbilityGain)} (${parts.join(" · ")})`
          : formatAdrenPct(tx.totalAbilityGain),
    });
  }

  if (tx.listedCost > 0 || tx.effectiveCost > 0 || tx.actualSpend > 0) {
    if (tx.listedCost !== tx.effectiveCost) {
      rows.push({
        label: "Cost",
        value: `listed ${tx.listedCost}% · effective ${tx.effectiveCost}%`,
      });
    } else {
      rows.push({ label: "Cost", value: `${tx.actualSpend}%` });
    }
  }

  if (tx.otherImmediateGrants > 0) {
    rows.push({
      label: "Other immediate grants",
      value: formatAdrenPct(tx.otherImmediateGrants),
    });
  }

  if (tx.conservationOfEnergyRefund > 0) {
    rows.push({
      label: "Conservation of Energy",
      value: formatAdrenPct(tx.conservationOfEnergyRefund),
    });
  }
  if (tx.ringOfVigourRefund > 0) {
    rows.push({
      label: "Ring of Vigour",
      value: formatAdrenPct(tx.ringOfVigourRefund),
    });
  }

  rows.push({ label: "Net", value: formatAdrenPct(netAdrenalineDelta(tx)) });
  return rows;
}

/** FotS / Invig / CoE / RoV / Impatient / Relentless / Herald - loadout assumptions only. */
export function adrenEconomyAssumptionRows(
  stats: CalcStats,
): Array<[string, string | number]> {
  const a = stats.adrenaline;
  if (!a && !stats.equipmentEffects?.vestments.heraldOfChaos) return [];
  const rows: Array<[string, string | number]> = [];

  if ((a?.basicAdrenalineFlatBonus ?? 0) > 0) {
    rows.push(["Fury of the Small", `+${a!.basicAdrenalineFlatBonus}% on generating basics`]);
  }
  if ((a?.basicGainMultiplier ?? 1) !== 1) {
    rows.push([
      "Invigorating",
      `×${(a!.basicGainMultiplier ?? 1).toFixed(2)} basic attack adren gain`,
    ]);
  }

  const coe = a?.conservationOfEnergyRefund ?? 0;
  if (coe > 0) {
    rows.push(["Conservation of Energy", `+${coe}% after ultimate`]);
  }
  if (a?.ringOfVigour) {
    rows.push(["Ring of Vigour", `+${RING_OF_VIGOUR_REFUND}% after ultimate · specials 90% listed cost`]);
  }

  if (stats.equipmentEffects?.vestments.heraldOfChaos) {
    rows.push([
      "Herald of Chaos",
      "+15% over 18s after melee ult; +20% if already active (rotation)",
    ]);
  }

  if ((a?.impatientRank ?? 0) > 0) {
    rows.push([
      "Impatient",
      `rank ${a!.impatientRank}${a!.impatientLevel20 ? " · L20" : ""} (rotation RNG)`,
    ]);
  }
  if ((a?.relentlessRank ?? 0) > 0) {
    rows.push([
      "Relentless",
      `rank ${a!.relentlessRank}${a!.relentlessLevel20 ? " · L20" : ""} (rotation RNG)`,
    ]);
  }
  return rows;
}

/** Fingerprint of loadout adren rules that change multi-cast timelines. */
export function adrenEconomyFingerprint(stats: CalcStats): string {
  const a = stats.adrenaline;
  return [
    stats.startingAdrenaline,
    stats.maxAdrenaline,
    a?.basicAdrenalineFlatBonus ?? 0,
    a?.basicGainMultiplier ?? 1,
    a?.abilityGainMultiplier ?? 1,
    a?.conservationOfEnergyRefund ?? 0,
    a?.maxAdrenalineBonus ?? 0,
    a?.impatientRank ?? 0,
    a?.impatientLevel20 ? 1 : 0,
    a?.relentlessRank ?? 0,
    a?.relentlessLevel20 ? 1 : 0,
    a?.ringOfVigour ? 1 : 0,
    stats.equipmentEffects?.vestments.heraldOfChaos ? 1 : 0,
    stats.equipmentEffects?.vestments.increasedAdrenalineCap ? 1 : 0,
  ].join("|");
}
