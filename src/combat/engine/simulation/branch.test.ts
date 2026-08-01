import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { commitCast, prepareSimulationCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { snapshotRuntime } from "./branch";
import type { CastContextInput } from "./contracts";
import { rotationOf } from "./contracts";
import { simulate, type SimulateInput } from "./simulate";

/**
 * Branch isolation: a snapshot must share nothing mutable with its parent, and
 * two branches of the same RNG point must not be able to reach each other's
 * ledgers, event queue, or nested style state.
 */

const meleeInput: CastContextInput = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
  context: { style: "melee" },
};

const necroInput: CastContextInput = {
  ...meleeInput,
  abilities: NECROMANCY_ABILITIES,
  context: { style: "necromancy" },
};

describe("snapshotRuntime shares no mutable collection", () => {
  it("ledgers, queue and lookup maps are independent copies", () => {
    const rt = createRuntime(meleeInput);
    for (let i = 0; i < 3; i++) {
      const attempt = prepareSimulationCast(rt, rt.byId.get("attack")!, rt.state.tick);
      if (attempt.ok) commitCast(rt, attempt.prepared, false);
    }
    const clone = snapshotRuntime(rt);
    for (const key of [
      "queue",
      "casts",
      "perAbility",
      "damageByTick",
      "events",
      "recordBySeq",
      "hitDetails",
      "spiritEventMeta",
      "scheduledSpiritTracks",
      "spiritHitCounts",
    ] as const) {
      expect(clone[key], key).not.toBe(rt[key]);
    }
    // Cast records are cloned, not aliased — a branch's totals must not leak.
    expect(clone.casts[0]).not.toBe(rt.casts[0]);
    expect(clone.casts[0]!.result.hits).not.toBe(rt.casts[0]!.result.hits);
  });

  it("a cast on the clone leaves the parent's nested style state untouched", () => {
    const rt = createRuntime(necroInput);
    const clone = snapshotRuntime(rt);
    const parentNecromancy = rt.state.necromancy;
    const parentMelee = rt.state.melee;

    const attempt = prepareSimulationCast(clone, clone.byId.get("conjure_undead_army")!, 0);
    expect(attempt.ok).toBe(true);
    if (attempt.ok) commitCast(clone, attempt.prepared, false);

    expect(clone.state.necromancy.conjures.spirits.length).toBe(3);
    // The parent still holds the object it started with — nothing was mutated
    // in place inside the nested style state.
    expect(rt.state.necromancy).toBe(parentNecromancy);
    expect(rt.state.necromancy.conjures.spirits).toHaveLength(0);
    expect(rt.state.melee).toBe(parentMelee);
    expect(rt.casts).toHaveLength(0);
    expect(rt.queue.length).toBe(0);
  });
});

describe("RNG branches merge to the weighted mean", () => {
  it("Impatient's branch set totals the same as its two outcomes weighted", () => {
    const rotation: Omit<SimulateInput, "adrenaline"> = {
      ...meleeInput,
      rotation: rotationOf("attack", "attack"),
    };
    const withPerk = simulate({ ...rotation, adrenaline: { impatientRank: 4 } });
    expect(withPerk.ok).toBe(true);
    expect(withPerk.rng?.method).toBe("probability-weighted branching");
    // Damage is unaffected by the perk; only adrenaline branches.
    const plain = simulate(rotation);
    expect(withPerk.totalExpected).toBeCloseTo(plain.totalExpected);
  });

  it("a deterministic run reports no branching at all", () => {
    const s = simulate({ ...meleeInput, rotation: rotationOf("attack", "attack") });
    expect(s.rng).toBeUndefined();
  });
});
