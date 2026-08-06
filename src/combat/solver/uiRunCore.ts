/**
 * UI Run core: pick best parallel branch-cap probe; hybrid score-only + full final.
 * Workers / main host only; no React.
 */
import type { RevolutionInput } from "../engine/simulation/revolution";
import { simulateRevolution } from "../engine/simulation/revolution";
import type { RotationSummary, SimulateOptions } from "../engine/simulation/simulate";
import {
  UI_RUN_BRANCH_FIDELITY_LADDER,
  RESIDUAL_FREE_TOLERANCE,
  budgetForLiveCap,
  meetsBranchCompleteness,
  type AdaptiveBranchFidelityResult,
  type BranchFidelityAttemptMeta,
  type BranchFidelityLadder,
} from "./branchFidelity";

export interface UiRunProbeResult {
  maxLiveBranches: number;
  residualWeight: number;
  ok: boolean;
  totalExpected: number;
  exactness?: string;
}

/**
 * Prefer residual-free at the *lowest* live cap (cheapest full-analysis).
 * Else lowest residual; among equal residual, higher live (more mass kept).
 */
export function pickBestUiRunProbe(probes: readonly UiRunProbeResult[]): UiRunProbeResult | null {
  const ok = probes.filter((p) => p.ok);
  const pool = ok.length > 0 ? ok : [...probes];
  if (pool.length === 0) return null;

  const free = pool.filter((p) => p.residualWeight <= RESIDUAL_FREE_TOLERANCE);
  if (free.length > 0) {
    let best = free[0]!;
    for (let i = 1; i < free.length; i++) {
      const p = free[i]!;
      if (p.maxLiveBranches < best.maxLiveBranches) best = p;
    }
    return best;
  }

  let best = pool[0]!;
  for (let i = 1; i < pool.length; i++) {
    const p = pool[i]!;
    if (p.residualWeight < best.residualWeight - RESIDUAL_FREE_TOLERANCE) {
      best = p;
      continue;
    }
    if (Math.abs(p.residualWeight - best.residualWeight) <= RESIDUAL_FREE_TOLERANCE) {
      if (p.maxLiveBranches > best.maxLiveBranches) best = p;
    }
  }
  return best;
}

export function isResidualFreeProbe(p: UiRunProbeResult): boolean {
  return p.ok && p.residualWeight <= RESIDUAL_FREE_TOLERANCE;
}

/** Chunk ladder for wave probes (cheapest wave first). */
export function chunkUiRunCaps(caps: readonly number[], waveSize: number): number[][] {
  const size = Math.max(1, waveSize);
  const out: number[][] = [];
  for (let i = 0; i < caps.length; i += size) {
    out.push([...caps.slice(i, i + size)]);
  }
  return out;
}

/** 2-4 workers; leave one core for UI when possible. */
export function preferredUiRunWorkerCount(hardwareConcurrency?: number): number {
  const cores =
    typeof hardwareConcurrency === "number" && hardwareConcurrency > 0
      ? hardwareConcurrency
      : typeof navigator !== "undefined" && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4;
  // Reserve 1 for main/UI when we have enough cores.
  const usable = cores > 2 ? cores - 1 : cores;
  return Math.max(2, Math.min(4, usable, UI_RUN_BRANCH_FIDELITY_LADDER.liveCaps.length));
}

export function probeFromSummary(
  summary: RotationSummary,
  maxLiveBranches: number,
): UiRunProbeResult {
  const residual = typeof summary.rng?.residualWeight === "number" ? summary.rng.residualWeight : 0;
  return {
    maxLiveBranches,
    residualWeight: residual,
    ok: summary.ok === true,
    totalExpected: typeof summary.totalExpected === "number" ? summary.totalExpected : 0,
    exactness: typeof summary.rng?.exactness === "string" ? summary.rng.exactness : undefined,
  };
}

/**
 * Score-only probe at one live cap (parallel worker job body).
 */
export function simulateUiRunProbe(
  input: RevolutionInput,
  maxLiveBranches: number,
  ladder: BranchFidelityLadder = UI_RUN_BRANCH_FIDELITY_LADDER,
  options?: SimulateOptions,
): UiRunProbeResult {
  const budget = budgetForLiveCap(maxLiveBranches, ladder.maximumResidualWeight);
  const summary = simulateRevolution(input, {
    ...options,
    detailLevel: "score-only",
    branchBudget: budget,
  });
  return probeFromSummary(summary, maxLiveBranches);
}

/**
 * Full-analysis presentation at a chosen live cap.
 */
export function simulateUiRunFullAnalysis(
  input: RevolutionInput,
  maxLiveBranches: number,
  ladder: BranchFidelityLadder = UI_RUN_BRANCH_FIDELITY_LADDER,
  options?: SimulateOptions,
): AdaptiveBranchFidelityResult {
  const budget = budgetForLiveCap(maxLiveBranches, ladder.maximumResidualWeight);
  const summary = simulateRevolution(input, {
    ...options,
    detailLevel: options?.detailLevel ?? "full-analysis",
    branchBudget: budget,
  });
  const residual = typeof summary.rng?.residualWeight === "number" ? summary.rng.residualWeight : 0;
  const meta: BranchFidelityAttemptMeta = {
    mode: ladder.mode,
    attempts: 1,
    finalBudget: budget,
    complete: meetsBranchCompleteness(summary, ladder),
    residualWeight: residual,
    exactness: typeof summary.rng?.exactness === "string" ? summary.rng.exactness : undefined,
  };
  return { summary, meta };
}

/**
 * Sequential hybrid for explicit main-thread runs: score-only climb then one full-analysis.
 */
export function simulateRevolutionForUiHybrid(
  input: RevolutionInput,
  options?: SimulateOptions,
  ladder: BranchFidelityLadder = UI_RUN_BRANCH_FIDELITY_LADDER,
): AdaptiveBranchFidelityResult {
  let attempts = 0;
  let chosenLive = ladder.liveCaps[0] ?? 128;

  for (let i = 0; i < ladder.liveCaps.length; i++) {
    const live = ladder.liveCaps[i]!;
    attempts += 1;
    const probe = simulateUiRunProbe(input, live, ladder, options);
    chosenLive = live;
    if (probe.ok && probe.residualWeight <= RESIDUAL_FREE_TOLERANCE) break;
    // Keep climbing while residual remains (mirror adaptive stop on last rung).
    if (i >= ladder.liveCaps.length - 1) break;
  }

  const full = simulateUiRunFullAnalysis(input, chosenLive, ladder, options);
  return {
    summary: full.summary,
    meta: {
      ...full.meta,
      attempts: attempts + 1,
      residualWeight: full.meta.residualWeight,
    },
  };
}

/**
 * Parallel hybrid on main (Promise.all still one thread unless workers).
 * Used when host fans out score-only probes then one full.
 */
export function finishUiRunFromProbes(
  input: RevolutionInput,
  probes: readonly UiRunProbeResult[],
  ladder: BranchFidelityLadder = UI_RUN_BRANCH_FIDELITY_LADDER,
  options?: SimulateOptions,
): AdaptiveBranchFidelityResult {
  const best = pickBestUiRunProbe(probes);
  const live = best?.maxLiveBranches ?? ladder.liveCaps[ladder.liveCaps.length - 1] ?? 128;
  const full = simulateUiRunFullAnalysis(input, live, ladder, options);
  return {
    summary: full.summary,
    meta: {
      ...full.meta,
      attempts: probes.length + 1,
    },
  };
}
