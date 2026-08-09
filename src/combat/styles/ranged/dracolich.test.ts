import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../../shared/equipment";
import { rangedInput } from "../../test/fixtures/inputs";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { createRuntime } from "../../engine/runtime/runtime";
import { advanceTo } from "../../engine/runtime/clock";
import {
  applyCastEffects,
  applyCompletionEffects,
  castEffectContext,
} from "../../engine/cast/effects";
import { prepareSimulationCast, commitCast } from "../../engine/cast";
import { scheduleCastEvents } from "../../engine/cast/schedule";
import { dracolichInfusionActive, dracolichInfusionAtCompletion } from "./dracolich";

const normalArmour = [
  "item:dracolich-helm",
  "item:dracolich-body",
  "item:dracolich-legs",
  "item:dracolich-gloves",
  "item:dracolich-boots",
] as const;

const eliteArmour = [
  "item:elite-dracolich-helm",
  "item:elite-dracolich-body",
  "item:elite-dracolich-legs",
  "item:elite-dracolich-gloves",
  "item:elite-dracolich-boots",
] as const;

function slotsFor(armour: readonly string[], weapon = "item:noxious-longbow") {
  const slots: Record<string, string> = { twohand: weapon };
  for (const [index, slot] of ["helmet", "body", "legs", "gloves", "boots"].entries()) {
    const item = armour[index];
    if (item) slots[slot] = item;
  }
  return slots;
}

function effectsFor(
  armour: readonly string[],
  additionalPiecesPerItem = 0,
  weapon = "item:noxious-longbow",
) {
  const equipmentSlots = slotsFor(armour, weapon);
  return activeEquipmentEffects({
    style: "ranged",
    equipmentSlots,
    pieceContribution: { additionalPiecesPerItem },
  });
}

function rapidRuntime(
  armour: readonly string[],
  equipmentEffects: ReturnType<typeof effectsFor>,
  startingAdrenaline = 25,
  horizonTicks?: number,
) {
  const equipmentIds = Object.values(slotsFor(armour));
  const rt = createRuntime({
    ...rangedInput,
    equipmentIds,
    equipmentEffects,
    startingAdrenaline,
    horizonTicks,
  });
  const ability = rt.byId.get("rapid_fire")!;
  const prepared = prepareSimulationCast(rt, ability, 0);
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) throw new Error(prepared.error);
  return { rt, prepared: prepared.prepared };
}

describe("Dracolich Rapid Fire set effects", () => {
  it("resolves physical and effective pieces for normal and Elite sets", () => {
    for (const [armour, payout, crit] of [
      [normalArmour, 0.2, 0.2],
      [eliteArmour, 0.5, 0.4],
    ] as const) {
      const one = effectsFor(armour.slice(0, 1), 2).dracolich!;
      const two = effectsFor(armour.slice(0, 2), 2).dracolich!;
      const five = effectsFor(armour, 2).dracolich!;

      expect(one).toMatchObject({
        physicalPieces: 1,
        effectivePieces: 3,
        adrenalinePerRapidFireHit: payout * 3,
        infusionCritChance: crit,
        thresholds: { three: true, four: false, five: false },
      });
      expect(two).toMatchObject({
        physicalPieces: 2,
        effectivePieces: 6,
        adrenalinePerRapidFireHit: payout * 6,
        thresholds: { three: true, four: true, five: true },
        infusionDurationTicks: 11,
      });
      expect(five).toMatchObject({
        physicalPieces: 5,
        effectivePieces: 15,
        adrenalinePerRapidFireHit: payout * 15,
        thresholds: { three: true, four: true, five: true },
        infusionDurationTicks: 11,
      });
    }
  });

  it("requires a bow for infusion while preserving the Rapid Fire payout", () => {
    const bow = effectsFor(normalArmour.slice(0, 3), 0, "item:noxious-longbow").dracolich!;
    const crossbow = effectsFor(normalArmour.slice(0, 3), 0, "item:eldritch-crossbow").dracolich!;

    expect(bow).toMatchObject({ bowEligible: true, thresholds: { three: true } });
    expect(crossbow.bowEligible).toBe(false);
    expect(crossbow.adrenalinePerRapidFireHit).toBeCloseTo(0.6, 10);
    expect(crossbow.infusionDurationTicks).toBe(5);
    expect(dracolichInfusionAtCompletion({ dracolich: bow }, 8)).toMatchObject({
      startsAtTick: 8,
      expiresAtTick: 13,
      critChance: 0.2,
    });
    expect(dracolichInfusionAtCompletion({ dracolich: crossbow }, 8)).toBeUndefined();
  });

  it("pays every Rapid Fire iteration for every normal and Elite piece count", () => {
    for (const [armour, payout] of [
      [normalArmour, 0.2],
      [eliteArmour, 0.5],
    ] as const) {
      for (let count = 1; count <= 5; count++) {
        const { rt, prepared } = rapidRuntime(
          armour.slice(0, count),
          effectsFor(armour.slice(0, count)),
        );
        scheduleCastEvents(rt, prepared, false);
        applyCastEffects(rt, prepared);
        let previousAdrenaline = 0;
        for (let tick = 0; tick < 8; tick++) {
          advanceTo(rt, tick);
          const currentAdrenaline = rt.state.adrenaline;
          expect(currentAdrenaline - previousAdrenaline).toBeCloseTo(payout * count, 10);
          previousAdrenaline = currentAdrenaline;
        }
        expect(rt.state.adrenaline).toBeCloseTo(payout * count * 8, 10);
        applyCompletionEffects(castEffectContext(rt, prepared), true);
        if (count < 3) {
          expect(rt.state.ranged.dracolichInfusion.expiresAtTick).toBe(0);
        } else {
          expect(rt.state.ranged.dracolichInfusion).toMatchObject({
            startsAtTick: 8,
            critChance: payout === 0.2 ? 0.2 : 0.4,
          });
        }
      }
    }
  });

  it("pays exactly eight landed Rapid Fire iterations and completes infusion", () => {
    const { rt, prepared } = rapidRuntime(normalArmour, effectsFor(normalArmour));
    commitCast(rt, prepared, false);

    expect(rt.events.map((event) => event.tick)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(rt.state.adrenaline).toBe(8);
    expect(rt.state.ranged.dracolichInfusion).toEqual({
      startsAtTick: 8,
      expiresAtTick: 19,
      critChance: 0.2,
    });
  });

  it("pays only the iterations that happen and skips completion on interruption", () => {
    const { rt, prepared } = rapidRuntime(normalArmour, effectsFor(normalArmour));
    scheduleCastEvents(rt, prepared, false);
    applyCastEffects(rt, prepared);

    advanceTo(rt, 3);
    expect(rt.state.adrenaline).toBe(4);
    expect(rt.events.map((event) => event.tick)).toEqual([0, 1, 2, 3]);

    rt.queue.cancelByOwner(0);
    advanceTo(rt, 8);
    applyCompletionEffects(castEffectContext(rt, prepared), false);
    expect(rt.state.adrenaline).toBe(4);
    expect(rt.state.ranged.dracolichInfusion.expiresAtTick).toBe(0);
  });

  it("does not complete Infusion at the half-open horizon boundary", () => {
    const { rt, prepared } = rapidRuntime(normalArmour, effectsFor(normalArmour, 1), 25, 8);
    commitCast(rt, prepared, false);

    expect(rt.events.map((event) => event.tick)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(rt.state.ranged.dracolichInfusion.expiresAtTick).toBe(0);
  });

  it("uses 5, 8, and 11 active ticks with replacement refresh", () => {
    const three = effectsFor(normalArmour.slice(0, 3)).dracolich!;
    const four = effectsFor(normalArmour.slice(0, 4)).dracolich!;
    const five = effectsFor(normalArmour).dracolich!;

    expect(three.infusionDurationTicks).toBe(5);
    expect(four.infusionDurationTicks).toBe(8);
    expect(five.infusionDurationTicks).toBe(11);

    const first = dracolichInfusionAtCompletion({ dracolich: three }, 20)!;
    const refreshed = dracolichInfusionAtCompletion({ dracolich: five }, 30)!;
    expect(dracolichInfusionActive(first, 20)).toBe(true);
    expect(dracolichInfusionActive(first, 24)).toBe(true);
    expect(dracolichInfusionActive(first, 25)).toBe(false);
    expect(refreshed).toEqual({ startsAtTick: 30, expiresAtTick: 41, critChance: 0.2 });
  });

  it("adds normal and Elite infusion crit chance at ranged land time", () => {
    for (const [armour, expected] of [
      [normalArmour.slice(0, 3), 0.2],
      [eliteArmour.slice(0, 3), 0.4],
    ] as const) {
      const effects = effectsFor(armour, 1);
      const result = simulate({
        ...rangedInput,
        equipmentIds: ["item:noxious-longbow", ...armour],
        equipmentEffects: effects,
        startingAdrenaline: 25,
        rotation: rotationOf("rapid_fire", "ranged_attack"),
      });
      expect(result.casts[1]?.result.hits[0]?.critChance).toBe(expected);
    }
  });

  it("leaves the base Rapid Fire timeline unchanged without Dracolich", () => {
    const plain = simulate({
      ...rangedInput,
      startingAdrenaline: 25,
      rotation: rotationOf("rapid_fire"),
    });
    const empty = simulate({
      ...rangedInput,
      startingAdrenaline: 25,
      equipmentEffects: activeEquipmentEffects({ style: "ranged", equipmentSlots: slotsFor([]) }),
      rotation: rotationOf("rapid_fire"),
    });
    expect(empty.casts[0]?.result).toEqual(plain.casts[0]?.result);
    expect(empty.casts[0]?.adrenalineAfter).toBe(0);
  });
});
