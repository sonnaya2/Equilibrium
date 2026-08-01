import type { SimulationRuntime } from "../runtime/runtime";
import { NO_DAMAGE, type EventResolution } from "./types";

/**
 * Resolve a derived hit (Bloat tail, Death Skulls bounce): a fraction of the
 * source hit's RESOLVED damage — crit boost included, never re-modified, never
 * crit itself (wiki Bloat / Death Skulls, verified 2026-07-31). min/max span
 * the source's non-crit min to its crit max; expected is the source's fraction.
 *
 * The source is addressed by its event seq, so provenance survives branching:
 * a cloned runtime resolves the tail against its own copy of the source detail.
 */
export function resolveDerivedHit(
  rt: SimulationRuntime,
  sourceSeq: number,
  fractionPct: number,
): EventResolution {
  const source = rt.hitDetails.get(sourceSeq);
  if (!source) return NO_DAMAGE;
  return {
    damage: {
      min: Math.floor((source.min * fractionPct) / 100),
      max: Math.floor((source.critMax * fractionPct) / 100),
      expected: (source.expected * fractionPct) / 100,
    },
  };
}
