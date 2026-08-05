import {
  hauntedActive,
  hauntedBonusDamage,
  hauntedParentDamage,
} from "../../styles/necromancy/haunted";
import type { SimulationRuntime } from "../runtime/runtime";
import {
  NO_DAMAGE,
  packageCritical,
  type AttachedDamageComponent,
  type EventResolution,
} from "./types";

/**
 * Resolve a derived hit (Bloat tail, Death Skulls bounce): a fraction of the
 * source hit's RESOLVED damage - crit boost included, never re-modified, never
 * crit itself (wiki Bloat / Death Skulls, verified 2026-07-31). min/max span
 * the source's non-crit min to its crit max; expected is the source's fraction.
 *
 * Haunted is re-evaluated at land tick (wiki: each Bloat/Skulls hit individually).
 * Attached only - never baked into the fraction parent.
 *
 * The source is addressed by its event seq, so provenance survives branching:
 * a cloned runtime resolves the tail against its own copy of the source detail.
 */
export function resolveDerivedHit(
  rt: SimulationRuntime,
  sourceSeq: number,
  fractionPct: number,
  landTick?: number,
): EventResolution {
  const source = rt.hitDetails.get(sourceSeq);
  if (!source) return NO_DAMAGE;
  const min = Math.floor((source.min * fractionPct) / 100);
  const max = Math.floor((source.critMax * fractionPct) / 100);
  const expected = (source.expected * fractionPct) / 100;
  const capLoss = (source.capLoss * fractionPct) / 100;
  const damage = {
    min,
    max,
    expected,
    capLoss,
    critical: packageCritical(source.critChance, source.critExpected, source.nonCritExpected, {
      scale: fractionPct / 100,
      inherited: true,
    }),
  };

  const tick = landTick ?? rt.state.tick;
  const haunted = rt.state.target.haunted;
  if (!hauntedActive(haunted, tick)) {
    return { damage };
  }

  // Fraction is of post-DP parent; reverse source potential so 10% ignores accuracy.
  const pot = source.potential;
  const capAD = haunted.capAbilityDamage;
  const bonusMin = hauntedBonusDamage(hauntedParentDamage(min, pot), capAD);
  const bonusMax = hauntedBonusDamage(hauntedParentDamage(max, pot), capAD);
  const bonusExpected = hauntedBonusDamage(hauntedParentDamage(expected, pot), capAD);
  if (bonusMax <= 0 && bonusExpected <= 0) return { damage };

  const component: AttachedDamageComponent = {
    id: "haunted",
    damage: { min: bonusMin, max: bonusMax, expected: bonusExpected },
    attached: true,
    hitCapPolicy: "separate",
  };
  return {
    damage: {
      ...damage,
      min: min + bonusMin,
      max: max + bonusMax,
      expected: expected + bonusExpected,
    },
    components: [component],
  };
}
