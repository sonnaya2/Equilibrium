import type { ResolvedEvent } from "@/combat";

const expectedNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

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
