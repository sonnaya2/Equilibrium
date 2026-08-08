import type { AbilityHit, AbilitySpec } from "../pipeline/calculateAbility";

function dotHit(hit: AbilityHit): boolean {
  return hit.dot === true;
}

function cadence(hits: readonly AbilityHit[]): number {
  const offsets = hits.map((hit) => hit.tickOffset ?? 0);
  if (offsets.length < 2) return Math.max(1, offsets[0] ?? 1);
  return Math.max(1, offsets[1]! - offsets[0]!);
}

function extendHits(hits: readonly AbilityHit[], multiplier: number): AbilityHit[] {
  const dots = hits.filter(dotHit);
  const extra = Math.max(0, Math.floor(dots.length * (multiplier - 1)));
  if (extra === 0) return hits.map((hit) => ({ ...hit, band: { ...hit.band } }));
  const step = cadence(dots);
  const template = dots[dots.length - 1]!;
  const lastOffset = template.tickOffset ?? 0;
  return [
    ...hits.map((hit) => ({ ...hit, band: { ...hit.band } })),
    ...Array.from({ length: extra }, (_, index) => ({
      ...template,
      band: { ...template.band },
      tickOffset: lastOffset + step * (index + 1),
    })),
  ];
}

function extendDerived(
  derived: NonNullable<AbilitySpec["derivedHits"]>,
  multiplier: number,
): NonNullable<AbilitySpec["derivedHits"]> {
  if (!derived.dot) return { ...derived };
  const extra = Math.max(0, Math.floor(derived.count * (multiplier - 1)));
  if (extra === 0) return { ...derived, fractionPcts: derived.fractionPcts?.slice() };
  const fractions = derived.fractionPcts
    ? [
        ...derived.fractionPcts,
        ...Array.from({ length: extra }, () => derived.fractionPcts!.at(-1)!),
      ]
    : undefined;
  return {
    ...derived,
    count: derived.count + extra,
    ...(fractions ? { fractionPcts: fractions } : {}),
  };
}

export function extendTearingThornsAbility(ability: AbilitySpec, multiplier = 2): AbilitySpec {
  if (ability.tearingThornsEligible !== true || multiplier <= 1) return ability;
  return {
    ...ability,
    hits: extendHits(ability.hits, multiplier),
    ...(ability.derivedHits ? { derivedHits: extendDerived(ability.derivedHits, multiplier) } : {}),
  };
}
