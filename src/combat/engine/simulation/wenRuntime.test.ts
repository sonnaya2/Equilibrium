import { describe, expect, it } from "vitest";
import { performCast } from "../cast";
import { advanceTo } from "../runtime/clock";
import { createRuntime } from "../runtime/runtime";
import { patchRanged } from "../runtime/state";
import { rangedInput } from "../../test/fixtures/inputs";
import { testRangedAmmunition } from "../../testing/rangedAmmunition";
import { WEN_ICY_CHILL_MAX_STACKS } from "../../styles/ranged/wen";

function runSnapShot(mode: "plain" | "consume" | "active") {
  const rt = createRuntime(
    {
      ...rangedInput,
      ammunition: testRangedAmmunition("wen"),
      accuracy: 0.5,
      crit: { chance: 0 },
      startingAdrenaline: 100,
    },
    { laneIndex: 0, laneCount: 128 },
  );
  if (mode === "consume") {
    rt.state = patchRanged(rt.state, {
      wen: {
        icyChillStacks: WEN_ICY_CHILL_MAX_STACKS,
        icyChillExpiresAtTick: 50,
        icyPrecisionUntilTick: 0,
      },
    });
  } else if (mode === "active") {
    rt.state = patchRanged(rt.state, {
      wen: {
        icyChillStacks: 0,
        icyChillExpiresAtTick: 0,
        icyPrecisionUntilTick: 15,
      },
    });
  }
  const ability = rt.byId.get("snap_shot");
  if (!ability) throw new Error("missing Snap Shot");
  const attempt = performCast(rt, ability, 0, false);
  if (!attempt.ok) throw new Error(attempt.error);
  advanceTo(rt, rt.endTick);
  return {
    rt,
    damage: rt.events
      .filter((event) => event.abilityId === "snap_shot")
      .reduce((total, event) => total + event.damage.expected, 0),
    potentials: rt.events
      .filter((event) => event.abilityId === "snap_shot")
      .map((event) => rt.hitDetails.get(event.seq)?.potential),
  };
}

describe("Wen Icy Precision runtime", () => {
  it("gives the consuming and active spenders damage and Damage Potential", () => {
    const plain = runSnapShot("plain");
    const consuming = runSnapShot("consume");
    const active = runSnapShot("active");

    expect(consuming.damage).toBeGreaterThan(plain.damage);
    expect(consuming.damage).toBeCloseTo(active.damage, 8);
    expect(consuming.potentials).toEqual([0.8, 0.8]);
    expect(active.potentials).toEqual([0.8, 0.8]);
    expect(consuming.rt.state.ranged.wen.icyChillStacks).toBe(0);
    expect(consuming.rt.state.ranged.wen.icyPrecisionUntilTick).toBe(15);
    expect(
      consuming.rt.events.every((event) =>
        event.appliedEffects?.some((effect) => effect.id === "ammunition:wen-icy-precision"),
      ),
    ).toBe(true);
  });
});
