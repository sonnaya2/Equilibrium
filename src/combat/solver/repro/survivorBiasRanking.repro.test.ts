/**
 * REPRO (Phase 2 + Phase 4) - residual exploratory scores are non-rankable.
 *
 * Pre-Phase-2 bug: short explore scored DPM(totalExpected) with residualWeight > 0,
 * so survivor-conditional mean promoted a worse bar via degraded-exploratory-fallback.
 *
 * Phase 2 gates (evaluate + objective + evaluationSession):
 * 1. Short explore: residual / non-unit-mass / non-exact => ok:false / finite:false
 * 2. Full rescore: scoreSummary hard-fails residual -> validForFinalRanking false
 * 3. Search archive must not promote residual explore (forceEval returns null)
 *
 * Phase 4: no full winners => status failed, best null, proof failed.
 * Exploratory never becomes applyable via degraded-exploratory-fallback.
 *
 * Mock EvaluateFn mirrors production residual/explore semantics after Phase 2.
 * Plug real residual via fromRealResidualSummary in survivorBiasFixture.ts.
 *
 * Run:
 *   npx vitest run src/combat/solver/repro/survivorBiasRanking.repro.test.ts
 */
import { describe, expect, it } from "vitest";
import type { PoolAbility, SolveResult } from "../contracts";
import { configForTier } from "../solve";
import { createSearchState } from "../search/types";
import { finalizeSearch } from "../search/finalize";
import {
  PROPOSED_BAR,
  PROPOSED_DERIVED,
  PROPOSED_FIXTURE,
  REPRO_FULL_HORIZON_TICKS,
  REPRO_SEARCH_HORIZON_TICKS,
  USER_BAR,
  USER_DERIVED,
  USER_FIXTURE,
  assertSearchHorizonIsExploratory,
  createSurvivorBiasEvaluateFn,
} from "./survivorBiasFixture";

assertSearchHorizonIsExploratory();

const pool: PoolAbility[] = [
  { id: "user-basic", category: "basic", averageDamage: 10, occupancyTicks: 3 },
  { id: "user-threshold", category: "enhanced", averageDamage: 30, occupancyTicks: 3 },
  { id: "survivor-ult", category: "ultimate", averageDamage: 100, occupancyTicks: 3 },
  { id: "survivor-basic", category: "basic", averageDamage: 10, occupancyTicks: 3 },
];

/** Pipeline record for agents / CI logs (Phase 2 / 4). */
export interface Phase2Record {
  survivingConcreteMass_user: number;
  survivingConcreteMass_proposed: number;
  residualMass_user: number;
  residualMass_proposed: number;
  conditionalExpectedDamage_user: number;
  conditionalExpectedDamage_proposed: number;
  knownMassDamage_user: number;
  knownMassDamage_proposed: number;
  /** Legacy conditional DPM (diagnostic); production explore no longer emits this as rank. */
  legacyExploratoryDpm_user: number;
  legacyExploratoryDpm_proposed: number;
  /** forceEval search result score, or -Infinity when non-rankable. */
  exploreForceScore_user: number;
  exploreForceScore_proposed: number;
  exploreFinite_user: boolean;
  exploreFinite_proposed: boolean;
  trustworthyFullDpm_user: number;
  trustworthyFullDpm_proposed: number;
  fullRankable_user: boolean;
  fullRankable_proposed: boolean;
  fullScore_user: number;
  fullScore_proposed: number;
  solveStatus: SolveResult["status"];
  proof: SolveResult["proof"];
  bestBar: readonly string[] | null;
  bestExploratoryScore: number;
  bestFullScore: number;
  validForFinalRanking: boolean | null;
  dtoBar: readonly string[] | null;
  dtoProofLabel: string | null;
  dtoScore: number | null;
}

function runPipeline(): { result: SolveResult; record: Phase2Record } {
  const evaluate = createSurvivorBiasEvaluateFn();
  const state = createSearchState({
    pool,
    sizeBounds: { min: 2, max: 2 },
    evaluate,
    config: {
      ...configForTier("thorough", 1),
      evaluationBudget: 40,
      fullShortlistSize: 4,
      searchHorizonTicks: REPRO_SEARCH_HORIZON_TICKS,
      fullHorizonTicks: REPRO_FULL_HORIZON_TICKS,
      profileId: "balanced",
    },
    // User bar is the current / authored seed (seed baseline + shortlist ensure).
    seeds: [USER_BAR],
  });

  // Explore both bars under short horizon (mirrors search archive + seed baseline).
  const exploreUser = state.forceEval(USER_BAR, "search", "repro-user-explore");
  const exploreProposed = state.forceEval(PROPOSED_BAR, "search", "repro-proposed-explore");

  // Full-horizon force (same as finalize rescore) for recorded full scores.
  const fullUser = state.forceEval(USER_BAR, "full", "repro-user-full");
  const fullProposed = state.forceEval(PROPOSED_BAR, "full", "repro-proposed-full");

  const result = finalizeSearch(state, { tier: "thorough", topK: 3 });

  // Phase 4: no best when no full winners - DTO projection is null.
  const dtoBar = result.best ? [...result.best.bar] : null;
  const dtoScore =
    result.best && Number.isFinite(result.best.robustScore) ? result.best.robustScore : null;
  const dtoProofLabel = result.best ? result.proof : null;

  const record: Phase2Record = {
    survivingConcreteMass_user: USER_FIXTURE.concreteMass,
    survivingConcreteMass_proposed: PROPOSED_FIXTURE.concreteMass,
    residualMass_user: USER_FIXTURE.residualMass,
    residualMass_proposed: PROPOSED_FIXTURE.residualMass,
    conditionalExpectedDamage_user: USER_FIXTURE.conditionalExpectedDamage,
    conditionalExpectedDamage_proposed: PROPOSED_FIXTURE.conditionalExpectedDamage,
    knownMassDamage_user: USER_DERIVED.knownMassDamage,
    knownMassDamage_proposed: PROPOSED_DERIVED.knownMassDamage,
    legacyExploratoryDpm_user: USER_DERIVED.exploratoryDpm,
    legacyExploratoryDpm_proposed: PROPOSED_DERIVED.exploratoryDpm,
    exploreForceScore_user: exploreUser?.robustScore ?? Number.NEGATIVE_INFINITY,
    exploreForceScore_proposed: exploreProposed?.robustScore ?? Number.NEGATIVE_INFINITY,
    exploreFinite_user: exploreUser != null && Number.isFinite(exploreUser.robustScore),
    exploreFinite_proposed:
      exploreProposed != null && Number.isFinite(exploreProposed.robustScore),
    trustworthyFullDpm_user: USER_DERIVED.trustworthyFullDpm,
    trustworthyFullDpm_proposed: PROPOSED_DERIVED.trustworthyFullDpm,
    fullRankable_user: fullUser?.validForFinalRanking === true,
    fullRankable_proposed: fullProposed?.validForFinalRanking === true,
    fullScore_user: fullUser?.robustScore ?? Number.NEGATIVE_INFINITY,
    fullScore_proposed: fullProposed?.robustScore ?? Number.NEGATIVE_INFINITY,
    solveStatus: result.status,
    proof: result.proof,
    bestBar: result.best ? [...result.best.bar] : null,
    bestExploratoryScore: result.bestExploratoryScore,
    bestFullScore: result.bestFullScore,
    validForFinalRanking: result.best?.validForFinalRanking ?? null,
    dtoBar,
    dtoProofLabel,
    dtoScore,
  };

  console.log(
    "[survivorBiasRanking.repro] PHASE-2/4 record",
    JSON.stringify(
      record,
      (_k, v) =>
        v === Number.NEGATIVE_INFINITY
          ? "-Infinity"
          : v === Number.POSITIVE_INFINITY
            ? "Infinity"
            : v,
      2,
    ),
  );

  return { result, record };
}

describe("REPRO: survivor-bias residual explore gates (Phase 2 + 4)", () => {
  it("fixture: substantial residual on proposed; known-mass prefers user; legacy explore preferred proposed", () => {
    expect(PROPOSED_FIXTURE.residualMass).toBeGreaterThan(0.5);
    expect(USER_FIXTURE.residualMass + USER_FIXTURE.concreteMass).toBeCloseTo(1, 9);
    expect(PROPOSED_FIXTURE.residualMass + PROPOSED_FIXTURE.concreteMass).toBeCloseTo(1, 9);

    // Survivor conditional mean inflates proposed; known-mass prefers user.
    expect(PROPOSED_FIXTURE.conditionalExpectedDamage).toBeGreaterThan(
      USER_FIXTURE.conditionalExpectedDamage,
    );
    expect(USER_DERIVED.knownMassDamage).toBeGreaterThan(PROPOSED_DERIVED.knownMassDamage);
    expect(USER_DERIVED.trustworthyFullDpm).toBeGreaterThan(PROPOSED_DERIVED.trustworthyFullDpm);
    // Legacy (pre-gate) arithmetic still documents the inflate that used to rank.
    expect(PROPOSED_DERIVED.exploratoryDpm).toBeGreaterThan(USER_DERIVED.exploratoryDpm);

    expect(USER_DERIVED.knownMassDamage).toBeCloseTo(3_840, 6);
    expect(PROPOSED_DERIVED.knownMassDamage).toBeCloseTo(2_400, 6);
    expect(USER_DERIVED.exploratoryDpm).toBeCloseTo(10_000, 6);
    expect(PROPOSED_DERIVED.exploratoryDpm).toBeCloseTo(40_000, 6);
    expect(USER_DERIVED.trustworthyFullDpm).toBeCloseTo(3_840, 6);
    expect(PROPOSED_DERIVED.trustworthyFullDpm).toBeCloseTo(2_400, 6);
  });

  it("PHASE 2+4: residual explore non-rankable; no full winners => failed", () => {
    const { result, record } = runPipeline();

    // 1. Substantial residual on proposed path.
    expect(record.residualMass_proposed).toBeGreaterThan(0.5);

    // 2. Progress vs pre-Phase-2: forceEval search returns null / non-finite for residual bars.
    //    (Previously explore proposed scored 40000 and beat user 10000.)
    expect(record.exploreFinite_user).toBe(false);
    expect(record.exploreFinite_proposed).toBe(false);
    expect(Number.isFinite(record.exploreForceScore_proposed)).toBe(false);
    expect(Number.isFinite(record.exploreForceScore_user)).toBe(false);
    // Legacy diagnostic still shows proposed inflate - not used for ranking.
    expect(record.legacyExploratoryDpm_proposed).toBe(PROPOSED_DERIVED.exploratoryDpm);
    expect(record.legacyExploratoryDpm_proposed).toBeGreaterThan(
      record.legacyExploratoryDpm_user * 2,
    );

    // 3. Full: both residual fixtures unrankable.
    expect(record.fullRankable_user).toBe(false);
    expect(record.fullRankable_proposed).toBe(false);
    expect(record.trustworthyFullDpm_proposed).toBeLessThan(record.trustworthyFullDpm_user);
    expect(Number.isFinite(record.fullScore_proposed) && record.fullScore_proposed > 0).toBe(
      false,
    );

    // 4. Known-mass diagnostic still prefers user.
    expect(record.knownMassDamage_user).toBeGreaterThan(record.knownMassDamage_proposed);
    expect(record.trustworthyFullDpm_user).toBeGreaterThan(record.trustworthyFullDpm_proposed);

    // 5. Phase 4: no full winners => failed; exploratory never applied as best.
    expect(result.validFullCandidateCount).toBe(0);
    expect(result.best).toBeNull();
    expect(result.status).toBe("failed");
    expect(result.proof).toBe("failed");
    expect(record.bestBar).toBeNull();
    expect(record.dtoBar).toBeNull();
    expect(record.dtoScore).toBeNull();
    expect(record.dtoProofLabel).toBeNull();
  });

  it("does not recommend residual-inflated exploratory winner over better user known-mass", () => {
    const { result, record } = runPipeline();

    expect(record.trustworthyFullDpm_user).toBeGreaterThan(record.trustworthyFullDpm_proposed);

    // Phase 4: refuse when all residual bars fail explore+full.
    expect(result.best).toBeNull();
    expect(result.status).toBe("failed");
    expect(result.proof).toBe("failed");
    expect(result.validFullCandidateCount).toBe(0);
  });
});
