/**
 * Survivor-bias residual fixture for solver ranking repros.
 *
 * Mirrors production semantics (engine contracts + evaluate short path):
 * - totalExpected = E[D|concrete] over surviving expanded terminals
 * - residual mass is disclosed, not mixed into totalExpected (not zero-filled)
 * - short explore (Phase 2): residual / non-unit-mass / non-exact => not finite rankable
 * - full: scoreSummary hard-fails when residualWeight > 0 -> not final-rankable
 *
 * Hook: replace fixture rows with a real residual summary from Agent A
 * (e.g. Leng hard-cap residual on a live revo bar) via fromRealResidualSummary.
 */

import { TICK_SECONDS } from "../../core/ticks";
import { MIN_RANKABLE_HORIZON_TICKS } from "../objective";
import type { EvalMode, EvalResult, EvaluateFn } from "../contracts";

/** Short exploratory horizon used by production search (< rankable windows). */
export const REPRO_SEARCH_HORIZON_TICKS = 40;

/** Full-horizon ticks for finalize re-score (rankable length; residual still fails). */
export const REPRO_FULL_HORIZON_TICKS = 100;

export interface ResidualBarFixture {
  /** Stable bar ids. */
  bar: readonly string[];
  /** Surviving concrete terminal mass (success + fail expanded). */
  concreteMass: number;
  /** Discarded / unexpanded mass. concreteMass + residualMass ~ 1. */
  residualMass: number;
  /**
   * Conditional expected damage over concrete terminals only (E[D|concrete]).
   * Production totalExpected with residualWeight > 0.
   */
  conditionalExpectedDamage: number;
  /** Production rng.exactness when residual remains. */
  exactness: "bounded-approximation" | "approximated";
}

export interface ResidualBarDerived {
  fixture: ResidualBarFixture;
  /** concreteMass * conditionalExpectedDamage - damage attributed to known mass. */
  knownMassDamage: number;
  /**
   * Unit-mass lower bound treating residual as zero damage:
   * same as knownMassDamage when residual is not mixed in.
   */
  unitMassLowerBoundDamage: number;
  /**
   * Legacy survivor-conditional exploratory DPM (pre-Phase-2 short path).
   * Diagnostic only; production no longer emits this as a finite rank score.
   */
  exploratoryDpm: number;
  /**
   * Trustworthy full diagnostic: known-mass damage scaled to full-horizon DPM.
   * Not production scoreSummary (which hard-fails); used only to compare honesty.
   */
  trustworthyFullDpm: number;
}

export function exploratoryDpmFromTotalExpected(
  totalExpected: number,
  durationTicks: number,
): number {
  const minutes = (durationTicks * TICK_SECONDS) / 60;
  return minutes > 0 ? totalExpected / minutes : 0;
}

export function deriveResidualBar(
  fixture: ResidualBarFixture,
  searchHorizonTicks: number = REPRO_SEARCH_HORIZON_TICKS,
  fullHorizonTicks: number = REPRO_FULL_HORIZON_TICKS,
): ResidualBarDerived {
  const knownMassDamage = fixture.concreteMass * fixture.conditionalExpectedDamage;
  const exploratoryDpm = exploratoryDpmFromTotalExpected(
    fixture.conditionalExpectedDamage,
    searchHorizonTicks,
  );
  // Same known-mass damage assumed on full window for diagnostic scale compare.
  const trustworthyFullDpm = exploratoryDpmFromTotalExpected(knownMassDamage, fullHorizonTicks);
  return {
    fixture,
    knownMassDamage,
    unitMassLowerBoundDamage: knownMassDamage,
    exploratoryDpm,
    trustworthyFullDpm,
  };
}

/**
 * Scenario numbers (locked).
 *
 * Proposed survivors look excellent (high E[D|concrete]) but most mass is residual.
 * User has low residual and moderate conditional mean; known-mass damage is higher.
 * Pre-Phase-2 short-path exploratory ranked proposed >> user; full rank fails both;
 * finalize degraded fallback recommended proposed.
 *
 * Phase 2: residual explore is non-rankable (finite:false); search archive must not
 * promote residual-inflated conditional means.
 *
 * Locked derived (search 40 ticks, full 100 ticks, TICK_SECONDS=0.6):
 *   user knownMass = 0.96 * 4000 = 3840; legacy explore DPM = 4000 / 0.4 = 10000
 *   proposed knownMass = 0.15 * 16000 = 2400; legacy explore DPM = 16000 / 0.4 = 40000
 *   trustworthy full DPM: user 3840/1.0 = 3840; proposed 2400/1.0 = 2400
 */
export const USER_BAR = ["user-basic", "user-threshold"] as const;
export const PROPOSED_BAR = ["survivor-ult", "survivor-basic"] as const;

export const USER_FIXTURE: ResidualBarFixture = {
  bar: USER_BAR,
  concreteMass: 0.96,
  residualMass: 0.04,
  conditionalExpectedDamage: 4_000,
  exactness: "bounded-approximation",
};

export const PROPOSED_FIXTURE: ResidualBarFixture = {
  bar: PROPOSED_BAR,
  concreteMass: 0.15,
  residualMass: 0.85,
  conditionalExpectedDamage: 16_000,
  exactness: "bounded-approximation",
};

export const USER_DERIVED = deriveResidualBar(USER_FIXTURE);
export const PROPOSED_DERIVED = deriveResidualBar(PROPOSED_FIXTURE);

export function barKey(bar: readonly string[]): string {
  return bar.join("|");
}

export function isSameBar(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Production-mirroring EvaluateFn for the two residual fixtures (Phase 2).
 * Unknown bars get weak unit-mass exploratory scores and residual full failure.
 *
 * Short explore: residual / non-exact => finite:false (no conditional-mean rank).
 * Full: validForFinalRanking only when residual = 0; both fixtures fail.
 */
export function createSurvivorBiasEvaluateFn(opts?: {
  user?: ResidualBarFixture;
  proposed?: ResidualBarFixture;
  searchHorizonTicks?: number;
}): EvaluateFn {
  const user = opts?.user ?? USER_FIXTURE;
  const proposed = opts?.proposed ?? PROPOSED_FIXTURE;
  const searchH = opts?.searchHorizonTicks ?? REPRO_SEARCH_HORIZON_TICKS;
  const byKey = new Map<string, ResidualBarFixture>([
    [barKey(user.bar), user],
    [barKey(proposed.bar), proposed],
  ]);

  return ({ bar, mode }: { bar: readonly string[]; mode?: EvalMode }): EvalResult => {
    const fx = byKey.get(barKey(bar));
    const isFull = mode === "full" || mode === "finalize";

    if (!fx) {
      // Other pool bars: low unit-mass explore, residual fail on full (no rankable full).
      if (isFull) {
        return residualFullFail(0.5);
      }
      return {
        score: 1,
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
        horizonTicks: searchH,
      };
    }

    if (isFull) {
      // Mirror scoreSummary hard-fail on residualWeight > 0.
      if (fx.residualMass > 0) {
        return residualFullFail(fx.residualMass);
      }
      // residual == 0 path (not used by locked fixtures; kept for real-fixture hook).
      const dpm = exploratoryDpmFromTotalExpected(
        fx.conditionalExpectedDamage,
        REPRO_FULL_HORIZON_TICKS,
      );
      return {
        score: dpm,
        finite: true,
        mode: "full",
        exploratory: false,
        validForFinalRanking: true,
        horizonTicks: REPRO_FULL_HORIZON_TICKS,
      };
    }

    // Short explore Phase 2: residual / non-exact never finite rankable.
    if (fx.residualMass > 0) {
      return residualExploreFail(fx.residualMass, searchH);
    }
    const dpm = exploratoryDpmFromTotalExpected(fx.conditionalExpectedDamage, searchH);
    return {
      score: dpm,
      finite: true,
      mode: "search",
      exploratory: true,
      validForFinalRanking: false,
      horizonTicks: searchH,
    };
  };
}

function residualExploreFail(residualWeight: number, searchH: number): EvalResult {
  return {
    score: Number.NEGATIVE_INFINITY,
    finite: false,
    mode: "search",
    exploratory: true,
    validForFinalRanking: false,
    horizonTicks: searchH,
    failureReason: `simulation residualWeight=${residualWeight}`,
  };
}

function residualFullFail(residualWeight: number): EvalResult {
  return {
    score: Number.NEGATIVE_INFINITY,
    finite: false,
    mode: "full",
    exploratory: false,
    validForFinalRanking: false,
    horizonTicks: REPRO_FULL_HORIZON_TICKS,
    failureReason: `simulation residualWeight=${residualWeight}`,
    objective: {
      ok: false,
      reason: `simulation residualWeight=${residualWeight}`,
      robustScore: 0,
      profileId: "balanced",
    },
  };
}

/**
 * Plug a real sim summary (Agent A residual fixture) into the same derived shape.
 * Expects production fields: totalExpected, rng.residualWeight, rng.concreteMass|probabilityMass.
 */
export function fromRealResidualSummary(
  bar: readonly string[],
  summary: {
    totalExpected: number;
    rng?: {
      residualWeight?: number;
      concreteMass?: number;
      probabilityMass?: number;
      exactness?: string;
    };
  },
  searchHorizonTicks: number = REPRO_SEARCH_HORIZON_TICKS,
  fullHorizonTicks: number = REPRO_FULL_HORIZON_TICKS,
): ResidualBarDerived {
  const residualMass = summary.rng?.residualWeight ?? 0;
  const concreteMass =
    summary.rng?.concreteMass ?? summary.rng?.probabilityMass ?? Math.max(0, 1 - residualMass);
  const exactness =
    summary.rng?.exactness === "approximated" ? "approximated" : "bounded-approximation";
  return deriveResidualBar(
    {
      bar,
      concreteMass,
      residualMass,
      conditionalExpectedDamage: summary.totalExpected,
      exactness,
    },
    searchHorizonTicks,
    fullHorizonTicks,
  );
}

/** Sanity: search horizon must stay below rankable so short path applies. */
export function assertSearchHorizonIsExploratory(
  ticks: number = REPRO_SEARCH_HORIZON_TICKS,
): void {
  if (ticks >= MIN_RANKABLE_HORIZON_TICKS) {
    throw new Error(
      `repro search horizon ${ticks} must be < MIN_RANKABLE_HORIZON_TICKS=${MIN_RANKABLE_HORIZON_TICKS}`,
    );
  }
}
