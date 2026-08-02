import type { HitResult } from "../../pipeline/calculateHit";

export interface CriticalResolution {
  mode: "none" | "expected" | "guaranteed";
  chance: number;
  /** Chance-weighted damage above the same roll's non-critical result. */
  contribution: number;
  /** True when a tail inherits its source hit's critical result instead of rolling again. */
  inherited?: boolean;
}

/** Package a hit's crit chance and EV split into the shared CriticalResolution shape. */
export function packageCritical(
  chance: number,
  critExpected: number,
  nonCritExpected: number,
  opts?: { inherited?: boolean; scale?: number },
): CriticalResolution {
  const scale = opts?.scale ?? 1;
  return {
    mode: chance >= 1 ? "guaranteed" : chance > 0 ? "expected" : "none",
    chance,
    contribution: Math.max(0, chance * (critExpected - nonCritExpected)) * scale,
    ...(opts?.inherited ? { inherited: true } : {}),
  };
}

/** Damage one scheduled event contributed. `critExpected` is diagnostic only. */
export interface ResolvedDamage {
  min: number;
  max: number;
  expected: number;
  critExpected?: number;
  /** Expected damage removed by the active hit cap. */
  capLoss?: number;
  critical?: CriticalResolution;
}

/**
 * What resolving one scheduled event produced. Resolution calculates and
 * returns; it never writes to the runtime's ledgers. `hitDetail` is the full
 * breakdown a real cast hit computed — record.ts stores it so later derived
 * hits and Lightning Surge procs can read their source's resolved numbers.
 */
export interface EventResolution {
  damage: ResolvedDamage;
  hitDetail?: HitResult;
}

/** Zero damage, no detail — a resolver whose source event is gone. */
export const NO_DAMAGE: EventResolution = { damage: { min: 0, max: 0, expected: 0 } };
