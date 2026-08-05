import { describe, expect, it } from "vitest";
import { costOf, castRejection } from "../../engine/cast/rules";
import { simulateRevolution } from "../../engine/simulation/revolution";
import { rotationOf } from "../../engine/simulation/contracts";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { necroInput } from "../../test/fixtures/inputs";
import { abilityById, findCast } from "../../test/helpers/summary";
import { NECROMANCY_ABILITIES } from "./abilities";

/**
 * Finger of Death multi-cast: Necrosis discount spends up to 6 stacks per cast
 * (10% adren each from 60% base). Free at >=6 stacks; residual stacks allow a
 * second free cast; 0 stacks requires full 60%. No ability CD on FoD.
 */

const byId = (id: string) => abilityById(NECROMANCY_ABILITIES, id);

function fodCount(casts: readonly { abilityId: string; tick: number }[], maxTickExclusive?: number) {
  return casts.filter(
    (c) =>
      c.abilityId === "finger_of_death" &&
      (maxTickExclusive === undefined || c.tick < maxTickExclusive),
  ).length;
}

describe("Finger of Death multi-cast", () => {
  it("12 Necrosis: two consecutive free FoDs (cost 0,0); stacks 12->6->0; adren unchanged", () => {
    // Start low adren so free casts prove affordability is stack-driven, not adren bank.
    const ctx = createCastContext({ ...necroInput, startingAdrenaline: 0 });
    const tod = byId("touch_of_death");
    const fod = byId("finger_of_death");

    // ToD CD 14.4s = 24 ticks; prepare auto-waits firstLegalTick.
    ctx.performCast(tod, 0, false);
    ctx.performCast(tod, 0, false);
    ctx.performCast(tod, 0, false);
    expect(ctx.getState().necromancy.resources.necrosisStacks).toBe(12);

    const adrenBeforeFree = ctx.getState().adrenaline;
    expect(adrenBeforeFree).toBeLessThan(60);

    const tick1 = ctx.getState().tick;
    expect(costOf(ctx.getState(), fod, tick1)).toBe(0);
    expect(castRejection(ctx.getState(), fod, tick1)).toBeNull();
    expect(ctx.performCast(fod, tick1, false).ok).toBe(true);
    expect(ctx.getState().necromancy.resources.necrosisStacks).toBe(6);
    expect(ctx.getState().adrenaline).toBe(adrenBeforeFree);

    const tick2 = ctx.getState().tick;
    expect(costOf(ctx.getState(), fod, tick2)).toBe(0);
    expect(castRejection(ctx.getState(), fod, tick2)).toBeNull();
    expect(ctx.performCast(fod, tick2, false).ok).toBe(true);
    expect(ctx.getState().necromancy.resources.necrosisStacks).toBe(0);
    expect(ctx.getState().adrenaline).toBe(adrenBeforeFree);
  });

  it("after free casts, third FoD needs 60% when stacks are 0", () => {
    const ctx = createCastContext({ ...necroInput, startingAdrenaline: 100 });
    const tod = byId("touch_of_death");
    const fod = byId("finger_of_death");

    ctx.performCast(tod, 0, false);
    ctx.performCast(tod, 0, false);
    ctx.performCast(tod, 0, false);
    expect(ctx.getState().necromancy.resources.necrosisStacks).toBe(12);

    expect(ctx.performCast(fod, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.performCast(fod, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().necromancy.resources.necrosisStacks).toBe(0);
    expect(ctx.getState().adrenaline).toBe(100);

    const tick3 = ctx.getState().tick;
    expect(costOf(ctx.getState(), fod, tick3)).toBe(60);
    expect(castRejection(ctx.getState(), fod, tick3)).toBeNull();
    expect(ctx.performCast(fod, tick3, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(40);
    expect(ctx.getState().necromancy.resources.necrosisStacks).toBe(0);
  });

  it("4 stacks: cost 20; after cast stacks 0; second FoD cost 60", () => {
    const ctx = createCastContext({ ...necroInput, startingAdrenaline: 100 });
    const tod = byId("touch_of_death");
    const fod = byId("finger_of_death");

    ctx.performCast(tod, 0, false);
    expect(ctx.getState().necromancy.resources.necrosisStacks).toBe(4);

    const tick1 = ctx.getState().tick;
    expect(costOf(ctx.getState(), fod, tick1)).toBe(20);
    expect(ctx.performCast(fod, tick1, false).ok).toBe(true);
    expect(ctx.getState().necromancy.resources.necrosisStacks).toBe(0);
    // At cap 100 ToD gain is discarded; FoD spends 20 -> 80.
    expect(ctx.getState().adrenaline).toBe(80);

    const tick2 = ctx.getState().tick;
    expect(costOf(ctx.getState(), fod, tick2)).toBe(60);
    expect(ctx.performCast(fod, tick2, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(20);
    expect(ctx.getState().necromancy.resources.necrosisStacks).toBe(0);
  });

  it("revo: FoD over basic at adren cap 150 casts at least 2 FoD in first 15 ticks without necrosis", () => {
    const fod = byId("finger_of_death");
    const basic = byId("necromancy_basic");
    const s = simulateRevolution({
      ...necroInput,
      bar: [fod, basic],
      style: "necromancy",
      durationTicks: 15,
      startingAdrenaline: 150,
      // Base cap 100; Heightened-style +50 so 150 start is legal.
      adrenaline: { maxAdrenalineBonus: 50 },
    });
    expect(s.ok, s.error).toBe(true);
    expect(fodCount(s.casts, 15)).toBeGreaterThanOrEqual(2);
    // No ToD: stacks never leave 0; every FoD is full 60 cost path.
    expect(s.casts.every((c) => c.abilityId !== "touch_of_death")).toBe(true);
  });

  it("revo: ToD then FoD high priority yields multiple FoDs over 50 ticks", () => {
    const tod = byId("touch_of_death");
    const fod = byId("finger_of_death");
    const basic = byId("necromancy_basic");
    const s = simulateRevolution({
      ...necroInput,
      bar: [tod, fod, basic],
      style: "necromancy",
      durationTicks: 50,
      startingAdrenaline: 100,
    });
    expect(s.ok, s.error).toBe(true);
    expect(fodCount(s.casts)).toBeGreaterThanOrEqual(2);
    expect(s.casts.some((c) => c.abilityId === "touch_of_death")).toBe(true);
  });

  it("Living Death FoD expected damage is ~4500 at base 1000", () => {
    // Band 270-330 * 1.5 = 405-495; mid EV at base 1000 is 4500.
    // Full LD sim path also locked in effects.test; keep this thin.
    const s = simulate({
      ...necroInput,
      startingAdrenaline: 100,
      rotation: rotationOf(
        ...Array(12).fill("necromancy_basic"),
        "touch_of_death",
        "living_death",
        "necromancy_basic",
        "finger_of_death",
      ),
    });
    expect(s.ok, s.error).toBe(true);
    const fodCast = findCast(
      s,
      (cast) => cast.abilityId === "finger_of_death",
      "Missing Finger of Death cast",
    );
    expect(fodCast.result.expected).toBeCloseTo(4500);
  });
});
