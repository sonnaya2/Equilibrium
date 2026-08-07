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
  occurrenceModel?:
    | { readonly kind: "bernoulli"; readonly probability: number }
    | {
        readonly kind: "geometric";
        readonly startProbability: number;
        readonly continuationProbability: number;
      };
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

function unitProbability(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} outside 0-1: ${value}`);
  }
  return value;
}

export function expectedStatefulOccurrences(event: MultiplicityFields): number {
  const model = event.occurrenceModel;
  if (model?.kind === "bernoulli") return unitProbability(model.probability, "probability");
  if (model?.kind === "geometric") {
    const start = unitProbability(model.startProbability, "startProbability");
    const continuation = unitProbability(model.continuationProbability, "continuationProbability");
    if (continuation >= 1) throw new RangeError("geometric continuationProbability must be < 1");
    return start / (1 - continuation);
  }
  return resolveEventMultiplicity(event).expectedActivations;
}

export function statefulOccurrenceProbability(event: MultiplicityFields): number {
  const model = event.occurrenceModel;
  if (model?.kind === "bernoulli") return unitProbability(model.probability, "probability");
  if (model?.kind === "geometric") {
    return unitProbability(model.startProbability, "startProbability");
  }
  const count = expectedStatefulOccurrences(event);
  if (count >= 1) return 1;
  return unitProbability(count, "expectedActivations");
}

export function statefulProcSuccessProbability(
  event: MultiplicityFields,
  chancePerOccurrence: number,
): number {
  const chance = unitProbability(chancePerOccurrence, "chancePerOccurrence");
  const model = event.occurrenceModel;
  if (model?.kind === "geometric") {
    const start = unitProbability(model.startProbability, "startProbability");
    const continuation = unitProbability(model.continuationProbability, "continuationProbability");
    if (continuation >= 1) throw new RangeError("geometric continuationProbability must be < 1");
    return (start * chance) / (1 - continuation * (1 - chance));
  }
  const count = expectedStatefulOccurrences(event);
  if (model?.kind === "bernoulli" || count < 1) return count * chance;
  if (!Number.isInteger(count)) {
    throw new RangeError(`stateful event requires an occurrence model for count ${count}`);
  }
  return 1 - (1 - chance) ** count;
}
