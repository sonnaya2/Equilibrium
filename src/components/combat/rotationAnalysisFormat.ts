import type { ResolvedEvent } from "@/combat";

const expectedNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
export const RESOLVED_EVENT_PREVIEW_LIMIT = 12;

export function resolvedEventPreview<T extends Pick<ResolvedEvent, "abilityId">>(
  events: readonly T[],
): { events: readonly T[]; pinnedPerfectEquilibrium: boolean } {
  const initial = events.slice(0, RESOLVED_EVENT_PREVIEW_LIMIT);
  const perfectEquilibrium = events.find((event) => event.abilityId === "perfect_equilibrium");
  if (!perfectEquilibrium || initial.includes(perfectEquilibrium)) {
    return { events: initial, pinnedPerfectEquilibrium: false };
  }
  return { events: [...initial, perfectEquilibrium], pinnedPerfectEquilibrium: true };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Describes packed occurrence metadata without recomputing its expectation. */
export function occurrenceModelNote(
  event: Pick<
    ResolvedEvent,
    "abilityId" | "blessingId" | "expectedActivations" | "expectedOccurrences" | "occurrenceModel"
  >,
  effectLabel: string,
): string | null {
  const model = event.occurrenceModel;
  if (model?.kind !== "geometric") return null;
  const expected = event.expectedActivations ?? event.expectedOccurrences;
  const expectedLabel =
    expected === undefined ? "packed EV" : `${expectedNumber.format(expected)} expected`;
  const prefix =
    event.blessingId === "unholy-critual" ? "Critual recursive chain" : "Recursive geometric chain";
  return `${prefix}: ${expectedLabel} ${effectLabel} per eligible parent (${percent(
    model.startProbability,
  )} start; ${percent(model.continuationProbability)} continuation)`;
}
