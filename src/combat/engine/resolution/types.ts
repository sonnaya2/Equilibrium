import type { HitResult } from "../../pipeline/calculateHit";

/** Damage one scheduled event contributed. `critExpected` is diagnostic only. */
export interface ResolvedDamage {
  min: number;
  max: number;
  expected: number;
  critExpected?: number;
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
