/**
 * Temporary effective combat-level override (e.g. Naragi Edict -> 255).
 * Override replaces the resolved level for the window; boosts do not stack above it.
 */

export interface EffectiveLevelOverride {
  /** Exclusive end tick (half-open: active while tick < untilTick). 0 = off. */
  untilTick: number;
  /** Exact effective level while active. */
  level: number;
}

export const NO_LEVEL_OVERRIDE: EffectiveLevelOverride = { untilTick: 0, level: 0 };

export function levelOverrideActive(
  override: EffectiveLevelOverride | null | undefined,
  tick: number,
): boolean {
  if (!override || override.untilTick <= 0) return false;
  return tick < override.untilTick && override.level > 0;
}

/**
 * When override is active, return exactly override.level.
 * Otherwise return baseEffective (already includes overload / prayer as the caller computed).
 */
export function resolveEffectiveCombatLevel(
  baseEffective: number,
  override: EffectiveLevelOverride | null | undefined,
  tick: number,
): number {
  if (levelOverrideActive(override, tick)) {
    return override!.level;
  }
  return baseEffective;
}

export function makeLevelOverride(untilTick: number, level: number): EffectiveLevelOverride {
  if (!Number.isFinite(untilTick) || untilTick < 0) {
    throw new RangeError(`makeLevelOverride: bad untilTick ${untilTick}`);
  }
  if (!Number.isFinite(level) || level < 0) {
    throw new RangeError(`makeLevelOverride: bad level ${level}`);
  }
  if (untilTick === 0 || level === 0) return NO_LEVEL_OVERRIDE;
  return { untilTick: Math.floor(untilTick), level: Math.floor(level) };
}
