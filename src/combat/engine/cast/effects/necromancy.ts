import {
  COMMAND_SKELETON_INITIAL_COOLDOWN_TICKS,
  CONJURE_ABILITY_SUMMONS,
  conjureActive,
} from "../../../styles/necromancy/conjures";
import { applyNecroOnCast } from "../../../styles/necromancy/effects";
import { applySkeletonCommand, scheduleSpiritTracks } from "../../schedulers/conjures";
import { resetCooldowns, startLinkedCooldown } from "./cooldowns";
import { grantBonusAdrenaline } from "./resources";
import { patchState, type CastEffectContext } from "./context";

/**
 * Immediate necromancy cast-state changes: the resource patch (souls, Necrosis,
 * Living Death and its cooldown resets), conjure summoning and its schedulers,
 * the Skeleton command, and Bloat's recast overwrite.
 */
export function applyNecromancyCastEffects(fx: CastEffectContext): void {
  const { rt, ability, candidate, prepared } = fx;

  const skeletonWasActive = conjureActive(rt.state.conjures, "skeleton_warrior", candidate);
  const patch = applyNecroOnCast(rt.state.necro, ability, candidate, rt.state.conjures);
  patchState(fx, {
    necro: patch.necro,
    ...(patch.conjures ? { conjures: patch.conjures } : {}),
  });
  grantBonusAdrenaline(fx, patch.adrenalineBonus);
  resetCooldowns(fx, patch.clearCooldownIds);

  for (const spirit of rt.state.conjures.spirits) scheduleSpiritTracks(rt, spirit);

  // Wiki: conjuring a skeleton starts the command's initial 3.6s (6-tick)
  // lockout; commanding mutates the skeleton's own auto scheduler.
  if (CONJURE_ABILITY_SUMMONS[ability.id]?.includes("skeleton_warrior") && !skeletonWasActive) {
    startLinkedCooldown(
      fx,
      "command_skeleton_warrior",
      candidate + COMMAND_SKELETON_INITIAL_COOLDOWN_TICKS,
    );
  }
  if (ability.id === "command_skeleton_warrior") applySkeletonCommand(rt, candidate);

  // Bloated does not stack on the single static target: a recast cancels the
  // previous cast's pending tails and starts a fresh derived set (wiki: "its
  // 19.8-second duration will be reset").
  if (ability.id === "bloat") {
    if (rt.state.activeBloatCastSeq >= 0) rt.queue.cancelByOwner(rt.state.activeBloatCastSeq);
    patchState(fx, { activeBloatCastSeq: prepared.snap.castSeq });
  }
}
