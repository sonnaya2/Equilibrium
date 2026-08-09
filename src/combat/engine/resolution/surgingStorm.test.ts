import { describe, expect, it } from "vitest";
import { calculateHit } from "../../pipeline/calculateHit";
import { rotationOf } from "../simulation/contracts";
import { createCastContext } from "../simulation/context";
import { simulate } from "../simulation/simulate";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import {
  SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION,
  instabilityActive,
} from "../../styles/magic/effects";
import { activeEquipmentEffects } from "../../shared/equipment";
import { fsoaMagicInput, magicInput } from "../../test/fixtures/inputs";

const FSOA = "item:fractured-staff-of-armadyl";
const STAFF = "item:staff-of-light";
const EOF = "item:essence-of-finality";

function exactMagicHit(
  damageBonus = 0,
  distribution?: typeof SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION,
  band = { minPct: 90, maxPct: 110 },
) {
  return calculateHit({
    base: 1000,
    band,
    level: 99,
    accuracy: 1,
    crit: { chance: 0, guaranteed: true, damageBonus },
    ...(distribution ? { critDamageDistribution: distribution } : {}),
  });
}

function equipment(twohand: string, amulet?: string) {
  return activeEquipmentEffects({
    style: "magic",
    equipmentSlots: { twohand, ...(amulet ? { amulet } : {}) },
  });
}

describe("Surging Storm cast ownership", () => {
  it("applies the exact layer only to an FSoA cast and composes additively", () => {
    const fsoa = simulate({
      ...fsoaMagicInput,
      crit: { chance: 0, guaranteed: true },
      rotation: rotationOf("magic_attack"),
    });
    const staff = simulate({
      ...magicInput,
      equipmentIds: [STAFF],
      weaponConfiguration: "twohand",
      equipmentEffects: equipment(STAFF),
      crit: { chance: 0, guaranteed: true },
      rotation: rotationOf("magic_attack"),
    });
    const additive = simulate({
      ...fsoaMagicInput,
      crit: { chance: 0, guaranteed: true, damageBonus: 0.2 },
      rotation: rotationOf("magic_attack"),
    });
    const exactStaff = exactMagicHit();
    const exactFsoa = exactMagicHit(0, SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION);
    const exactAdditive =
      Array.from({ length: SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION.points }, (_, index) => {
        const bonus =
          SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION.minBonus +
          ((SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION.maxBonus -
            SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION.minBonus) *
            index) /
            (SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION.points - 1);
        return exactMagicHit(0.2 + bonus).expected;
      }).reduce((total, expected) => total + expected, 0) /
      SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION.points;

    expect(fsoa.casts[0]!.result.hits[0]!.expected).toBeCloseTo(exactFsoa.expected, 10);
    expect(staff.casts[0]!.result.hits[0]!.expected).toBeCloseTo(exactStaff.expected, 10);
    expect(additive.casts[0]!.result.hits[0]!.expected).toBeCloseTo(exactAdditive, 10);
    expect(fsoa.casts[0]!.result.hits[0]!.expected).not.toBe(
      staff.casts[0]!.result.hits[0]!.expected,
    );
  });

  it("does not grant the passive to an EoF special on another weapon", () => {
    const result = simulate({
      ...magicInput,
      equipmentIds: [STAFF, EOF],
      weaponConfiguration: "twohand",
      equipmentEffects: equipment(STAFF, EOF),
      startingAdrenaline: 50,
      crit: { chance: 0, guaranteed: true },
      rotation: rotationOf("instability"),
    });
    expect(result.ok).toBe(true);
    const event = result.events.find(
      (candidate) => candidate.abilityId === "instability" && candidate.family === "hit",
    )!;
    expect(event.castSnap?.surgingStormAtCast).toBe(false);
    expect(event.damage.expected).toBeCloseTo(
      exactMagicHit(0, undefined, { minPct: 120, maxPct: 140 }).expected,
      10,
    );
  });

  it("keeps the cast-snapshotted layer on delayed multi-hit damage", () => {
    const attack = MAGIC_ABILITIES.find((ability) => ability.id === "magic_attack")!;
    const delayed = {
      ...attack,
      id: "surging_storm_delayed_multi",
      hits: [
        { ...attack.hits[0]!, tickOffset: 0 },
        { ...attack.hits[0]!, tickOffset: 4 },
      ],
    };
    const result = simulate({
      ...fsoaMagicInput,
      abilities: [...MAGIC_ABILITIES, delayed],
      crit: { chance: 0, guaranteed: true },
      horizonTicks: 12,
      rotation: rotationOf(delayed.id),
    });
    const hits = result.events.filter(
      (event) => event.abilityId === delayed.id && event.family === "hit",
    );
    expect(hits).toHaveLength(2);
    expect(hits.map((event) => event.castSnap?.surgingStormAtCast)).toEqual([true, true]);
    expect(hits.map((event) => event.damage.expected)).toEqual([
      exactMagicHit(0, SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION).expected,
      exactMagicHit(0, SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION).expected,
    ]);
  });

  it("keeps damage-only Surging Storm on one lane", () => {
    const result = simulate({
      ...fsoaMagicInput,
      crit: { chance: 0, guaranteed: true },
      rotation: rotationOf("magic_attack"),
    });
    expect(result.rng?.lanes ?? 1).toBe(1);
  });

  it("suppresses while away from FSoA and resumes before the timer expires", () => {
    const fsoaEffects = equipment(FSOA);
    const awayEffects = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { mainhand: "item:abyssal-whip" },
    });
    const fsoaWeapon = fsoaEffects.activeWeapon;
    const context = createCastContext({
      ...fsoaMagicInput,
      startingAdrenaline: 50,
      crit: { chance: 0, guaranteed: true },
      equipmentEffects: fsoaEffects,
    });
    context.performCast(context.byId.get("instability")!, 0, false);
    fsoaEffects.activeWeapon = awayEffects.activeWeapon;
    context.performCast(context.byId.get("magic_attack")!, context.getState().tick, false);
    fsoaEffects.activeWeapon = fsoaWeapon;
    context.performCast(context.byId.get("magic_attack")!, context.getState().tick, false);

    expect(instabilityActive(context.getState().magic.instability, context.getState().tick)).toBe(
      true,
    );
    const summary = context.finish();
    expect(
      summary.events
        .filter((event) => event.provenance.detail === "lightning_surge")
        .map((event) => event.sourceCast),
    ).toEqual([0, 2]);
  });
});
