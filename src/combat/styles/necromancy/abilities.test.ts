import { describe, expect, it } from "vitest";
import { calculateAbility } from "../../pipeline/calculateAbility";
import {
  BLOAT_DOT_FRACTION,
  BLOAT_DOT_HITS,
  BLOAT_DOT_TICK_INTERVAL,
  BLOAT_INITIAL_BAND,
  BLOOD_SIPHON_FINAL_BAND,
  COMMAND_PHANTOM_GUARDIAN_BAND,
  COMMAND_PUTRID_ZOMBIE_BAND,
  COMMAND_SKELETON_HITS,
  DEATH_GRASP_BAND,
  DEATH_SKULLS_BAND,
  DEATH_SKULLS_SINGLE_TARGET_HITS,
  FINGER_OF_DEATH_BAND,
  FINGER_OF_DEATH_BASE_COST_PCT,
  MAX_SOULS,
  NECROMANCY_ABILITIES,
  NECROMANCY_EFFECTS,
  VOLLEY_MIN_SOULS,
  commandPhantomGuardian,
  deathGrasp,
  fingerOfDeath,
  spectralScythe3,
  volleyOfSouls,
} from "./abilities";

const input = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
};

describe("necromancy ability data", () => {
  it("every calculable record carries a source and sane bands", () => {
    for (const a of NECROMANCY_ABILITIES) {
      expect(a.source.verifiedAt, a.id).toBeTruthy();
      expect(a.style).toBe("necromancy");
      for (const h of a.hits) expect(h.band.minPct, a.id).toBeLessThanOrEqual(h.band.maxPct);
    }
    expect(new Set(NECROMANCY_ABILITIES.map((a) => a.id)).size).toBe(NECROMANCY_ABILITIES.length);
  });

  it("exactly one auto-attack basic", () => {
    const autos = NECROMANCY_ABILITIES.filter((a) => a.autoAttack);
    expect(autos).toHaveLength(1);
    expect(autos[0]!.id).toBe("necromancy_basic");
    expect(autos[0]!.hits[0]!.band).toEqual({ minPct: 90, maxPct: 110 });
    expect(autos[0]!.adrenaline?.gain).toBe(9);
  });

  it("Soul Sap / Touch of Death are 90–110% basics with resource gains", () => {
    const sap = NECROMANCY_ABILITIES.find((a) => a.id === "soul_sap")!;
    expect(sap.hits[0]!.band).toEqual({ minPct: 90, maxPct: 110 });
    expect(sap.soulGain).toBe(1);
    expect(sap.adrenaline?.gain).toBe(9);

    const tod = NECROMANCY_ABILITIES.find((a) => a.id === "touch_of_death")!;
    expect(tod.hits[0]!.band).toEqual({ minPct: 90, maxPct: 110 });
    expect(tod.necrosisGain).toBe(4);
  });

  it("Death Skulls single-target model is an initial hit plus 2 derived bounces", () => {
    const ds = NECROMANCY_ABILITIES.find((a) => a.id === "death_skulls")!;
    expect(ds.hits).toHaveLength(1);
    expect(ds.hits[0]!.band).toEqual({ ...DEATH_SKULLS_BAND });
    expect(ds.derivedHits).toEqual({
      count: DEATH_SKULLS_SINGLE_TARGET_HITS - 1,
      intervalTicks: 2,
      firstOffset: 2,
      fractionPct: 100,
      dot: false,
    });
    expect(ds.adrenaline?.cost).toBe(60);
  });

  it("Bloat is an initial hit plus 10 derived DoT tails at 25% of it", () => {
    const bloat = NECROMANCY_ABILITIES.find((a) => a.id === "bloat")!;
    expect(bloat.hits).toHaveLength(1);
    expect(bloat.hits[0]!.band).toEqual({ ...BLOAT_INITIAL_BAND });
    expect(bloat.derivedHits).toEqual({
      count: BLOAT_DOT_HITS,
      intervalTicks: BLOAT_DOT_TICK_INTERVAL,
      firstOffset: BLOAT_DOT_TICK_INTERVAL,
      fractionPct: BLOAT_DOT_FRACTION * 100,
      dot: true,
    });
    expect(bloat.adrenaline?.cost).toBe(20);
  });

  it("Living Death is a buff-only ultimate at 100% adrenaline", () => {
    const ld = NECROMANCY_ABILITIES.find((a) => a.id === "living_death")!;
    expect(ld.hits).toHaveLength(0);
    expect(ld.stateEffect).toBe("living_death");
    expect(ld.adrenaline?.cost).toBe(100);
  });

  it("Blood Siphon solo model is the 117–143% finisher", () => {
    const bs = NECROMANCY_ABILITIES.find((a) => a.id === "blood_siphon")!;
    expect(bs.hits).toHaveLength(1);
    expect(bs.hits[0]!.band).toEqual({ ...BLOOD_SIPHON_FINAL_BAND });
    expect(bs.adrenaline?.cost).toBe(0);
    expect(bs.cooldownSeconds).toBe(45);
  });

  it("command bursts use spirit bands and cannot crit", () => {
    const skel = NECROMANCY_ABILITIES.find((a) => a.id === "command_skeleton_warrior")!;
    expect(skel.hits).toHaveLength(COMMAND_SKELETON_HITS);
    expect(skel.hits.every((h) => h.critEligible === false)).toBe(true);
    expect(skel.hits[0]!.band).toEqual({ minPct: 22, maxPct: 28 });

    const putrid = NECROMANCY_ABILITIES.find((a) => a.id === "command_putrid_zombie")!;
    expect(putrid.hits[0]!.band).toEqual({ ...COMMAND_PUTRID_ZOMBIE_BAND });
    expect(putrid.hits[0]!.critEligible).toBe(false);

    const phantom = NECROMANCY_ABILITIES.find((a) => a.id === "command_phantom_guardian")!;
    expect(phantom.hits[0]!.band).toEqual({ ...COMMAND_PHANTOM_GUARDIAN_BAND });
  });

  it("conjure casts are 0-adren enhanced setups with empty hits", () => {
    const ids = [
      "conjure_skeleton_warrior",
      "conjure_vengeful_ghost",
      "conjure_putrid_zombie",
      "conjure_phantom_guardian",
      "conjure_undead_army",
    ] as const;
    for (const id of ids) {
      const a = NECROMANCY_ABILITIES.find((x) => x.id === id)!;
      expect(a.category, id).toBe("enhanced");
      expect(a.hits, id).toEqual([]);
      expect(a.adrenaline?.cost, id).toBe(0);
      expect(a.stateEffect, id).toBe(id);
      expect(a.source.verifiedAt, id).toBeTruthy();
    }
  });

  it("Death Grasp base band is 405–495% at 25% adrenaline", () => {
    const dg = NECROMANCY_ABILITIES.find((a) => a.id === "death_grasp")!;
    expect(dg.hits[0]!.band).toEqual({ ...DEATH_GRASP_BAND });
    expect(dg.adrenaline?.cost).toBe(25);
  });

  it("effect records stay sourced", () => {
    for (const e of NECROMANCY_EFFECTS) {
      expect(e.source.verifiedAt, e.id).toBeTruthy();
      expect(e.notes.length, e.id).toBeGreaterThan(0);
    }
  });
});

describe("volleyOfSouls", () => {
  it("deals one 135–165% hit per soul spent", () => {
    const spec = volleyOfSouls(3);
    expect(spec.hits).toHaveLength(3);
    expect(spec.hits.every((hit) => hit.band.minPct === 135 && hit.band.maxPct === 165)).toBe(true);
  });

  it("rolls up through calculateAbility", () => {
    const result = calculateAbility(volleyOfSouls(3), input);
    expect(result.min).toBe(3 * 1350);
    expect(result.max).toBe(3 * 1650);
    expect(result.expected).toBe(3 * 1500);
  });

  it("requires 2–5 souls and costs 0% adrenaline", () => {
    expect(volleyOfSouls(MAX_SOULS).hits).toHaveLength(5);
    expect(volleyOfSouls(VOLLEY_MIN_SOULS).adrenaline?.cost).toBe(0);
    expect(() => volleyOfSouls(1)).toThrow(RangeError);
    expect(() => volleyOfSouls(0)).toThrow(RangeError);
    expect(() => volleyOfSouls(MAX_SOULS + 1)).toThrow(RangeError);
  });
});

describe("fingerOfDeath", () => {
  it("uses the base 270–330% band at full 60% cost with no stacks", () => {
    const spec = fingerOfDeath();
    expect(spec.hits[0]!.band).toEqual({ ...FINGER_OF_DEATH_BAND });
    expect(spec.adrenaline?.cost).toBe(FINGER_OF_DEATH_BASE_COST_PCT);
  });

  it("discounts 10% adrenaline per Necrosis stack up to free at 6", () => {
    expect(fingerOfDeath({ necrosisStacks: 3 }).adrenaline?.cost).toBe(30);
    expect(fingerOfDeath({ necrosisStacks: 6 }).adrenaline?.cost).toBe(0);
    expect(fingerOfDeath({ necrosisStacks: 12 }).adrenaline?.cost).toBe(0);
  });

  it("Living Death multiplies the band by 1.5 → 405–495%", () => {
    const spec = fingerOfDeath({ livingDeath: true });
    expect(spec.hits[0]!.band).toEqual({ minPct: 405, maxPct: 495 });
    const result = calculateAbility(spec, input);
    expect(result.min).toBe(4050);
    expect(result.max).toBe(4950);
  });
});

describe("spectralScythe3", () => {
  it("scales with missing life points (50% remaining → 1.5×)", () => {
    const half = spectralScythe3(0.5);
    expect(half.hits[0]!.band).toEqual({ minPct: 337.5, maxPct: 412.5 });
  });

  it("rejects out-of-range hp fractions", () => {
    expect(() => spectralScythe3(-0.1)).toThrow(RangeError);
    expect(() => spectralScythe3(1.1)).toThrow(RangeError);
  });
});

describe("commandPhantomGuardian / deathGrasp factories", () => {
  it("Valour multiplies the phantom command band (25 stacks → 270–330%)", () => {
    const full = commandPhantomGuardian({ valour: 25 });
    expect(full.hits[0]!.band).toEqual({ minPct: 270, maxPct: 330 });
  });

  it("Necrosis adds 40% AD per stack to Death Grasp (12 → 885–975%)", () => {
    const full = deathGrasp({ necrosisStacks: 12 });
    expect(full.hits[0]!.band).toEqual({ minPct: 885, maxPct: 975 });
    expect(deathGrasp().hits[0]!.band).toEqual({ ...DEATH_GRASP_BAND });
  });
});
