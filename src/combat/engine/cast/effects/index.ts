import type { SimulationRuntime } from "../../runtime/runtime";
import type { CastRng } from "../../simulation/contracts";
import type { PreparedCast } from "../prepare";
import { castEffectContext } from "./context";
import { applyCastCooldown } from "./cooldowns";
import { applyMagicCastEffects } from "./magic";
import { applyMeleeCastEffects } from "./melee";
import { applyNecromancyCastEffects } from "./necromancy";
import { applyPreparedTransitions } from "./prepared";
import { applyCastResources } from "./resources";
import { applyRangedCastEffects } from "./ranged";
import { patchTarget } from "../../runtime/state";
import { applyLeagueCastEffects } from "./league";
import { applyEquipmentCastEffects } from "./equipment";

export { applyCompletionEffects } from "./completion";
export { castEffectContext, type CastEffectContext } from "./context";

/**
 * Every cast-start state transition of one atomic cast, in sourced order: what
 * preparation decided to consume, the cooldown clock, adrenaline and free-cast
 * resources, then the one style module that owns the rest. A cast has exactly
 * one style, so the style modules never interleave.

 * Effects that need the channel to have finished are not here - see
 * applyCompletionEffects.
 */
export function applyCastEffects(
  rt: SimulationRuntime,
  prepared: PreparedCast,
  rng?: CastRng,
): void {
  const fx = castEffectContext(rt, prepared, rng);
  const song = rt.analysis.song;
  if (prepared.snap.songPreCastStacks >= 1 && prepared.ability.essenceCorruptionEligible === true) {
    song.empowermentRolls += 1;
    if (prepared.snap.songEmpowered) song.empowermentActivations += 1;
  }
  if (prepared.ability.id === "soulfire") song.soulfireCasts += 1;
  applyPreparedTransitions(fx);
  applyCastCooldown(fx);
  applyCastResources(fx);
  applyLeagueCastEffects(fx);
  applyEquipmentCastEffects(fx);
  if (prepared.working.hits.length > 0) {
    rt.state = patchTarget(rt.state, { lastAttackTick: prepared.candidate });
  }

  switch (prepared.ability.style) {
    case "melee":
      applyMeleeCastEffects(fx);
      break;
    case "ranged":
      applyRangedCastEffects(fx);
      break;
    case "magic":
      applyMagicCastEffects(fx);
      break;
    case "necromancy":
      applyNecromancyCastEffects(fx);
      break;
  }
}
