/**
 * Bloodlust: the post-modernisation melee resource. Basics build it; several adrenaline
 * abilities scale from or consume it. Modelled as state - never a flat multiplier.
 */
export const BLOODLUST_CAP = 4;
export const BLOODLUST_CAP_BERSERK = 8;
/** Stacks granted on Berserk activation, per the modernisation patch notes. */
export const BERSERK_ACTIVATION_STACKS = 4;

export interface BloodlustState {
  stacks: number;
  berserk: boolean;
}

export const BERSERK_DURATION_SECONDS = 19.8;
export const BERSERK_DAMAGE_MULTIPLIER = 1.75;

export const newBloodlust = (): BloodlustState => ({ stacks: 0, berserk: false });

export function bloodlustCap(state: BloodlustState): number {
  return state.berserk ? BLOODLUST_CAP_BERSERK : BLOODLUST_CAP;
}

/** Basics generate double Bloodlust during Berserk - the doubling lives here in the
 *  state machine, not in each ability record. */
export function gainBloodlust(state: BloodlustState, base: number): BloodlustState {
  const gain = state.berserk ? base * 2 : base;
  return { ...state, stacks: Math.min(bloodlustCap(state), state.stacks + gain) };
}

export function spendBloodlust(state: BloodlustState, cost: number): BloodlustState {
  return { ...state, stacks: Math.max(0, state.stacks - cost) };
}

/** Berserk: cap rises to 8 and grants stacks on activation. */
export function activateBerserk(state: BloodlustState): BloodlustState {
  const next = { ...state, berserk: true };
  return {
    ...next,
    stacks: Math.min(bloodlustCap(next), state.stacks + BERSERK_ACTIVATION_STACKS),
  };
}

/** Window over: cap drops back and excess stacks fall off with it. */
export function endBerserk(state: BloodlustState): BloodlustState {
  const next = { ...state, berserk: false };
  return { ...next, stacks: Math.min(bloodlustCap(next), next.stacks) };
}
