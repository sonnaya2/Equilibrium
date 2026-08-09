import { describe, expect, it } from "vitest";
import { activeEquipmentEffects, type ActiveEquipmentEffects } from "../../../shared/equipment";
import { equipmentById } from "../../../data";
import { NECROMANCY_ABILITIES } from "../../../styles/necromancy/abilities";
import { magicInput, necroInput } from "../../../test/fixtures/inputs";
import { rotationOf } from "../../simulation/contracts";
import { simulate } from "../../simulation/simulate";
import { simulateRevolution } from "../../simulation/revolution";
import { createRuntime, type SimulationRuntime } from "../../runtime/runtime";
import type { ScheduledEvent } from "../../runtime/events";
import { stochasticLaneCount } from "../../runtime/stochastic";
import {
  deathMarkApplicationEligible,
  deathMarkExecutionEligible,
  deathMarkExecutionThreshold,
  deathMarkExecutionWindow,
} from "./deathMark";
import {
  applyTimedTargetStatus,
  activeTimedTargetStatus,
  normalizeTimedTargetStatus,
} from "../../../target/timedStatus";

const armourSlots = ["helmet", "body", "legs", "gloves", "boots"] as const;
const tierIds = (tier: 70 | 80 | 90): string[] => [
  `item:deathdealer-hood-t${tier}`,
  `item:deathdealer-robe-top-t${tier}`,
  `item:deathdealer-robe-bottom-t${tier}`,
  `item:deathdealer-gloves-t${tier}`,
  `item:deathdealer-boots-t${tier}`,
];

function deathdealerEffects(
  applicationChance: number,
  pieceContribution?: { additionalPiecesPerItem: number },
): ActiveEquipmentEffects {
  return {
    ...activeEquipmentEffects({ style: "necromancy" }),
    deathdealer: { physicalPieces: 5, effectivePieces: 5, applicationChance },
    ...(pieceContribution ? { pieceContribution } : {}),
  };
}

function equipmentFor(
  ids: readonly string[],
  pieceContribution?: { additionalPiecesPerItem: number },
) {
  const equipmentSlots = Object.fromEntries(ids.map((id, index) => [armourSlots[index], id]));
  return activeEquipmentEffects({ style: "necromancy", equipmentSlots, pieceContribution });
}

function eventFor(
  kind: ScheduledEvent<SimulationRuntime>["provenance"]["kind"],
  detail?: string,
): ScheduledEvent<SimulationRuntime> {
  const conjure =
    kind === "conjure_auto" || kind === "conjure_command" || kind === "conjure_poison";
  return {
    tick: 0,
    seq: 1,
    family: conjure ? "conjureAuto" : kind === "player_dot" ? "dot" : "hit",
    abilityId: conjure ? "conjure_skeleton" : "necromancy_basic",
    sourceCast: 0,
    hitIndex: 0,
    attached: false,
    procEligible: true,
    recursionAllowed: false,
    provenance: { kind, ...(detail ? { detail } : {}) },
    resolve: () => ({ damage: { min: 1, max: 1, expected: 1 } }),
  };
}

function runDeathMark(
  overrides: Partial<typeof necroInput> = {},
  rotation = rotationOf("necromancy_basic", "necromancy_basic"),
) {
  return simulate(
    {
      ...necroInput,
      equipmentEffects: deathdealerEffects(1),
      targetMaximumLifePoints: 100_000,
      targetHpPercent: 19,
      ...overrides,
      rotation,
    },
    { stochasticLanes: 1 },
  );
}

describe("Deathdealer equipment and timed Death Mark", () => {
  it("uses actual worn armour pieces and applies tier rates additively", () => {
    expect(equipmentFor([tierIds(70)[0]!]).deathdealer).toMatchObject({
      physicalPieces: 1,
      effectivePieces: 1,
      applicationChance: 0.01,
    });
    expect(equipmentFor(tierIds(70)).deathdealer?.applicationChance).toBe(0.05);
    expect(equipmentFor([tierIds(80)[0]!]).deathdealer?.applicationChance).toBe(0.015);
    expect(equipmentFor(tierIds(80)).deathdealer?.applicationChance).toBe(0.075);
    expect(equipmentFor([tierIds(90)[0]!]).deathdealer?.applicationChance).toBe(0.02);
    expect(equipmentFor(tierIds(90)).deathdealer?.applicationChance).toBe(0.1);

    const mixed = [tierIds(70)[0]!, tierIds(70)[1]!, tierIds(90)[0]!, tierIds(90)[1]!];
    expect(equipmentFor(mixed).deathdealer?.applicationChance).toBe(0.06);
    expect(equipmentFor(tierIds(70), { additionalPiecesPerItem: 2 }).deathdealer).toMatchObject({
      physicalPieces: 5,
      effectivePieces: 15,
      applicationChance: 0.15,
    });
    expect(
      equipmentFor(tierIds(80), { additionalPiecesPerItem: 2 }).deathdealer?.applicationChance,
    ).toBeCloseTo(0.225, 12);
    expect(
      equipmentFor(tierIds(90), { additionalPiecesPerItem: 2 }).deathdealer?.applicationChance,
    ).toBeCloseTo(0.3, 12);
    expect(
      equipmentFor([tierIds(70)[0]!, tierIds(70)[1]!, tierIds(90)[0]!, tierIds(90)[1]!], {
        additionalPiecesPerItem: 2,
      }).deathdealer,
    ).toMatchObject({ physicalPieces: 4, effectivePieces: 12, applicationChance: 0.18 });

    expect(
      activeEquipmentEffects({ style: "necromancy", equipmentIds: tierIds(90) }).deathdealer,
    ).toBeUndefined();
  });

  it("publishes the sourced T70 and T80 normalized armour stats", () => {
    const expected = {
      70: {
        "item:deathdealer-hood-t70": [259.8, 17.5],
        "item:deathdealer-robe-top-t70": [298.7, 26.2],
        "item:deathdealer-robe-bottom-t70": [285.7, 21.8],
        "item:deathdealer-gloves-t70": [64.9, 10.9],
        "item:deathdealer-boots-t70": [64.9, 10.9],
      },
      80: {
        "item:deathdealer-hood-t80": [338.8, 20],
        "item:deathdealer-robe-top-t80": [389.6, 30],
        "item:deathdealer-robe-bottom-t80": [372.6, 25],
        "item:deathdealer-gloves-t80": [84.7, 12.5],
        "item:deathdealer-boots-t80": [84.7, 12.5],
      },
    } as const;
    for (const tier of [70, 80] as const) {
      for (const [id, [armour, damage]] of Object.entries(expected[tier])) {
        expect(equipmentById(id)?.bonuses, id).toMatchObject({ armour, damage });
      }
    }
  });

  it("keeps timed status active through the half-open expiry boundary and refreshes immutably", () => {
    const first = applyTimedTargetStatus({ id: "deathdealer", label: "Deathdealer" }, 10, 1_000);
    expect(activeTimedTargetStatus(first, 10)).toBe(true);
    expect(activeTimedTargetStatus(first, 999)).toBe(true);
    expect(activeTimedTargetStatus(first, 1_010)).toBe(false);
    expect(normalizeTimedTargetStatus(first, 1_010)).toBeUndefined();
    const refreshed = applyTimedTargetStatus(
      { id: "invoke-death", label: "Invoke Death" },
      20,
      1_000,
    );
    expect(refreshed).toMatchObject({ appliedAtTick: 20, expiresAtTick: 1_020 });
    expect(first).toMatchObject({ appliedAtTick: 10, expiresAtTick: 1_010 });
  });

  it("accepts and rejects the explicit application and execution provenance whitelists", () => {
    const rt = createRuntime({ ...necroInput, abilities: NECROMANCY_ABILITIES });
    for (const kind of ["player_direct", "player_auto", "derived_bounce"] as const) {
      expect(deathMarkApplicationEligible(rt, eventFor(kind), 1)).toBe(true);
    }
    for (const kind of [
      "player_dot",
      "derived_tail",
      "conjure_auto",
      "conjure_command",
      "conjure_poison",
      "player_poison",
      "equipment_proc",
      "invention_proc",
      "attached",
      "blessing",
      "reflected",
    ] as const) {
      expect(deathMarkApplicationEligible(rt, eventFor(kind), 1)).toBe(false);
    }

    for (const kind of [
      "player_direct",
      "player_auto",
      "player_dot",
      "derived_bounce",
      "derived_tail",
      "conjure_auto",
      "conjure_command",
      "conjure_poison",
    ] as const) {
      expect(deathMarkExecutionEligible(rt, eventFor(kind), 1)).toBe(true);
    }
    for (const kind of [
      "player_poison",
      "equipment_proc",
      "invention_proc",
      "attached",
      "blessing",
      "reflected",
    ] as const) {
      expect(deathMarkExecutionEligible(rt, eventFor(kind), 1)).toBe(false);
    }
    expect(deathMarkExecutionEligible(rt, eventFor("conjure_auto", "familiar"), 1)).toBe(false);
    expect(deathMarkExecutionEligible(rt, eventFor("conjure_auto", "familiar:pack"), 1)).toBe(
      false,
    );
  });

  it("applies on a new qualifying hit, then executes once after a later hit", () => {
    const result = runDeathMark();
    const execution = result.events.find((event) => event.abilityId === "death_mark");
    expect(execution).toMatchObject({
      family: "status",
      provenance: { kind: "target_status", detail: "death-mark" },
      tick: 3,
      sourceCast: -1,
    });
    expect(result.perAbility.death_mark).toBe(100_000);
    expect(result.events.filter((event) => event.abilityId === "death_mark")).toHaveLength(1);
    expect(result.analysis.byEffect).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "deathdealer",
          kind: "equipment-passive",
          expectedTriggerRolls: 1,
          expectedActivations: 1,
          totalDamage: 0,
        }),
        expect.objectContaining({
          id: "death_mark",
          kind: "target-status",
          expectedSeparateHits: 1,
          expectedActivations: 1,
          totalDamage: 100_000,
        }),
      ]),
    );
    expect(result.targetStatus?.deathMark).toMatchObject({ active: false, currentLifePoints: 0 });
    expect(result.analysis.byEffect.find((effect) => effect.id === "deathdealer")).toMatchObject({
      expectedTriggerRolls: 1,
      expectedActivations: 1,
    });
  });

  it("does not execute a mark on the application event and does not require a target maximum", () => {
    const first = runDeathMark({}, rotationOf("necromancy_basic"));
    expect(first.events.some((event) => event.abilityId === "death_mark")).toBe(false);
    expect(first.analysis.byEffect.find((effect) => effect.id === "deathdealer")).toMatchObject({
      expectedTriggerRolls: 1,
      expectedActivations: 1,
    });

    const withoutMaximum = simulate(
      {
        ...necroInput,
        equipmentEffects: deathdealerEffects(1),
        rotation: rotationOf("necromancy_basic", "necromancy_basic"),
      },
      { stochasticLanes: 1 },
    );
    expect(withoutMaximum.events.some((event) => event.abilityId === "death_mark")).toBe(false);
    expect(withoutMaximum.targetStatus?.deathMark?.active).toBe(true);
  });

  it("allows a Bloat tail to execute a pre-existing mark without reapplying it", () => {
    const result = runDeathMark({ startingAdrenaline: 20 }, rotationOf("bloat"));
    expect(result.analysis.byEffect.find((effect) => effect.id === "deathdealer")).toMatchObject({
      expectedTriggerRolls: 1,
      expectedActivations: 1,
    });
    expect(result.events.filter((event) => event.abilityId === "death_mark")).toHaveLength(1);
    expect(result.events.find((event) => event.abilityId === "death_mark")?.tick).toBe(3);
  });

  it("rolls once for each landed hit in a derived multi-hit attack", () => {
    const result = runDeathMark(
      { startingAdrenaline: 100, targetMaximumLifePoints: 1_000_000, targetHpPercent: 100 },
      rotationOf("death_skulls"),
    );
    expect(result.events.filter((event) => event.abilityId === "death_skulls")).toHaveLength(3);
    expect(result.analysis.byEffect.find((effect) => effect.id === "deathdealer")).toMatchObject({
      expectedTriggerRolls: 3,
      expectedActivations: 3,
    });
  });

  it("uses strict threshold boundaries and resolves execution through accuracy", () => {
    expect(
      deathMarkExecutionThreshold({ maximumLifePoints: 200_000, currentLifePoints: 30_000 }),
    ).toBe(30_000);
    expect(
      deathMarkExecutionWindow({ maximumLifePoints: 200_000, currentLifePoints: 30_000 }),
    ).toBe(false);
    expect(
      deathMarkExecutionWindow({ maximumLifePoints: 200_000, currentLifePoints: 29_999 }),
    ).toBe(true);
    expect(deathMarkExecutionWindow({ maximumLifePoints: 78_000, currentLifePoints: 15_600 })).toBe(
      false,
    );
    expect(deathMarkExecutionWindow({ maximumLifePoints: 78_000, currentLifePoints: 15_599 })).toBe(
      true,
    );
    expect(deathMarkExecutionWindow({ maximumLifePoints: 100_000, currentLifePoints: 0 })).toBe(
      false,
    );
    const deadTarget = runDeathMark(
      { targetHpPercent: 0 },
      rotationOf("necromancy_basic", "necromancy_basic"),
    );
    expect(deadTarget.events.some((event) => event.abilityId === "death_mark")).toBe(false);
    expect(deadTarget.targetStatus?.deathMark).toMatchObject({ active: false });
    expect(
      deadTarget.analysis.byEffect.find((effect) => effect.id === "deathdealer"),
    ).toBeUndefined();

    const noOpScoreOnly = simulate(
      {
        ...necroInput,
        equipmentEffects: deathdealerEffects(1),
        targetMaximumLifePoints: 100_000,
        rotation: [],
      },
      { detailLevel: "score-only" },
    );
    expect(noOpScoreOnly.damage.eligibleForRanking).toBe(true);
    expect(noOpScoreOnly.rng).toBeUndefined();

    const nonNecromancyScoreOnly = simulate(
      {
        ...magicInput,
        equipmentEffects: deathdealerEffects(1),
        targetMaximumLifePoints: 100_000,
        rotation: rotationOf("magic_attack"),
      },
      { detailLevel: "score-only" },
    );
    expect(nonNecromancyScoreOnly.damage.eligibleForRanking).toBe(true);
    expect(nonNecromancyScoreOnly.rng).toBeUndefined();

    const zeroDurationRevolution = simulateRevolution(
      {
        ...necroInput,
        equipmentEffects: deathdealerEffects(0.5),
        targetMaximumLifePoints: 100_000,
        bar: [],
        style: "necromancy",
        durationTicks: 0,
      },
      { detailLevel: "score-only" },
    );
    expect(zeroDurationRevolution.damage.eligibleForRanking).toBe(true);
    expect(zeroDurationRevolution.rng).toMatchObject({ lanes: 128, exactness: "exact" });

    const revolutionFallback = simulateRevolution(
      {
        ...necroInput,
        equipmentEffects: deathdealerEffects(0.5),
        targetMaximumLifePoints: 100_000,
        bar: [],
        style: "necromancy",
        durationTicks: 3,
      },
      { detailLevel: "score-only" },
    );
    expect(revolutionFallback.rng).toMatchObject({
      lanes: 128,
      exactness: "approximated",
    });
    expect(revolutionFallback.damage.eligibleForRanking).toBe(false);

    const partial = runDeathMark({ accuracy: 0.1 });
    expect(partial.perAbility.death_mark).toBe(10_000);
    expect(partial.targetStatus?.deathMark).toMatchObject({
      active: false,
      maximumLifePoints: 100_000,
    });
    expect(partial.targetStatus?.deathMark?.currentLifePoints).toBeCloseTo(8_800.895522388062, 10);
    expect(partial.targetStatus?.deathMark?.currentLifePoints).toBeGreaterThan(0);
  });

  it("samples only the future-changing application roll with fixed unit mass", () => {
    const effects = deathdealerEffects(0.5);
    const input = {
      ...necroInput,
      equipmentEffects: effects,
      targetMaximumLifePoints: 100_000,
      targetHpPercent: 100,
      rotation: rotationOf("necromancy_basic"),
    };
    expect(stochasticLaneCount(input, ["necromancy_basic"])).toBe(128);
    expect(
      stochasticLaneCount({ ...input, equipmentEffects: undefined }, ["necromancy_basic"]),
    ).toBe(1);
    const first = simulate(input);
    const second = simulate(input);
    expect(first).toEqual(second);
    expect(first.rng).toMatchObject({
      lanes: 128,
      probabilityMass: 1,
      residualWeight: 0,
      exactness: "approximated",
    });
    expect(first.damage.eligibleForRanking).toBe(false);
    expect(first.targetStatus?.deathMark?.expected?.activeProbability).toBeCloseTo(0.5, 12);
  });

  it("keeps execution damage in score-only totals without analysis ledgers", () => {
    const input = {
      ...necroInput,
      equipmentEffects: deathdealerEffects(1),
      targetMaximumLifePoints: 100_000,
      targetHpPercent: 19,
      rotation: rotationOf("necromancy_basic", "necromancy_basic"),
    };
    const full = simulate(input, { stochasticLanes: 1, detailLevel: "full-analysis" });
    const scoreOnly = simulate(input, { stochasticLanes: 1, detailLevel: "score-only" });
    expect(scoreOnly.totalExpected).toBe(full.totalExpected);
    expect(scoreOnly.damageByTick).toEqual(full.damageByTick);
    expect(scoreOnly.events).toEqual([]);
    expect(scoreOnly.analysis.byEffect).toEqual([]);
  });
});
