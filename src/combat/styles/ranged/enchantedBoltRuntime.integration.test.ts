import { describe, expect, it } from "vitest";
import { performCast } from "../../engine/cast";
import { createRuntime } from "../../engine/runtime/runtime";
import { DEFAULT_STOCHASTIC_LANES } from "../../engine/runtime/stochastic";
import { patchRanged } from "../../engine/runtime/state";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { rangedInput } from "../../test/fixtures/inputs";
import { testRangedAmmunition } from "../../testing/rangedAmmunition";
import { activateBoltDeathmark } from "./enchantedBoltRuntime";

function activatedLaneCount(
  mechanicId: "hydrix" | "ascendri",
  modifiers: { rangedCape?: boolean; eliteSeersVillage?: boolean } = {},
): number {
  let activated = 0;
  for (let laneIndex = 0; laneIndex < DEFAULT_STOCHASTIC_LANES; laneIndex++) {
    const rt = createRuntime(
      {
        ...rangedInput,
        ammunition: testRangedAmmunition(mechanicId),
        enchantedBoltChanceModifiers: modifiers,
      },
      { laneIndex, laneCount: DEFAULT_STOCHASTIC_LANES, seed: 17 },
    );
    const attack = rt.byId.get("ranged_attack")!;
    expect(performCast(rt, attack, 0, false).ok).toBe(true);
    if (rt.state.ranged.boltDeathmark.expiresAtTick > 0) {
      activated++;
      expect(rt.state.adrenaline).toBe(19);
      expect(
        rt.events.some((event) =>
          event.appliedEffects?.some((effect) => effect.id === `ammunition:${mechanicId}`),
        ),
      ).toBe(true);
    } else {
      expect(rt.state.adrenaline).toBe(9);
    }
  }
  return activated;
}

describe("Hydrix and Ascendri Deathmark runtime", () => {
  it("samples the sourced per-hit chance and applies the activation adrenaline", () => {
    expect(activatedLaneCount("hydrix")).toBe(13);
    expect(activatedLaneCount("ascendri", { rangedCape: true, eliteSeersVillage: true })).toBe(18);
  });

  it("grants one extra adrenaline per generating basic cast, not per hitsplat", () => {
    const rt = createRuntime(rangedInput, { laneIndex: 0, laneCount: 1, seed: 19 });
    rt.state = patchRanged(rt.state, { boltDeathmark: activateBoltDeathmark(0) });
    const piercingShot = rt.byId.get("piercing_shot")!;

    expect(performCast(rt, piercingShot, 0, false).ok).toBe(true);
    expect(performCast(rt, piercingShot, rt.state.tick, false).ok).toBe(true);
    expect(rt.casts.map((cast) => cast.adrenalineTransaction?.boltDeathmarkGain)).toEqual([1, 1]);
    expect(rt.state.adrenaline).toBe(20);
  });

  it("keeps the fixed stochastic ensemble deterministic and unit-mass", () => {
    const input = {
      ...rangedInput,
      ammunition: testRangedAmmunition("hydrix"),
      rotation: rotationOf("ranged_attack", "ranged_attack", "ranged_attack"),
    };
    const first = simulate(input, { stochasticSeed: 23 });
    const second = simulate(input, { stochasticSeed: 23 });

    expect(first.rng).toMatchObject({
      lanes: DEFAULT_STOCHASTIC_LANES,
      probabilityMass: 1,
      residualWeight: 0,
      failedLanes: 0,
    });
    expect(second.totalExpected).toBe(first.totalExpected);
    expect(second.rng).toEqual(first.rng);
  });
});
