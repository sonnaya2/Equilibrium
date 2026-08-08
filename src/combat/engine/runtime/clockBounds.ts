/**
 * Fixed windows are half-open. Per-tick ledgers use [fromTick, endExclusive);
 * completion-time events and pulses use (fromTick, endInclusive].
 */
export function clockAdvanceBounds(
  targetTick: number,
  horizon: number | undefined,
): { perTickEndExclusive: number; eventEndInclusive: number } {
  return {
    perTickEndExclusive: horizon == null ? targetTick : Math.min(targetTick, horizon),
    eventEndInclusive: horizon == null ? targetTick : Math.min(targetTick, horizon - 1),
  };
}
