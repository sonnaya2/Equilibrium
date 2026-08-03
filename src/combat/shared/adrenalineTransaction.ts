/**
 * Pure adrenaline transaction for one cast. No RNG; procs must be pre-resolved.
 * https://runescape.wiki/w/Invigorating
 * https://runescape.wiki/w/Basic_attacks
 * https://runescape.wiki/w/Conservation_of_Energy
 * https://runescape.wiki/w/Ring_of_vigour
 */

import {
  resolveAbilityAdrenalineGainBreakdown,
  type AbilityAdrenalineGainInput,
} from "./adrenalineGain";

export type SpendPreventedBy =
  | "none"
  | "relentless"
  | "deathspore"
  | "avernic-rampage"
  | string;

export interface AdrenalineTransaction {
  before: number;
  cap: number;

  listedGain: number;
  furyOfTheSmallGain: number;
  impatientGain: number;
  gainBeforeInvigorating: number;
  invigoratingMultiplier: number;
  gainAfterInvigorating: number;
  abilityGainMultiplier: number;
  totalAbilityGain: number;

  listedCost: number;
  effectiveCost: number;
  actualSpend: number;
  spendPreventedBy: SpendPreventedBy;

  conservationOfEnergyRefund: number;
  ringOfVigourRefund: number;
  /** Jaws etc. when folded in by the caller. */
  otherImmediateGrants: number;

  /** clamp(before + gain + other - spend + coe + vigour, 0, cap) */
  afterResources: number;
  /** Unclamped intermediate for tests. */
  afterResourcesUnclamped: number;
}

export interface AdrenalineTransactionInput extends AbilityAdrenalineGainInput {
  before: number;
  cap: number;
  listedCost: number;
  /** Vigour-discounted special cost; amount that would be spent without prevention. */
  effectiveCost: number;
  relentlessProc: boolean;
  /** 0 or 10; caller gates on ultimate + not Onslaught. */
  conservationOfEnergyRefund?: number;
  /** 0 or 10; never double equipped+passive. */
  ringOfVigourRefund?: number;
  otherImmediateGrants?: number;
  /**
   * prepared.spend === 0 while cost > 0 (Deathspore free cast, etc.).
   * Relentless is separate via relentlessProc and wins when both apply.
   */
  spendZeroReason?: Exclude<SpendPreventedBy, "none" | "relentless">;
}

function clampAdrenaline(value: number, cap: number): number {
  if (value < 0) return 0;
  if (value > cap) return cap;
  return value;
}

export function resolveAdrenalineTransaction(
  input: AdrenalineTransactionInput,
): AdrenalineTransaction {
  const gain = resolveAbilityAdrenalineGainBreakdown(input);

  const listedCost = Math.max(0, input.listedCost);
  const effectiveCost = Math.max(0, input.effectiveCost);

  let actualSpend = effectiveCost;
  let spendPreventedBy: SpendPreventedBy = "none";

  if (input.relentlessProc && effectiveCost > 0) {
    actualSpend = 0;
    spendPreventedBy = "relentless";
  } else if (input.spendZeroReason) {
    actualSpend = 0;
    spendPreventedBy = input.spendZeroReason;
  }

  const conservationOfEnergyRefund = Math.max(0, input.conservationOfEnergyRefund ?? 0);
  const ringOfVigourRefund = Math.max(0, input.ringOfVigourRefund ?? 0);
  const otherImmediateGrants = Math.max(0, input.otherImmediateGrants ?? 0);

  const afterResourcesUnclamped =
    input.before +
    gain.totalAbilityGain +
    otherImmediateGrants -
    actualSpend +
    conservationOfEnergyRefund +
    ringOfVigourRefund;

  const afterResources = clampAdrenaline(afterResourcesUnclamped, input.cap);

  return {
    before: input.before,
    cap: input.cap,
    ...gain,
    listedCost,
    effectiveCost,
    actualSpend,
    spendPreventedBy,
    conservationOfEnergyRefund,
    ringOfVigourRefund,
    otherImmediateGrants,
    afterResources,
    afterResourcesUnclamped,
  };
}
