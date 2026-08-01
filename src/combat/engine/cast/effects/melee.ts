import { secondsToTicks } from "../../../core/ticks";
import { activateBerserk, BERSERK_DURATION_SECONDS } from "../../../styles/melee/bloodlust";
import {
  BLEED_CHAIN_RECAST_WINDOW_TICKS,
  CHAOS_ROAR_DURATION_SECONDS,
  GREATER_FURY_CRIT_WINDOW_SECONDS,
  isMeleeAbility,
} from "../../../styles/melee/abilities";
import {
  GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS,
  METEOR_STRIKE_DURATION_SECONDS,
} from "../../../styles/melee/effects";
import { gainMeleeBloodlust, patchMelee } from "../../runtime/state";
import type { CastEffectContext } from "./context";

/**
 * Immediate melee cast-state changes: Bloodlust generation, the Berserk window,
 * the next-hit grants (Chaos Roar / Fury / Greater Fury), Meteor Strike's
 * adrenaline window, Greater Flurry's Berserk extension, and the Dismember
 * recast chain. Consumption of the next-hit windows happened in prepared.ts.
 */
export function applyMeleeCastEffects(fx: CastEffectContext): void {
  const { rt, ability, working, candidate } = fx;
  const melee = isMeleeAbility(ability) ? ability : null;

  if (melee?.bloodlustGain) {
    rt.state = gainMeleeBloodlust(rt.state, melee.bloodlustGain);
  }
  if (ability.stateEffect === "berserk") {
    rt.state = patchMelee(rt.state, {
      bloodlust: activateBerserk(rt.state.melee.bloodlust),
      berserkUntilTick: candidate + secondsToTicks(BERSERK_DURATION_SECONDS),
    });
  }
  if (ability.appliesEffect === "chaos_roar") {
    rt.state = patchMelee(rt.state, {
      chaosRoarUntilTick: candidate + secondsToTicks(CHAOS_ROAR_DURATION_SECONDS),
    });
  }
  if (ability.appliesEffect === "greater_fury") {
    rt.state = patchMelee(rt.state, {
      greaterFuryUntilTick: candidate + secondsToTicks(GREATER_FURY_CRIT_WINDOW_SECONDS),
    });
  }
  if (ability.appliesEffect === "fury") {
    rt.state = patchMelee(rt.state, { furyCritBonus: true });
  }
  if (ability.appliesEffect === "meteor_strike") {
    rt.state = patchMelee(rt.state, {
      meteorStrikeUntilTick: candidate + secondsToTicks(METEOR_STRIKE_DURATION_SECONDS),
    });
  }
  // Greater Flurry extends a live Berserk by 0.6s per scheduled hit; eligibility
  // is the Berserk window at cast time.
  if (
    ability.appliesEffect === "greater_flurry" &&
    rt.state.melee.bloodlust.berserk &&
    candidate < rt.state.melee.berserkUntilTick
  ) {
    const extendTicks =
      working.hits.length * secondsToTicks(GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS);
    rt.state = patchMelee(rt.state, {
      berserkUntilTick: rt.state.melee.berserkUntilTick + extendTicks,
    });
  }
  if (working.hits.length > 0) {
    rt.state = patchMelee(rt.state, { lastCastTick: candidate });
  }
  // Dismember chain: each stage unlocks the next for 40 ticks; completing
  // Massacre resets it.
  if (melee?.enables === "slaughter" || melee?.enables === "massacre") {
    rt.state = patchMelee(rt.state, {
      bleedChainNext: melee.enables,
      bleedChainUntilTick: candidate + BLEED_CHAIN_RECAST_WINDOW_TICKS,
    });
  } else if (melee?.recastOf) {
    rt.state = patchMelee(rt.state, { bleedChainNext: null, bleedChainUntilTick: 0 });
  }
}
