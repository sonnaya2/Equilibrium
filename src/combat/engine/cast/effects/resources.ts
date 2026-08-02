import { secondsToTicks } from "../../../core/ticks";
import { IMPATIENT_EXTRA_ADRENALINE, RELENTLESS_INTERNAL_CD_SECONDS } from "../../../shared/perks";
import { METEOR_STRIKE_BASIC_ADREN_MULTIPLIER } from "../../../styles/melee/effects";
import { spendDeathspore } from "../../../styles/ranged/onHit";
import { gainAdrenaline, patchRanged, spendAdrenaline } from "../../runtime/state";
import type { CastEffectContext } from "./context";
import { vestmentsUltimateEligible } from "../../../shared/equipment";
import { hasPassive } from "../../../shared/equipment";
import { activeBleedCount } from "../../../styles/melee/effects";
import { rngProc } from "../../simulation/contracts";

/**
 * Adrenaline and free-cast resources for one cast, in sourced order: gain
 * first (Meteor Strike's basic multiplier, the loadout multiplier, then an
 * Impatient proc), then the spend (refunded outright by a Relentless proc), then
 * the Deathspore charge a free cast consumed.
 *
 * Impatient and Relentless are state-changing RNG: the driver enumerates the
 * outcome and passes it in, so a flat expected value never spends what no real
 * branch could have.
 */
export function applyCastResources(fx: CastEffectContext): void {
  const { rt, ability, candidate, rng } = fx;
  const { cost, spend } = fx.prepared;
  const input = rt.input;

  if (ability.adrenaline?.gain) {
    const isBasic = ability.category === "basic" || !!ability.autoAttack;
    const meteorBasic =
      ability.style === "melee" &&
      ability.category === "basic" &&
      rt.state.melee.meteorStrikeUntilTick > 0 &&
      candidate < rt.state.melee.meteorStrikeUntilTick;
    let gain = meteorBasic
      ? ability.adrenaline.gain * METEOR_STRIKE_BASIC_ADREN_MULTIPLIER
      : ability.adrenaline.gain;
    if (isBasic) {
      gain *= input.adrenaline?.basicGainMultiplier ?? 1;
      if ((input.adrenaline?.impatientRank ?? 0) > 0 && rngProc(rng, "impatient")) {
        gain += IMPATIENT_EXTRA_ADRENALINE;
      }
    }
    gain *= input.adrenaline?.abilityGainMultiplier ?? 1;
    rt.state = gainAdrenaline(rt.state, gain);
  }

  if (
    hasPassive(input.equipmentEffects, "jaws-of-the-abyss") &&
    ability.style === "melee" &&
    ability.category === "basic" &&
    !ability.autoAttack &&
    fx.prepared.working.hits.length > 0
  ) {
    const jaws = 2 * activeBleedCount(rt.state.target.melee, candidate);
    rt.state = gainAdrenaline(
      rt.state,
      candidate < rt.state.naturalInstinctUntilTick ? jaws * 2 : jaws,
    );
  }

  if (spend > 0) {
    // Relentless: on a proc the cost is fully refunded and the perk locks out
    // for 30s instead.
    if (
      (input.adrenaline?.relentlessRank ?? 0) > 0 &&
      candidate >= rt.state.relentlessUntilTick &&
      rngProc(rng, "relentless")
    ) {
      rt.state = {
        ...rt.state,
        relentlessUntilTick: candidate + secondsToTicks(RELENTLESS_INTERNAL_CD_SECONDS),
      };
    } else {
      rt.state = spendAdrenaline(rt.state, spend);
    }
  }

  // A zeroed spend against a real cost is the Deathspore free cast being used.
  if (spend === 0 && cost > 0 && ability.style === "ranged" && input.ammo === "deathspore") {
    rt.state = patchRanged(rt.state, {
      deathspore: spendDeathspore(rt.state.ranged.deathspore, candidate),
    });
  }

  if (vestmentsUltimateEligible(input.equipmentEffects, ability)) {
    if (candidate < rt.state.vestmentsAdrenalineUntilTick) {
      rt.state = gainAdrenaline({ ...rt.state, vestmentsAdrenalineUntilTick: 0 }, 20);
    } else {
      rt.state = {
        ...rt.state,
        vestmentsAdrenalineUntilTick: candidate + secondsToTicks(18),
      };
    }
  }
}

/** Extra adrenaline a style rule grants beyond the ability's listed gain. */
export function grantBonusAdrenaline(fx: CastEffectContext, amount: number): void {
  if (amount > 0) fx.rt.state = gainAdrenaline(fx.rt.state, amount);
}
