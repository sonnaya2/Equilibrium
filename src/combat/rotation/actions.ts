/** One queued cast; the simulator advances to its first legal tick. */
export interface RotationAction {
  abilityId: string;
}

export function rotationOf(...abilityIds: string[]): RotationAction[] {
  return abilityIds.map((abilityId) => ({ abilityId }));
}
