import { applyCombust } from "../../../styles/magic/burn";
import {
  activateInstability,
  activateSunshine,
  CONC_BLAST_CRIT_PER_HIT_PCT,
  CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT,
  GREATER_CONC_BLAST_CRIT_PER_HIT_PCT,
  GREATER_CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT,
  isConcentratedBlast,
} from "../../../styles/magic/effects";
import { animaCharged, consumeAnima } from "../../../styles/magic/runicCharge";
import { patchMagic, patchTarget } from "../../runtime/state";
import type { CastEffectContext } from "./context";

/** Per-stack crit grant a Concentrated Blast cast sets for its channel. */
function concCritPerStackPct(abilityId: string, empowered: boolean): number {
  if (abilityId === "concentrated_blast") {
    return empowered ? CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT : CONC_BLAST_CRIT_PER_HIT_PCT;
  }
  return empowered
    ? GREATER_CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT
    : GREATER_CONC_BLAST_CRIT_PER_HIT_PCT;
}

/**
 * Immediate magic cast-state changes: the Sunshine and Instability windows,
 * Runic Charge consumption by the casts that empower off it, the Concentrated
 * Blast stack ledger, Combust's burn on the target, and Flow's consumption.
 *
 * Flow is earned from event-carried data when Sonic Wave lands.
 */
export function applyMagicCastEffects(fx: CastEffectContext): void {
  const { rt, ability, candidate } = fx;
  const spendCharge = () => {
    rt.state = patchMagic(rt.state, { runicCharge: consumeAnima(rt.state.magic.runicCharge) });
  };

  if (ability.appliesEffect === "sunshine" || ability.appliesEffect === "greater_sunshine") {
    const greater = ability.appliesEffect === "greater_sunshine";
    rt.state = patchMagic(rt.state, {
      sunshine: activateSunshine(
        candidate,
        greater,
        !greater && rt.input.plantedFeet === true,
        fx.prepared.snap.castSeq,
      ),
    });
  }
  if (ability.appliesEffect === "instability") {
    rt.state = patchMagic(rt.state, {
      instability: activateInstability(candidate, fx.prepared.snap.castSeq),
    });
  }

  if (ability.id === "sonic_wave" || ability.id === "greater_sonic_wave") {
    const empowered = animaCharged(rt.state.magic.runicCharge, candidate);
    if (empowered) spendCharge();
  }
  // Runic-charged Dragon Breath spends the charge; its empowered band was
  // resolved during preparation.
  if (ability.id === "dragon_breath" && animaCharged(rt.state.magic.runicCharge, candidate)) {
    spendCharge();
  }
  if (isConcentratedBlast(ability.id)) {
    const empowered = animaCharged(rt.state.magic.runicCharge, candidate);
    rt.state = patchMagic(rt.state, {
      concCritPerStackPct: concCritPerStackPct(ability.id, empowered),
    });
    if (empowered) spendCharge();
  } else if (rt.state.magic.concCritStacks > 0) {
    // This non-CB magic attack is the one that consumed the accumulated stacks.
    rt.state = patchMagic(rt.state, { concCritStacks: 0 });
  }
  if (ability.id === "combust") {
    rt.state = patchTarget(rt.state, { burns: applyCombust(rt.state.target.burns, candidate) });
  }
  // Flow is consumed by a listed positive-cost Magic spender even when Flow
  // reduced the actual cost to zero. Listed zero-cost abilities do not use it.
  if (
    ability.style === "magic" &&
    (ability.adrenaline?.cost ?? 0) > 0 &&
    candidate < rt.state.magic.flowUntilTick
  ) {
    rt.state = patchMagic(rt.state, { flowUntilTick: 0, flowReduction: 0 });
  }
}
