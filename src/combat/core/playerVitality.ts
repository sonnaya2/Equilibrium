/**
 * Player life-point heal / clamp helpers for sim runtime.
 * Max LP comes from loadout life-point resolution; this module does not invent caps.
 */

export interface PlayerVitality {
  currentLifePoints: number;
  maximumLifePoints: number;
}

export interface HealResult {
  vitality: PlayerVitality;
  attempted: number;
  healed: number;
  overheal: number;
}

export interface DamageToPlayerResult {
  vitality: PlayerVitality;
  attempted: number;
  taken: number;
  /** True when current life would be <= 0 after the hit (before death-prevention). */
  wouldDie: boolean;
}

function assertNonNegativeFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`playerVitality: bad ${label} ${value}`);
  }
  return value;
}

export function clampCurrentLife(vitality: PlayerVitality): PlayerVitality {
  const max = assertNonNegativeFinite(vitality.maximumLifePoints, "maximumLifePoints");
  const cur = assertNonNegativeFinite(vitality.currentLifePoints, "currentLifePoints");
  return {
    maximumLifePoints: max,
    currentLifePoints: Math.min(cur, max),
  };
}

/** Reduce max LP and clamp current (unequip / max reduction). */
export function setMaximumLifePoints(
  vitality: PlayerVitality,
  maximumLifePoints: number,
): PlayerVitality {
  return clampCurrentLife({
    currentLifePoints: vitality.currentLifePoints,
    maximumLifePoints: assertNonNegativeFinite(maximumLifePoints, "maximumLifePoints"),
  });
}

export function applyPlayerHeal(vitality: PlayerVitality, amount: number): HealResult {
  const attempted = assertNonNegativeFinite(amount, "heal amount");
  const base = clampCurrentLife(vitality);
  if (attempted === 0) {
    return { vitality: base, attempted: 0, healed: 0, overheal: 0 };
  }
  const room = Math.max(0, base.maximumLifePoints - base.currentLifePoints);
  const healed = Math.min(room, attempted);
  const overheal = attempted - healed;
  return {
    vitality: {
      maximumLifePoints: base.maximumLifePoints,
      currentLifePoints: base.currentLifePoints + healed,
    },
    attempted,
    healed,
    overheal,
  };
}

/**
 * Apply incoming damage without death-prevention. Caller intercepts wouldDie.
 * Life is floored at 0. wouldDie when post-hit current is 0 (including already dead).
 */
export function applyIncomingPlayerDamage(
  vitality: PlayerVitality,
  amount: number,
): DamageToPlayerResult {
  const attempted = assertNonNegativeFinite(amount, "damage amount");
  const base = clampCurrentLife(vitality);
  if (attempted === 0) {
    return {
      vitality: base,
      attempted: 0,
      taken: 0,
      wouldDie: base.currentLifePoints <= 0,
    };
  }
  const before = base.currentLifePoints;
  const next = Math.max(0, before - attempted);
  return {
    vitality: {
      maximumLifePoints: base.maximumLifePoints,
      currentLifePoints: next,
    },
    attempted,
    taken: before - next,
    wouldDie: next <= 0,
  };
}

export const applyPlayerDamage = applyIncomingPlayerDamage;
