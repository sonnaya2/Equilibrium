import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { baseInput } from "../../test/fixtures/inputs";
import { abilityById, lastCast } from "../../test/helpers/summary";
import { MELEE_ABILITIES } from "./abilities";
import {
  activateBerserk,
  bloodlustCap,
  gainBloodlust,
  newBloodlust,
  spendBloodlust,
} from "./bloodlust";

describe("bloodlust", () => {
  it("builds to a cap of 4", () => {
    let s = newBloodlust();
    s = gainBloodlust(s, 1);
    s = gainBloodlust(s, 2);
    s = gainBloodlust(s, 2);
    expect(s.stacks).toBe(4);
    expect(bloodlustCap(s)).toBe(4);
  });

  it("Berserk raises the cap to 8, grants 4 on activation, doubles generation", () => {
    let s = activateBerserk(newBloodlust());
    expect(s.stacks).toBe(4);
    s = gainBloodlust(s, 1);
    expect(s.stacks).toBe(6);
    s = gainBloodlust(s, 2);
    expect(s.stacks).toBe(8);
  });

  it("spending never drops below zero", () => {
    expect(spendBloodlust({ stacks: 2, berserk: false }, 5).stacks).toBe(0);
  });
});

describe("bloodlust — spend lifecycle through the simulator", () => {
  it("swaps Assault to its 4-Bloodlust band only once the threshold is met", () => {
    const low = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "assault"),
    });
    expect(lastCast(low).result.expected).toBeCloseTo(4 * 1400);

    const high = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault"),
    });
    const assault = lastCast(high);
    expect(assault.tick).toBe(12);
    expect(assault.result.expected).toBeCloseTo(4 * 1800);
    expect(assault.adrenalineAfter).toBe(36 - 25);
  });

  it("an empowered Assault consumes 4 stacks atomically; the next spender rebuilds first", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(4);
    expect(ctx.performCast(assault, ctx.firstLegalTick("assault"), false).ok).toBe(true);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(0);
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(3);
    expect(ctx.performCast(assault, ctx.firstLegalTick("assault"), false).ok).toBe(true);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(3); // unempowered: no spend
    const s = ctx.finish();
    expect(s.casts[4].result.expected).toBeCloseTo(4 * 1800); // empowered 170-190
    expect(s.casts[8].result.expected).toBeCloseTo(4 * 1400); // normal 130-150
  });

  it("an empowered Hurricane appends its sourced extra hit and spends 4 stacks", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const hurricane = ctx.byId.get("hurricane")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(hurricane, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(0);
    const s = ctx.finish();
    const cast = lastCast(s);
    expect(cast.result.hits).toHaveLength(3);
    expect(cast.result.expected).toBeCloseTo(1500 + 1700 + 850);
    const events = s.events.filter((e) => e.abilityId === "hurricane");
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.hitIndex)).toEqual([0, 1, 2]);
    expect(events.every((e) => e.procEligible && !e.attached)).toBe(true);
  });

  it("an unempowered Hurricane keeps its two hits and its stacks", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const hurricane = ctx.byId.get("hurricane")!;
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(hurricane, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(3); // below threshold: no spend
    const s = ctx.finish();
    expect(lastCast(s).result.hits).toHaveLength(2);
    expect(lastCast(s).result.expected).toBeCloseTo(1500 + 1700);
  });

  it("an empowered Flurry scales with target missing LP when HP is provided", () => {
    const rotation = rotationOf("attack", "attack", "attack", "attack", "flurry");
    const low = simulate({ ...baseInput, targetHpPercent: 30, rotation });
    // 70% missing LP capped to +65%, with the multiplier floored per integer roll.
    expect(lastCast(low).result.expected).toBeCloseTo(8576.237623762376, 10);
    const full = simulate({ ...baseInput, targetHpPercent: 100, rotation });
    expect(lastCast(full).result.expected).toBeCloseTo(8 * 650);
  });

  it("an empowered Flurry without target HP spends stacks but invents no bonus", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const flurry = ctx.byId.get("flurry")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(flurry, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(0);
    const s = ctx.finish();
    expect(s.casts[4].result.expected).toBeCloseTo(8 * 650);
  });

  it("clips Bloodlust stacks when Berserk expires mid-wait, at the boundary tick", () => {
    const ctx = createCastContext(baseInput);
    const attack = abilityById(MELEE_ABILITIES, "attack");
    for (let i = 0; i < 12; i++) ctx.performCast(attack, i * 3, false);
    ctx.performCast(abilityById(MELEE_ABILITIES, "berserk"), 36, false);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(8);
    expect(ctx.getState().melee.berserkUntilTick).toBe(69);
    for (let t = 39; t <= 63; t += 3) ctx.performCast(attack, t, false);
    // Still inside the window at tick 66: no clip.
    expect(ctx.getState().tick).toBe(66);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(8);
    expect(ctx.getState().melee.bloodlust.berserk).toBe(true);
    ctx.performCast(attack, 66, false);
    // The occupancy advance crosses tick 69 (the exclusive end): stacks clip to the base cap.
    expect(ctx.getState().tick).toBe(69);
    expect(ctx.getState().melee.bloodlust.berserk).toBe(false);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(4);
    expect(ctx.getState().melee.berserkUntilTick).toBe(0);
  });
});
