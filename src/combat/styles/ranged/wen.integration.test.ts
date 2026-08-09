import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { rangedInput } from "../../test/fixtures/inputs";
import { testRangedAmmunition } from "../../testing/rangedAmmunition";
import { WEN_ICY_PRECISION_DAMAGE_MULTIPLIER, WEN_ICY_PRECISION_DURATION_TICKS } from "./wen";

describe("Wen arrow runtime", () => {
  it("builds from every basic ability, then consumes on a spender", () => {
    const ctx = createCastContext({
      ...rangedInput,
      ammunition: testRangedAmmunition("wen"),
    });
    const attack = ctx.byId.get("ranged_attack")!;
    for (let cast = 0; cast < 9; cast++) {
      expect(ctx.performCast(attack, ctx.getState().tick, false).ok).toBe(true);
    }
    expect(ctx.getState().ranged.wen.icyChillStacks).toBe(9);

    const piercingShot = ctx.byId.get("piercing_shot")!;
    expect(ctx.performCast(piercingShot, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().ranged.wen.icyChillStacks).toBe(10);

    const rapidFire = ctx.byId.get("rapid_fire")!;
    const activationTick = ctx.getState().tick;
    expect(ctx.performCast(rapidFire, activationTick, false).ok).toBe(true);
    expect(ctx.getState().ranged.wen).toMatchObject({
      icyChillStacks: 0,
      icyPrecisionUntilTick: activationTick + WEN_ICY_PRECISION_DURATION_TICKS,
    });
  });

  it("gives the consuming spender +30% damage and +30 Damage Potential", () => {
    const rotation = rotationOf(...Array(10).fill("ranged_attack"), "rapid_fire");
    const result = simulate({
      ...rangedInput,
      accuracy: 0.5,
      ammunition: testRangedAmmunition("wen"),
      rotation,
    });
    const reference = simulate({ ...rangedInput, accuracy: 0.8, rotation });
    const wenCast = result.casts.find((cast) => cast.abilityId === "rapid_fire")!;
    const referenceCast = reference.casts.find((cast) => cast.abilityId === "rapid_fire")!;

    expect(wenCast.result.hits).toHaveLength(8);
    expect(wenCast.result.hits.every((hit) => hit.potential === 0.8)).toBe(true);
    for (let index = 0; index < wenCast.result.hits.length; index++) {
      expect(
        wenCast.result.hits[index]!.expected / referenceCast.result.hits[index]!.expected,
      ).toBeCloseTo(WEN_ICY_PRECISION_DAMAGE_MULTIPLIER, 2);
    }
  });
});
