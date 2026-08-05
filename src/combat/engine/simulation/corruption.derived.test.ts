import { describe, expect, it } from "vitest";
import { mulFloor } from "../../core/rounding";
import { MODERNISATION_WIKI } from "../../data/sources";
import type { HitResult } from "../../pipeline/calculateHit";
import type { CombatModifier } from "../../types";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { vulnerabilityModifier } from "../../shared/vulnerability";
import { resolveDerivedHit } from "../resolution/derived";
import { createRuntime } from "../runtime/runtime";
import type { SimulationRuntime } from "../runtime/runtime";
import { rotationOf, type SimulateInput } from "./contracts";
import { createCastContext, simulate } from "./simulate";
import { simulateRevolution } from "./revolution";

/**
 * Phase 6 Corruption derived-hit goldens.
 * Shot/Blast: 1 parent DoT (90-110) + 4 tails at 80/60/40/20% of resolved parent.
 */

const TAIL_FRACTIONS_PCT = [80, 60, 40, 20] as const;
const TAIL_EXPECTED_AT_1000 = [800, 600, 400, 200] as const;

const rangedInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: RANGED_ABILITIES,
  context: { style: "ranged" as const },
};

const magicInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MAGIC_ABILITIES,
  context: { style: "magic" as const },
};

const prayer = (multiplier: number): CombatModifier => ({
  id: "prayer:test",
  stage: "onCast",
  priority: 0,
  applies: () => true,
  apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
  source: MODERNISATION_WIKI,
});

function flatHitDetail(value: number): HitResult {
  return {
    potential: 1,
    min: value,
    max: value,
    critMin: value,
    critMax: value,
    critChance: 0,
    nonCritExpected: value,
    critExpected: value,
    expected: value,
    uncappedExpected: value,
    capLoss: 0,
  };
}

function runtimeWithParent(value: number, seq = 0): SimulationRuntime {
  const rt = createRuntime({
    ...rangedInput,
  });
  rt.hitDetails.set(seq, flatHitDetail(value));
  return rt;
}

function zeroCd<T extends { id: string; cooldownSeconds?: number }>(ability: T): T {
  return { ...ability, cooldownSeconds: 0 };
}

describe("Corruption Shot wiki ladder / lineage", () => {
  it("parent + 4 derived tails at 80/60/40/20% with cast-relative ticks", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf(...Array(8).fill("ranged_attack"), "corruption_shot"),
    });
    expect(s.ok).toBe(true);
    const castTick = s.casts.find((c) => c.abilityId === "corruption_shot")!.tick;
    const events = s.events.filter((e) => e.abilityId === "corruption_shot");
    expect(events).toHaveLength(5);

    const parent = events.find((e) => e.hitIndex === 0)!;
    const tails = events.filter((e) => e.hitIndex > 0).sort((a, b) => a.hitIndex - b.hitIndex);

    expect(parent.tick).toBe(castTick);
    expect(parent.damage.expected).toBeCloseTo(1000);
    expect(parent.family).toBe("dot");
    expect(parent.derivedFrom).toBeUndefined();
    expect(parent.procEligible).toBe(false);

    expect(tails).toHaveLength(4);
    expect(tails.map((e) => e.tick)).toEqual([
      castTick + 2,
      castTick + 4,
      castTick + 6,
      castTick + 8,
    ]);
    for (let i = 0; i < 4; i++) {
      const tail = tails[i]!;
      expect(tail.damage.expected).toBeCloseTo(TAIL_EXPECTED_AT_1000[i]!);
      expect(tail.derivedFrom).toBe(parent.seq);
      expect(tail.family).toBe("dot");
      expect(tail.procEligible).toBe(false);
    }
    expect(s.perAbility["corruption_shot"]).toBeCloseTo(3000);
  });
});

describe("Corruption Blast timing", () => {
  it("parent at cast+2; tails at +4,+6,+8,+10 with same fractions", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf(...Array(8).fill("magic_attack"), "corruption_blast"),
    });
    expect(s.ok).toBe(true);
    const castTick = s.casts.find((c) => c.abilityId === "corruption_blast")!.tick;
    const events = s.events.filter((e) => e.abilityId === "corruption_blast");
    expect(events).toHaveLength(5);

    const parent = events.find((e) => e.hitIndex === 0)!;
    const tails = events.filter((e) => e.hitIndex > 0).sort((a, b) => a.hitIndex - b.hitIndex);

    expect(parent.tick).toBe(castTick + 2);
    expect(parent.damage.expected).toBeCloseTo(1000);
    expect(parent.family).toBe("dot");
    expect(parent.derivedFrom).toBeUndefined();

    expect(tails.map((e) => e.tick)).toEqual([
      castTick + 4,
      castTick + 6,
      castTick + 8,
      castTick + 10,
    ]);
    for (let i = 0; i < 4; i++) {
      const tail = tails[i]!;
      expect(tail.damage.expected).toBeCloseTo(TAIL_EXPECTED_AT_1000[i]!);
      expect(tail.derivedFrom).toBe(parent.seq);
      expect(tail.family).toBe("dot");
      expect(tail.procEligible).toBe(false);
    }
    expect(s.perAbility["corruption_blast"]).toBeCloseTo(3000);
  });
});

describe("resolveDerivedHit floor goldens", () => {
  it("wiki ladder parent 1080 floors to 864/648/432/216", () => {
    const rt = runtimeWithParent(1080);
    const mins = TAIL_FRACTIONS_PCT.map((pct) => resolveDerivedHit(rt, 0, pct).damage.min);
    const expecteds = TAIL_FRACTIONS_PCT.map(
      (pct) => resolveDerivedHit(rt, 0, pct).damage.expected,
    );
    expect(mins).toEqual([864, 648, 432, 216]);
    expect(expecteds).toEqual([864, 648, 432, 216]);
  });

  it("odd parent 1001 floors min/max to 800/600/400/200", () => {
    const rt = runtimeWithParent(1001);
    for (let i = 0; i < 4; i++) {
      const pct = TAIL_FRACTIONS_PCT[i]!;
      const r = resolveDerivedHit(rt, 0, pct);
      const floored = Math.floor((1001 * pct) / 100);
      expect(r.damage.min).toBe(floored);
      expect(r.damage.max).toBe(floored);
      // expected is unfloored scale of parent expected
      expect(r.damage.expected).toBeCloseTo((1001 * pct) / 100);
    }
    expect(TAIL_FRACTIONS_PCT.map((pct) => resolveDerivedHit(rt, 0, pct).damage.min)).toEqual([
      800, 600, 400, 200,
    ]);
  });
});

describe("Corruption DoT cannot crit", () => {
  it("guaranteed crit still leaves parent and tails non-crit", () => {
    const s = simulate({
      ...rangedInput,
      crit: { chance: 0, guaranteed: true },
      rotation: rotationOf(...Array(8).fill("ranged_attack"), "corruption_shot"),
    });
    const events = s.events.filter((e) => e.abilityId === "corruption_shot");
    expect(events).toHaveLength(5);
    expect(events.map((e) => e.damage.expected)).toEqual([1000, 800, 600, 400, 200]);
    const parent = events.find((e) => e.hitIndex === 0)!;
    expect(parent.damage.critical?.mode).toBe("none");
    expect(parent.damage.critical?.chance).toBe(0);
    for (const tail of events.filter((e) => e.hitIndex > 0)) {
      expect(tail.damage.critical?.mode).toBe("none");
      expect(tail.damage.critical?.inherited).toBe(true);
    }
    expect(s.perAbility["corruption_shot"]).toBeCloseTo(3000);
  });
});

describe("Corruption DoT-excluded buffs", () => {
  it("prayer damage mult does not inflate parent or tails", () => {
    const s = simulate({
      ...rangedInput,
      modifiers: [prayer(1.2)],
      rotation: rotationOf(...Array(8).fill("ranged_attack"), "corruption_shot"),
    });
    const events = s.events.filter((e) => e.abilityId === "corruption_shot");
    expect(events.every((e) => e.family === "dot")).toBe(true);
    expect(events.map((e) => e.damage.expected)).toEqual([1000, 800, 600, 400, 200]);
    expect(s.perAbility["corruption_shot"]).toBeCloseTo(3000);
  });
});

describe("Corruption Vulnerability once on parent", () => {
  it("parent includes vuln; tails scale parent without double apply", () => {
    const s = simulate({
      ...rangedInput,
      modifiers: [vulnerabilityModifier()],
      rotation: rotationOf(...Array(8).fill("ranged_attack"), "corruption_shot"),
    });
    const events = s.events
      .filter((e) => e.abilityId === "corruption_shot")
      .sort((a, b) => a.hitIndex - b.hitIndex);
    const parent = events[0]!;
    // Inclusive band 900-1100 under target-stage 1.1; not exactly floor(1000*1.1).
    expect(parent.damage.expected).toBeCloseTo(1099.55223880597, 10);
    for (let i = 0; i < 4; i++) {
      const frac = TAIL_FRACTIONS_PCT[i]! / 100;
      expect(events[i + 1]!.damage.expected).toBeCloseTo(parent.damage.expected * frac, 10);
      expect(events[i + 1]!.derivedFrom).toBe(parent.seq);
    }
    // Total is parent * 3 (1 + 0.8 + 0.6 + 0.4 + 0.2).
    expect(s.perAbility["corruption_shot"]).toBeCloseTo(parent.damage.expected * 3, 10);
  });
});

describe("Corruption horizon", () => {
  it("revo short duration drops late tails", () => {
    const shot = RANGED_ABILITIES.find((a) => a.id === "corruption_shot")!;
    const basic = RANGED_ABILITIES.find((a) => a.id === "ranged_attack")!;
    // Cast at 0 with starting adren; parent@0 tails@2,4,6,8. Horizon 7 lands through +6.
    const s = simulateRevolution({
      ...rangedInput,
      bar: [shot, basic],
      style: "ranged",
      durationTicks: 7,
      startingAdrenaline: 100,
    });
    expect(s.ok).toBe(true);
    const landed = s.events.filter((e) => e.abilityId === "corruption_shot");
    expect(landed.map((e) => e.tick)).toEqual([0, 2, 4, 6]);
    expect(landed.map((e) => e.hitIndex)).toEqual([0, 1, 2, 3]);
    expect(s.perAbility["corruption_shot"]).toBeCloseTo(1000 + 800 + 600 + 400);
  });
});

describe("Corruption recast overwrite", () => {
  it("recast same ability cancels old pending tails; new tails from new parent", () => {
    const shot = zeroCd(RANGED_ABILITIES.find((a) => a.id === "corruption_shot")!);
    const abilities = RANGED_ABILITIES.map((a) => (a.id === "corruption_shot" ? shot : a));
    const ctx = createCastContext({
      ...rangedInput,
      abilities,
      startingAdrenaline: 100,
    });
    // First cast at 0: parent@0, tails@2,4,6,8.
    expect(ctx.performCast(shot, 0, false).ok).toBe(true);
    // Recast at 6: old +6 tail lands, then +8 cancelled; new parent@6, tails@8..14.
    expect(ctx.performCast(shot, 6, false).ok).toBe(true);
    const s = ctx.finish();
    const events = s.events.filter((e) => e.abilityId === "corruption_shot");
    const parents = events.filter((e) => e.hitIndex === 0);
    expect(parents).toHaveLength(2);
    expect(parents.map((e) => e.tick)).toEqual([0, 6]);

    const oldTails = events.filter((e) => e.derivedFrom === parents[0]!.seq);
    const newTails = events.filter((e) => e.derivedFrom === parents[1]!.seq);
    expect(oldTails.map((e) => e.tick)).toEqual([2, 4, 6]);
    expect(newTails.map((e) => e.tick)).toEqual([8, 10, 12, 14]);
    expect(newTails).toHaveLength(4);
    for (const tail of newTails) {
      expect(tail.damage.expected).toBeCloseTo(TAIL_EXPECTED_AT_1000[tail.hitIndex - 1]!);
    }
  });

  it("Blast recast after GCD keeps landed parent; cancels remaining old tails", () => {
    // Parent is at cast+2 and GCD is 3 ticks, so the first free cast is after the
    // old parent has already landed. Recast must not orphan tails from that parent.
    const blast = zeroCd(MAGIC_ABILITIES.find((a) => a.id === "corruption_blast")!);
    const abilities = MAGIC_ABILITIES.map((a) => (a.id === "corruption_blast" ? blast : a));
    const ctx = createCastContext({
      ...magicInput,
      abilities,
      startingAdrenaline: 100,
    });
    // Cast1@0: parent@2, tails@4,6,8,10. Occupancy ends at 3 with parent landed.
    expect(ctx.performCast(blast, 0, false).ok).toBe(true);
    expect(ctx.getState().tick).toBe(3);
    // Cast2@3: cancel pending tails of cast1; new parent@5, tails@7,9,11,13.
    expect(ctx.performCast(blast, 3, false).ok).toBe(true);
    const s = ctx.finish();
    const events = s.events.filter((e) => e.abilityId === "corruption_blast");
    const parents = events.filter((e) => e.hitIndex === 0);
    expect(parents.map((e) => e.tick)).toEqual([2, 5]);
    const oldTails = events.filter((e) => e.derivedFrom === parents[0]!.seq);
    const newTails = events.filter((e) => e.derivedFrom === parents[1]!.seq);
    expect(oldTails).toHaveLength(0);
    expect(newTails.map((e) => e.tick)).toEqual([7, 9, 11, 13]);
    expect(newTails).toHaveLength(4);
  });

  it("Shot recast does not cancel Blast tails when both are live", () => {
    const shot = zeroCd(RANGED_ABILITIES.find((a) => a.id === "corruption_shot")!);
    const blast = zeroCd(MAGIC_ABILITIES.find((a) => a.id === "corruption_blast")!);
    const abilities = [
      ...RANGED_ABILITIES.map((a) => (a.id === "corruption_shot" ? shot : a)),
      ...MAGIC_ABILITIES.map((a) => (a.id === "corruption_blast" ? blast : a)),
    ];
    const ctx = createCastContext({
      ...rangedInput,
      abilities,
      startingAdrenaline: 100,
    });
    expect(ctx.performCast(blast, 0, false).ok).toBe(true);
    expect(ctx.performCast(shot, 3, false).ok).toBe(true);
    expect(ctx.performCast(shot, 6, false).ok).toBe(true);
    const s = ctx.finish();

    const blastEvents = s.events.filter((e) => e.abilityId === "corruption_blast");
    // Blast parent@2, tails@4,6,8,10 - full set survives Shot recasts.
    expect(blastEvents).toHaveLength(5);
    expect(blastEvents.map((e) => e.tick)).toEqual([2, 4, 6, 8, 10]);

    const shotParents = s.events.filter(
      (e) => e.abilityId === "corruption_shot" && e.hitIndex === 0,
    );
    expect(shotParents.map((e) => e.tick)).toEqual([3, 6]);
    const firstShotTails = s.events.filter((e) => e.derivedFrom === shotParents[0]!.seq);
    // First shot at 3: tails 5,7,9,11; recast at 6 cancels 7+ (5 lands).
    expect(firstShotTails.map((e) => e.tick)).toEqual([5]);
  });
});

describe("Corruption provenance", () => {
  it("parent is player_dot; tails are derived_tail", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf(...Array(8).fill("ranged_attack"), "corruption_shot"),
    });
    const events = s.events.filter((e) => e.abilityId === "corruption_shot");
    const parent = events.find((e) => e.hitIndex === 0)!;
    expect(parent.provenance).toEqual({ kind: "player_dot" });
    for (const tail of events.filter((e) => e.hitIndex > 0)) {
      expect(tail.provenance).toEqual({ kind: "derived_tail", detail: "corruption_shot" });
    }
  });

  it("Blast parent player_dot; tails derived_tail", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf(...Array(8).fill("magic_attack"), "corruption_blast"),
    });
    const events = s.events.filter((e) => e.abilityId === "corruption_blast");
    expect(events.find((e) => e.hitIndex === 0)!.provenance).toEqual({ kind: "player_dot" });
    for (const tail of events.filter((e) => e.hitIndex > 0)) {
      expect(tail.provenance).toEqual({ kind: "derived_tail", detail: "corruption_blast" });
    }
  });
});

describe("Corruption accuracy and cap", () => {
  it("accuracy 0.5 scales parent and derived tails together", () => {
    const s = simulate({
      ...rangedInput,
      accuracy: 0.5,
      rotation: rotationOf(...Array(8).fill("ranged_attack"), "corruption_shot"),
    });
    const events = s.events
      .filter((e) => e.abilityId === "corruption_shot")
      .sort((a, b) => a.hitIndex - b.hitIndex);
    const parentExp = events[0]!.damage.expected;
    expect(parentExp).toBeCloseTo(499.7512437810945, 10);
    for (let i = 0; i < 4; i++) {
      expect(events[i + 1]!.damage.expected).toBeCloseTo(
        parentExp * (TAIL_FRACTIONS_PCT[i]! / 100),
        10,
      );
    }
    expect(s.perAbility["corruption_shot"]).toBeCloseTo(parentExp * 3, 10);
  });

  it("hit cap on parent propagates into derived tails", () => {
    const s = simulate({
      ...rangedInput,
      cap: { cap: 950 },
      rotation: rotationOf(...Array(8).fill("ranged_attack"), "corruption_shot"),
    });
    const events = s.events
      .filter((e) => e.abilityId === "corruption_shot")
      .sort((a, b) => a.hitIndex - b.hitIndex);
    const parentExp = events[0]!.damage.expected;
    expect(parentExp).toBeCloseTo(943.6567164179105, 10);
    expect(events[0]!.damage.max).toBe(950);
    for (let i = 0; i < 4; i++) {
      expect(events[i + 1]!.damage.expected).toBeCloseTo(
        parentExp * (TAIL_FRACTIONS_PCT[i]! / 100),
        10,
      );
    }
    expect(s.perAbility["corruption_shot"]).toBeCloseTo(parentExp * 3, 10);
  });
});
