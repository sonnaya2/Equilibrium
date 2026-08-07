import { describe, expect, it } from "vitest";
import {
  budgetForLiveCap,
  DEFAULT_BRANCH_FIDELITY_LADDERS,
  UI_RUN_BRANCH_FIDELITY_LADDER,
  UI_RUN_INITIAL_LIVE_BRANCH_CAP,
  UI_RUN_MAX_LIVE_BRANCH_CAP,
  meetsBranchCompleteness,
  resolveBranchFidelityLadder,
  simulateWithAdaptiveBranchFidelity,
  simulateRevolutionForUi,
  shouldStopAdaptiveAttempt,
  branchFidelityModeForEval,
  branchFidelityCacheToken,
  RESIDUAL_FREE_TOLERANCE,
} from "./branchFidelity";
import {
  resolveBranchBudget,
  defaultBranchBudget,
  MAX_LIVE_BRANCHES,
} from "../engine/simulation/branch";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { RevolutionInput } from "../engine/simulation/revolution";
import { simulateRevolution } from "../engine/simulation/revolution";
import { summaryEligibleForObjectiveScore } from "./objective";
import { survivorBiasPrimaryFixture } from "./repro/survivorBiasRanking.repro";

function basic(id: string, name: string, minPct: number, maxPct: number): AbilitySpec {
  return {
    id,
    name,
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct, maxPct } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 5.4,
  };
}

const auto: AbilitySpec = {
  id: "attack",
  name: "Attack",
  style: "melee",
  category: "basic",
  basicAttack: true,
  hits: [{ band: { minPct: 110, maxPct: 130 } }],
  adrenaline: { gain: 9 },
};

const alpha = basic("alpha", "Alpha", 100, 100);
const beta = basic("beta", "Beta", 150, 150);

function simpleRevo(durationTicks = 12): RevolutionInput {
  return {
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    abilities: [auto, alpha, beta],
    bar: [alpha, beta],
    style: "melee",
    durationTicks,
    startingAdrenaline: 100,
  };
}

describe("resolveBranchBudget", () => {
  it("defaults match MAX_LIVE_BRANCHES policy (64/128)", () => {
    const d = defaultBranchBudget();
    expect(d).toEqual({
      maxLiveBranches: 64,
      maxIntermediateBranches: 128,
      maximumResidualWeight: 0,
    });
    expect(resolveBranchBudget()).toEqual(d);
  });

  it("rejects invalid live/intermediate", () => {
    expect(() => resolveBranchBudget({ maxLiveBranches: 0 })).toThrow(/maxLiveBranches/);
    expect(() => resolveBranchBudget({ maxLiveBranches: 8, maxIntermediateBranches: 4 })).toThrow(
      /maxIntermediateBranches/,
    );
  });
});

describe("branch fidelity ladders", () => {
  it("default ladders match starting policy", () => {
    expect(DEFAULT_BRANCH_FIDELITY_LADDERS.exploratory.liveCaps).toEqual([64, 128, 256, 512]);
    expect(DEFAULT_BRANCH_FIDELITY_LADDERS.exploratory.maximumResidualWeight).toBe(1e-3);
    expect(DEFAULT_BRANCH_FIDELITY_LADDERS.medium.liveCaps).toEqual([256, 512, 1024]);
    expect(DEFAULT_BRANCH_FIDELITY_LADDERS.medium.maximumResidualWeight).toBe(1e-4);
    expect(DEFAULT_BRANCH_FIDELITY_LADDERS.full.liveCaps).toEqual([512, 1024, 2048, 4096, 8192]);
    expect(DEFAULT_BRANCH_FIDELITY_LADDERS.full.maximumResidualWeight).toBe(1e-12);
    expect(DEFAULT_BRANCH_FIDELITY_LADDERS.full.exactness).toBe("exact-or-merged");
  });

  it("overrides liveCaps and residual threshold", () => {
    const ladder = resolveBranchFidelityLadder("exploratory", {
      exploratory: { liveCaps: [4, 8], maximumResidualWeight: 0.05 },
    });
    expect(ladder.liveCaps).toEqual([4, 8]);
    expect(ladder.maximumResidualWeight).toBe(0.05);
    expect(ladder.mode).toBe("exploratory");
  });

  it("maps eval modes to ladder modes", () => {
    expect(branchFidelityModeForEval("search")).toBe("exploratory");
    expect(branchFidelityModeForEval("medium")).toBe("medium");
    expect(branchFidelityModeForEval("full")).toBe("full");
    expect(branchFidelityModeForEval("finalize")).toBe("full");
  });
});

describe("meetsBranchCompleteness", () => {
  const explore = DEFAULT_BRANCH_FIDELITY_LADDERS.exploratory;
  const full = DEFAULT_BRANCH_FIDELITY_LADDERS.full;

  it("accepts residual within exploratory threshold without exactness requirement", () => {
    expect(
      meetsBranchCompleteness(
        {
          ok: true,
          rng: { residualWeight: 1e-3, exactness: "approximated" },
        },
        explore,
      ),
    ).toBe(true);
  });

  it("rejects residual above exploratory threshold", () => {
    expect(
      meetsBranchCompleteness(
        {
          ok: true,
          rng: { residualWeight: 1e-3 + 1e-9, exactness: "approximated" },
        },
        explore,
      ),
    ).toBe(false);
  });

  it("full requires residual near zero and exact-or-merged", () => {
    expect(
      meetsBranchCompleteness({ ok: true, rng: { residualWeight: 0, exactness: "exact" } }, full),
    ).toBe(true);
    expect(
      meetsBranchCompleteness(
        { ok: true, rng: { residualWeight: 0, exactness: "merged-exactly" } },
        full,
      ),
    ).toBe(true);
    expect(
      meetsBranchCompleteness(
        { ok: true, rng: { residualWeight: 0, exactness: "approximated" } },
        full,
      ),
    ).toBe(false);
    expect(
      meetsBranchCompleteness(
        { ok: true, rng: { residualWeight: 1e-9, exactness: "exact" } },
        full,
      ),
    ).toBe(false);
  });

  it("guidance-complete residual still fails ranking gates (no launder)", () => {
    const guidance = {
      ok: true as const,
      damageByTick: { 0: 1 },
      rng: {
        residualWeight: 5e-4,
        totalsBasis: "known-mass-contribution" as const,
        exactness: "approximated" as const,
      },
    };
    expect(meetsBranchCompleteness(guidance, explore)).toBe(true);
    expect(summaryEligibleForObjectiveScore(guidance)).toBe(false);
  });
});

describe("shouldStopAdaptiveAttempt", () => {
  const explore = DEFAULT_BRANCH_FIDELITY_LADDERS.exploratory;

  it("does not stop mid-ladder on residual-in-band (keeps escalating for residual-free)", () => {
    const mid = {
      ok: true as const,
      rng: { residualWeight: 5e-4, exactness: "approximated" as const },
    };
    expect(meetsBranchCompleteness(mid, explore)).toBe(true);
    expect(shouldStopAdaptiveAttempt(mid, explore, 0)).toBe(false);
    expect(shouldStopAdaptiveAttempt(mid, explore, explore.liveCaps.length - 1)).toBe(true);
  });

  it("stops immediately when residual-free", () => {
    const free = {
      ok: true as const,
      rng: { residualWeight: RESIDUAL_FREE_TOLERANCE, exactness: "exact" as const },
    };
    expect(shouldStopAdaptiveAttempt(free, explore, 0)).toBe(true);
  });
});

describe("budgetForLiveCap", () => {
  it("sets intermediate to 2x live by default", () => {
    expect(budgetForLiveCap(256, 1e-4)).toEqual({
      maxLiveBranches: 256,
      maxIntermediateBranches: 512,
      maximumResidualWeight: 1e-4,
    });
  });
});

describe("simulateWithAdaptiveBranchFidelity", () => {
  it("completes on first attempt for residual-free simple bar", () => {
    const ladder = resolveBranchFidelityLadder("exploratory", {
      exploratory: { liveCaps: [64, 128], maximumResidualWeight: 1e-3 },
    });
    const result = simulateWithAdaptiveBranchFidelity(simpleRevo(20), undefined, ladder);
    expect(result.meta.complete).toBe(true);
    expect(result.meta.attempts).toBe(1);
    expect(result.meta.finalBudget.maxLiveBranches).toBe(64);
    expect(result.summary.ok).toBe(true);
    expect(result.summary.rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-3);
  });

  it("stops at first complete rung (does not escalate further)", () => {
    const ladder = resolveBranchFidelityLadder("full", {
      full: {
        liveCaps: [64, 128, 256],
        maximumResidualWeight: 1e-12,
        exactness: "exact-or-merged",
      },
    });
    const result = simulateWithAdaptiveBranchFidelity(simpleRevo(16), undefined, ladder);
    expect(result.meta.complete).toBe(true);
    expect(result.meta.attempts).toBe(1);
    expect(result.meta.finalBudget.maxLiveBranches).toBe(64);
  });

  it("cache token distinguishes complete vs incomplete", () => {
    const a = branchFidelityCacheToken({
      mode: "exploratory",
      attempts: 1,
      finalBudget: budgetForLiveCap(64, 1e-3),
      complete: true,
      residualWeight: 0,
    });
    const b = branchFidelityCacheToken({
      mode: "exploratory",
      attempts: 2,
      finalBudget: budgetForLiveCap(128, 1e-3),
      complete: false,
      residualWeight: 0.5,
    });
    expect(a).not.toBe(b);
  });

  it("exhausted ladder returns incomplete meta (unrankable caller path)", () => {
    // maxLive=1 forces residual on multi-RNG adrenaline bars with Impatient.
    const impatient = {
      ...simpleRevo(24),
      adrenaline: { impatientRank: 4, impatientLevel20: true, relentlessRank: 5 },
    };
    const ladder = resolveBranchFidelityLadder("exploratory", {
      exploratory: {
        liveCaps: [1],
        maximumResidualWeight: 0,
        exactness: "any",
      },
    });
    const result = simulateWithAdaptiveBranchFidelity(impatient, undefined, ladder);
    // Either residual remains (incomplete) or rare residual-free (complete).
    if ((result.summary.rng?.residualWeight ?? 0) > 0) {
      expect(result.meta.complete).toBe(false);
      expect(result.meta.attempts).toBe(1);
      expect(result.meta.finalBudget.maxLiveBranches).toBe(1);
      // Known-mass ledger under residual - never unit-mass rank.
      expect(result.summary.rng?.totalsBasis ?? result.summary.damage?.scope).toMatch(
        /known-mass|concrete-terminals/,
      );
    } else {
      expect(result.meta.complete).toBe(true);
    }
  });

  it("elevated branchBudget can reduce residual vs default live cap (occupancy path threaded)", () => {
    const impatient = {
      ...simpleRevo(40),
      adrenaline: { impatientRank: 4, impatientLevel20: true, relentlessRank: 5 },
    };
    const tight = simulateRevolution(impatient, {
      branchBudget: {
        maxLiveBranches: 2,
        maxIntermediateBranches: 4,
        maximumResidualWeight: 0,
      },
    });
    const wide = simulateRevolution(impatient, {
      branchBudget: {
        maxLiveBranches: 256,
        maxIntermediateBranches: 512,
        maximumResidualWeight: 0,
      },
    });
    expect(tight.ok).toBe(true);
    expect(wide.ok).toBe(true);
    const tightR = tight.rng?.residualWeight ?? 0;
    const wideR = wide.rng?.residualWeight ?? 0;
    // When tight discards mass, wide must not be worse (typically strictly lower).
    if (tightR > 1e-9) {
      expect(wideR).toBeLessThanOrEqual(tightR + 1e-12);
      expect(wideR).toBeLessThan(tightR);
    }
    expect(MAX_LIVE_BRANCHES).toBe(64);
  });
});

describe("UI_RUN_BRANCH_FIDELITY_LADDER", () => {
  it("scales from 128 to the temporary 4096 ceiling", () => {
    expect(MAX_LIVE_BRANCHES).toBe(64);
    expect(UI_RUN_INITIAL_LIVE_BRANCH_CAP).toBe(128);
    expect(UI_RUN_MAX_LIVE_BRANCH_CAP).toBe(4096);
    expect(UI_RUN_BRANCH_FIDELITY_LADDER.liveCaps).toEqual([128, 256, 512, 1024, 2048, 4096]);
    expect(budgetForLiveCap(UI_RUN_MAX_LIVE_BRANCH_CAP, 1e-12)).toEqual({
      maxLiveBranches: 4096,
      maxIntermediateBranches: 8192,
      maximumResidualWeight: 1e-12,
    });
    expect(UI_RUN_BRANCH_FIDELITY_LADDER.mode).toBe("medium");
    expect(UI_RUN_BRANCH_FIDELITY_LADDER.exactness).toBe("any");
    expect(UI_RUN_BRANCH_FIDELITY_LADDER.maximumResidualWeight).toBe(1e-12);
  });

  it("simulateRevolutionForUi reduces residual vs default 64 on survivor-bias primary", () => {
    const fx = survivorBiasPrimaryFixture();
    const at64 = simulateRevolution(fx.revoInput, { detailLevel: "score-only" });
    const ui = simulateRevolutionForUi(fx.revoInput, { detailLevel: "score-only" });
    expect(at64.ok).toBe(true);
    expect(ui.summary.ok).toBe(true);
    const r64 = at64.rng?.residualWeight ?? 0;
    const rUi = ui.summary.rng?.residualWeight ?? ui.meta.residualWeight;
    // Fixture is high-residual at default cap; UI ladder must improve mass retention.
    expect(r64).toBeGreaterThan(0.5);
    expect(rUi).toBeLessThan(r64);
    expect(ui.meta.finalBudget.maxLiveBranches).toBeGreaterThan(MAX_LIVE_BRANCHES);
    // Known-mass under residual still disclosed (no launder to unit-mass rank).
    if (rUi > 1e-12) {
      expect(ui.summary.rng?.totalsBasis ?? ui.summary.damage?.scope).toMatch(
        /known-mass|concrete-terminals/,
      );
    }
  }, 120_000);
});
