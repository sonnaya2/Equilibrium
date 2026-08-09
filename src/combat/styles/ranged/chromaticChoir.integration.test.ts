import { describe, expect, it } from "vitest";
import { performCast } from "../../engine/cast";
import { createRuntime } from "../../engine/runtime/runtime";
import { DEFAULT_STOCHASTIC_LANES } from "../../engine/runtime/stochastic";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { activeEquipmentEffects } from "../../shared/equipment";
import { rangedInput } from "../../test/fixtures/inputs";
import {
  chromaticChoirSetSummary,
  type ChromaticChoirSetSummary,
} from "./chromaticChoir";

function setCounts(sirenic = 0, elite = 0): Map<string, number> {
  const map = new Map<string, number>();
  if (sirenic > 0) map.set("sirenic", sirenic);
  if (elite > 0) map.set("elite-sirenic", elite);
  return map;
}

function choirSummary(
  physicalSirenic: number,
  physicalElite = 0,
  weaponClass: "crossbow" | "bow" | null = "crossbow",
): ChromaticChoirSetSummary {
  return chromaticChoirSetSummary(
    setCounts(physicalSirenic, physicalElite),
    setCounts(physicalSirenic, physicalElite),
    undefined,
    weaponClass,
  );
}

function equipmentWithChoir(choir: ChromaticChoirSetSummary, weaponId = "item:eldritch-crossbow") {
  const base = activeEquipmentEffects({
    style: "ranged",
    equipmentSlots: { twohand: weaponId },
  });
  return { ...base, chromaticChoir: choir };
}

function directHits(result: ReturnType<typeof simulate>) {
  return result.events.filter(
    (event) => event.family === "hit" && !event.attached && event.originKind === "direct",
  );
}

describe("Chromatic Choir free-proc engine path", () => {
  it("2pc elite + crossbow schedules DS EV amount proportional to 12%", () => {
    const choir = choirSummary(0, 2, "crossbow");
    expect(choir.procChance).toBe(0.12);
    expect(choir.gems).toEqual(["dragonstone"]);

    const withChoir = simulate({
      ...rangedInput,
      equipmentEffects: equipmentWithChoir(choir),
      rotation: rotationOf("ranged_attack"),
    });
    const without = simulate({
      ...rangedInput,
      equipmentEffects: activeEquipmentEffects({
        style: "ranged",
        equipmentSlots: { twohand: "item:eldritch-crossbow" },
      }),
      rotation: rotationOf("ranged_attack"),
    });

    const proc = withChoir.events.find(
      (event) => event.abilityId === "set:chromatic-choir:dragonstone",
    );
    expect(proc).toMatchObject({
      family: "proc",
      procEligible: false,
      recursionAllowed: false,
      provenance: { kind: "equipment_proc", detail: "chromatic-choir-dragonstone" },
      expectedActivations: 0.12,
      expectedSeparateHits: 0.12,
    });
    expect(proc!.damage.expected).toBeGreaterThan(0);
    // Host hit unchanged; free-proc EV is the total delta.
    expect(directHits(withChoir)[0]!.damage.expected).toBeCloseTo(
      directHits(without)[0]!.damage.expected,
      10,
    );
    expect(withChoir.totalExpected - without.totalExpected).toBeCloseTo(proc!.damage.expected, 10);
    // Single-lane EV for pure 2pc dragonstone.
    expect(withChoir.rng?.lanes ?? 1).toBe(1);
  });

  it("bow weapon: no choir free proc even with 3pc elite", () => {
    const choir = choirSummary(0, 3, "bow");
    expect(choir.crossbowEligible).toBe(false);
    expect(choir.procChance).toBe(0);

    const result = simulate({
      ...rangedInput,
      equipmentEffects: equipmentWithChoir(choir, "item:noxious-longbow"),
      rotation: rotationOf("ranged_attack"),
    });
    expect(result.events.some((event) => event.abilityId.startsWith("set:chromatic-choir:"))).toBe(
      false,
    );
  });

  it("mixed set inactive: no free proc", () => {
    const choir = choirSummary(2, 1, "crossbow");
    expect(choir.mixed).toBe(true);
    expect(choir.procChance).toBe(0);

    const result = simulate({
      ...rangedInput,
      equipmentEffects: equipmentWithChoir(choir),
      rotation: rotationOf("ranged_attack"),
    });
    expect(result.events.some((event) => event.abilityId.startsWith("set:chromatic-choir:"))).toBe(
      false,
    );
  });

  it("3pc triggers multi-gem path (deathmark or onyx under forced RNG lanes)", () => {
    const choir = choirSummary(0, 3, "crossbow");
    expect(choir.thresholds.three).toBe(true);
    expect(choir.gems).toEqual(["dragonstone", "onyx", "hydrix"]);

    let deathmarkLanes = 0;
    let onyxLanes = 0;
    let dragonstoneLanes = 0;
    for (let laneIndex = 0; laneIndex < DEFAULT_STOCHASTIC_LANES; laneIndex++) {
      const rt = createRuntime(
        {
          ...rangedInput,
          equipmentEffects: equipmentWithChoir(choir),
          playerMaximumLifePoints: 10_000,
          playerHpPercent: 50,
        },
        { laneIndex, laneCount: DEFAULT_STOCHASTIC_LANES, seed: 53 },
      );
      const attack = rt.byId.get("ranged_attack")!;
      expect(performCast(rt, attack, 0, false).ok).toBe(true);

      if (rt.state.ranged.boltDeathmark.expiresAtTick > 0) {
        deathmarkLanes++;
        expect(rt.state.adrenaline).toBe(19);
        expect(
          rt.events.some((event) =>
            event.appliedEffects?.some((effect) => effect.id === "set:chromatic-choir:hydrix"),
          ),
        ).toBe(true);
      }
      if (rt.totalHealed > 0) {
        onyxLanes++;
        expect(rt.totalHealed).toBeLessThanOrEqual(2_500);
      }
      if (rt.events.some((event) => event.abilityId === "set:chromatic-choir:dragonstone")) {
        dragonstoneLanes++;
      }
    }

    expect(deathmarkLanes).toBeGreaterThan(0);
    expect(onyxLanes).toBeGreaterThan(0);
    expect(dragonstoneLanes).toBeGreaterThan(0);

    const ensemble = simulate({
      ...rangedInput,
      equipmentEffects: equipmentWithChoir(choir),
      playerMaximumLifePoints: 10_000,
      playerHpPercent: 50,
      rotation: rotationOf("ranged_attack"),
    });
    expect(ensemble.rng?.lanes).toBe(DEFAULT_STOCHASTIC_LANES);
  });

  it("does not re-trigger choir or ammo from choir-scheduled separate hits", () => {
    const choir = choirSummary(0, 2, "crossbow");
    const result = simulate({
      ...rangedInput,
      equipmentEffects: equipmentWithChoir(choir),
      rotation: rotationOf("ranged_attack"),
    });
    const choirProcs = result.events.filter((event) =>
      event.abilityId.startsWith("set:chromatic-choir:"),
    );
    expect(choirProcs).toHaveLength(1);
    expect(choirProcs[0]!.procEligible).toBe(false);
    expect(choirProcs[0]!.recursionAllowed).toBe(false);
  });

  it("keeps choir free DS independent of equipped ammo mechanicId", () => {
    const choir = choirSummary(2, 0, "crossbow");
    const result = simulate({
      ...rangedInput,
      equipmentEffects: equipmentWithChoir(choir),
      // No enchanted ammo - free proc still schedules set-owned DS.
      rotation: rotationOf("ranged_attack"),
    });
    expect(result.events.some((event) => event.abilityId === "set:chromatic-choir:dragonstone")).toBe(
      true,
    );
    expect(result.events.some((event) => event.abilityId === "ammunition:dragonstone")).toBe(false);
  });

  it("respects dragonstone target gate on choir free DS", () => {
    const choir = choirSummary(0, 2, "crossbow");
    const immune = simulate({
      ...rangedInput,
      equipmentEffects: equipmentWithChoir(choir),
      targetClassification: { dragonfireImmune: true },
      rotation: rotationOf("ranged_attack"),
    });
    expect(immune.events.some((event) => event.abilityId === "set:chromatic-choir:dragonstone")).toBe(
      false,
    );
  });
});
