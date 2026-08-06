import { secondsToTicks } from "../../../core/ticks";
import { isBasicAttack, isGeneratingBasicAbility } from "../../../shared/adrenalineGain";
import {
  resolveAdrenalineTransaction,
  type AdrenalineTransaction,
} from "../../../shared/adrenalineTransaction";
import { resolveUltimateAdrenalineRefunds } from "../../../shared/conservationOfEnergy";
import { RELENTLESS_INTERNAL_CD_SECONDS } from "../../../shared/perks";
import { RING_OF_VIGOUR_REFUND } from "../../../shared/ringOfVigour";
import { METEOR_STRIKE_BASIC_ADREN_MULTIPLIER } from "../../../styles/melee/effects";
import { spendDeathspore } from "../../../styles/ranged/onHit";
import { patchRanged } from "../../runtime/state";
import type { CastEffectContext } from "./context";
import {
  VESTMENTS_INSTANT_ON_REFRESH,
  VESTMENTS_REGEN_SECONDS,
  vestmentsUltimateEligible,
  hasPassive,
} from "../../../shared/equipment";
import { activeBleedCount } from "../../../styles/melee/effects";
import { rngProc } from "../../simulation/contracts";
import {
  livingDeathActive,
  TOUCH_OF_DEATH_LIVING_DEATH_ADRENALINE_BONUS,
} from "../../../styles/necromancy/effects";

/**
 * Cast adren/resources via pure transaction after one Impatient/Relentless roll.
 * Order: listed + FotS + Impatient, Invigorating (basic attacks), AJ mult,
 * otherImmediate (Jaws, Vestments refresh, ToD+LD), spend (Relentless / Deathspore),
 * CoE + RoV, clamp; then Deathspore bookkeeping and Vestments window arm/clear.
 * Timed Vestments regen is the clock ledger (grantVestmentsPassive).
 * https://runescape.wiki/w/Invigorating
 * https://runescape.wiki/w/Basic_attacks
 */

export function applyCastResources(fx: CastEffectContext): AdrenalineTransaction {
  const { rt, ability, candidate, rng } = fx;
  const { cost, spend } = fx.prepared;
  const input = rt.input;
  const adren = input.adrenaline;

  const generating = isGeneratingBasicAbility(ability);
  const basicAttack = isBasicAttack(ability);

  const impatientProc = generating && (adren?.impatientRank ?? 0) > 0 && rngProc(rng, "impatient");

  const relentlessEligible =
    spend > 0 && (adren?.relentlessRank ?? 0) > 0 && candidate >= rt.state.relentlessUntilTick;
  const relentlessProc = relentlessEligible && rngProc(rng, "relentless");

  const meteorBasic =
    ability.style === "melee" &&
    ability.category === "basic" &&
    rt.state.melee.meteorStrikeUntilTick > 0 &&
    candidate < rt.state.melee.meteorStrikeUntilTick;

  let jawsGrant = 0;
  if (
    hasPassive(input.equipmentEffects, "jaws-of-the-abyss") &&
    ability.style === "melee" &&
    ability.category === "basic" &&
    fx.prepared.working.hits.length > 0
  ) {
    const jaws = 2 * activeBleedCount(rt.state.target.melee, candidate);
    jawsGrant = candidate < rt.state.naturalInstinctUntilTick ? jaws * 2 : jaws;
  }

  let vestmentsInstantGrant = 0;
  let vestmentsStartWindow = false;
  let vestmentsCancelWindow = false;
  if (vestmentsUltimateEligible(input.equipmentEffects, ability)) {
    if (candidate < rt.state.vestmentsAdrenalineUntilTick) {
      vestmentsInstantGrant = VESTMENTS_INSTANT_ON_REFRESH;
      vestmentsCancelWindow = true;
    } else {
      vestmentsStartWindow = true;
    }
  }

  let livingDeathTodGrant = 0;
  if (
    ability.id === "touch_of_death" &&
    livingDeathActive(rt.state.necromancy.resources, candidate)
  ) {
    livingDeathTodGrant = TOUCH_OF_DEATH_LIVING_DEATH_ADRENALINE_BONUS;
  }

  const { conservationOfEnergyRefund, ringOfVigourRefund } = resolveUltimateAdrenalineRefunds(
    ability,
    adren,
    RING_OF_VIGOUR_REFUND,
  );

  const spendZeroReason =
    spend === 0 && cost > 0 && ability.style === "ranged" && input.ammo === "deathspore"
      ? ("deathspore" as const)
      : undefined;

  // effectiveCost: amount that would be spent without Relentless/Deathspore prevention.
  // Deathspore zeros prepared.spend while cost remains; ledger keeps requirement as effectiveCost.
  const effectiveCost = spendZeroReason ? cost : spend;
  // Catalogue listed (pre-Vigour/Flow); Analysis uses ability.adrenaline.cost the same way.
  const listedCost =
    typeof ability.adrenaline?.cost === "number" && ability.adrenaline.cost > 0
      ? ability.adrenaline.cost
      : cost;

  const listedGain =
    typeof ability.adrenaline?.gain === "number" && ability.adrenaline.gain > 0
      ? ability.adrenaline.gain
      : 0;

  const otherImmediateGrants = jawsGrant + vestmentsInstantGrant + livingDeathTodGrant;

  const tx = resolveAdrenalineTransaction({
    before: rt.state.adrenaline,
    cap: rt.state.adrenalineCap,
    listedGain,
    listedCost,
    effectiveCost,
    isGeneratingBasicAbility: generating,
    isBasicAttack: basicAttack,
    impatientProc,
    relentlessProc,
    basicAdrenalineFlatBonus: adren?.basicAdrenalineFlatBonus,
    basicGainMultiplier: adren?.basicGainMultiplier,
    abilityGainMultiplier: adren?.abilityGainMultiplier,
    meteorBasicMultiplier: meteorBasic ? METEOR_STRIKE_BASIC_ADREN_MULTIPLIER : 1,
    conservationOfEnergyRefund,
    ringOfVigourRefund,
    otherImmediateGrants,
    spendZeroReason,
  });

  if (tx.spendPreventedBy === "relentless") {
    rt.state = {
      ...rt.state,
      relentlessUntilTick: candidate + secondsToTicks(RELENTLESS_INTERNAL_CD_SECONDS),
    };
  }

  if (tx.afterResources !== rt.state.adrenaline) {
    rt.state = { ...rt.state, adrenaline: tx.afterResources };
  }

  rt.lastCastAdrenalineTransaction = tx;

  if (spendZeroReason === "deathspore") {
    rt.state = patchRanged(rt.state, {
      deathspore: spendDeathspore(rt.state.ranged.deathspore, candidate),
    });
  }

  if (vestmentsCancelWindow) {
    rt.state = { ...rt.state, vestmentsAdrenalineUntilTick: 0 };
  } else if (vestmentsStartWindow) {
    rt.state = {
      ...rt.state,
      vestmentsAdrenalineUntilTick: candidate + secondsToTicks(VESTMENTS_REGEN_SECONDS),
    };
  }

  return tx;
}
