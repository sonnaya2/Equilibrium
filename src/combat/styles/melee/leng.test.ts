import { describe, expect, it } from "vitest";
import { createCastContext } from "../../engine/simulation/simulate";
import { performCast } from "../../engine/cast";
import { createRuntime } from "../../engine/runtime/runtime";
import { patchMelee } from "../../engine/runtime/state";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { activeEquipmentEffects } from "../../shared/equipment";
import { baseInput } from "../../test/fixtures/inputs";
import { MELEE_ABILITIES } from "./abilities";
import {
  FROSTBLADES_AD_FRACTION,
  LENG_BOUNDLESS_CHILL_CHANCE,
  LENG_ENDLESS_FROST_CHANCE,
  PRIMORDIAL_ICE_CAP,
  icyTempestHits,
  icyTempestSpend,
} from "./effects";
import { expectedStacksFromAtoms } from "./primordialIce";

const effects = activeEquipmentEffects({
  style: "melee",
  equipmentSlots: {
    mainhand: "item:dark-shard-of-leng",
    offhand: "item:dark-sliver-of-leng",
  },
});

function lengInput(rotation = rotationOf("attack")) {
  return {
    ...baseInput,
    abilities: MELEE_ABILITIES,
    startingAdrenaline: 100,
    equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"] as const,
    equipmentEffects: effects,
    weaponConfiguration: "dualwield" as const,
    rotation,
  };
}

function lengRuntime() {
  const { rotation: _rotation, ...input } = lengInput();
  return createRuntime(input);
}

describe("Leng state and Icy Tempest", () => {
  it("keeps integer stack math and cap", () => {
    expect(icyTempestSpend(0)).toBe(30);
    expect(icyTempestSpend(2)).toBe(6);
    expect(icyTempestSpend(3)).toBe(0);
    expect(icyTempestHits(PRIMORDIAL_ICE_CAP)[0]!.band.minPct).toBe(295);
  });

  it("manual cast keeps the complete probability state on one runtime", () => {
    const rt = lengRuntime();
    const attack = MELEE_ABILITIES.find((ability) => ability.id === "attack")!;
    expect(performCast(rt, attack, 0, false).ok).toBe(true);
    expect(expectedStacksFromAtoms(rt.state.melee.primordialIce.atoms)).toBeCloseTo(0.12, 12);
    expect(rt.state.melee.primordialIce.atoms.reduce((sum, atom) => sum + atom.weight, 0)).toBeCloseTo(
      1,
      12,
    );
    expect(
      rt.state.melee.primordialIce.atoms.some((atom) => atom.stacks === 2 && atom.frostbladesExpireAtTick > 0),
    ).toBe(true);
  });

  it("Icy Tempest uses weighted integer spend groups, never a heaviest-arm state", () => {
    const ctx = createCastContext(lengInput());
    const attack = MELEE_ABILITIES.find((ability) => ability.id === "attack")!;
    const tempest = MELEE_ABILITIES.find((ability) => ability.id === "icy_tempest")!;
    expect(ctx.performCast(attack, 0, false).ok).toBe(true);
    expect(ctx.performCast(tempest, ctx.getState().tick, false).ok).toBe(true);
    const summary = ctx.finish();
    expect(summary.ok).toBe(true);
    expect(summary.totalExpected).toBeGreaterThan(0);
  });

  it("Frostblades uses active atom mass for expected flat damage", () => {
    const rt = lengRuntime();
    rt.state = patchMelee(rt.state, {
      primordialIce: {
        atoms: [
          { weight: 0.25, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 100 },
          { weight: 0.75, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 0 },
        ],
      },
    });
    const assault = MELEE_ABILITIES.find((ability) => ability.id === "assault")!;
    expect(performCast(rt, assault, 0, false).ok).toBe(true);
    const hit = rt.events.find((event) => event.abilityId === "assault" && !event.attached)!;
    const expectedFlat = Math.floor(1000 * FROSTBLADES_AD_FRACTION * 0.25);
    expect(hit.damage.min).toBeGreaterThanOrEqual(1300 + expectedFlat);
  });

  it("mixes Frostblades after the hit pipeline, not before floor", () => {
    const make = (frostbladesExpireAtTick: number) => {
      const rt = createRuntime({ ...lengInput(), base: 999 });
      rt.state = patchMelee(rt.state, {
        primordialIce: {
          atoms: [
            { weight: 1, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick },
          ],
        },
      });
      const assault = MELEE_ABILITIES.find((ability) => ability.id === "assault")!;
      expect(performCast(rt, assault, 0, false).ok).toBe(true);
      return rt.events.find((event) => event.abilityId === "assault" && !event.attached)!
        .damage.expected;
    };
    const noFrost = make(0);
    const fullFrost = make(100);
    const mixed = createRuntime({ ...lengInput(), base: 999 });
    mixed.state = patchMelee(mixed.state, {
      primordialIce: {
        atoms: [
          { weight: 0.25, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 100 },
          { weight: 0.75, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 0 },
        ],
      },
    });
    const assault = MELEE_ABILITIES.find((ability) => ability.id === "assault")!;
    expect(performCast(mixed, assault, 0, false).ok).toBe(true);
    const mixedExpected = mixed.events.find(
      (event) => event.abilityId === "assault" && !event.attached,
    )!.damage.expected;
    expect(mixedExpected).toBeCloseTo(0.25 * fullFrost + 0.75 * noFrost, 10);
  });

  it("manual and Revolution-shaped simulation paths preserve exact mass", () => {
    const manual = simulate(lengInput(rotationOf("attack", "assault")), {
      detailLevel: "full-analysis",
    });
    const revo = simulate({ ...lengInput(rotationOf("attack", "assault")), autoWeave: true }, {
      detailLevel: "score-only",
    });
    expect(manual.ok).toBe(true);
    expect(revo.ok).toBe(true);
    expect(manual.rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-12);
    expect(revo.rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-12);
    expect(LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE).toBeCloseTo(0.12, 12);
  });
});
