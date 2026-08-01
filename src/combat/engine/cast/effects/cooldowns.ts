import { secondsToTicks } from "../../../core/ticks";
import { deathSkullsCooldownTicks } from "../../../styles/necromancy/effects";
import { clearCooldowns, startCooldown } from "../../runtime/state";
import type { CastEffectContext } from "./context";

/**
 * Cooldown clocks for one cast. Every ability keeps its own clock keyed by id;
 * the only sourced variation is Death Skulls, whose cooldown collapses to 17
 * ticks under Living Death (2 Mar 2026).
 */
export function applyCastCooldown(fx: CastEffectContext): void {
  const { rt, ability, candidate } = fx;
  if (!ability.cooldownSeconds) return;
  const ticks =
    ability.id === "death_skulls"
      ? deathSkullsCooldownTicks(rt.state.necromancy.resources, candidate)
      : secondsToTicks(ability.cooldownSeconds);
  rt.state = startCooldown(
    rt.state,
    ability.cooldownGroup ?? ability.replacementGroup ?? ability.id,
    ticks,
  );
}

/** Cooldown resets granted by a cast (Living Death clears ToD and Death Skulls). */
export function resetCooldowns(fx: CastEffectContext, ids: readonly string[]): void {
  fx.rt.state = clearCooldowns(fx.rt.state, ids);
}

/**
 * Start a cooldown on an ability other than the one being cast — conjuring a
 * skeleton locks its command ability out for a sourced initial window.
 */
export function startLinkedCooldown(fx: CastEffectContext, id: string, untilTick: number): void {
  fx.rt.state = {
    ...fx.rt.state,
    cooldowns: { ...fx.rt.state.cooldowns, [id]: untilTick },
  };
}
