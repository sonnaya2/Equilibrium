/** RS runs on a 0.6s tick. Post-modernisation, fundamental attack timing is ~3 ticks
 *  across styles; per-weapon speed assumptions are legacy only. */
export const TICK_SECONDS = 0.6;
export const STANDARD_ATTACK_TICKS = 3;

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds / TICK_SECONDS);
}

export function ticksToSeconds(ticks: number): number {
  return ticks * TICK_SECONDS;
}
