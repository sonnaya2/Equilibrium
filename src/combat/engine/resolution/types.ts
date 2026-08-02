import type { HitResult } from "../../pipeline/calculateHit";

export interface CriticalResolution {
  mode: "none" | "expected" | "guaranteed";
  chance: number;
  /** Chance-weighted damage above the same roll's non-critical result. */
  contribution: number;
  /** True when a tail inherits its source hit's critical result instead of rolling again. */
  inherited?: boolean;
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
