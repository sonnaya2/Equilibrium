import { describe, expect, it } from "vitest";
import { performCast } from "../../engine/cast";
import { createRuntime } from "../../engine/runtime/runtime";
import { createStochasticOracle, DEFAULT_STOCHASTIC_LANES } from "../../engine/runtime/stochastic";
import { patchRanged } from "../../engine/runtime/state";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { rangedInput } from "../../test/fixtures/inputs";
import { testRangedAmmunition } from "../../testing/rangedAmmunition";
import {
  activateBoltDeathmark,
  enchantedBoltStatefulProcStream,
} from "./enchantedBoltRuntime";
import { enchantedBoltActivationChance } from "./enchantedBolt";
import { resolveAmmunitionProfile } from "./ammunitionProfile";

function statefulBoltAmmunition(mechanicId: "ruby" | "onyx") {
  const projectile = resolveAmmunitionProfile({
    id: `item:test-${mechanicId}-bolts-stateful`,
    label: `Test ${mechanicId} bolts`,
    family: "bolts",
    statTier: 95,
    mechanicId,
    support: { status: "modeled", label: "Test fixture" },
  });
  if (!projectile) throw new Error(`missing ${mechanicId} fixture`);
  return {
    projectile,
    quiver: null,
    weaponCapability: { mode: "optional" as const, acceptedFamily: "bolts" as const },
    effectiveStatTier: 95,
  };
}

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

  it("applies Ruby Blood Forfeit and recoil from concrete target/player state", () => {
    let active = 0;
    let inactive = 0;
    for (let laneIndex = 0; laneIndex < DEFAULT_STOCHASTIC_LANES; laneIndex++) {
      const rt = createRuntime(
        {
          ...rangedInput,
          ammunition: statefulBoltAmmunition("ruby"),
          targetMaximumLifePoints: 10_000,
          targetHpPercent: 50,
          playerMaximumLifePoints: 10_000,
          playerHpPercent: 50,
        },
        { laneIndex, laneCount: DEFAULT_STOCHASTIC_LANES, seed: 31 },
      );
      const attack = rt.byId.get("ranged_attack")!;
      expect(performCast(rt, attack, 0, false).ok).toBe(true);
      if (rt.state.player!.vitality.currentLifePoints < 5_000) {
        active++;
        expect(rt.state.target.vitality!.currentLifePoints).toBeLessThan(5_000);
      } else {
        inactive++;
        expect(rt.state.player!.vitality.currentLifePoints).toBe(5_000);
      }
    }
    expect(active).toBeGreaterThan(0);
    expect(inactive).toBeGreaterThan(0);
  });

  it("applies one Ruby direct hit to target vitality", () => {
    const initialTargetLifePoints = 5_000;
    for (let laneIndex = 0; laneIndex < DEFAULT_STOCHASTIC_LANES; laneIndex++) {
      const rt = createRuntime(
        {
          ...rangedInput,
          ammunition: statefulBoltAmmunition("ruby"),
          targetMaximumLifePoints: 10_000,
          targetHpPercent: 50,
          playerMaximumLifePoints: 10_000,
          playerHpPercent: 50,
        },
        { laneIndex, laneCount: DEFAULT_STOCHASTIC_LANES, seed: 31 },
      );
      const attack = rt.byId.get("ranged_attack")!;
      expect(performCast(rt, attack, 0, false).ok).toBe(true);

      if (rt.state.player!.vitality.currentLifePoints < initialTargetLifePoints) {
        const directEvents = rt.events.filter(
          (event) => event.family === "hit" && !event.attached && event.originKind === "direct",
        );
        expect(directEvents).toHaveLength(1);
        expect(rt.state.target.vitality!.currentLifePoints).toBe(
          Math.max(0, initialTargetLifePoints - directEvents[0]!.damage.expected),
        );
        return;
      }
    }
    throw new Error("Ruby proc did not activate in the fixed stochastic lanes");
  });

  it("heals from original Onyx damage potential and respects the cap", () => {
    let active = 0;
    for (let laneIndex = 0; laneIndex < DEFAULT_STOCHASTIC_LANES; laneIndex++) {
      const rt = createRuntime(
        {
          ...rangedInput,
          ammunition: statefulBoltAmmunition("onyx"),
          playerMaximumLifePoints: 10_000,
          playerHpPercent: 50,
        },
        { laneIndex, laneCount: DEFAULT_STOCHASTIC_LANES, seed: 37 },
      );
      const attack = rt.byId.get("ranged_attack")!;
      expect(performCast(rt, attack, 0, false).ok).toBe(true);
      if (rt.totalHealed > 0) {
        active++;
        expect(rt.totalHealed).toBeLessThanOrEqual(2_500);
        expect(rt.state.player!.vitality.currentLifePoints).toBeGreaterThan(5_000);
      }
    }
    expect(active).toBeGreaterThan(0);
  });

  it("uses pre-Onyx capped potential for the healing amount", () => {
    for (let laneIndex = 0; laneIndex < DEFAULT_STOCHASTIC_LANES; laneIndex++) {
      const rt = createRuntime(
        {
          ...rangedInput,
          ammunition: statefulBoltAmmunition("onyx"),
          cap: { cap: 100, bypass: false },
          playerVitality: { maximumLifePoints: 10_000, currentLifePoints: 5_000 },
        },
        { laneIndex, laneCount: DEFAULT_STOCHASTIC_LANES, seed: 41 },
      );
      const attack = rt.byId.get("ranged_attack")!;
      expect(performCast(rt, attack, 0, false).ok).toBe(true);
      if (rt.totalHealed > 0) expect(rt.totalHealed).toBe(25);
    }
  });

  it("preserves existing Onyx overheal when Life Leech procs", () => {
    const maximumLifePoints = 10_000;
    const initialLifePoints = 10_500;
    let active = 0;
    for (let laneIndex = 0; laneIndex < DEFAULT_STOCHASTIC_LANES; laneIndex++) {
      const rt = createRuntime(
        {
          ...rangedInput,
          ammunition: statefulBoltAmmunition("onyx"),
          playerVitality: {
            maximumLifePoints,
            currentLifePoints: initialLifePoints,
          },
        },
        { laneIndex, laneCount: DEFAULT_STOCHASTIC_LANES, seed: 37 },
      );
      expect(rt.state.player!.vitality.currentLifePoints).toBe(initialLifePoints);
      const attack = rt.byId.get("ranged_attack")!;
      expect(performCast(rt, attack, 0, false).ok).toBe(true);
      if (rt.totalHealed > 0) {
        active++;
        expect(rt.state.player!.vitality.currentLifePoints).toBe(initialLifePoints);
        break;
      }
    }
    expect(active).toBe(1);
  });

  it("keeps stateful bolt outcomes lane- and cast-local under simulation hit reuse", () => {
    const castCount = 2;
    for (const mechanicId of ["ruby", "onyx"] as const) {
      const seed = 31;
      const chance = enchantedBoltActivationChance(mechanicId)!;
      let expectedActivations = 0;
      for (let laneIndex = 0; laneIndex < DEFAULT_STOCHASTIC_LANES; laneIndex++) {
        const oracle = createStochasticOracle({
          laneIndex,
          laneCount: DEFAULT_STOCHASTIC_LANES,
          seed,
        });
        for (let castSeq = 0; castSeq < castCount; castSeq++) {
          if (oracle.bernoulli(enchantedBoltStatefulProcStream(castSeq, 0), chance)) {
            expectedActivations++;
          }
        }
      }

      const summary = simulate(
        {
          ...rangedInput,
          ammunition: statefulBoltAmmunition(mechanicId),
          rotation: rotationOf("ranged_attack", "ranged_attack"),
          targetMaximumLifePoints: 1_000_000,
          targetHpPercent: 100,
          playerVitality: { maximumLifePoints: 10_000, currentLifePoints: 5_000 },
        },
        { stochasticSeed: seed },
      );
      const effect = summary.analysis.byEffect.find(
        (row) => row.id === `ammunition:${mechanicId}`,
      );
      expect(summary.rng?.lanes).toBe(DEFAULT_STOCHASTIC_LANES);
      expect(effect?.expectedActivations).toBeCloseTo(
        expectedActivations / DEFAULT_STOCHASTIC_LANES,
        10,
      );
    }
  });
});
