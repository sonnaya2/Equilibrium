import { describe, expect, it } from "vitest";
import type { CombatModifier } from "../../types";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import type { CastSnapshot } from "../cast/snapshot";
import { rotationOf } from "../simulation/contracts";
import { simulate, type SimulateInput } from "../simulation/simulate";
import { baseInput } from "../../test/fixtures/inputs";
import { EventQueue, type ScheduledEvent } from "./events";

const stubMod = (id: string, stage: CombatModifier["stage"], priority: number): CombatModifier => ({
  id,
  stage,
  priority,
  applies: () => true,
  apply: (s) => s,
  source: { source: "derived", url: "test", verifiedAt: "2026-08-03" },
});

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

const castSnap = (over: Partial<CastSnapshot> = {}): CastSnapshot => ({
  castSeq: 0,
  critLayers: { chance: 0, eligible: true },
  baseMods: [],
  chaosRoarActive: false,
  channelled: false,
  greaterFuryActive: false,
  furyActive: false,
  firstEligibleHitIndex: 0,
  empowerMult: 1,
  searingWindsAtCast: false,
  enduringRuinBonus: 0,
  ...over,
});

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

  it("distinguishes castSnap searingWindsAtCast", () => {
    const a = new EventQueue();
    const b = new EventQueue();
    a.push(event({ castSnap: castSnap({ searingWindsAtCast: true }) }));
    b.push(event({ castSnap: castSnap({ searingWindsAtCast: false }) }));
    expect(a.signature()).not.toBe(b.signature());
  });

  it("distinguishes castSnap greaterFuryActive", () => {
    const a = new EventQueue();
    const b = new EventQueue();
    a.push(event({ castSnap: castSnap({ greaterFuryActive: true }) }));
    b.push(event({ castSnap: castSnap({ greaterFuryActive: false }) }));
    expect(a.signature()).not.toBe(b.signature());
  });

  it("distinguishes castSnap empowerMult", () => {
    const a = new EventQueue();
    const b = new EventQueue();
    a.push(event({ castSnap: castSnap({ empowerMult: 1.25 }) }));
    b.push(event({ castSnap: castSnap({ empowerMult: 1 }) }));
    expect(a.signature()).not.toBe(b.signature());
  });

  it("distinguishes castSnap chaosRoarActive", () => {
    const a = new EventQueue();
    const b = new EventQueue();
    a.push(event({ castSnap: castSnap({ chaosRoarActive: true }) }));
    b.push(event({ castSnap: castSnap({ chaosRoarActive: false }) }));
    expect(a.signature()).not.toBe(b.signature());
  });

  it("distinguishes castSnap baseMods id/stage/priority", () => {
    const a = new EventQueue();
    const b = new EventQueue();
    const c = new EventQueue();
    const d = new EventQueue();
    a.push(event({ castSnap: castSnap({ baseMods: [stubMod("m1", "base", 0)] }) }));
    b.push(event({ castSnap: castSnap({ baseMods: [stubMod("m2", "base", 0)] }) }));
    c.push(event({ castSnap: castSnap({ baseMods: [stubMod("m1", "onHit", 0)] }) }));
    d.push(event({ castSnap: castSnap({ baseMods: [stubMod("m1", "base", 1)] }) }));
    expect(a.signature()).not.toBe(b.signature());
    expect(a.signature()).not.toBe(c.signature());
    expect(a.signature()).not.toBe(d.signature());
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
      { originKind: "dot" },
      { triggerRolls: 1 },
      { expectedActivations: 0.05 },
      { expectedSeparateHits: 1 },
      { damageTag: "bonus-damage" },
      { expectedOccurrences: 0.5 },
      { flowReduction: 0.1 },
      { convertedChannel: true },
      { dotKind: "bleed" },
      { bleedId: "dismember" },
      { bleedExpiresAtTick: 10 },
      { blessingId: "big-boned" },
      { provenance: { kind: "player_dot" } },
      { provenance: { kind: "player_direct", detail: "x" } },
      { castSnap: castSnap() },
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
    // not 19 - so exactly one free cast is available.
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

describe("same-tick event order is explicit and stable", () => {
  it("is deterministic and orders same-tick events by (tick, seq) in hit-index order", () => {
    const rotation = rotationOf("attack", "adaptive_strike_dw", "attack", "dismember");
    const a = simulate({ ...baseInput, rotation });
    const b = simulate({ ...baseInput, rotation });
    expect(a.events).toEqual(b.events);
    expect(a).toEqual(b);
    const dw = a.events.filter((e) => e.abilityId === "adaptive_strike_dw");
    expect(dw.map((e) => e.tick)).toEqual([3, 3]);
    expect(dw[0].hitIndex).toBe(0);
    expect(dw[1].hitIndex).toBe(1);
    expect(dw[0].seq).toBeLessThan(dw[1].seq);
  });
});

describe("attached damage rides its source event", () => {
  it("folds Searing Winds into the source hit event — no separate event, and Galeshot never rides its own buff", () => {
    const s = simulate({
      ...baseInput,
      abilities: RANGED_ABILITIES,
      context: { style: "ranged" },
      rotation: rotationOf("galeshot", "ranged_attack"),
    });
    expect(s.ok).toBe(true);
    const galeshot = s.events.filter((e) => e.abilityId === "galeshot");
    expect(galeshot).toHaveLength(1);
    expect(galeshot[0].damage.expected).toBeCloseTo(1000);
    const attack = s.events.filter((e) => e.abilityId === "ranged_attack");
    expect(attack).toHaveLength(1);
    expect(attack[0].family).toBe("hit");
    expect(attack[0].attached).toBe(false);
    expect(attack[0].damage.expected).toBeCloseTo(1200);
    // The attached +20% is in the event damage but not in the real hit's own roll.
    expect(s.casts[1].result.hits[0].expected).toBeCloseTo(1000);
    expect(s.casts[1].result.expected).toBeCloseTo(1200);
  });
});
