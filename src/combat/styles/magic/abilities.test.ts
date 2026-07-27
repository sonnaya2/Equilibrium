import { describe, expect, it } from "vitest";
import { calculateAbility } from "../../pipeline/calculateAbility";
import { MAGIC_ABILITIES, MAGIC_EFFECTS } from "./abilities";

const byId = (id: string) => {
  const a = MAGIC_ABILITIES.find((x) => x.id === id);
  if (!a) throw new Error(`missing ability ${id}`);
  return a;
};

describe("magic ability data", () => {
  it("calculable records stay sourced and unique", () => {
    for (const a of MAGIC_ABILITIES) {
      expect(a.source.verifiedAt, a.id).toBeTruthy();
      expect(a.style).toBe("magic");
    }
    expect(new Set(MAGIC_ABILITIES.map((a) => a.id)).size).toBe(MAGIC_ABILITIES.length);
    const basic = byId("magic_attack");
    expect(basic.hits[0].band).toEqual({ minPct: 90, maxPct: 110 });
    expect(basic.adrenaline?.gain).toBe(9);
    expect(basic.autoAttack).toBe(true);
  });

  it("promotes Revo-priority bands from verified wiki ranges", () => {
    expect(byId("sonic_wave").hits[0].band).toEqual({ minPct: 90, maxPct: 110 });
    expect(byId("greater_sonic_wave").hits[0].band).toEqual({ minPct: 115, maxPct: 135 });
    expect(byId("dragon_breath").hits[0].band).toEqual({ minPct: 110, maxPct: 130 });
    expect(byId("dragon_breath").adrenaline?.gain).toBe(9);
    expect(byId("dragon_breath").cooldownSeconds).toBe(7.2);
    expect(byId("impact").hits[0].band).toEqual({ minPct: 65, maxPct: 75 });
    expect(byId("chain").hits[0].band).toEqual({ minPct: 70, maxPct: 90 });
    expect(byId("greater_chain").hits[0].band).toEqual({ minPct: 80, maxPct: 100 });

    const gcb = byId("greater_concentrated_blast");
    expect(gcb.hits).toHaveLength(3);
    expect(gcb.hits.every((h) => h.band.minPct === 40 && h.band.maxPct === 50)).toBe(true);
    expect(gcb.hits.map((h) => h.tickOffset)).toEqual([0, 1, 2]);
    expect(gcb.adrenaline?.gain).toBe(9);

    const cb = byId("concentrated_blast");
    expect(cb.hits.every((h) => h.band.minPct === 30 && h.band.maxPct === 40)).toBe(true);
    expect(cb.hits.map((h) => h.tickOffset)).toEqual([0, 1, 2]);

    // Combust: 10 burn hits every 1.8s (3 ticks); first at +3.
    expect(byId("combust").hits.map((h) => h.tickOffset)).toEqual([
      3, 6, 9, 12, 15, 18, 21, 24, 27, 30,
    ]);

    const wild = byId("wild_magic");
    expect(wild.hits).toHaveLength(2);
    expect(wild.hits[0].band).toEqual({ minPct: 125, maxPct: 155 });
    expect(wild.adrenaline?.cost).toBe(25);
    expect(wild.cooldownSeconds).toBe(5.4);
    // Wiki does not state inter-hit timing — no invented offsets.
    expect(wild.hits.every((h) => h.tickOffset === undefined)).toBe(true);

    const asph = byId("asphyxiate");
    expect(asph.hits).toHaveLength(4);
    expect(asph.hits[0].band).toEqual({ minPct: 120, maxPct: 140 });
    expect(asph.hits.map((h) => h.tickOffset)).toEqual([0, 2, 4, 6]);
    expect(asph.adrenaline?.cost).toBe(25);

    const respl = byId("asphyxiate_resplendence");
    expect(respl.hits).toHaveLength(8);
    expect(respl.hits.every((h) => h.band.minPct === 72 && h.band.maxPct === 84)).toBe(true);
    expect(respl.hits.map((h) => h.tickOffset)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    expect(byId("tsunami").hits[0].band).toEqual({ minPct: 225, maxPct: 275 });
    expect(byId("tsunami").adrenaline?.cost).toBe(100);
    expect(byId("omnipower").hits[0].band).toEqual({ minPct: 420, maxPct: 500 });
    // Igneous: first hit then three on the next tick (wiki).
    expect(byId("omnipower_igneous").hits.map((h) => h.tickOffset)).toEqual([0, 1, 1, 1]);
  });

  it("models multi-hit DoTs with wiki decay / escalation, not average-only stubs", () => {
    const corr = byId("corruption_blast");
    expect(corr.hits).toHaveLength(5);
    expect(corr.hits[0].band).toEqual({ minPct: 90, maxPct: 110 });
    expect(corr.hits[4].band).toEqual({ minPct: 18, maxPct: 22 });
    expect(corr.hits.every((h) => h.critEligible === false)).toBe(true);
    expect(corr.adrenaline?.cost).toBe(20);
    expect(corr.hits.map((h) => h.tickOffset)).toEqual([2, 4, 6, 8, 10]);

    const smoke = byId("smoke_tendrils");
    expect(smoke.guaranteedCrit).toBe(true);
    expect(smoke.hits.map((h) => h.band)).toEqual([
      { minPct: 55, maxPct: 65 },
      { minPct: 65, maxPct: 80 },
      { minPct: 75, maxPct: 95 },
      { minPct: 85, maxPct: 110 },
    ]);
    expect(smoke.adrenaline).toBeUndefined();
    // Escalating hits every 1.2s (2 ticks).
    expect(smoke.hits.map((h) => h.tickOffset)).toEqual([0, 2, 4, 6]);

    const magma = byId("magma_tempest");
    expect(magma.hits).toHaveLength(8);
    expect(magma.hits.every((h) => h.band.minPct === 35 && h.critEligible === false)).toBe(true);
    expect(magma.adrenaline?.cost).toBe(20);
    // 8 hits every 1.2s (2 ticks); first at +2.
    expect(magma.hits.map((h) => h.tickOffset)).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
  });

  it("treats Greater Sunshine 315% as DoT total, not a front-loaded hit", () => {
    const gs = byId("greater_sunshine");
    expect(gs.hits).toHaveLength(21);
    expect(gs.hits.every((h) => h.band.minPct === 10 && h.band.maxPct === 20)).toBe(true);
    expect(gs.hits.some((h) => h.band.minPct === 315)).toBe(false);
    expect(gs.appliesBuff).toBe("greater_sunshine");
    expect(gs.adrenaline?.cost).toBe(100);
    // Beam DoT: every 1.8s (3 ticks); first at +3.
    expect(gs.hits[0].tickOffset).toBe(3);
    expect(gs.hits[20].tickOffset).toBe(63);

    const sun = byId("sunshine");
    expect(sun.hits).toHaveLength(16);
    expect(sun.adrenaline?.cost).toBe(100);
    expect(sun.hits[0].tickOffset).toBe(3);
    expect(sun.hits[15].tickOffset).toBe(48);
  });

  it("keeps Runic-Charged Dragon Breath as a separate anima-gated band", () => {
    const empowered = byId("dragon_breath_empowered");
    expect(empowered.requiresAnima).toBe(true);
    expect(empowered.hits[0].band).toEqual({ minPct: 260, maxPct: 310 });
    expect(byId("dragon_breath").requiresAnima).toBeFalsy();
  });

  it("models wiki-verified weapon special cast bands", () => {
    const fsoa = byId("instability");
    expect(fsoa.hits[0].band).toEqual({ minPct: 120, maxPct: 140 });
    expect(fsoa.adrenaline?.cost).toBe(50);
    expect(fsoa.cooldownSeconds).toBe(60);
    expect(fsoa.appliesBuff).toBe("instability");

    const cog = byId("claws_of_guthix");
    expect(cog.hits[0].band).toEqual({ minPct: 200, maxPct: 240 });
    expect(cog.adrenaline?.cost).toBe(25);
  });

  it("rolls multi-hit totals for a known band without inventing numbers", () => {
    const r = calculateAbility(byId("wild_magic"), {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
    });
    // Two independent 125-155% hits, no crit: min 2500, max 3100, mid 2800.
    expect(r.min).toBe(2500);
    expect(r.max).toBe(3100);
    expect(r.expected).toBe(2800);
    expect(r.adrenalineDelta).toBe(-25);
  });

  it("effect notes remain sourced; no orphan average-only stubs for promoted ids", () => {
    for (const e of MAGIC_EFFECTS) {
      expect(e.source.verifiedAt, e.id).toBeTruthy();
      expect(e.notes.length, e.id).toBeGreaterThan(0);
    }
    const noteIds = new Set(MAGIC_EFFECTS.map((e) => e.id));
    // Promoted abilities must not reappear as average-only effect stubs under the same id.
    for (const id of [
      "wild_magic",
      "asphyxiate",
      "smoke_tendrils",
      "tsunami",
      "corruption_blast",
      "magma_tempest",
      "sonic_wave",
      "concentrated_blast",
      "dragon_breath",
      "instability",
      "claws_of_guthix",
    ]) {
      expect(noteIds.has(id), id).toBe(false);
      expect(
        MAGIC_ABILITIES.some((a) => a.id === id),
        id,
      ).toBe(true);
    }
  });
});
