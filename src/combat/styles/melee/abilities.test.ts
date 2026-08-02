import { describe, expect, it } from "vitest";
import {
  CHAOS_ROAR_DAMAGE_MULTIPLIER,
  CHAOS_ROAR_DURATION_SECONDS,
  MELEE_ABILITIES,
  MELEE_EFFECTS,
  PUNISH_HP_THRESHOLD,
  PUNISH_TARGET_MULTIPLIER,
  withStrengthCape99Dismember,
} from "./abilities";
import { STRENGTH_CAPE_DISMEMBER_EXTRA_HITS } from "../../shared/perks";

const byId = (id: string) => {
  const a = MELEE_ABILITIES.find((x) => x.id === id);
  if (!a) throw new Error(`missing ability ${id}`);
  return a;
};

describe("melee ability data", () => {
  it("Bloodlust builders declare generation per record", () => {
    expect(byId("attack").bloodlustGain).toBe(1);
    expect(byId("attack").adrenaline?.gain).toBe(9);
    expect(byId("rend").bloodlustGain).toBe(2);
    expect(byId("rend").adrenaline?.gain).toBe(9);
    expect(byId("greater_fury").bloodlustGain).toBe(1);
    expect(byId("chaos_roar").bloodlustGain).toBe(1);
    expect(byId("backhand").bloodlustGain).toBe(1);
    expect(byId("punish").bloodlustGain).toBe(1);
    expect(byId("barge").bloodlustGain).toBe(1);
  });

  it("bleed chains name their enabler and Dismember is enhanced", () => {
    const dismember = byId("dismember");
    expect(dismember.category).toBe("enhanced");
    expect(dismember.enables).toBe("slaughter");
    expect(byId("slaughter").enables).toBe("massacre");
  });

  it("Strength cape (99) adds three extra Dismember hits of the same band", () => {
    const base = byId("dismember");
    expect(base.hits).toHaveLength(8);
    const patched = withStrengthCape99Dismember(MELEE_ABILITIES, STRENGTH_CAPE_DISMEMBER_EXTRA_HITS);
    const dismember = patched.find((a) => a.id === "dismember")!;
    expect(dismember.hits).toHaveLength(11);
    expect(dismember.hits.slice(8).map((h) => h.tickOffset)).toEqual([18, 20, 22]);
    expect(dismember.hits[10]?.band).toEqual(base.hits[0]!.band);
    // Idempotent.
    const twice = withStrengthCape99Dismember(patched, STRENGTH_CAPE_DISMEMBER_EXTRA_HITS);
    expect(twice.find((a) => a.id === "dismember")!.hits).toHaveLength(11);
  });

  it("Assault carries its 4-Bloodlust band as data", () => {
    expect(byId("assault").bloodlustScale).toEqual({
      threshold: 4,
      band: { minPct: 170, maxPct: 190 },
    });
    expect(byId("assault").channelled).toBe(true);
  });

  it("channel and bleed multi-hits carry wiki tickOffsets", () => {
    expect(byId("assault").hits.map((h) => h.tickOffset)).toEqual([1, 3, 5, 7]);

    expect(byId("flurry").hits.map((h) => h.tickOffset)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(byId("greater_flurry").hits.map((h) => h.tickOffset)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    expect(byId("dismember").hits.map((h) => h.tickOffset)).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
    expect(byId("slaughter").hits.map((h) => h.tickOffset)).toEqual([3, 6, 9, 12, 15, 18]);
    expect(byId("massacre").hits.map((h) => h.tickOffset)).toEqual([
      undefined,
      4,
      8,
      12,
      16,
      20,
      24,
    ]);

    expect(byId("overpower_igneous").hits.every((h) => h.tickOffset === undefined)).toBe(true);
    expect(byId("hurricane").hits.every((h) => h.tickOffset === undefined)).toBe(true);
  });

  it("wiki-audited core bands match current ability pages", () => {
    expect(byId("attack").hits[0].band).toEqual({ minPct: 110, maxPct: 130 });
    expect(byId("adaptive_strike_2h").hits[0].band).toEqual({ minPct: 120, maxPct: 140 });
    expect(byId("adaptive_strike_dw").hits).toHaveLength(2);
    expect(byId("rend").hits[0].band).toEqual({ minPct: 135, maxPct: 165 });
    expect(byId("overpower").hits[0].band).toEqual({ minPct: 520, maxPct: 570 });
    expect(byId("overpower_igneous").hits).toHaveLength(2);
    expect(byId("overpower_igneous").hits[0].band).toEqual({ minPct: 280, maxPct: 340 });
    expect(byId("overpower_igneous").adrenaline).toEqual({ cost: 60 });
    expect(byId("overpower_igneous").requiredPassiveAnyOf).toEqual(["igneous-overpower"]);
  });

  it("Revo-bar and RSA damage kit carry sourced bands", () => {
    expect(byId("greater_fury").hits[0].band).toEqual({ minPct: 120, maxPct: 140 });
    expect(byId("greater_fury").adrenaline?.gain).toBe(9);
    expect(byId("greater_fury").cooldownSeconds).toBe(15);
    expect(byId("greater_fury").appliesEffect).toBe("greater_fury");

    const flurry = byId("flurry");
    expect(flurry.hits).toHaveLength(8);
    expect(flurry.hits[0].band).toEqual({ minPct: 60, maxPct: 70 });
    expect(flurry.hits.every((h) => h.band.minPct === 60 && h.band.maxPct === 70)).toBe(true);
    expect(flurry.adrenaline?.cost).toBe(25);
    expect(flurry.cooldownSeconds).toBe(20.4);
    expect(flurry.channelled).toBe(true);

    const chaosRoar = byId("chaos_roar");
    expect(chaosRoar.hits[0].band).toEqual({ minPct: 100, maxPct: 120 });
    expect(chaosRoar.appliesEffect).toBe("chaos_roar");
    expect(chaosRoar.cooldownSeconds).toBe(60);
    expect(CHAOS_ROAR_DAMAGE_MULTIPLIER).toBe(1.75);
    expect(CHAOS_ROAR_DURATION_SECONDS).toBe(7.2);

    const meteor = byId("meteor_strike");
    expect(meteor.hits[0].band).toEqual({ minPct: 220, maxPct: 250 });
    expect(meteor.adrenaline?.cost).toBe(60);
    expect(meteor.cooldownSeconds).toBe(60);

    const hurricane = byId("hurricane");
    expect(hurricane.hits).toEqual([
      { band: { minPct: 135, maxPct: 165 } },
      { band: { minPct: 155, maxPct: 185 } },
    ]);
    expect(hurricane.bloodlustExtraHits).toEqual({
      threshold: 4,
      hits: [{ band: { minPct: 75, maxPct: 95 } }],
    });
    expect(hurricane.adrenaline?.cost).toBe(25);
    expect(hurricane.cooldownSeconds).toBe(20.4);
  });

  it("Adaptive Strike declares wiki adrenaline and cooldown", () => {
    for (const id of ["adaptive_strike_2h", "adaptive_strike_dw"] as const) {
      const a = byId(id);
      expect(a.adrenaline?.gain).toBe(12);
      expect(a.cooldownSeconds).toBe(5.4);
    }
  });

  it("fills remaining post-modernisation damage kit with wiki bands", () => {
    expect(byId("backhand").hits[0].band).toEqual({ minPct: 95, maxPct: 105 });
    expect(byId("backhand").adrenaline?.gain).toBe(9);
    expect(byId("backhand").cooldownSeconds).toBe(15);

    expect(byId("punish").hits[0].band).toEqual({ minPct: 110, maxPct: 130 });
    expect(byId("punish").cooldownSeconds).toBe(24);
    expect(PUNISH_TARGET_MULTIPLIER).toBe(2.5);
    expect(PUNISH_HP_THRESHOLD).toBe(0.5);

    for (const id of ["barge", "greater_barge"] as const) {
      expect(byId(id).hits[0].band).toEqual({ minPct: 75, maxPct: 95 });
      expect(byId(id).adrenaline?.gain).toBe(9);
      expect(byId(id).cooldownSeconds).toBe(20.4);
    }
    expect(byId("greater_barge").appliesEffect).toBe("greater_barge");

    const gflurry = byId("greater_flurry");
    expect(gflurry.hits).toHaveLength(8);
    expect(gflurry.hits.every((h) => h.band.minPct === 60 && h.band.maxPct === 70)).toBe(true);
    expect(gflurry.adrenaline?.cost).toBe(25);
    expect(gflurry.cooldownSeconds).toBe(20.4);
    expect(gflurry.channelled).toBe(true);
    expect(gflurry.appliesEffect).toBe("greater_flurry");

    const pulverise = byId("pulverise");
    expect(pulverise.hits[0].band).toEqual({ minPct: 300, maxPct: 340 });
    expect(pulverise.adrenaline?.cost).toBe(60);
    expect(pulverise.cooldownSeconds).toBe(60);
    expect(pulverise.category).toBe("ultimate");
    expect(pulverise.appliesEffect).toBe("pulverise");
  });

  it("effect records stay sourced", () => {
    for (const e of MELEE_EFFECTS) expect(e.source.verifiedAt, e.id).toBeTruthy();
  });
});
