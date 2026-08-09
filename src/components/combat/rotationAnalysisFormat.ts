import type { ResolvedEvent } from "@/combat";

const expectedNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Full event list for the results panel (no truncated preview). */
export function resolvedEventPreview<T extends Pick<ResolvedEvent, "abilityId">>(
  events: readonly T[],
): { events: readonly T[]; pinnedPerfectEquilibrium: boolean } {
  return { events, pinnedPerfectEquilibrium: false };
}

export type EventTimelineMark = {
  isTickStart: boolean;
  isCastStart: boolean;
};

/** Presentation marks for land-tick / source-cast grouping in the event table. */
export function eventTimelineMarks(
  events: readonly Pick<ResolvedEvent, "tick" | "sourceCast">[],
): EventTimelineMark[] {
  return events.map((event, index) => {
    const prev = index > 0 ? events[index - 1] : undefined;
    const isTickStart = !prev || prev.tick !== event.tick;
    const isCastStart =
      isTickStart || (prev != null && prev.sourceCast !== event.sourceCast);
    return { isTickStart, isCastStart };
  });
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
