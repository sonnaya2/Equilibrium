/** Product Revolution bar sizes (4..11). */

export const MIN_SOLVER_BAR_SIZE = 4;
export const DEFAULT_MAX_BAR_SIZE = 11;
export const ABSOLUTE_MAX_BAR_SIZE = 11;
export const BAR_LENGTH_COUNT = ABSOLUTE_MAX_BAR_SIZE - MIN_SOLVER_BAR_SIZE + 1;

export type SolverBarSizeBounds = { minBarSize: number; maxBarSize: number };

/** Tier defaults: full product window unless the request narrows it. */
export const TIER_BAR_SIZE_BOUNDS: Record<
  "thorough" | "extreme" | "unhinged",
  SolverBarSizeBounds
> = {
  thorough: { minBarSize: MIN_SOLVER_BAR_SIZE, maxBarSize: ABSOLUTE_MAX_BAR_SIZE },
  extreme: { minBarSize: MIN_SOLVER_BAR_SIZE, maxBarSize: ABSOLUTE_MAX_BAR_SIZE },
  unhinged: { minBarSize: MIN_SOLVER_BAR_SIZE, maxBarSize: ABSOLUTE_MAX_BAR_SIZE },
};

function clampBarSize(raw: number | undefined, fallback: number): number {
  const n = Math.floor(raw ?? fallback) || fallback;
  return Math.max(MIN_SOLVER_BAR_SIZE, Math.min(ABSOLUTE_MAX_BAR_SIZE, n));
}

/**
 * Clamp product path size bounds into 4..11.
 * Preserves caller intent: does not expand a narrow window to the full range.
 * Inverted ranges collapse to a fixed size at the higher floor.
 */
export function clampSolverBarSizes(minBarSize?: number, maxBarSize?: number): SolverBarSizeBounds {
  const min = clampBarSize(minBarSize, MIN_SOLVER_BAR_SIZE);
  const max = Math.max(min, clampBarSize(maxBarSize, DEFAULT_MAX_BAR_SIZE));
  return { minBarSize: min, maxBarSize: max };
}

/** Distinct bar lengths in a size window (max − min + 1) after clamp. */
export function barLengthSpan(minBarSize: number, maxBarSize: number): number {
  const { minBarSize: lo, maxBarSize: hi } = clampSolverBarSizes(minBarSize, maxBarSize);
  return hi - lo + 1;
}

/**
 * Target length for agent i within an optional window (default full 4..11).
 * Cycles lo..hi so fixed windows stay pinned (4..4 → always 4).
 */
export function agentBarLength(
  agentIndex: number,
  minBarSize: number = MIN_SOLVER_BAR_SIZE,
  maxBarSize: number = ABSOLUTE_MAX_BAR_SIZE,
): number {
  const { minBarSize: lo, maxBarSize: hi } = clampSolverBarSizes(minBarSize, maxBarSize);
  const span = hi - lo + 1;
  const i = Math.max(0, Math.floor(Number(agentIndex)) || 0);
  return lo + (i % span);
}

/**
 * Per-agent size band inside the request window only.
 * Fixed request (e.g. 4..4) → every agent gets that exact size.
 * Ranged request → agents cycle fixed target lengths through [min, max].
 * Request min/max are honored after clamp; never silently expanded.
 */
export function agentBarSizeBounds(
  minBarSize: number,
  maxBarSize: number,
  agentIndex: number,
  _agentCount: number = 1,
): SolverBarSizeBounds {
  const { minBarSize: lo, maxBarSize: hi } = clampSolverBarSizes(minBarSize, maxBarSize);
  const target = agentBarLength(agentIndex, lo, hi);
  return { minBarSize: target, maxBarSize: target };
}
