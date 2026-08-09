export const BLACK_STONE_ARMOUR_REDUCTION_FRACTION = 0.0075;
export const BLACK_STONE_PER_APPLICATION_CAP = 22;
export const BLACK_STONE_TOTAL_REDUCTION_FRACTION = 0.15;
export const BLACK_STONE_TOTAL_RATING_CAP = 454;
export const BLACK_STONE_DURATION_TICKS = 1200;

export type BlackStoneResetReason = "target-death" | "debuff-clear";

export interface BlackStoneArmourState {
  originalBaseArmour: number;
  applications: number;
  reducedRating: number;
  appliedAtTick: number | null;
  expiresAtTick: number | null;
}

export const newBlackStoneArmourState = (originalBaseArmour: number): BlackStoneArmourState => {
  validateArmour(originalBaseArmour, "original base armour");
  return {
    originalBaseArmour,
    applications: 0,
    reducedRating: 0,
    appliedAtTick: null,
    expiresAtTick: null,
  };
};

export interface BlackStoneArmourApplication {
  state: BlackStoneArmourState;
  reduction: number;
  effectiveBaseArmour: number;
  totalCap: number;
  perApplicationCap: number;
}

export interface BlackStoneReset {
  reason: BlackStoneResetReason;
  state: BlackStoneArmourState;
}

function validateArmour(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${label} must be finite and non-negative`);
}

function validateTick(tick: number): void {
  if (!Number.isInteger(tick) || tick < 0)
    throw new Error("land tick must be a non-negative integer");
}

function totalCapFor(originalBaseArmour: number): number {
  return Math.floor(
    Math.min(
      originalBaseArmour * BLACK_STONE_TOTAL_REDUCTION_FRACTION,
      BLACK_STONE_TOTAL_RATING_CAP,
    ),
  );
}

function perApplicationCapFor(originalBaseArmour: number): number {
  return Math.floor(
    Math.min(
      originalBaseArmour * BLACK_STONE_ARMOUR_REDUCTION_FRACTION,
      BLACK_STONE_PER_APPLICATION_CAP,
    ),
  );
}

function expiredAt(state: BlackStoneArmourState, landTick: number): boolean {
  return state.expiresAtTick != null && landTick >= state.expiresAtTick;
}

export function applyBlackStoneArmourReduction(
  state: BlackStoneArmourState,
  landTick: number,
): BlackStoneArmourApplication {
  validateArmour(state.originalBaseArmour, "original base armour");
  validateTick(landTick);
  const workingState = expiredAt(state, landTick)
    ? newBlackStoneArmourState(state.originalBaseArmour)
    : state;
  const totalCap = totalCapFor(workingState.originalBaseArmour);
  const perApplicationCap = perApplicationCapFor(workingState.originalBaseArmour);
  const reduction = Math.max(0, Math.min(perApplicationCap, totalCap - workingState.reducedRating));
  const nextState =
    reduction === 0
      ? workingState
      : {
          ...workingState,
          applications: workingState.applications + 1,
          reducedRating: workingState.reducedRating + reduction,
          appliedAtTick: landTick,
          expiresAtTick: landTick + BLACK_STONE_DURATION_TICKS,
        };
  return {
    state: nextState,
    reduction,
    effectiveBaseArmour: effectiveBaseArmourAtTick(nextState, landTick),
    totalCap,
    perApplicationCap,
  };
}

export function effectiveBaseArmourAtTick(state: BlackStoneArmourState, tick: number): number {
  validateTick(tick);
  return blackStoneActiveAtTick(state, tick)
    ? Math.max(0, state.originalBaseArmour - state.reducedRating)
    : state.originalBaseArmour;
}

export function blackStoneActiveAtTick(state: BlackStoneArmourState, tick: number): boolean {
  return (
    state.appliedAtTick != null &&
    state.expiresAtTick != null &&
    Number.isInteger(tick) &&
    tick >= state.appliedAtTick &&
    tick < state.expiresAtTick
  );
}

export function resetBlackStoneArmour(
  state: BlackStoneArmourState,
  reason: BlackStoneResetReason,
): BlackStoneReset {
  return { reason, state: newBlackStoneArmourState(state.originalBaseArmour) };
}

export function resetBlackStoneOnTargetDeath(state: BlackStoneArmourState): BlackStoneReset {
  return resetBlackStoneArmour(state, "target-death");
}

export function clearBlackStoneDebuff(state: BlackStoneArmourState): BlackStoneReset {
  return resetBlackStoneArmour(state, "debuff-clear");
}
