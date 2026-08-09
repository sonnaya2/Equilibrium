export interface TargetStatusSource {
  readonly id: string;
  readonly label: string;
}

export interface TimedTargetStatus {
  readonly source: TargetStatusSource;
  readonly appliedAtTick: number;
  readonly expiresAtTick: number;
}

export function activeTimedTargetStatus(
  status: TimedTargetStatus | undefined,
  tick: number,
): status is TimedTargetStatus {
  return status !== undefined && tick < status.expiresAtTick;
}

export function normalizeTimedTargetStatus(
  status: TimedTargetStatus | undefined,
  tick: number,
): TimedTargetStatus | undefined {
  return activeTimedTargetStatus(status, tick) ? status : undefined;
}

export function applyTimedTargetStatus(
  source: TargetStatusSource,
  tick: number,
  durationTicks: number,
): TimedTargetStatus {
  if (!Number.isInteger(durationTicks) || durationTicks <= 0) {
    throw new RangeError(`durationTicks must be a positive integer: ${durationTicks}`);
  }
  return {
    source: { ...source },
    appliedAtTick: tick,
    expiresAtTick: tick + durationTicks,
  };
}
