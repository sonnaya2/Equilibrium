import type { SourceReference } from "../types";
import { resolveAdrenalineCap } from "./adrenalineCap";

/**
 * Heightened Senses (Archaeology monolith relic).
 * https://runescape.wiki/w/Heightened_Senses
 * +10 absolute adrenaline cap points (base 100 -> 110).
 */

export const HEIGHTENED_SENSES_ID = "heightened_senses";
export const HEIGHTENED_SENSES_NAME = "Heightened Senses";
export const HEIGHTENED_SENSES_ADRENALINE_BONUS = 10;

export const HEIGHTENED_SENSES_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Heightened_Senses",
  title: "Heightened Senses",
  verifiedAt: "2026-08-02",
};

export function applyHeightenedSensesCap(baseCap: number, active: boolean): number {
  if (!Number.isFinite(baseCap)) return baseCap;
  return resolveAdrenalineCap(
    baseCap,
    active
      ? [
          {
            id: HEIGHTENED_SENSES_ID,
            kind: "points",
            value: HEIGHTENED_SENSES_ADRENALINE_BONUS,
          },
        ]
      : [],
  ).cap;
}
