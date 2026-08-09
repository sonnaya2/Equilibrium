import {
  activateBalanceByForce,
  activateDeathsSwiftness,
} from "../../../styles/ranged/effects";
import {
  activateSearingWinds,
  activateShadowImbued,
  extendShadowImbued,
} from "../../../styles/ranged/onHit";
import { patchRanged } from "../../runtime/state";
import type { CastEffectContext } from "./context";

/**
 * Immediate ranged cast-state changes: the Death's Swiftness and Shadow Imbued
 * windows, and Searing Winds' activation. Deathspore stacks, Shadow Imbued's
 * per-hit adrenaline and Rapid Fire's Searing Winds extension are landed-hit
 * effects - see resolution/landed/ranged.
 */
export function applyRangedCastEffects(fx: CastEffectContext): void {
  const { rt, ability, candidate, prepared } = fx;

  if (ability.stateEffect === "deaths_swiftness") {
    rt.state = patchRanged(rt.state, {
      swiftness: activateDeathsSwiftness(candidate, false, rt.input.plantedFeet === true),
    });
  } else if (ability.stateEffect === "greater_deaths_swiftness") {
    rt.state = patchRanged(rt.state, { swiftness: activateDeathsSwiftness(candidate, true) });
  } else if (ability.stateEffect === "shadow_imbued") {
    rt.state = patchRanged(rt.state, { shadowImbued: activateShadowImbued(candidate) });
  } else if (ability.stateEffect === "balance_by_force") {
    rt.state = patchRanged(rt.state, {
      balanceByForce: activateBalanceByForce(candidate),
    });
  }
  if (ability.appliesEffect === "searing_winds") {
    rt.state = patchRanged(rt.state, {
      searingWinds: activateSearingWinds(candidate, prepared.snap.castSeq),
    });
  }
  if (ability.id === "shadow_tendrils") {
    rt.state = patchRanged(rt.state, {
      shadowImbued: extendShadowImbued(rt.state.ranged.shadowImbued, candidate),
    });
  }

  // Recast cancels prior Corruption Shot pending events (parent + tails) by owner.
  // Does not cancel Blast. Cast effects run after schedule; skip this cast's owner.
  if (ability.id === "corruption_shot") {
    const newOwner = prepared.snap.castSeq;
    const owners = new Set<number>();
    for (const e of rt.queue.pending()) {
      if (
        e.abilityId === "corruption_shot" &&
        e.cancelOwner != null &&
        e.cancelOwner !== newOwner
      ) {
        owners.add(e.cancelOwner);
      }
    }
    for (const owner of owners) rt.queue.cancelByOwner(owner);
  }
}
