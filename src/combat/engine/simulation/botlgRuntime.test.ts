import { describe, expect, it } from "vitest";
import { performCast } from "../cast";
import { advanceTo } from "../runtime/clock";
import { createRuntime } from "../runtime/runtime";
import { patchRanged, patchTarget } from "../runtime/state";
import { activeEquipmentEffects, type ActiveEquipmentEffects } from "../../shared/equipment";
import { resolveLeagueRules } from "../../league/ruleset";
import { rangedInput } from "../../test/fixtures/inputs";
import { testRangedAmmunition } from "../../testing/rangedAmmunition";
import { resolveAmmunitionProfile } from "../../styles/ranged/ammunitionProfile";
import {
  applyBlackStoneArmourReduction,
  newBlackStoneArmourState,
  type BlackStoneArmourState,
} from "../../styles/ranged/blackStone";
import type { ResolvedTargetAccuracyProfile } from "../../target/genericTarget";
import type { CombatModifier } from "../../types";

const unholy = resolveLeagueRules({
  ruleset: "equilibrium",
  blessingPicks: ["Order", "Order", "Order", "Order", "Chaos"],
});

function botlgEffects(): ActiveEquipmentEffects {
  const base = activeEquipmentEffects({ style: "ranged" });
  return {
    ...base,
    passiveIds: ["perfect-equilibrium"],
    weaponClass: "bow",
    activeWeapon: {
      ...base.activeWeapon,
      id: "item:bow-of-the-last-guardian",
      slot: "twohand",
      style: "ranged",
      specialAttackId: "balance_by_force",
      passiveIds: ["perfect-equilibrium"],
    },
  };
}

function otherBowEffects(): ActiveEquipmentEffects {
  const base = activeEquipmentEffects({ style: "ranged" });
  return {
    ...base,
    passiveIds: [],
    weaponClass: "bow",
    activeWeapon: {
      ...base.activeWeapon,
      id: "item:noxious-longbow",
      slot: "twohand",
      style: "ranged",
      specialAttackId: null,
      passiveIds: [],
    },
  };
}

function fulAmmunition() {
  return {
    projectile: resolveAmmunitionProfile({
      id: "item:test-ful-arrows",
      label: "Test Ful arrows",
      family: "arrows",
      statTier: 100,
      mechanicId: "ful",
      support: { status: "modeled", label: "Test fixture" },
    }),
    quiver: null,
    weaponCapability: { mode: "optional" as const, acceptedFamily: "arrows" as const },
    effectiveStatTier: 100,
  };
}

function blackStoneAmmunition() {
  return {
    projectile: resolveAmmunitionProfile({
      id: "item:test-black-stone-arrows",
      label: "Test Black Stone arrows",
      family: "arrows",
      statTier: 95,
      mechanicId: "black-stone",
      support: { status: "modeled", label: "Test fixture" },
    }),
    quiver: null,
    weaponCapability: { mode: "optional" as const, acceptedFamily: "arrows" as const },
    effectiveStatTier: 95,
  };
}

const targetAccuracyProfile: ResolvedTargetAccuracyProfile = {
  playerAccuracyRating: 1000,
  originalTargetArmourRating: 1200,
  affinity: "same",
  additiveHitChance: 0,
};

function runTargetedPhysical(
  profile: ResolvedTargetAccuracyProfile | undefined,
  ammunition: ReturnType<typeof fulAmmunition>,
  initialBlackStone?: BlackStoneArmourState,
) {
  const rt = createRuntime(
    {
      ...rangedInput,
      ammunition,
      ...(profile ? { targetAccuracyProfile: profile } : {}),
      league: unholy,
      crit: { chance: 0 },
      startingAdrenaline: 100,
      equipmentEffects: botlgEffects(),
      context: { style: "ranged", ruleset: "equilibrium" },
    },
    { laneIndex: 0, laneCount: 128 },
  );
  rt.state = patchRanged(rt.state, { perfectEquilibriumStacks: 7 });
  if (initialBlackStone) rt.state = patchTarget(rt.state, { blackStone: initialBlackStone });
  const ability = rt.byId.get("ranged_attack");
  if (!ability) throw new Error("missing ranged attack");
  const attempt = performCast(rt, ability, 0, false);
  if (!attempt.ok) throw new Error(attempt.error);
  advanceTo(rt, rt.endTick);
  const event = rt.events.find((candidate) => candidate.abilityId === "perfect_equilibrium");
  if (!event) throw new Error("missing Perfect Equilibrium event");
  return { rt, event, potential: rt.hitDetails.get(event.seq)?.potential };
}

function multiplier(id: string, stage: CombatModifier["stage"], value: number): CombatModifier {
  return {
    id,
    stage,
    priority: 0,
    applies: () => true,
    apply: (state) => ({ ...state, damage: Math.floor(state.damage * value) }),
    source: { source: "derived", url: `https://example.invalid/${id}`, verifiedAt: "2026-08-09" },
  };
}

function runPhysical(
  laneIndex: number,
  stacks: number,
  detailLevel: "full-analysis" | "score-only" = "full-analysis",
) {
  const rt = createRuntime(
    {
      ...rangedInput,
      league: unholy,
      crit: { chance: 0.5 },
      startingAdrenaline: 100,
      detailLevel,
      equipmentEffects: botlgEffects(),
      context: { style: "ranged", ruleset: "equilibrium" },
    },
    { laneIndex, laneCount: 128 },
  );
  rt.state = patchRanged(rt.state, { perfectEquilibriumStacks: stacks });
  const ability = rt.byId.get("ranged_attack");
  if (!ability) throw new Error("missing ranged attack");
  const attempt = performCast(rt, ability, 0, false);
  if (!attempt.ok) throw new Error(attempt.error);
  advanceTo(rt, rt.endTick);
  return rt;
}

function runPhysicalBalance(stacks: number) {
  const rt = createRuntime(
    {
      ...rangedInput,
      league: undefined,
      crit: { chance: 0 },
      startingAdrenaline: 100,
      equipmentEffects: botlgEffects(),
      context: { style: "ranged", ruleset: "equilibrium" },
    },
    { laneIndex: 0, laneCount: 128 },
  );
  rt.state = patchRanged(rt.state, { perfectEquilibriumStacks: stacks });
  const ability = rt.byId.get("balance_by_force");
  if (!ability) throw new Error("missing Balance by Force");
  const attempt = performCast(rt, ability, 0, false);
  if (!attempt.ok) throw new Error(attempt.error);
  advanceTo(rt, rt.endTick);
  return rt;
}

function runEofBalance(stacks: number) {
  const rt = createRuntime(
    {
      ...rangedInput,
      equipmentEffects: undefined,
      equipmentIds: ["item:essence-of-finality"],
      // EoF requires matching stored special; alone is fail-closed.
      eofStoredSpecialId: "balance_by_force",
      league: unholy,
      crit: { chance: 0.5 },
      startingAdrenaline: 100,
      context: { style: "ranged", ruleset: "equilibrium" },
    },
    { laneIndex: 0, laneCount: 128 },
  );
  rt.state = patchRanged(rt.state, { perfectEquilibriumStacks: stacks });
  const ability = rt.byId.get("balance_by_force");
  if (!ability) throw new Error("missing Balance by Force");
  const attempt = performCast(rt, ability, 0, false);
  if (!attempt.ok) throw new Error(attempt.error);
  advanceTo(rt, rt.endTick);
  return rt;
}

describe("Perfect Equilibrium runtime", () => {
  it("captures the source distribution and schedules one concrete separate PE hit", () => {
    const rt = runPhysical(37, 7);
    const parent = rt.events.find((event) => event.abilityId === "ranged_attack");
    const pe = rt.events.filter((event) => event.abilityId === "perfect_equilibrium");

    expect(parent).toBeDefined();
    expect(pe).toHaveLength(1);
    expect(pe[0]).toMatchObject({
      family: "hit",
      sourceCast: -1,
      hitIndex: 0,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      originKind: "direct",
      provenance: { kind: "botlg_perfect_equilibrium" },
      expectedOccurrences: 1,
      expectedActivations: 1,
      expectedSeparateHits: 1,
      combatStyle: "ranged",
      resourceEligible: false,
    });
    expect(pe[0]?.derivedFrom).toBe(parent?.seq);
    expect(pe[0]?.damage.critical?.outcome).toBeDefined();
    expect(rt.analysis.effects.get("perfect_equilibrium")?.kind).toBe("equipment-passive");
    expect(rt.events.filter((event) => event.abilityId === "perfect_equilibrium")).toHaveLength(1);
  });

  it("uses physical passive ownership for normal stack generation", () => {
    const withoutPhysical = createRuntime(
      {
        ...rangedInput,
        equipmentEffects: otherBowEffects(),
        league: undefined,
        crit: { chance: 0 },
        startingAdrenaline: 100,
        context: { style: "ranged", ruleset: "equilibrium" },
      },
      { laneIndex: 0, laneCount: 128 },
    );
    withoutPhysical.state = patchRanged(withoutPhysical.state, {
      perfectEquilibriumStacks: 7,
    });
    const ability = withoutPhysical.byId.get("ranged_attack");
    if (!ability) throw new Error("missing ranged attack");
    const attempt = performCast(withoutPhysical, ability, 0, false);
    if (!attempt.ok) throw new Error(attempt.error);
    advanceTo(withoutPhysical, withoutPhysical.endTick);

    expect(withoutPhysical.events.some((event) => event.abilityId === "perfect_equilibrium")).toBe(
      false,
    );
    expect(withoutPhysical.state.ranged.perfectEquilibriumStacks).toBe(7);
  });

  it("spends Balance pre-cast stacks once, including through EoF with stored Balance", () => {
    const physical = runEofBalance(3);
    expect(
      physical.events.filter((event) => event.abilityId === "perfect_equilibrium"),
    ).toHaveLength(1);
    expect(physical.state.ranged.perfectEquilibriumStacks).toBe(0);

    expect(runPhysicalBalance(0).state.ranged.perfectEquilibriumStacks).toBe(1);
    expect(runPhysicalBalance(2).state.ranged.perfectEquilibriumStacks).toBe(3);
    const physicalBow = runPhysicalBalance(3);
    expect(
      physicalBow.events.filter((event) => event.abilityId === "perfect_equilibrium"),
    ).toHaveLength(1);
    expect(physicalBow.state.ranged.perfectEquilibriumStacks).toBe(0);
  });

  it("resolves a multi-hitter per landed hitsplat without creating a PE recursion", () => {
    const rt = createRuntime(
      {
        ...rangedInput,
        league: undefined,
        crit: { chance: 0.5 },
        startingAdrenaline: 100,
        equipmentEffects: botlgEffects(),
        context: { style: "ranged", ruleset: "equilibrium" },
      },
      { laneIndex: 0, laneCount: 128 },
    );
    rt.state = patchRanged(rt.state, { perfectEquilibriumStacks: 7 });
    const ability = rt.byId.get("greater_ricochet");
    if (!ability) throw new Error("missing Greater Ricochet");
    const attempt = performCast(rt, ability, 0, false);
    if (!attempt.ok) throw new Error(attempt.error);
    advanceTo(rt, rt.endTick);

    const parents = rt.events.filter((event) => event.abilityId === "greater_ricochet");
    const pes = rt.events.filter((event) => event.abilityId === "perfect_equilibrium");
    expect(parents.length).toBeGreaterThan(1);
    expect(pes).toHaveLength(1);
    expect(rt.state.ranged.perfectEquilibriumStacks).toBe(parents.length - 1);
    expect(pes.some((event) => event.derivedFrom === pes[0]?.seq)).toBe(false);
  });

  it("uses the four-hit Balance threshold across every Greater Ricochet hitsplat", () => {
    const rt = createRuntime(
      {
        ...rangedInput,
        league: undefined,
        crit: { chance: 0 },
        startingAdrenaline: 100,
        equipmentEffects: botlgEffects(),
        context: { style: "ranged", ruleset: "base" },
      },
      { laneIndex: 0, laneCount: 128 },
    );
    const balance = rt.byId.get("balance_by_force");
    const grico = rt.byId.get("greater_ricochet");
    if (!balance || !grico) throw new Error("missing BotLG rotation abilities");

    const balanceAttempt = performCast(rt, balance, 0, false);
    if (!balanceAttempt.ok) throw new Error(balanceAttempt.error);
    const gricoAttempt = performCast(rt, grico, rt.state.tick, false);
    if (!gricoAttempt.ok) throw new Error(gricoAttempt.error);
    advanceTo(rt, rt.endTick);

    const gricoHits = rt.events.filter((event) => event.abilityId === "greater_ricochet");
    const gricoSeqs = new Set(gricoHits.map((event) => event.seq));
    const gricoPerfectEquilibrium = rt.events.filter(
      (event) =>
        event.abilityId === "perfect_equilibrium" &&
        event.derivedFrom !== undefined &&
        gricoSeqs.has(event.derivedFrom),
    );
    const stackHistory = gricoHits.map(
      (event) =>
        event.appliedEffects?.find((effect) => effect.id === "perfect_equilibrium")?.stackCount,
    );

    expect(
      rt.events.find((event) => event.abilityId === "balance_by_force")?.appliedEffects,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "perfect_equilibrium", stackCount: 1 }),
        expect.objectContaining({ id: "balance_by_force", remainingTicks: 50 }),
      ]),
    );
    expect(gricoHits).toHaveLength(7);
    expect(stackHistory).toEqual([2, 3, 0, 1, 2, 3, 0]);
    expect(gricoPerfectEquilibrium).toHaveLength(2);
    expect(rt.state.ranged.perfectEquilibriumStacks).toBe(0);
  });

  it("counts a direct Inferno blessing hit toward Perfect Equilibrium", () => {
    const rt = createRuntime(
      {
        ...rangedInput,
        league: unholy,
        crit: { chance: 1, guaranteed: true },
        startingAdrenaline: 100,
        equipmentEffects: botlgEffects(),
        context: { style: "ranged", ruleset: "equilibrium" },
      },
      { laneIndex: 0, laneCount: 128 },
    );
    rt.state = patchRanged(rt.state, { perfectEquilibriumStacks: 6 });
    const ability = rt.byId.get("ranged_attack");
    if (!ability) throw new Error("missing ranged attack");
    const attempt = performCast(rt, ability, 0, false);
    if (!attempt.ok) throw new Error(attempt.error);
    advanceTo(rt, rt.endTick);

    const parent = rt.events.find((event) => event.abilityId === "ranged_attack");
    const inferno = rt.events.find((event) => event.abilityId === "inferno-of-zamorak");
    const pe = rt.events.find(
      (event) => event.abilityId === "perfect_equilibrium" && event.derivedFrom === inferno?.seq,
    );

    expect(parent?.appliedEffects).toContainEqual(
      expect.objectContaining({ id: "perfect_equilibrium", stackCount: 7 }),
    );
    expect(inferno).toBeDefined();
    expect(inferno?.appliedEffects).toContainEqual(
      expect.objectContaining({ id: "perfect_equilibrium", stackCount: 0 }),
    );
    expect(pe).toBeDefined();
  });

  it("counts a PE proc as a landed hit for active Imbue Shadows", () => {
    const run = (expiresAtTick: number) => {
      const rt = createRuntime(
        {
          ...rangedInput,
          league: undefined,
          crit: { chance: 0 },
          startingAdrenaline: 0,
          equipmentEffects: botlgEffects(),
          context: { style: "ranged", ruleset: "base" },
        },
        { laneIndex: 0, laneCount: 128 },
      );
      rt.state = patchRanged(rt.state, {
        perfectEquilibriumStacks: 7,
        shadowImbued: { expiresAtTick },
      });
      const ability = rt.byId.get("ranged_attack");
      if (!ability) throw new Error("missing ranged attack");
      const attempt = performCast(rt, ability, 0, false);
      if (!attempt.ok) throw new Error(attempt.error);
      advanceTo(rt, rt.endTick);
      return rt;
    };

    const inactive = run(0);
    const active = run(50);
    expect(active.events.filter((event) => event.abilityId === "perfect_equilibrium")).toHaveLength(
      1,
    );
    expect(active.state.adrenaline - inactive.state.adrenaline).toBe(10);
  });

  it("uses BotLG's explicit ammunition origin for one landed PE state update", () => {
    const rt = createRuntime(
      {
        ...rangedInput,
        ammunition: testRangedAmmunition("deathspore"),
        league: unholy,
        crit: { chance: 0.5 },
        startingAdrenaline: 100,
        equipmentEffects: botlgEffects(),
        context: { style: "ranged", ruleset: "equilibrium" },
      },
      { laneIndex: 0, laneCount: 128 },
    );
    rt.state = patchRanged(rt.state, { perfectEquilibriumStacks: 7 });
    const ability = rt.byId.get("ranged_attack");
    if (!ability) throw new Error("missing ranged attack");
    const attempt = performCast(rt, ability, 0, false);
    if (!attempt.ok) throw new Error(attempt.error);
    advanceTo(rt, rt.endTick);

    expect(rt.events.filter((event) => event.abilityId === "perfect_equilibrium")).toHaveLength(1);
    expect(rt.state.ranged.deathspore.stacks).toBe(2);
    expect(
      rt.events
        .filter(
          (event) =>
            event.abilityId === "ranged_attack" || event.abilityId === "perfect_equilibrium",
        )
        .every((event) =>
          event.appliedEffects?.some((effect) => effect.id === "ammunition:deathspore"),
        ),
    ).toBe(true);
    expect(rt.analysis.effects.get("ammunition:deathspore")?.expectedActivations).toBe(2);
    expect(rt.events.some((event) => event.abilityId === "puncture")).toBe(false);
  });

  it("applies Bik on the parent and a critical PE without enabling recursive procs", () => {
    const rt = createRuntime(
      {
        ...rangedInput,
        ammunition: testRangedAmmunition("bik"),
        league: undefined,
        crit: { chance: 1 },
        startingAdrenaline: 100,
        equipmentEffects: botlgEffects(),
        context: { style: "ranged", ruleset: "equilibrium" },
      },
      { laneIndex: 0, laneCount: 128 },
    );
    rt.state = patchRanged(rt.state, { perfectEquilibriumStacks: 7 });
    const ability = rt.byId.get("ranged_attack");
    if (!ability) throw new Error("missing ranged attack");
    const attempt = performCast(rt, ability, 0, false);
    if (!attempt.ok) throw new Error(attempt.error);
    advanceTo(rt, rt.endTick);

    const parent = rt.events.find((event) => event.abilityId === "ranged_attack");
    const pe = rt.events.find((event) => event.abilityId === "perfect_equilibrium");
    expect(parent?.damage.critical?.outcome).toBe(true);
    expect(pe?.damage.critical?.outcome).toBe(true);
    expect(parent?.appliedEffects).toContainEqual(
      expect.objectContaining({ id: "ammunition:bik", stackCount: 1 }),
    );
    expect(pe?.appliedEffects).toContainEqual(
      expect.objectContaining({ id: "ammunition:bik", stackCount: 2 }),
    );
    expect(rt.state.target.evolvingToxin.stacks).toBe(2);
    expect(rt.analysis.effects.get("ammunition:bik")?.expectedActivations).toBe(2);
    expect(rt.events.filter((event) => event.abilityId === "perfect_equilibrium")).toHaveLength(1);
  });

  it("lets a PE hit build Wen Icy Chill without adding another PE stack", () => {
    const rt = createRuntime(
      {
        ...rangedInput,
        ammunition: testRangedAmmunition("wen"),
        league: undefined,
        crit: { chance: 1 },
        startingAdrenaline: 100,
        equipmentEffects: botlgEffects(),
        context: { style: "ranged", ruleset: "equilibrium" },
      },
      { laneIndex: 0, laneCount: 128 },
    );
    rt.state = patchRanged(rt.state, { perfectEquilibriumStacks: 7 });
    const ability = rt.byId.get("ranged_attack");
    if (!ability) throw new Error("missing ranged attack");
    const attempt = performCast(rt, ability, 0, false);
    if (!attempt.ok) throw new Error(attempt.error);
    advanceTo(rt, rt.endTick);

    const pe = rt.events.find((event) => event.abilityId === "perfect_equilibrium");
    expect(rt.state.ranged.wen.icyChillStacks).toBe(2);
    expect(pe?.appliedEffects).toContainEqual(
      expect.objectContaining({ id: "ammunition:wen", stackCount: 2 }),
    );
    expect(rt.state.ranged.perfectEquilibriumStacks).toBe(0);
    expect(rt.events.filter((event) => event.abilityId === "perfect_equilibrium")).toHaveLength(1);
  });

  it("applies configured prayer/perk stages and Ful as a PE on-hit stage", () => {
    const plain = runPhysical(0, 7);
    const withConfiguredEffects = createRuntime(
      {
        ...rangedInput,
        ammunition: fulAmmunition(),
        league: unholy,
        crit: { chance: 0 },
        startingAdrenaline: 100,
        equipmentEffects: botlgEffects(),
        modifiers: () => [
          multiplier("prayer:test", "ability", 1.1),
          multiplier("perk:test", "roll", 1.2),
          multiplier("on-hit:test", "onHit", 1.3),
        ],
        context: { style: "ranged", ruleset: "equilibrium" },
      },
      { laneIndex: 0, laneCount: 128 },
    );
    withConfiguredEffects.state = patchRanged(withConfiguredEffects.state, {
      perfectEquilibriumStacks: 7,
    });
    const ability = withConfiguredEffects.byId.get("ranged_attack");
    if (!ability) throw new Error("missing ranged attack");
    const attempt = performCast(withConfiguredEffects, ability, 0, false);
    if (!attempt.ok) throw new Error(attempt.error);
    advanceTo(withConfiguredEffects, withConfiguredEffects.endTick);

    const plainPe = plain.events.find((event) => event.abilityId === "perfect_equilibrium");
    const configuredPe = withConfiguredEffects.events.find(
      (event) => event.abilityId === "perfect_equilibrium",
    );
    expect(plainPe?.damage.expected).toBeGreaterThan(0);
    expect(configuredPe?.damage.expected).toBeGreaterThan(plainPe?.damage.expected ?? 0);
  });

  it("uses live lane-local target DP for PE and keeps the no-profile fallback static", () => {
    const withoutBlackStone = runTargetedPhysical(targetAccuracyProfile, fulAmmunition());
    const withBlackStone = runTargetedPhysical(targetAccuracyProfile, blackStoneAmmunition());
    expect(withBlackStone.rt.state.target.blackStone).toBeDefined();
    expect(withBlackStone.potential).toBeGreaterThan(withoutBlackStone.potential ?? 0);

    const blackStoneState = applyBlackStoneArmourReduction(
      newBlackStoneArmourState(targetAccuracyProfile.originalTargetArmourRating),
      0,
    ).state;
    const manual = runTargetedPhysical(undefined, fulAmmunition());
    const manualWithBlackStone = runTargetedPhysical(undefined, fulAmmunition(), blackStoneState);
    expect(manualWithBlackStone.potential).toBe(manual.potential);
    expect(manualWithBlackStone.event.damage.expected).toBe(manual.event.damage.expected);
  });

  it("preserves concrete PE state transitions between full and score-only lanes", () => {
    for (let laneIndex = 0; laneIndex < 16; laneIndex++) {
      const full = runPhysical(laneIndex, 7, "full-analysis");
      const scoreOnly = runPhysical(laneIndex, 7, "score-only");
      expect(scoreOnly.state.adrenaline, `lane ${laneIndex}`).toBe(full.state.adrenaline);
      expect(scoreOnly.state.ranged.perfectEquilibriumStacks, `lane ${laneIndex}`).toBe(
        full.state.ranged.perfectEquilibriumStacks,
      );
      expect(scoreOnly.totalExpected, `lane ${laneIndex}`).toBe(full.totalExpected);
    }
  });
});
