import { describe, expect, it } from "vitest";
import { createRuntime } from "../../engine/runtime/runtime";
import { patchMelee, patchTarget } from "../../engine/runtime/state";
import { resolveCastHit } from "../../engine/resolution";
import { castOutcomes, planCastOutcomes } from "../../engine/simulation/branch";
import { commitCastBranches } from "../../engine/simulation/lengLandBranch";
import { activeEquipmentEffects } from "../../shared/equipment";
import { baseInput } from "../../test/fixtures/inputs";
import { MELEE_ABILITIES } from "./abilities";
import { unitPrimordialIce } from "./primordialIce";

const tempest = MELEE_ABILITIES.find((ability) => ability.id === "icy_tempest")!;

function input(overrides: Record<string, unknown> = {}) {
  return {
    ...baseInput,
    abilities: MELEE_ABILITIES,
    startingAdrenaline: 100,
    equipmentIds: ["item:essence-of-finality"],
    equipmentEffects: activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { amulet: "item:essence-of-finality" },
    }),
    weaponConfiguration: "dualwield" as const,
    ...overrides,
  };
}

function executeUnitStack(
  stacks: number,
  overrides: Record<string, unknown> = {},
  haunted?: { untilTick: number; capAbilityDamage: number },
) {
  const rt = createRuntime(input(overrides));
  rt.state = patchMelee(rt.state, {
    primordialIce: unitPrimordialIce(stacks, 100),
  });
  if (haunted) rt.state = patchTarget(rt.state, { haunted });
  const plans = planCastOutcomes(
    { weight: 1, rt },
    tempest,
    0,
    false,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
  );
  expect(plans.plans).toHaveLength(1);
  const prepared = plans.plans[0]!.prepared;
  const resolution = resolveCastHit(
    rt,
    prepared.candidate,
    prepared.working.hits[0]!,
    0,
    tempest,
    prepared.snap,
    false,
  );
  const committed = commitCastBranches(
    plans.plans[0]!.parent,
    prepared,
    false,
    undefined,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
  );
  const branch = committed.branches[0]!;
  return {
    branch,
    event: branch.rt.events.find((event) => event.abilityId === "icy_tempest")!,
    resolution,
  };
}

describe("Icy Tempest execution outcomes", () => {
  it("matches the exhaustive 0/3 oracle after branch execution", () => {
    const rt = createRuntime(input());
    rt.state = patchMelee(rt.state, {
      primordialIce: {
        atoms: [
          { weight: 0.5, stacks: 0, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
          { weight: 0.5, stacks: 3, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
        ],
      },
    });
    const outcomes = castOutcomes(
      { weight: 1, rt },
      tempest,
      0,
      false,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    );
    expect(outcomes.branches).toHaveLength(2);
    expect(outcomes.residualWeight).toBe(0);
    const exhaustiveExpected = 0.5 * 3_150 + 0.5 * 4_350;
    expect(
      outcomes.branches.reduce((sum, branch) => sum + branch.weight * branch.rt.totalExpected, 0),
    ).toBeCloseTo(exhaustiveExpected, 10);
  });

  it("runs each discrete hit through crit and cap nonlinearities", () => {
    const low = executeUnitStack(0, { crit: { chance: 1 }, cap: { cap: 2_500 } });
    const high = executeUnitStack(3, { crit: { chance: 1 }, cap: { cap: 2_500 } });

    expect(low.event.damage.capLoss).toBe(0);
    expect(high.event.damage.capLoss).toBeGreaterThan(0);
    expect(high.event.damage.expected).toBeGreaterThan(low.event.damage.expected);
  });

  it("keeps attached Haunted damage branch-specific", () => {
    const haunted = { untilTick: 100, capAbilityDamage: 10_000 };
    const low = executeUnitStack(0, {}, haunted);
    const high = executeUnitStack(3, {}, haunted);
    const lowHaunted = low.resolution.components?.find((component) => component.id === "haunted");
    const highHaunted = high.resolution.components?.find((component) => component.id === "haunted");

    expect(lowHaunted?.damage.expected).toBeDefined();
    expect(highHaunted?.damage.expected).toBeGreaterThan(lowHaunted?.damage.expected ?? 0);
  });

  it("consumes the selected stack state only after a successful cast", () => {
    const success = executeUnitStack(3);
    expect(success.branch.rt.state.melee.primordialIce.atoms).toEqual([
      { weight: 1, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 0 },
    ]);

    const failedRt = createRuntime(input({ startingAdrenaline: 20 }));
    failedRt.state = patchMelee(failedRt.state, {
      primordialIce: unitPrimordialIce(3, 100),
    });
    const plans = planCastOutcomes({ weight: 1, rt: failedRt }, tempest, 0, false);
    expect(plans.plans).toHaveLength(0);
    expect(plans.errors[0]!.weight).toBe(1);
    expect(failedRt.state.melee.primordialIce).toEqual(unitPrimordialIce(3, 100));
  });
});
