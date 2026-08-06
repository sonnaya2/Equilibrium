import type { SourceReference } from "../types";

/**
 * Fury of the Small (Archaeology monolith relic).
 * https://runescape.wiki/w/Fury_of_the_Small
 * +1% listed adrenaline on adrenaline-generating Basic abilities.
 * Flat +1 is applied before Invigorating mult (wiki: Invigorating multiplies the relic gain).
 */

export const FURY_OF_THE_SMALL_ID = "fury_of_the_small";
export const FURY_OF_THE_SMALL_NAME = "Fury of the Small";
export const FURY_OF_THE_SMALL_EXTRA_ADRENALINE = 1;

export const FURY_OF_THE_SMALL_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Fury_of_the_Small",
  title: "Fury of the Small",
  verifiedAt: "2026-08-02",
};

/** Basic ability with a positive listed adrenaline gain. */
export function furyOfTheSmallQualifies(ability: {
  category?: string;
  adrenaline?: { gain?: number };
}): boolean {
  const gain = ability.adrenaline?.gain;
  if (!(typeof gain === "number" && gain > 0)) return false;
  return ability.category === "basic";
}
