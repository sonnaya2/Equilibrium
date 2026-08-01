import { describe, expect, it } from "vitest";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { rotationOf } from "../simulation/contracts";
import { simulate, type SimulateInput } from "../simulation/simulate";
import { EventQueue, type ScheduledEvent } from "./events";

/**
 * Event provenance and ownership: what a scheduled event has to carry so
 * branching, cancellation and attached damage stay correct. Derived-hit
 * provenance and Bloat's replacement-by-owner are covered in
 * simulation/mechanics.test.ts.
 */

const rangedInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: RANGED_ABILITIES,
  context: { style: "ranged" },
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
  resolve: () => ({ damage: { min: 0, max: 0, expected: 0 } }),
  ...over,
});

describe("branch equivalence signature", () => {
  it("distinguishes tails derived from different source hits", () => {
    const a = new EventQueue();
    const b = new EventQueue();
    a.push(event({ derivedFrom: 4 }));
    b.push(event({ derivedFrom: 9 }));
    expect(a.signature()).not.toBe(b.signature());
  });

  it("distinguishes an owned event from an unowned one", () => {
    const owned = new EventQueue();
    const free = new EventQueue();
    owned.push(event({ cancelOwner: 0 }));
    free.push(event({}));
    expect(owned.signature()).not.toBe(free.signature());
  });

  it("covers every provenance field the resolver can branch on", () => {
    const base = new EventQueue();
    base.push(event({}));
    const variants: Partial<ScheduledEvent>[] = [
      { tick: 1 },
      { seq: 1 },
      { family: "dot" },
      { abilityId: "b" },
      { sourceCast: 1 },
      { hitIndex: 1 },
      { attached: true },
      { procEligible: false },
      { recursionAllowed: true },
      { cancelOwner: 0 },
      { derivedFrom: 0 },
    ];
    for (const over of variants) {
      const other = new EventQueue();
      other.push(event(over));
      expect(other.signature(), JSON.stringify(over)).not.toBe(base.signature());
    }
  });

  it("a clone keeps the same signature and cancels independently", () => {
    const original = new EventQueue();
    original.push(event({ seq: 0, cancelOwner: 1 }));
    original.push(event({ seq: 1, cancelOwner: 2 }));
    const clone = original.clone();
    expect(clone.signature()).toBe(original.signature());
    expect(clone.cancelByOwner(1)).toBe(1);
    expect(original.length).toBe(2);
    expect(clone.signature()).not.toBe(original.signature());
  });
});

describe("attached damage is not a separate hit", () => {
  it("the Searing Winds bonus rides its source hit instead of scheduling one", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf("galeshot", "ranged_attack"),
    });
    expect(s.ok).toBe(true);
    const boosted = s.events.filter((e) => e.abilityId === "ranged_attack");
    // One ability hit is one event, whatever damage is attached to it.
    expect(boosted).toHaveLength(1);
    // 90-110% of 1000 plus the attached 20% bonus hit.
    expect(boosted[0].damage.expected).toBeCloseTo(1200);
    expect(s.events.some((e) => e.attached)).toBe(false);
  });

  it("attached damage does not generate an extra Deathspore stack", () => {
    // Deathspore grants a free cast every 10 landed ranged hits. With the
    // bonus attached rather than scheduled, Galeshot + 9 attacks is 10 hits,
    // not 19 — so exactly one free cast is available.
    const s = simulate({
      ...rangedInput,
      ammo: "deathspore",
      rotation: rotationOf("galeshot", ...Array(9).fill("ranged_attack"), "corruption_shot"),
    });
    expect(s.ok).toBe(true);
    const hits = s.events.filter((e) => e.procEligible && !e.attached && e.family === "hit");
    expect(hits).toHaveLength(10);
  });
});
