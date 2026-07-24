/** Tick primitives live in core/ticks; the rotation layer re-exports them with its own vocabulary. */
import { STANDARD_ATTACK_TICKS } from "../core/ticks";

export { TICK_SECONDS, secondsToTicks, ticksToSeconds } from "../core/ticks";

/** Global cooldown between casts — the standardised 3-tick fundamental timing. */
export const GLOBAL_COOLDOWN_TICKS = STANDARD_ATTACK_TICKS;
