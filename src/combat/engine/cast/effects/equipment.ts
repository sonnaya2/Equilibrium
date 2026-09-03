import { hasPassive } from "../../../shared/equipment";
import {
  activateScriptureOfAmascut,
  DEVOURERS_CONTAGION_EFFECT_ID,
  DEVOURERS_CONTAGION_FIRST_HIT_OFFSET_TICKS,
  DEVOURERS_CONTAGION_HIT_COUNT,
  DEVOURERS_CONTAGION_HIT_INTERVAL_TICKS,
  SCRIPTURE_OF_AMASCUT_PASSIVE_ID,
} from "../../../passives/scriptureOfAmascut";
import { resolveDevourersContagion } from "../../resolution/scriptureOfAmascut";
import { scheduleEvent } from "../../runtime/runtime";
import { patchScriptureOfAmascut } from "../../runtime/state";
import { rngProc } from "../../simulation/contracts";
import { hasDamagingHits } from "../hitKind";
import type { CastEffectContext } from "./context";

export function applyEquipmentCastEffects(fx: CastEffectContext): void {
  const { rt, working, candidate, prepared } = fx;
  if (
    !hasPassive(rt.input.equipmentEffects, SCRIPTURE_OF_AMASCUT_PASSIVE_ID) ||
    !rngProc(fx.rng, "scripture-of-amascut") ||
    candidate < rt.state.scriptureOfAmascut.readyTick ||
    !hasDamagingHits(working.hits)
  ) {
    return;
  }

  rt.state = patchScriptureOfAmascut(
    rt.state,
    activateScriptureOfAmascut(candidate, prepared.snap.castSeq),
  );
  const targetCount = Math.min(9, Math.max(1, Math.floor(rt.input.league?.areaTargets ?? 1)));
  for (let hitIndex = 0; hitIndex < DEVOURERS_CONTAGION_HIT_COUNT; hitIndex++) {
    scheduleEvent(rt, {
      tick:
        candidate +
        DEVOURERS_CONTAGION_FIRST_HIT_OFFSET_TICKS +
        hitIndex * DEVOURERS_CONTAGION_HIT_INTERVAL_TICKS,
      family: "dot",
      abilityId: DEVOURERS_CONTAGION_EFFECT_ID,
      sourceCast: prepared.snap.castSeq,
      hitIndex,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      originKind: "dot",
      provenance: { kind: "equipment_proc", detail: DEVOURERS_CONTAGION_EFFECT_ID },
      dotKind: "other",
      tearingThornsEligible: true,
      combatStyle: working.style,
      expectedOccurrences: targetCount,
      expectedTriggerRolls: 0,
      expectedActivations: hitIndex === 0 ? 1 : 0,
      expectedSeparateHits: targetCount,
      resolve: (eventRt, at) => resolveDevourersContagion(eventRt, at, working.style, targetCount),
    });
  }
}
