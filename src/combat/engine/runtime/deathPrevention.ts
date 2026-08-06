import { applyIncomingPlayerDamage, type PlayerVitality } from "../../core/playerVitality";

/**
 * Reusable death-prevention / revive charges for sim runtime.
 * Post-revive LP policy is explicit and may be provisional until wiki-sourced.
 */

export type ReviveLifePolicy =
  /** Provisional: restore to maximum LP (wiki does not state revive health %). */
  | "full-max"
  /** Leave current at 1 LP after intercept. */
  | "one-lp";

export interface DeathPreventionState {
  sourceId: string;
  /** Charges remaining while untilTick window is open. */
  charges: number;
  /** Exclusive end tick (half-open). 0 = inactive. */
  untilTick: number;
  policy: ReviveLifePolicy;
}

export const NO_DEATH_PREVENTION: DeathPreventionState = {
  sourceId: "",
  charges: 0,
  untilTick: 0,
  policy: "full-max",
};

export function deathPreventionActive(
  state: DeathPreventionState | null | undefined,
  tick: number,
): boolean {
  if (!state || state.untilTick <= 0 || state.charges <= 0) return false;
  return tick < state.untilTick;
}

export function makeDeathPrevention(opts: {
  sourceId: string;
  charges: number;
  untilTick: number;
  policy?: ReviveLifePolicy;
}): DeathPreventionState {
  return {
    sourceId: opts.sourceId,
    charges: Math.max(0, Math.floor(opts.charges)),
    untilTick: Math.max(0, Math.floor(opts.untilTick)),
    policy: opts.policy ?? "full-max",
  };
}

export function clearDeathPrevention(state: DeathPreventionState): DeathPreventionState {
  if (state.charges === 0 && state.untilTick === 0 && state.sourceId === "") return state;
  return { ...NO_DEATH_PREVENTION, policy: state.policy };
}

function reviveLife(vitality: PlayerVitality, policy: ReviveLifePolicy): PlayerVitality {
  if (policy === "one-lp") {
    return {
      maximumLifePoints: vitality.maximumLifePoints,
      currentLifePoints: Math.min(1, vitality.maximumLifePoints),
    };
  }
  // full-max (provisional for Naragi until wiki states revive health)
  return {
    maximumLifePoints: vitality.maximumLifePoints,
    currentLifePoints: vitality.maximumLifePoints,
  };
}

export interface PreventableDamageResult {
  vitality: PlayerVitality;
  deathPrevention: DeathPreventionState;
  died: boolean;
  revived: boolean;
  damageTaken: number;
  attempted: number;
}

/**
 * Apply incoming damage; if lethal and a charge remains in-window, consume it and revive.
 * Order: damage -> if wouldDie and preventable -> consume + revive (player lives).
 */
export function applyPreventablePlayerDamage(
  vitality: PlayerVitality,
  deathPrevention: DeathPreventionState,
  amount: number,
  tick: number,
): PreventableDamageResult {
  const hit = applyIncomingPlayerDamage(vitality, amount);
  if (!hit.wouldDie) {
    return {
      vitality: hit.vitality,
      deathPrevention,
      died: false,
      revived: false,
      damageTaken: hit.taken,
      attempted: hit.attempted,
    };
  }
  if (deathPreventionActive(deathPrevention, tick)) {
    const nextPrevention: DeathPreventionState = {
      ...deathPrevention,
      charges: deathPrevention.charges - 1,
    };
    return {
      vitality: reviveLife(hit.vitality, deathPrevention.policy),
      deathPrevention: nextPrevention,
      died: false,
      revived: true,
      damageTaken: hit.taken,
      attempted: hit.attempted,
    };
  }
  return {
    vitality: hit.vitality,
    deathPrevention,
    died: true,
    revived: false,
    damageTaken: hit.taken,
    attempted: hit.attempted,
  };
}
