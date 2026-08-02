import type { ScheduledEvent } from "../runtime/events";

/**
 * Resolved multiplicity for one landed event. Prefer explicit fields; fall back
 * to expectedOccurrences / attached for older schedulers.
 */
export interface ResolvedMultiplicity {
  triggerRolls: number;
  expectedActivations: number;
  expectedSeparateHits: number;
  attachedComponents: number;
}

export function resolveEventMultiplicity(event: ScheduledEvent): ResolvedMultiplicity {
  if (event.attached) {
    const activations =
      event.expectedActivations ?? event.expectedOccurrences ?? 1;
    return {
      triggerRolls: event.triggerRolls ?? 0,
      expectedActivations: activations,
      expectedSeparateHits: 0,
      attachedComponents: activations,
    };
  }

  if (event.triggerRolls !== undefined || event.expectedActivations !== undefined) {
    const activations = event.expectedActivations ?? event.expectedOccurrences ?? 1;
    return {
      triggerRolls: event.triggerRolls ?? 0,
      expectedActivations: activations,
      expectedSeparateHits: event.expectedSeparateHits ?? activations,
      attachedComponents: 0,
    };
  }

  // Legacy: expectedOccurrences < 1 means a chance-weighted EV proc event.
  if (event.expectedOccurrences !== undefined && event.expectedOccurrences < 1) {
    return {
      triggerRolls: 1,
      expectedActivations: event.expectedOccurrences,
      expectedSeparateHits: event.expectedOccurrences,
      attachedComponents: 0,
    };
  }

  // Legacy: expectedOccurrences > 1 is multi-application (e.g. Grasp tiles).
  if (event.expectedOccurrences !== undefined && event.expectedOccurrences !== 1) {
    return {
      triggerRolls: 0,
      expectedActivations: event.expectedOccurrences,
      expectedSeparateHits: event.expectedOccurrences,
      attachedComponents: 0,
    };
  }

  return {
    triggerRolls: 0,
    expectedActivations: 1,
    expectedSeparateHits: 1,
    attachedComponents: 0,
  };
}
