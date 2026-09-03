import type { SourceReference } from "../../types";

export const KERAPAC_WRIST_WRAPS_PASSIVE_ID = "kerapac-combust" as const;
export const KERAPAC_WRIST_WRAPS_WINDOW_TICKS = 10;
export const KERAPAC_WRIST_WRAPS_COMBUST_MULTIPLIER = 1.25;

export const KERAPAC_WRIST_WRAPS_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Kerapac%27s_wrist_wraps",
  title: "Kerapac's wrist wraps",
  verifiedAt: "2026-09-03",
};

export function armKerapacWristWraps(castTick: number): number {
  return castTick + KERAPAC_WRIST_WRAPS_WINDOW_TICKS;
}

export function kerapacWristWrapsActive(untilTick: number, castTick: number): boolean {
  return untilTick > 0 && castTick < untilTick;
}
