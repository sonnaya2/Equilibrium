import { spendBloodlust } from "../../../styles/melee/bloodlust";
import {
  patchDefence,
  patchMagic,
  patchMelee,
  patchRanged,
  patchTarget,
} from "../../runtime/state";
import {
  armSongAdrenalineStream,
  consumeConflagrate,
} from "../../../styles/magic/songOfDestruction";
import type { CastEffectContext } from "./context";
import { reduceActiveCooldowns } from "./cooldowns";

/**
 * Apply the transitions preparation decided, in the order it recorded them.
 * These are the consumptions a cast pays for the variant it already resolved,
 * so they land before cooldowns, resources and style grants.
 */
export function applyPreparedTransitions(fx: CastEffectContext): void {
  const { rt } = fx;
  for (const transition of fx.prepared.transitions) {
    switch (transition.kind) {
      case "spendBloodlust":
        rt.state = patchMelee(rt.state, {
          bloodlust: spendBloodlust(rt.state.melee.bloodlust, transition.stacks),
        });
        break;
      case "grantEndlessAssault":
        rt.state = patchMelee(rt.state, { endlessAssaultUntilTick: transition.untilTick });
        break;
      case "consumeEndlessAssault":
        rt.state = patchMelee(rt.state, { endlessAssaultUntilTick: 0 });
        break;
      case "consumeChaosRoar":
        rt.state = patchMelee(rt.state, { chaosRoarUntilTick: 0 });
        break;
      case "consumeGreaterFury":
        rt.state = patchMelee(rt.state, { greaterFuryUntilTick: 0 });
        break;
      case "consumeFury":
        rt.state = patchMelee(rt.state, { furyCritBonus: false });
        break;
      case "consumeEnduringRuin":
        rt.state = patchMelee(rt.state, {
          enduringRuin: { nextAttackBonus: 0, untilTick: 0, grantedByCast: -1 },
        });
        break;
      case "consumePrimordialIce":
        rt.state = patchMelee(rt.state, {
          primordialIce: transition.next,
        });
        break;
      case "designateFlameboundRival":
        rt.state = patchTarget(rt.state, {
          melee: { ...rt.state.target.melee, flameboundRival: true },
        });
        break;
      case "consumePerfectEquilibrium":
        rt.state = patchRanged(rt.state, {
          perfectEquilibriumStacks: 0,
        });
        break;
      case "activateWenIcyPrecision":
        rt.state = patchRanged(rt.state, { wen: transition.next });
        break;
      case "consumeSongConflagrate":
        rt.analysis.song.conflagrateConsumptions += 1;
        rt.state = patchMagic(rt.state, {
          song: {
            ...rt.state.magic.song,
            conflagrateUntilTick: consumeConflagrate(
              rt.state.magic.song.conflagrateUntilTick,
              fx.ability.id,
              fx.candidate,
            ).nextUntilTick,
          },
        });
        break;
      case "armSongAdrenaline":
        rt.state = patchMagic(rt.state, {
          song: {
            ...rt.state.magic.song,
            adrenalineStream: armSongAdrenalineStream(
              rt.input.equipmentEffects!.songOfDestruction!,
              transition.stacks,
              fx.ability,
              fx.candidate,
              rt.state.magic.song.adrenalineStream,
            ),
          },
        });
        break;
      case "reduceActiveCooldowns":
        rt.state = reduceActiveCooldowns(
          rt.state,
          transition.ticks,
          transition.floorTick,
          transition.excludedKeys,
        );
        break;
      case "activateRevenge":
        rt.state = patchDefence(rt.state, { revenge: transition.next });
        break;
    }
  }
}
