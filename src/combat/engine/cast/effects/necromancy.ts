import {
  COMMAND_GHOST_INITIAL_COOLDOWN_TICKS,
  COMMAND_SKELETON_INITIAL_COOLDOWN_TICKS,
  COMMAND_ZOMBIE_INITIAL_COOLDOWN_TICKS,
  CONJURE_ABILITY_SUMMONS,
  applyGhostCommand,
  conjureActive,
} from "../../../styles/necromancy/conjures";
import {
  applyDeathSparkOnBasic,
  DEATH_SPARK_PASSIVE_ID,
} from "../../../styles/necromancy/deathSpark";
import {
  applySoulReaveOnBasic,
  SOUL_REAVE_PASSIVE_ID,
} from "../../../styles/necromancy/soulReave";
import { secondsToTicks } from "../../../core/ticks";
import { applyNecroOnCast, residualSoulCapFor } from "../../../styles/necromancy/effects";
import { hasPassive } from "../../../shared/equipment";
import { rngProc } from "../../simulation/contracts";
import { patchConjures, patchNecro, patchTarget } from "../../runtime/state";
import { applySkeletonCommand, scheduleSpiritTracks } from "../../schedulers/conjures";
import { resetCooldowns, startLinkedCooldown } from "./cooldowns";
import type { CastEffectContext } from "./context";

/**
 * Immediate necromancy cast-state changes: the resource patch (souls, Necrosis,
 * Living Death and its cooldown resets), Spectral Scythe 25% soul RNG, conjure
 * summoning and its schedulers, the Skeleton command, and Bloat's recast overwrite.
 * Living Death Touch of Death +6% adren is folded into applyCastResources
 * (otherImmediateGrants) before the transaction commits.
 */
export function applyNecromancyCastEffects(fx: CastEffectContext): void {
  const { rt, ability, candidate, prepared } = fx;
  const necromancy = rt.state.necromancy;

  const skeletonWasActive = conjureActive(necromancy.conjures, "skeleton_warrior", candidate);
  const ghostWasActive = conjureActive(necromancy.conjures, "vengeful_ghost", candidate);
  const zombieWasActive = conjureActive(necromancy.conjures, "putrid_zombie", candidate);
  const patch = applyNecroOnCast(
    necromancy.resources,
    ability,
    candidate,
    necromancy.conjures,
    rt.input.conjureDurationMult,
  );
  rt.state = patchNecro(rt.state, patch.necro);
  if (patch.conjures) rt.state = patchConjures(rt.state, patch.conjures);
  resetCooldowns(fx, patch.clearCooldownIds);

  // Spectral Scythe casts 1-2: 25% residual soul when forked and under cap.
  const soulChance = (ability as { soulChance?: number }).soulChance;
  if (rngProc(fx.rng, "spectral_scythe_soul") && soulChance) {
    const necro = rt.state.necromancy.resources;
    const cap = residualSoulCapFor(necro);
    if (necro.residualSouls < cap) {
      rt.state = patchNecro(rt.state, { residualSouls: necro.residualSouls + 1 });
    }
  }

  // Omni Guard Death Spark: stack on Necromancy basic; empower was applied in prepare.
  const necroBasic =
    ability.id === "necromancy_basic" || (!!ability.autoAttack && ability.style === "necromancy");
  if (necroBasic && hasPassive(rt.input.equipmentEffects, DEATH_SPARK_PASSIVE_ID)) {
    const ds = applyDeathSparkOnBasic(rt.state.necromancy.resources.deathSparkStacks);
    rt.state = patchNecro(rt.state, { deathSparkStacks: ds.stacks });
  }

  // Soul Reave (Devourer's Guard): stack on necro basic; land grants +1 residual soul.
  // https://runescape.wiki/w/Devourer%27s_Guard
  if (necroBasic && hasPassive(rt.input.equipmentEffects, SOUL_REAVE_PASSIVE_ID)) {
    const reave = applySoulReaveOnBasic(rt.state.necromancy.resources.soulReaveStacks);
    rt.state = patchNecro(rt.state, {
      soulReaveStacks: reave.stacks,
      soulReaveGrantOnLand: reave.grantSoulOnLand,
    });
  }

  for (const spirit of rt.state.necromancy.conjures.spirits) scheduleSpiritTracks(rt, spirit);

  // Wiki: conjuring a skeleton starts the command's initial 3.6s (6-tick)
  // lockout; commanding mutates the skeleton's own auto scheduler.
  if (CONJURE_ABILITY_SUMMONS[ability.id]?.includes("skeleton_warrior") && !skeletonWasActive) {
    startLinkedCooldown(
      fx,
      "command_skeleton_warrior",
      candidate + COMMAND_SKELETON_INITIAL_COOLDOWN_TICKS,
    );
  }
  if (CONJURE_ABILITY_SUMMONS[ability.id]?.includes("vengeful_ghost") && !ghostWasActive) {
    startLinkedCooldown(
      fx,
      "command_vengeful_ghost",
      candidate + COMMAND_GHOST_INITIAL_COOLDOWN_TICKS,
    );
  }
  if (CONJURE_ABILITY_SUMMONS[ability.id]?.includes("putrid_zombie") && !zombieWasActive) {
    // Conjure CD is independent of command/expiry (wiki 30s). Command also
    // gets the same initial 6-tick lockout as skeleton/ghost (first legal @6).
    startLinkedCooldown(fx, "conjure_putrid_zombie", candidate + secondsToTicks(30));
    startLinkedCooldown(
      fx,
      "command_putrid_zombie",
      candidate + COMMAND_ZOMBIE_INITIAL_COOLDOWN_TICKS,
    );
  }
  if (ability.id === "command_skeleton_warrior") applySkeletonCommand(rt, candidate);
  if (ability.id === "command_vengeful_ghost") {
    rt.state = patchConjures(rt.state, applyGhostCommand(rt.state.necromancy.conjures));
  }

  // Bloated does not stack on the single static target: a recast cancels the
  // previous cast's pending tails and starts a fresh derived set (wiki: "its
  // 19.8-second duration will be reset").
  if (ability.id === "bloat") {
    if (rt.state.target.bloatedByCast >= 0) rt.queue.cancelByOwner(rt.state.target.bloatedByCast);
    rt.state = patchTarget(rt.state, { bloatedByCast: prepared.snap.castSeq });
  }
}
