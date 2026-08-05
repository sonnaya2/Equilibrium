/**
 * Explicit honesty surface for SolverResultDTO.
 * Consumers gate Apply / labels from these fields - never from exploratory scores alone.
 */
import type { ProofLabel, SolveStatus } from "./contracts";
import type { SolverResultDTO } from "./worker/serializable";
import { VERIFIED_CACHEABLE_PROOFS } from "./identity";
import { exactnessEligibleForExactProof, RESIDUAL_FREE_TOLERANCE } from "./objective";

export { RESIDUAL_FREE_TOLERANCE };

/** Machine-readable honesty block always emitted by buildSolverResultDto. */
export interface SolverResultHonesty {
  /** Finalize status: ok when a full-rankable best exists (upgrade or incumbent). */
  status: SolveStatus;
  /**
   * True when presentation is residual-free and exact (or merged-exactly).
   * Ranking may still have been residual-free score-only; residual presentation fails this.
   */
  fullyValidated: boolean;
  /** True when proposed full score beats the incumbent (score compare only). */
  beatsBar: boolean;
  /** Branch expansion exactness of the presentation re-sim when known. */
  branchExactness: string | null;
  /** Residual probability mass on the presentation re-sim (0 when residual-free). */
  residualMass: number;
  /** Full-horizon incumbent score when evaluated; -Infinity when none. */
  currentBarScore: number;
  /** Full-horizon proposed/winner score. */
  proposedBarScore: number;
  /** proposed - current when beatsBar; else 0. */
  improvement: number;
  /** True only when Apply is allowed (upgrade + residual-free + verified proof). */
  applyAllowed: boolean;
}

export function residualMassOfDto(
  dto: Pick<SolverResultDTO, "rng" | "summary" | "honesty">,
): number {
  if (typeof dto.honesty?.residualMass === "number" && Number.isFinite(dto.honesty.residualMass)) {
    return Math.max(0, dto.honesty.residualMass);
  }
  const w = dto.rng?.residualWeight ?? dto.summary?.rng?.residualWeight;
  return typeof w === "number" && Number.isFinite(w) && w > RESIDUAL_FREE_TOLERANCE ? w : 0;
}

export function branchExactnessOfDto(
  dto: Pick<SolverResultDTO, "rng" | "summary" | "honesty">,
): string | null {
  if (dto.honesty?.branchExactness != null && dto.honesty.branchExactness.length > 0) {
    return dto.honesty.branchExactness;
  }
  const ex = dto.rng?.exactness ?? dto.summary?.rng?.exactness;
  return typeof ex === "string" && ex.length > 0 ? ex : null;
}

/** Residual-free + exact/merged-exactly (or missing exactness as legacy exact). */
export function isFullyValidatedPresentation(
  residualMass: number,
  branchExactness: string | null | undefined,
): boolean {
  if (!(residualMass <= RESIDUAL_FREE_TOLERANCE)) return false;
  return exactnessEligibleForExactProof(
    branchExactness == null || branchExactness.length === 0 ? undefined : branchExactness,
  );
}

/**
 * Build the honesty block for a validated DTO path (buildSolverResultDto only).
 * beatsBar is raw score compare; residual only kills applyAllowed / fullyValidated.
 */
export function buildSolverResultHonesty(args: {
  status: SolveStatus;
  isUpgrade: boolean;
  validForApply: boolean;
  currentBarScore: number;
  proposedBarScore: number;
  improvement: number;
  proofLabel: ProofLabel;
  residualMass: number;
  branchExactness: string | null;
}): SolverResultHonesty {
  const residual = Math.max(0, args.residualMass);
  const fullyValidated = isFullyValidatedPresentation(residual, args.branchExactness);
  const residualFree = residual <= RESIDUAL_FREE_TOLERANCE;
  const proofOk = VERIFIED_CACHEABLE_PROOFS.has(args.proofLabel);
  const applyAllowed =
    fullyValidated &&
    residualFree &&
    args.validForApply &&
    args.isUpgrade &&
    proofOk &&
    Number.isFinite(args.proposedBarScore);

  return {
    status: args.status,
    fullyValidated,
    beatsBar: args.isUpgrade,
    branchExactness: args.branchExactness,
    residualMass: residual,
    currentBarScore: args.currentBarScore,
    proposedBarScore: args.proposedBarScore,
    improvement: args.isUpgrade ? args.improvement : 0,
    applyAllowed,
  };
}

/**
 * Fail-closed Apply gate from DTO honesty + legacy fields.
 * Residual mass or non-verified proofs never enable Apply.
 */
export function dtoAllowsApply(dto: SolverResultDTO | null | undefined): boolean {
  if (!dto?.bar?.length) return false;
  if (!Number.isFinite(dto.score)) return false;
  if (dto.honesty?.applyAllowed === false) return false;
  if (dto.honesty?.fullyValidated === false) return false;
  if (dto.honesty?.beatsBar === false) return false;
  if (dto.validForApply === false || dto.isUpgrade === false) return false;
  if (residualMassOfDto(dto) > RESIDUAL_FREE_TOLERANCE) return false;
  const proof = dto.proofLabel ?? dto.proof?.label;
  if (typeof proof !== "string" || proof.length === 0) return false;
  if (!VERIFIED_CACHEABLE_PROOFS.has(proof as ProofLabel)) return false;
  return true;
}
