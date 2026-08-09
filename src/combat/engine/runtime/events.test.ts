import { describe, expect, it } from "vitest";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { rotationOf } from "../simulation/contracts";
import { simulate, type SimulateInput } from "../simulation/simulate";
import { baseInput } from "../../test/fixtures/inputs";
import { EventQueue, type ScheduledEvent } from "./events";

const rangedInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: RANGED_ABILITIES,
  context: { style: "ranged" },
  equipmentIds: ["item:noxious-longbow"],
};

const event = (over: Partial<ScheduledEvent>): ScheduledEvent => ({
  tick: 0,
  seq: 0,
  family: "hit",
  abilityId: "a",
  sourceCast: 0,
  hitIndex: 0,
  attached: false,
  procEligible: true,
  recursionAllowed: false,
  provenance: { kind: "player_direct" },
  resolve: () => ({ damage: { min: 0, max: 0, expected: 0 } }),
  ...over,
});

describe("event queue", () => {
  it("pops out-of-order inserts by tick and sequence", () => {
    const queue = new EventQueue();
    queue.push(event({ tick: 4, seq: 9 }));
    queue.push(event({ tick: 1, seq: 7 }));
    queue.push(event({ tick: 4, seq: 3 }));
    queue.push(event({ tick: 2, seq: 8 }));

    expect(queue.pending().map(({ tick, seq }) => [tick, seq])).toEqual([
      [1, 7],
      [2, 8],
      [4, 3],
      [4, 9],
    ]);
    expect(Array.from({ length: 4 }, () => queue.shift()?.seq)).toEqual([7, 8, 3, 9]);
  });

  it("preserves order after cancellation and keeps clones independent", () => {
    const queue = new EventQueue();
    queue.push(event({ tick: 3, seq: 4, cancelOwner: 1 }));
    queue.push(event({ tick: 1, seq: 2, cancelOwner: 2 }));
    queue.push(event({ tick: 2, seq: 3, cancelOwner: 1 }));
    const clone = queue.clone();

    expect(clone.cancelByOwner(1)).toBe(2);
    expect(clone.pending().map(({ seq }) => seq)).toEqual([2]);
    expect(queue.pending().map(({ seq }) => seq)).toEqual([2, 3, 4]);
  });
});

describe("attached damage is not a separate hit", () => {
  it("the Searing Winds bonus rides its source hit instead of scheduling one", () => {
    const summary = simulate({
      ...rangedInput,
      rotation: rotationOf("galeshot", "ranged_attack"),
    });
    expect(summary.ok).toBe(true);
    const boosted = summary.events.filter((event) => event.abilityId === "ranged_attack");
    expect(boosted).toHaveLength(1);
    expect(boosted[0]!.damage.expected).toBeCloseTo(1200);
    expect(summary.events.some((event) => event.attached)).toBe(false);
  });

  it("attached damage does not generate an extra Deathspore stack", () => {
    const summary = simulate({
      ...rangedInput,
      ammo: "deathspore",
      rotation: rotationOf("galeshot", ...Array(9).fill("ranged_attack"), "corruption_shot"),
    });
    expect(summary.ok).toBe(true);
    const hits = summary.events.filter(
      (event) => event.procEligible && !event.attached && event.family === "hit",
    );
    expect(hits).toHaveLength(10);
  });
});

describe("same-tick event order", () => {
  it("orders same-tick events by tick and sequence", () => {
    const rotation = rotationOf("attack", "adaptive_strike_dw", "attack", "dismember");
    const first = simulate({ ...baseInput, rotation });
    const second = simulate({ ...baseInput, rotation });
    expect(first.events).toEqual(second.events);
    expect(first).toEqual(second);
    const dualWield = first.events.filter((event) => event.abilityId === "adaptive_strike_dw");
    expect(dualWield.map((event) => event.tick)).toEqual([3, 3]);
    expect(dualWield[0]!.hitIndex).toBe(0);
    expect(dualWield[1]!.hitIndex).toBe(1);
    expect(dualWield[0]!.seq).toBeLessThan(dualWield[1]!.seq);
  });
});

describe("attached damage accounting", () => {
  it("folds Searing Winds into the source event without boosting Galeshot itself", () => {
    const summary = simulate({
      ...baseInput,
      abilities: RANGED_ABILITIES,
      context: { style: "ranged" },
      rotation: rotationOf("galeshot", "ranged_attack"),
    });
    expect(summary.ok).toBe(true);
    const galeshot = summary.events.filter((event) => event.abilityId === "galeshot");
    expect(galeshot).toHaveLength(1);
    expect(galeshot[0]!.damage.expected).toBeCloseTo(1000);
    const attack = summary.events.filter((event) => event.abilityId === "ranged_attack");
    expect(attack).toHaveLength(1);
    expect(attack[0]!.family).toBe("hit");
    expect(attack[0]!.attached).toBe(false);
    expect(attack[0]!.damage.expected).toBeCloseTo(1200);
    expect(summary.casts[1]!.result.hits[0]!.expected).toBeCloseTo(1000);
    expect(summary.casts[1]!.result.expected).toBeCloseTo(1200);
  });
});
