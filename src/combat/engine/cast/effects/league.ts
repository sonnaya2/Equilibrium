import { blessingRule } from "../../../league/ruleset";
import { patchLeague } from "../../runtime/state";
import { rngProc } from "../../simulation/contracts";
import type { CastEffectContext } from "./context";

/** Stateful blessing transitions that begin after the triggering cast pays its cost. */
export function applyLeagueCastEffects(fx: CastEffectContext): void {
  if (
    !rngProc(fx.rng, "avernic-rampage") ||
    fx.candidate < (fx.rt.state.league?.avernicRampageUntilTick ?? 0)
  ) {
    return;
  }
  const duration = blessingRule(fx.rt.input.league, "avernic-rampage")?.freeCastDurationTicks;
  if (duration === undefined) return;
  fx.rt.state = patchLeague(fx.rt.state, {
    avernicRampageUntilTick: fx.candidate + duration,
  });
}
