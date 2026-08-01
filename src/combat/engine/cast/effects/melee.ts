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
import { gainMeleeBloodlust } from "../../runtime/state";
import { patchState, type CastEffectContext } from "./context";

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
    patchState(fx, {
      melee: activateBerserk(rt.state.melee),
      berserkUntilTick: candidate + secondsToTicks(BERSERK_DURATION_SECONDS),
    });
  }
  if (ability.appliesEffect === "chaos_roar") {
    patchState(fx, {
      chaosRoarUntilTick: candidate + secondsToTicks(CHAOS_ROAR_DURATION_SECONDS),
    });
  }
  if (ability.appliesEffect === "greater_fury") {
    patchState(fx, {
      greaterFuryUntilTick: candidate + secondsToTicks(GREATER_FURY_CRIT_WINDOW_SECONDS),
    });
  }
  if (ability.appliesEffect === "fury") {
    patchState(fx, { furyCritBonus: true });
  }
  if (ability.appliesEffect === "meteor_strike") {
    patchState(fx, {
      meteorStrikeUntilTick: candidate + secondsToTicks(METEOR_STRIKE_DURATION_SECONDS),
    });
  }
  // Greater Flurry extends a live Berserk by 0.6s per scheduled hit; eligibility
  // is the Berserk window at cast time.
  if (
    ability.appliesEffect === "greater_flurry" &&
    rt.state.melee.berserk &&
    candidate < rt.state.berserkUntilTick
  ) {
    const extendTicks =
      working.hits.length * secondsToTicks(GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS);
    patchState(fx, { berserkUntilTick: rt.state.berserkUntilTick + extendTicks });
  }
  if (working.hits.length > 0) {
    patchState(fx, { lastMeleeCastTick: candidate });
  }
  // Dismember chain: each stage unlocks the next for 40 ticks; completing
  // Massacre resets it.
  if (melee?.enables === "slaughter" || melee?.enables === "massacre") {
    patchState(fx, {
      bleedChainNext: melee.enables,
      bleedChainUntilTick: candidate + BLEED_CHAIN_RECAST_WINDOW_TICKS,
    });
  } else if (melee?.recastOf) {
    patchState(fx, { bleedChainNext: null, bleedChainUntilTick: 0 });
  }
}
