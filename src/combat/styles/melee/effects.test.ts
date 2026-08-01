import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { baseInput } from "../../test/fixtures/inputs";
import { abilityById, findCast, lastCast } from "../../test/helpers/summary";
import { MELEE_ABILITIES } from "./abilities";

describe("berserk", () => {
  const setup = [
    ...Array(12).fill("attack"),
    "berserk",
    "rend",
    ...Array(10).fill("attack"),
    "rend",
  ];

  it("multiplies melee damage inside the window and expires after 19.8s", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf(...setup) });
    expect(s.ok).toBe(true);
    const rends = s.casts.filter((c) => c.abilityId === "rend");
    expect(rends[0].tick).toBe(39);
    expect(rends[0].result.expected).toBeCloseTo(2624.624584717608, 10);
    expect(rends[1].tick).toBe(72);
    expect(rends[1].result.expected).toBeCloseTo(1500);
  });
});

describe("fury", () => {
  it("grants +25% crit chance to the next crit-eligible melee cast only", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("fury", "attack", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].result.expected).toBeCloseTo(1200);
    expect(s.casts[0].result.hits[0].critChance).toBe(0);
    expect(s.casts[1].result.hits[0].critChance).toBeCloseTo(0.25);
    expect(s.casts[1].result.expected).toBeCloseTo(1349.9378109452737, 10);
    expect(s.casts[2].result.hits[0].critChance).toBe(0);
    expect(s.casts[2].result.expected).toBeCloseTo(1200);
  });

  it("does not consume the buff on a bleed-only cast", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("fury", "dismember", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[2].result.hits[0].critChance).toBeCloseTo(0.25);
    expect(s.casts[2].result.expected).toBeCloseTo(1349.9378109452737, 10);
  });
});

describe("greater_flurry", () => {
  it("extends an active Berserk window by 0.6s per hit (8 ticks) while the channel occupies 8", () => {
    const rotation = rotationOf(
      ...Array(12).fill("attack"),
      "berserk",
      ...Array(3).fill("attack"),
      "greater_flurry",
      ...Array(7).fill("attack"),
    );
    const s = simulate({ ...baseInput, rotation });
    expect(s.ok).toBe(true);
    const last = lastCast(s);
    expect(last.abilityId).toBe("attack");
    // Greater Flurry @48 holds the actor until 56; Berserk 36+33=69 extended +8 → 77.
    expect(last.tick).toBe(74);
    expect(last.result.expected).toBeCloseTo(2099.626865671642, 10);
  });

  it("does not invent a Berserk window when none is active", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(...Array(3).fill("attack"), "greater_flurry", "rend"),
    });
    expect(s.ok).toBe(true);
    expect(lastCast(s).result.expected).toBeCloseTo(1500);
  });
});

describe("meteor_strike", () => {
  it("multiplies melee basic adrenaline by 1.5x inside the 30s window", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(...Array(7).fill("attack"), "meteor_strike", "attack"),
    });
    expect(s.ok).toBe(true);
    const meteor = findCast(
      s,
      (cast) => cast.abilityId === "meteor_strike",
      "Missing Meteor Strike cast",
    );
    expect(meteor.adrenalineAfter).toBeCloseTo(3 + 3 * 4.5);
    const follow = lastCast(s);
    expect(follow.adrenalineAfter).toBeCloseTo(meteor.adrenalineAfter + 13.5 + 3 * 4.5);
  });

  it("does not 1.5x non-basic adrenaline costs or gains (channel occupancy grants its 8 passive ticks)", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(
        ...Array(7).fill("attack"),
        "meteor_strike",
        ...Array(3).fill("attack"),
        "assault",
      ),
    });
    expect(s.ok).toBe(true);
    const assault = lastCast(s);
    const beforeAssault = s.casts[s.casts.length - 2].adrenalineAfter;
    // Assault @33: −25 cost, then 8 channel ticks × 4.5 passive = +36 (cap 100).
    expect(assault.adrenalineAfter).toBeCloseTo(Math.min(100, beforeAssault - 25 + 8 * 4.5), 10);
    expect(assault.adrenalineAfter).toBe(100);
  });
});

describe("Greater Fury and Chaos Roar", () => {
  it("greater fury guarantees crit on the next non-bleed melee", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("greater_fury", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[1].result.expected).toBeCloseTo(1799.7512437810944, 10);
  });
});

describe("greater_barge idle + Endless Assault", () => {
  const byId = (id: string) => abilityById(MELEE_ABILITIES, id);

  it("after 10 idle ticks, min/max gain +5*10 / +7*10 AD%", () => {
    const ctx = createCastContext(baseInput);
    ctx.performCast(byId("attack"), 0, false);
    ctx.performCast(byId("greater_barge"), 10, false);
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    const g = s.casts[1];
    expect(g.result.min).toBe(1250);
    expect(g.result.max).toBe(1650);
    expect(g.result.expected).toBeCloseTo(1450);
  });

  it("caps idle scale at 10 ticks", () => {
    const ctx = createCastContext(baseInput);
    ctx.performCast(byId("attack"), 0, false);
    ctx.performCast(byId("greater_barge"), 20, false);
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    const g = s.casts[1];
    expect(g.result.min).toBe(1250);
    expect(g.result.max).toBe(1650);
  });

  it("does not invent pre-simulation idle for the first cast", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf("greater_barge"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].result.min).toBe(750);
    expect(s.casts[0].result.max).toBe(950);
  });

  it("grants Endless Assault after 8 idle ticks and consumes on next channelled melee", () => {
    const ctx = createCastContext(baseInput);
    ctx.performCast(byId("attack"), 0, false);
    ctx.performCast(byId("greater_barge"), 8, false);
    expect(ctx.getState().melee.endlessAssaultUntilTick).toBe(18);
    // Fund the channel: attack@11 puts adrenaline at 27 so the cast is accepted.
    ctx.performCast(byId("attack"), 11, false);
    const attempt = ctx.performCast(byId("assault"), 14, false);
    expect(attempt.ok).toBe(true);
    expect(ctx.getState().melee.endlessAssaultUntilTick).toBe(0);
    expect(ctx.getState().tick).toBe(17);
    expect(ctx.performCast(byId("attack"), 17, false).ok).toBe(true);
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    expect(s.casts[1].result.min).toBe(1150);
    expect(s.casts[1].result.max).toBe(1510);
    expect(s.casts[3].abilityId).toBe("assault");
    expect(s.casts[3].tick).toBe(14);
    expect(s.casts[4].tick).toBe(17);
    const converted = s.events.filter((event) => event.abilityId === "assault");
    expect(converted.map((event) => event.tick)).toEqual([15, 17, 19, 21]);
    expect(
      converted.every(
        (event) => event.family === "dot" && event.convertedChannel && !event.procEligible,
      ),
    ).toBe(true);
  });

  it("extends Berserk from converted Greater Flurry hits as each hit lands", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    ctx.performCast(byId("berserk"), 0, false);
    for (const tick of [3, 6, 9]) ctx.performCast(byId("attack"), tick, false);
    ctx.performCast(byId("greater_barge"), 17, false);
    expect(ctx.performCast(byId("greater_flurry"), 20, false).ok).toBe(true);
    expect(ctx.getState().tick).toBe(23);
    expect(ctx.getState().melee.berserkUntilTick).toBe(36);
    expect(ctx.performCast(byId("attack"), 23, false).ok).toBe(true);
    ctx.advanceTo(28);
    expect(ctx.getState().melee.berserkUntilTick).toBe(41);
    const s = ctx.finish();
    const converted = s.events.filter((event) => event.abilityId === "greater_flurry");
    expect(converted.map((event) => event.tick)).toEqual([21, 22, 23, 24, 25, 26, 27, 28]);
    expect(converted.every((event) => event.convertedChannel)).toBe(true);
  });
});

describe("next-hit effect scope", () => {
  it("Greater Fury guarantees only the first hit of a channel", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("attack", "attack", "greater_fury", "assault"),
    });
    expect(s.ok).toBe(true);
    const assault = lastCast(s);
    expect(assault.result.expected).toBeCloseTo(6299.751243781095, 10);
    expect(assault.result.hits[0].critChance).toBe(1);
    expect(assault.result.hits[1].critChance).toBe(0);
  });

  it("Greater Fury guarantees exactly one hit of a non-channelled multihit", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("attack", "attack", "greater_fury", "hurricane"),
    });
    expect(lastCast(s).result.expected).toBeCloseTo(3949.750830564784, 10);
  });

  it("Greater Fury expires at the 15s window boundary", () => {
    const ctx = createCastContext(baseInput);
    const greaterFury = ctx.byId.get("greater_fury")!;
    const attack = ctx.byId.get("attack")!;
    ctx.performCast(greaterFury, 0, false);
    expect(ctx.getState().melee.greaterFuryUntilTick).toBe(25);
    ctx.performCast(attack, 24, false); // inside the window
    ctx.performCast(greaterFury, ctx.getState().tick, false); // recast: new window from cast tick
    const secondWindow = ctx.getState().melee.greaterFuryUntilTick;
    ctx.performCast(attack, secondWindow, false); // exactly at its end: expired
    const s = ctx.finish();
    expect(s.casts[1].result.expected).toBeCloseTo(1799.7512437810944, 10);
    expect(s.casts[3].result.expected).toBeCloseTo(1200);
  });

  it("Fury's +25% applies to a channel's first hit only", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("attack", "attack", "fury", "assault"),
    });
    expect(s.ok).toBe(true);
    const assault = lastCast(s);
    expect(assault.result.hits[0].critChance).toBeCloseTo(0.25);
    expect(assault.result.hits[1].critChance).toBe(0);
    expect(assault.result.expected).toBeCloseTo(5774.937810945274, 10);
  });

  it("Chaos Roar multiplies only the first hit of a channel", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "chaos_roar", "assault"),
    });
    expect(lastCast(s).result.expected).toBeCloseTo(6649.626865671642, 10);
  });

  it("Chaos Roar multiplies every hit of a non-channelled multihit", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "chaos_roar", "hurricane"),
    });
    expect(lastCast(s).result.expected).toBeCloseTo(5599.249169435216, 10);
  });

  it("Chaos Roar also boosts bleed ticks", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("chaos_roar", "dismember") });
    expect(s.ok).toBe(true);
    for (let t = 5; t <= 19; t += 2) {
      expect(s.damageByTick[t]).toBeCloseTo(524.6237623762377, 10);
    }
  });

  it("Chaos Roar expires at the 7.2s window boundary", () => {
    const ctx = createCastContext(baseInput);
    const chaosRoar = ctx.byId.get("chaos_roar")!;
    const attack = ctx.byId.get("attack")!;
    ctx.performCast(chaosRoar, 0, false);
    expect(ctx.getState().melee.chaosRoarUntilTick).toBe(12);
    ctx.performCast(attack, 11, false); // inside the window
    ctx.performCast(chaosRoar, ctx.getState().tick, false);
    const secondWindow = ctx.getState().melee.chaosRoarUntilTick;
    ctx.performCast(attack, secondWindow, false); // exactly at its end: expired
    const s = ctx.finish();
    expect(s.casts[1].result.expected).toBeCloseTo(2099.626865671642, 10);
    expect(s.casts[3].result.expected).toBeCloseTo(1200); // expired: half-open window
  });
});
