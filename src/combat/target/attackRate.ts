import { ticksToSeconds } from "../core/ticks";

/**
 * Wiki attack rate is ticks between auto-attacks (0.6s per tick).
 * https://runescape.wiki/w/Attack_rate
 * Null when missing, non-positive, or non-finite - never invent cadence.
 */
export function attackRateTicksToIntervalSeconds(
  ticks: number | null | undefined,
): number | undefined {
  if (ticks == null || !Number.isFinite(ticks)) return undefined;
  const t = Math.floor(ticks);
  if (t < 1) return undefined;
  // One decimal avoids 6*0.6 float noise (3.599…); tick cadence is always n*0.6.
  return Math.round(ticksToSeconds(t) * 10) / 10;
}
