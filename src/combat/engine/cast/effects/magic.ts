import { applyCombust } from "../../../styles/magic/burn";
import {
  activateInstability,
  activateSunshine,
  CONC_BLAST_CRIT_PER_HIT_PCT,
  CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT,
  GREATER_CONC_BLAST_CRIT_PER_HIT_PCT,
  GREATER_CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT,
  GREATER_FLOW_REDUCTION,
  isConcentratedBlast,
  RUNIC_FLOW_BONUS,
  SONIC_FLOW_REDUCTION,
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
 * Flow is only *earned* here as a pending reduction — Sonic Wave grants the
 * window when its hit lands (see resolution/landed/magic).
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
    rt.state = patchMagic(rt.state, { instability: activateInstability(candidate) });
  }

  // Sonic Wave / Greater Sonic Wave record what a landed hit should grant; a
  // Runic-charged cast earns the empowered reduction and spends the charge now.
  if (ability.id === "sonic_wave" || ability.id === "greater_sonic_wave") {
    const empowered = animaCharged(rt.state.magic.runicCharge, candidate);
    const base = ability.id === "sonic_wave" ? SONIC_FLOW_REDUCTION : GREATER_FLOW_REDUCTION;
    rt.state = patchMagic(rt.state, {
      pendingFlowReduction: base + (empowered ? RUNIC_FLOW_BONUS : 0),
    });
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
  // Enhanced/ultimate Magic casts consume Flow (wiki); basics never do.
  if (
    (ability.category === "enhanced" || ability.category === "ultimate") &&
    rt.state.magic.flowUntilTick > 0
  ) {
    rt.state = patchMagic(rt.state, { flowUntilTick: 0, flowReduction: 0 });
  }
}
