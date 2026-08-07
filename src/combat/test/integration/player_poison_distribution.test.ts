import { describe, expect, it } from "vitest";
import { simulateRevolution, type RevolutionInput } from "../../engine/simulation/revolution";
import { simulate } from "../../engine/simulation/simulate";
import { rotationOf } from "../../engine/simulation/contracts";
import {
  enableBranchProfiling,
  getBranchProfile,
  resetBranchProfile,
} from "../../engine/simulation/branch";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { PLAYER_POISON_EFFECT_ID, type PlayerPoisonProfile } from "../../poison/mechanics";
import {
  resolveBranchFidelityLadder,
  simulateWithAdaptiveBranchFidelity,
} from "../../solver/branchFidelity";
import { leagueModifiers, resolveLeagueRules } from "../../league/ruleset";

const ability = (id: string) => {
  const found = MELEE_ABILITIES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
};

const base: RevolutionInput = {
  base: 1_000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
  bar: ["hurricane", "dismember", "assault", "fury", "punish"].map(ability),
  style: "melee",
  durationTicks: 100,
  startingAdrenaline: 100,
};

const poison = (patch: Partial<PlayerPoisonProfile> = {}): PlayerPoisonProfile => ({
  potion: "weapon-plus-plus-plus",
  potionUntilTick: 1_200,
  kwuarmPotency: 0,
  cinderbane: false,
  blowpipe: false,
  laniakea: false,
  ...patch,
});

const manualRotation = ["dismember", "fury", "punish"] as const;

describe("player poison distribution integration", () => {
  it("keeps 60-second poison variants unit-mass, ordered, and branch-free", () => {
    enableBranchProfiling();
    try {
      const run = (playerPoison?: PlayerPoisonProfile) => {
        resetBranchProfile();
        const result = simulateRevolution(
          { ...base, ...(playerPoison ? { playerPoison } : {}) },
          { detailLevel: "full-analysis" },
        );
        return { result, profile: getBranchProfile() };
      };

      const off = run();
      const potion = run(poison());
      const cinderbane = run(poison({ cinderbane: true }));
      const kwuarm = run(poison({ kwuarmPotency: 4 }));

      expect(potion.result.totalExpected).toBeGreaterThan(off.result.totalExpected);
      expect(cinderbane.result.totalExpected).toBeGreaterThan(potion.result.totalExpected);
      expect(kwuarm.result.totalExpected).toBeGreaterThan(potion.result.totalExpected);
      expect(potion.result.playerPoison?.effectiveTier).toBe(4);
      expect(cinderbane.result.playerPoison?.effectiveTier).toBe(5);
      expect(cinderbane.result.playerPoison!.separateHits).toBeGreaterThan(
        potion.result.playerPoison!.separateHits,
      );
      expect(cinderbane.result.playerPoison!.successfulCinderbaneContinuations).toBeGreaterThan(0);
      expect(cinderbane.result.playerPoison!.expectedDamage).toBeGreaterThan(
        potion.result.playerPoison!.expectedDamage * 1.2,
      );
      expect(kwuarm.result.playerPoison!.expectedDamage).toBeCloseTo(
        potion.result.playerPoison!.expectedDamage * 1.1,
        8,
      );

      for (const sample of [potion, cinderbane, kwuarm]) {
        expect(sample.result.rng).toBeUndefined();
        expect(sample.result.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
        expect(sample.profile.branchSnapshots).toBe(0);
        expect(sample.profile.snapshotFieldsCloned).toBe(0);
        expect(sample.profile.branchKeySerializations).toBe(0);
        expect(sample.profile.branchKeyChars).toBe(0);
        expect(sample.profile.residualMassEvents).toBe(0);
        expect(sample.profile.fidelityRetries).toBe(0);
        expect(sample.profile.maxLiveBranches).toBe(1);
      }
    } finally {
      enableBranchProfiling(false);
    }
  });

  it("keeps 60-second Cinderbane score-only and full-analysis totals identical", () => {
    const input = { ...base, ammo: "bik" as const, playerPoison: poison({ cinderbane: true }) };
    const full = simulateRevolution(input, { detailLevel: "full-analysis" });
    const score = simulateRevolution(input, { detailLevel: "score-only" });
    expect(score.totalExpected).toBe(full.totalExpected);
    expect(score.damageByTick).toEqual(full.damageByTick);
    expect(full.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
    expect(full.playerPoison?.expectedDamage).toBeGreaterThan(0);
  });

  it("keeps a realistic manual rotation aligned across poison variants and detail levels", () => {
    const run = (
      playerPoison?: PlayerPoisonProfile,
      detailLevel: "full-analysis" | "score-only" = "full-analysis",
    ) => {
      return simulate(
        {
          ...base,
          horizonTicks: 100,
          rotation: rotationOf(...Array.from({ length: 12 }, () => manualRotation).flat()),
          ...(playerPoison ? { playerPoison } : {}),
        },
        { detailLevel },
      );
    };

    const off = run();
    const potion = run(poison());
    const cinderbane = run(poison({ cinderbane: true }));
    const kwuarm = run(poison({ kwuarmPotency: 4 }));
    const score = run(poison({ cinderbane: true }), "score-only");

    expect(off.ok).toBe(true);
    expect(potion.ok).toBe(true);
    expect(cinderbane.ok).toBe(true);
    expect(kwuarm.ok).toBe(true);
    expect(potion.totalExpected).toBeGreaterThan(off.totalExpected);
    expect(cinderbane.totalExpected).toBeGreaterThan(potion.totalExpected);
    expect(kwuarm.totalExpected).toBeGreaterThan(potion.totalExpected);
    expect(potion.playerPoison?.effectiveTier).toBe(4);
    expect(cinderbane.playerPoison?.effectiveTier).toBe(5);
    expect(cinderbane.playerPoison!.separateHits).toBeGreaterThan(
      potion.playerPoison!.separateHits,
    );
    expect(kwuarm.playerPoison!.expectedDamage).toBeCloseTo(
      potion.playerPoison!.expectedDamage * 1.1,
      8,
    );
    for (const result of [potion, cinderbane, kwuarm]) {
      expect(result.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
      expect(result.rng).toBeUndefined();
    }
    expect(score.totalExpected).toBeCloseTo(cinderbane.totalExpected, 10);
    expect(score.damageByTick).toEqual(cinderbane.damageByTick);
  });

  it("adds Big Boned to every poison hit in a 60-second Cinderbane bar", () => {
    const league = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Balance"] },
      { maximumLife: 15_000 },
    );
    const ordinary = simulateRevolution(
      { ...base, playerPoison: poison() },
      { detailLevel: "full-analysis" },
    );
    const ordinaryCinderbane = simulateRevolution(
      { ...base, playerPoison: poison({ cinderbane: true }) },
      { detailLevel: "full-analysis" },
    );
    const blessedCinderbaneInput = {
      ...base,
      league,
      modifiers: leagueModifiers(league),
      context: { style: "melee" as const, ruleset: "equilibrium" as const },
      playerPoison: poison({ cinderbane: true }),
    };
    enableBranchProfiling();
    try {
      resetBranchProfile();
      const blessed = simulateRevolution(
        {
          ...base,
          league,
          modifiers: leagueModifiers(league),
          context: { style: "melee", ruleset: "equilibrium" },
          playerPoison: poison(),
        },
        { detailLevel: "full-analysis" },
      );
      const blessedCinderbane = simulateRevolution(blessedCinderbaneInput, {
        detailLevel: "full-analysis",
      });
      const scoreOnly = simulateRevolution(blessedCinderbaneInput, {
        detailLevel: "score-only",
      });
      const poisonHits = blessedCinderbane.events.filter(
        (event) => event.abilityId === PLAYER_POISON_EFFECT_ID,
      );
      const bigBoned = blessedCinderbane.events.filter(
        (event) =>
          event.abilityId === "big-boned" && event.bonusTargetId === PLAYER_POISON_EFFECT_ID,
      );
      const poisonRow = blessedCinderbane.analysis.byEffect.find(
        (effect) => effect.id === PLAYER_POISON_EFFECT_ID,
      );
      const profile = getBranchProfile();

      expect(bigBoned).toHaveLength(poisonHits.length);
      expect(poisonHits.length).toBeGreaterThan(0);
      expect(
        bigBoned.every(
          (event) =>
            event.attached &&
            event.expectedSeparateHits === 0 &&
            !event.procEligible &&
            event.originKind === "poison" &&
            poisonHits.some((poisonHit) => poisonHit.seq === event.derivedFrom),
        ),
      ).toBe(true);
      expect(
        bigBoned.reduce((sum, event) => sum + (event.expectedActivations ?? 0), 0),
      ).toBeCloseTo(blessedCinderbane.playerPoison!.separateHits, 12);
      expect(blessed.playerPoison!.applicationAttempts).toBeCloseTo(
        ordinary.playerPoison!.applicationAttempts,
        12,
      );
      expect(blessed.playerPoison!.successfulApplications).toBeCloseTo(
        ordinary.playerPoison!.successfulApplications,
        12,
      );
      expect(blessedCinderbane.playerPoison!.applicationAttempts).toBeCloseTo(
        ordinaryCinderbane.playerPoison!.applicationAttempts,
        12,
      );
      expect(blessedCinderbane.playerPoison!.successfulApplications).toBeCloseTo(
        ordinaryCinderbane.playerPoison!.successfulApplications,
        12,
      );
      expect(blessed.playerPoison!.expectedDamage).toBeGreaterThan(
        ordinary.playerPoison!.expectedDamage,
      );
      expect(blessedCinderbane.playerPoison!.expectedDamage).toBeGreaterThan(
        ordinaryCinderbane.playerPoison!.expectedDamage,
      );
      expect(poisonRow?.bonusDamage).toBeGreaterThan(0);
      expect(blessedCinderbane.playerPoison!.successfulCinderbaneContinuations).toBeGreaterThan(0);
      expect(blessedCinderbane.playerPoison!.probabilityMass).toBeCloseTo(1, 12);
      expect(blessedCinderbane.rng).toBeUndefined();
      expect(scoreOnly.totalExpected).toBeCloseTo(blessedCinderbane.totalExpected, 10);
      expect(scoreOnly.damageByTick).toEqual(blessedCinderbane.damageByTick);
      expect(profile.branchSnapshots).toBe(0);
      expect(profile.branchKeySerializations).toBe(0);
    } finally {
      enableBranchProfiling(false);
    }
  });

  it("finishes a Cinders and poison-heavy solver evaluation on the first fidelity rung", () => {
    const league = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Balance", "Chaos"] },
      { maximumLife: 15_000 },
    );
    const ladder = resolveBranchFidelityLadder("full", {
      full: {
        liveCaps: [1, 64],
        maximumResidualWeight: 0,
        exactness: "exact-or-merged",
      },
    });
    enableBranchProfiling();
    try {
      resetBranchProfile();
      const evaluated = simulateWithAdaptiveBranchFidelity(
        {
          ...base,
          ammo: "bik",
          league,
          modifiers: leagueModifiers(league),
          context: { style: "melee", ruleset: "equilibrium" },
          playerPoison: poison({ cinderbane: true }),
        },
        { detailLevel: "score-only" },
        ladder,
      );
      const profile = getBranchProfile();
      expect(evaluated.meta).toMatchObject({ attempts: 1, complete: true, residualWeight: 0 });
      expect(evaluated.meta.finalBudget.maxLiveBranches).toBe(1);
      expect(evaluated.summary.totalExpected).toBeGreaterThan(0);
      expect(evaluated.summary.rng).toBeUndefined();
      expect(profile.branchSnapshots).toBe(0);
      expect(profile.branchKeySerializations).toBe(0);
      expect(profile.mergeAndCapDiscards).toBe(0);
      expect(profile.residualMassEvents).toBe(0);
      expect(profile.maxLiveBranches).toBe(1);
    } finally {
      enableBranchProfiling(false);
    }
  });
});
