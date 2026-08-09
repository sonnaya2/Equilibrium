import type { WeaponClass } from "../../data/records";
import {
  effectiveSetPieces,
  type SetPieceContributionModifier,
} from "../../shared/equipment";

export type ChromaticChoirSetId = "sirenic" | "elite-sirenic";

export type ChromaticChoirGem = "dragonstone" | "onyx" | "hydrix";

export interface ChromaticChoirSetSummary {
  setId: ChromaticChoirSetId | null;
  physicalPieces: number;
  effectivePieces: number;
  crossbowEligible: boolean;
  mixed: boolean;
  procChance: number;
  thresholds: { two: boolean; three: boolean };
  gems: readonly ChromaticChoirGem[];
}

const TWO_PC_GEMS: readonly ChromaticChoirGem[] = ["dragonstone"];
const THREE_PC_GEMS: readonly ChromaticChoirGem[] = ["dragonstone", "onyx", "hydrix"];

export function chromaticChoirSetSummary(
  counts: ReadonlyMap<string, number>,
  itemCounts: ReadonlyMap<string, number>,
  contribution: SetPieceContributionModifier | undefined,
  weaponClass: WeaponClass | null,
): ChromaticChoirSetSummary {
  const physicalNormal = counts.get("sirenic") ?? 0;
  const physicalElite = counts.get("elite-sirenic") ?? 0;
  const mixed = physicalNormal > 0 && physicalElite > 0;
  const setId = mixed
    ? null
    : physicalElite > 0
      ? "elite-sirenic"
      : physicalNormal > 0
        ? "sirenic"
        : null;
  const physicalPieces = physicalNormal + physicalElite;
  const itemCount = (itemCounts.get("sirenic") ?? 0) + (itemCounts.get("elite-sirenic") ?? 0);
  const effectivePieces = mixed ? 0 : effectiveSetPieces(physicalPieces, contribution, itemCount);
  const thresholds = {
    two: effectivePieces >= 2,
    three: effectivePieces >= 3,
  };
  const crossbowEligible = setId !== null && weaponClass === "crossbow";
  const baseProc =
    setId === "elite-sirenic" ? 0.12 : setId === "sirenic" ? 0.06 : 0;
  const procChance = crossbowEligible && thresholds.two ? baseProc : 0;
  const gems = thresholds.three
    ? [...THREE_PC_GEMS]
    : thresholds.two
      ? [...TWO_PC_GEMS]
      : [];
  return {
    setId,
    physicalPieces,
    effectivePieces,
    crossbowEligible,
    mixed,
    procChance,
    thresholds,
    gems,
  };
}

export function chromaticChoirActive(
  summary: ChromaticChoirSetSummary | undefined,
): boolean {
  return (
    summary != null &&
    summary.crossbowEligible === true &&
    summary.procChance > 0 &&
    summary.thresholds.two === true
  );
}

/** 3pc onyx heal / hydrix deathmark+adren change later state. */
export function chromaticChoirNeedsStochasticLanes(
  summary: ChromaticChoirSetSummary | undefined,
): boolean {
  return chromaticChoirActive(summary) && summary!.thresholds.three === true;
}

export function chromaticChoirGems(
  summary: ChromaticChoirSetSummary | undefined,
): readonly ChromaticChoirGem[] {
  if (!chromaticChoirActive(summary)) return [];
  return summary!.gems;
}

export function chromaticChoirGemWeight(
  summary: ChromaticChoirSetSummary | undefined,
  gem: ChromaticChoirGem,
): number {
  const gems = chromaticChoirGems(summary);
  if (gems.length === 0 || !gems.includes(gem)) return 0;
  return 1 / gems.length;
}

export function chromaticChoirProcStream(parentCastId: number, hitIndex: number): string {
  return `chromatic-choir:proc:${parentCastId}:${hitIndex}`;
}

export function chromaticChoirGemStream(parentCastId: number, hitIndex: number): string {
  return `chromatic-choir:gem:${parentCastId}:${hitIndex}`;
}

export function chromaticChoirAnalysisId(gem: ChromaticChoirGem): string {
  return `set:chromatic-choir:${gem}`;
}
