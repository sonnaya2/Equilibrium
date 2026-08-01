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
import { patchState, type CastEffectContext } from "./context";

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
 * Blast stack ledger, Combust's burn, and Flow's consumption.
 *
 * Flow is only *earned* here as a pending reduction — Sonic Wave grants the
 * window when its hit lands (see resolution/landed/magic).
 */
export function applyMagicCastEffects(fx: CastEffectContext): void {
  const { rt, ability, candidate } = fx;

  if (ability.appliesEffect === "sunshine" || ability.appliesEffect === "greater_sunshine") {
    const greater = ability.appliesEffect === "greater_sunshine";
    patchState(fx, {
      sunshine: activateSunshine(
        candidate,
        greater,
        !greater && rt.input.plantedFeet === true,
        fx.prepared.snap.castSeq,
      ),
    });
  }
  if (ability.appliesEffect === "instability") {
    patchState(fx, { instability: activateInstability(candidate) });
  }

  // Sonic Wave / Greater Sonic Wave record what a landed hit should grant; a
  // Runic-charged cast earns the empowered reduction and spends the charge now.
  if (ability.id === "sonic_wave" || ability.id === "greater_sonic_wave") {
    const empowered = animaCharged(rt.state.magic, candidate);
    const base = ability.id === "sonic_wave" ? SONIC_FLOW_REDUCTION : GREATER_FLOW_REDUCTION;
    patchState(fx, {
      magicFx: {
        ...rt.state.magicFx,
        pendingFlowReduction: base + (empowered ? RUNIC_FLOW_BONUS : 0),
      },
    });
    if (empowered) patchState(fx, { magic: consumeAnima(rt.state.magic) });
  }
  // Runic-charged Dragon Breath spends the charge; its empowered band was
  // resolved during preparation.
  if (ability.id === "dragon_breath" && animaCharged(rt.state.magic, candidate)) {
    patchState(fx, { magic: consumeAnima(rt.state.magic) });
  }
  if (isConcentratedBlast(ability.id)) {
    const empowered = animaCharged(rt.state.magic, candidate);
    patchState(fx, {
      magicFx: {
        ...rt.state.magicFx,
        concCritPerStackPct: concCritPerStackPct(ability.id, empowered),
      },
    });
    if (empowered) patchState(fx, { magic: consumeAnima(rt.state.magic) });
  } else if (rt.state.magicFx.concCritStacks > 0) {
    // This non-CB magic attack is the one that consumed the accumulated stacks.
    patchState(fx, { magicFx: { ...rt.state.magicFx, concCritStacks: 0 } });
  }
  if (ability.id === "combust") {
    patchState(fx, {
      magicFx: { ...rt.state.magicFx, burns: applyCombust(rt.state.magicFx.burns, candidate) },
    });
  }
  // Enhanced/ultimate Magic casts consume Flow (wiki); basics never do.
  if (
    (ability.category === "enhanced" || ability.category === "ultimate") &&
    rt.state.magicFx.flowUntilTick > 0
  ) {
    patchState(fx, { magicFx: { ...rt.state.magicFx, flowUntilTick: 0, flowReduction: 0 } });
  }
}
