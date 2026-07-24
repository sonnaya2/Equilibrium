/**
 * Damage Potential (post-Mar-2024): against NPCs, accuracy is not a binary hit/miss
 * roll. At 70% accuracy the attack always connects, scaled to 70% of its damage.
 * UI copy must call this Damage Potential, never "hit chance".
 */
export function damagePotential(accuracy: number): number {
  if (!Number.isFinite(accuracy)) throw new RangeError(`damagePotential: bad accuracy ${accuracy}`);
  return Math.min(1, Math.max(0, accuracy));
}

export function applyDamagePotential(damage: number, accuracy: number): number {
  return damage * damagePotential(accuracy);
}
