import {
  hauntedActive,
  hauntedBonusDamage,
  hauntedParentDamage,
} from "../../styles/necromancy/haunted";
import type { SimulationRuntime } from "../runtime/runtime";
import { attachedResolutionComponent, resolveLeagueAttachedRawHost } from "../../league/damage";
import { resolveLeagueCritAtLand } from "../../league/ruleset";
import type { DamageProvenance } from "../../shared/damageProvenance";
import { outgoingSourceOf } from "../../shared/damageProvenance";
import { abilityDamageAt } from "./castHit";
import { targetAndPostHitModifiers } from "./modifiers";
import { applyHitCap, normalizeHitCapRule, standardHitCap } from "../../core/hitCaps";
import { resolveEffectiveCombatLevel } from "../../core/effectiveLevel";
import {
  NO_SONG_OF_DESTRUCTION,
  essenceCorruptionFlatBonus,
} from "../../styles/magic/songOfDestruction";
import {
  appendAttachedComponents,
  NO_DAMAGE,
  packageCritical,
  type AttachedDamageComponent,
  type EventResolution,
} from "./types";

/**
 * Resolve a derived hit (Bloat tail, Death Skulls bounce): a fraction of the
 * source hit's RESOLVED damage - crit boost included, never re-modified, and
 * Death Skulls inherits the source critical outcome. min/max span
 * the source's non-crit min to its crit max; expected is the source's fraction.
 *
 * Haunted is re-evaluated at land tick (wiki: each Bloat/Skulls hit individually).
 * Attached only - never baked into the fraction parent.
 *
 * The source is addressed by its event seq, so provenance survives delayed resolution:
 * a cloned runtime resolves the tail against its own copy of the source detail.
 */
export function resolveDerivedHit(
  rt: SimulationRuntime,
  sourceSeq: number,
  fractionPct: number,
  landTick?: number,
  provenance: DamageProvenance = { kind: "derived_tail" },
): EventResolution {
  const source = rt.hitDetails.get(sourceSeq);
  if (!source) return NO_DAMAGE;
  const tick = landTick ?? rt.state.tick;
  const ability = provenance.detail ? rt.byId.get(provenance.detail) : undefined;
  const level = resolveEffectiveCombatLevel(
    rt.input.level,
    rt.state.player?.levelOverride,
    tick,
  );
  const flat = essenceCorruptionFlatBonus(
    rt.input.equipmentEffects?.songOfDestruction ?? NO_SONG_OF_DESTRUCTION,
    rt.state.magic.song.essenceCorruption,
    tick,
    level,
    ability,
    provenance,
  );
  const uncappedMin = Math.floor((source.min * fractionPct) / 100) + flat;
  const uncappedMax = Math.floor((source.critMax * fractionPct) / 100) + flat;
  const baseExpected = (source.expected * fractionPct) / 100;
  const uncappedExpected = baseExpected + flat;
  const capRule = normalizeHitCapRule(rt.input.cap ?? standardHitCap);
  const min = flat > 0 ? applyHitCap(uncappedMin, capRule) : uncappedMin;
  const max = flat > 0 ? applyHitCap(uncappedMax, capRule) : uncappedMax;
  const expected = flat > 0 ? applyHitCap(uncappedExpected, capRule) : uncappedExpected;
  const postDamagePotentialFlatContribution =
    flat > 0 ? Math.max(0, expected - applyHitCap(baseExpected, capRule)) : undefined;
  const capLoss =
    (source.capLoss * fractionPct) / 100 + Math.max(0, uncappedExpected - expected);
  const inheritedCrit = resolveLeagueCritAtLand(rt.input.league, {
    chance: source.critChance,
    damageBonus: source.critDamageBonus,
    eligible: source.critChance > 0,
  });
  const damage = {
    min,
    max,
    expected,
    critExpected: (source.critExpected * fractionPct) / 100,
    capLoss,
    critical: packageCritical(inheritedCrit.chance, source.critExpected, source.nonCritExpected, {
      scale: fractionPct / 100,
      inherited: true,
      ...(source.critOutcome === undefined ? {} : { outcome: source.critOutcome }),
    }),
  };

  const haunted = rt.state.target.haunted;
  let resolution: EventResolution = {
    damage,
    ...(postDamagePotentialFlatContribution !== undefined
      ? { postDamagePotentialFlatContribution }
      : {}),
  };

  if (hauntedActive(haunted, tick)) {
    // Fraction is of post-DP parent; reverse source potential so 10% ignores accuracy.
    const pot = source.potential;
    const capAD = haunted.capAbilityDamage;
    const bonusMin = hauntedBonusDamage(hauntedParentDamage(min, pot), capAD);
    const bonusMax = hauntedBonusDamage(hauntedParentDamage(max, pot), capAD);
    const bonusExpected = hauntedBonusDamage(hauntedParentDamage(expected, pot), capAD);
    if (bonusMax > 0 || bonusExpected > 0) {
      const component: AttachedDamageComponent = {
        id: "haunted",
        damage: { min: bonusMin, max: bonusMax, expected: bonusExpected },
        attached: true,
        hitCapPolicy: "separate",
      };
      resolution = appendAttachedComponents(resolution, [component]);
    }
  }

  const attached = resolveLeagueAttachedRawHost({
    rules: rt.input.league,
    source: provenance,
    landTick: tick,
    abilityBase: abilityDamageAt(rt, tick),
    min: 0,
    max: 0,
    level: rt.input.level,
    accuracy: source.potential,
    crit: inheritedCrit,
    modifiers: targetAndPostHitModifiers(rt, ability),
    context: {
      ...(rt.input.context ?? { style: ability?.style ?? "melee" }),
      damageSource: outgoingSourceOf(provenance),
      provenance,
    },
    cap: { cap: rt.input.cap?.cap ?? 30_000, bypass: true },
  });
  return appendAttachedComponents(
    resolution,
    attached.components.map((component) => attachedResolutionComponent(component)),
  );
}
