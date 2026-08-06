/**
 * Multiplicity fields shared by scheduled and resolved events (no `resolve`
 * closure required - works on the event log).
 */
export interface MultiplicityFields {
  attached: boolean;
  expectedOccurrences?: number;
  expectedTriggerRolls?: number;
  expectedActivations?: number;
  expectedSeparateHits?: number;
}

/**
 * Resolved multiplicity for one landed event. Prefer explicit fields; fall back
 * to expectedOccurrences / attached for older schedulers.
 */
export interface ResolvedMultiplicity {
  expectedTriggerRolls: number;
  expectedActivations: number;
  expectedSeparateHits: number;
  expectedAttachedComponents: number;
}

export function resolveEventMultiplicity(event: MultiplicityFields): ResolvedMultiplicity {
  if (event.attached) {
    const activations = event.expectedActivations ?? event.expectedOccurrences ?? 1;
    return {
      expectedTriggerRolls: event.expectedTriggerRolls ?? 0,
      expectedActivations: activations,
      expectedSeparateHits: 0,
      expectedAttachedComponents: activations,
    };
  }

  if (event.expectedTriggerRolls !== undefined || event.expectedActivations !== undefined) {
    const activations = event.expectedActivations ?? event.expectedOccurrences ?? 1;
    return {
      expectedTriggerRolls: event.expectedTriggerRolls ?? 0,
      expectedActivations: activations,
      expectedSeparateHits: event.expectedSeparateHits ?? activations,
      expectedAttachedComponents: 0,
    };
  }

  // Legacy: expectedOccurrences < 1 means a chance-weighted EV proc event.
  if (event.expectedOccurrences !== undefined && event.expectedOccurrences < 1) {
    return {
      expectedTriggerRolls: 1,
      expectedActivations: event.expectedOccurrences,
      expectedSeparateHits: event.expectedOccurrences,
      expectedAttachedComponents: 0,
    };
  }

  // Legacy: expectedOccurrences > 1 is multi-application (e.g. Grasp tiles).
  if (event.expectedOccurrences !== undefined && event.expectedOccurrences !== 1) {
    return {
      expectedTriggerRolls: 0,
      expectedActivations: event.expectedOccurrences,
      expectedSeparateHits: event.expectedOccurrences,
      expectedAttachedComponents: 0,
    };
  }

  return {
    expectedTriggerRolls: 0,
    expectedActivations: 1,
    expectedSeparateHits: 1,
    expectedAttachedComponents: 0,
  };
}
