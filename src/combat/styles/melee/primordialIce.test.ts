import { describe, expect, it } from "vitest";
import { lengLandTableFor } from "./lengRng";
import {
  PRIMORDIAL_ICE_BINS,
  PRIMORDIAL_ICE_DURATION_TICKS,
  applyLengLandToDistribution,
  emptyPrimordialIce,
  expectedStacksFromMass,
  expirePrimordialIce,
  lengProcChances,
  massSum,
  unitPrimordialIce,
} from "./primordialIce";
import {
  icyTempestBaseSpend,
  icyTempestHitsLinear,
  icyTempestSpendAfterVigour,
  resolveIcyTempest,
} from "./icyTempest";
import { icyTempestHits, icyTempestSpend } from "./effects";

describe("PrimordialIceDistribution", () => {
  it("starts at unit mass on zero stacks", () => {
    const d = emptyPrimordialIce();
    expect(d.stackMass).toHaveLength(PRIMORDIAL_ICE_BINS);
    expect(massSum(d.stackMass)).toBeCloseTo(1, 12);
    expect(expectedStacksFromMass(d.stackMass)).toBe(0);
  });

  it("conserves mass on dual-Leng land from 0", () => {
    const table = lengLandTableFor(true, true)!;
    const next = applyLengLandToDistribution(emptyPrimordialIce(), table, 0);
    expect(massSum(next.stackMass)).toBeCloseTo(1, 12);
    const { p0, p1, p2 } = lengProcChances(true, true);
    expect(next.stackMass[0]).toBeCloseTo(p0, 12);
    expect(next.stackMass[1]).toBeCloseTo(p1, 12);
    expect(next.stackMass[2]).toBeCloseTo(p2, 12);
    expect(expectedStacksFromMass(next.stackMass)).toBeCloseTo(p1 + 2 * p2, 12);
  });

  it("never floors E[stacks] for Icy Tempest spend after one dual-Leng land", () => {
    const table = lengLandTableFor(true, true)!;
    const next = applyLengLandToDistribution(emptyPrimordialIce(), table, 0);
    const resolved = resolveIcyTempest(next, 0, false);
    // Discrete oracle: 0.882*30 + 0.116*18 + 0.002*6 = 28.56
    const { p0, p1, p2 } = lengProcChances(true, true);
    const oracle = p0 * 30 + p1 * 18 + p2 * 6;
    expect(resolved.expectedSpend).toBeCloseTo(oracle, 10);
    expect(resolved.expectedSpend).toBeCloseTo(28.56, 2);
    expect(resolved.expectedSpend).not.toBe(30);
    expect(icyTempestSpend(expectedStacksFromMass(next.stackMass))).toBe(30); // floor trap
  });

  it("caps at 10 and conserves mass", () => {
    const table = lengLandTableFor(true, true)!;
    let d = unitPrimordialIce(10);
    d = applyLengLandToDistribution(d, table, 0);
    expect(massSum(d.stackMass)).toBeCloseTo(1, 12);
    expect(d.stackMass[10]).toBeCloseTo(1, 12);
    expect(expectedStacksFromMass(d.stackMass)).toBe(10);
  });

  it("expires stacks at expiresAtTick", () => {
    const d = unitPrimordialIce(5, 100);
    expect(expirePrimordialIce(d, 99).stackMass[5]).toBe(1);
    const gone = expirePrimordialIce(d, 100);
    expect(gone.stackMass[0]).toBe(1);
    expect(expectedStacksFromMass(gone.stackMass)).toBe(0);
  });

  it("refreshes expiry when gain is possible", () => {
    const table = lengLandTableFor(true, false)!;
    const d = unitPrimordialIce(0, 0);
    const next = applyLengLandToDistribution(d, table, 50);
    expect(next.expiresAtTick).toBe(50 + PRIMORDIAL_ICE_DURATION_TICKS);
  });

  it("EF-only and BC-only and none combinations conserve mass", () => {
    for (const [ef, bc] of [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ] as const) {
      const table = lengLandTableFor(ef, bc);
      for (let s = 0; s <= 10; s++) {
        const start = unitPrimordialIce(s);
        if (!table) {
          expect(massSum(start.stackMass)).toBeCloseTo(1, 12);
          continue;
        }
        const next = applyLengLandToDistribution(start, table, 0);
        expect(massSum(next.stackMass)).toBeCloseTo(1, 12);
        for (const w of next.stackMass) expect(w).toBeGreaterThanOrEqual(-1e-15);
      }
    }
  });
});

describe("resolveIcyTempest", () => {
  it("integer bands match icyTempestHits for 0,1,10", () => {
    for (const n of [0, 1, 10]) {
      const r = resolveIcyTempest(unitPrimordialIce(n), 0, false);
      expect(r.expectedHits).toEqual(icyTempestHits(n));
      expect(icyTempestHitsLinear(n)).toEqual(icyTempestHits(n));
    }
  });

  it("mixed distribution expected damage equals weighted integer sum", () => {
    const mass = [0.5, 0.3, 0.2, 0, 0, 0, 0, 0, 0, 0, 0];
    const dist = { stackMass: mass, expiresAtTick: 999 };
    const r = resolveIcyTempest(dist, 0, false);
    const eMin0 = mass.reduce((s, p, n) => s + p * icyTempestHits(n)[0]!.band.minPct, 0);
    expect(r.expectedHits[0]!.band.minPct).toBeCloseTo(eMin0, 10);
  });

  it("spend groups with and without RoV", () => {
    expect(icyTempestBaseSpend(0)).toBe(30);
    expect(icyTempestBaseSpend(1)).toBe(18);
    expect(icyTempestBaseSpend(2)).toBe(6);
    expect(icyTempestBaseSpend(3)).toBe(0);
    expect(icyTempestSpendAfterVigour(0, true)).toBe(27);
    expect(icyTempestSpendAfterVigour(1, true)).toBe(17);
    expect(icyTempestSpendAfterVigour(2, true)).toBe(6);
    expect(icyTempestSpendAfterVigour(3, true)).toBe(0);

    const r = resolveIcyTempest(unitPrimordialIce(1), 0, true);
    expect(r.requirement).toBe(27);
    expect(r.expectedSpend).toBe(17);
    expect(r.spendDistribution).toHaveLength(1);
  });

  it("successful resolve reports mass consumed; consume leaves frost independent", () => {
    const d = unitPrimordialIce(4, 200);
    const r = resolveIcyTempest(d, 0, false);
    expect(r.stackMassConsumed[4]).toBe(1);
    expect(r.expectedSpend).toBe(0);
  });
});
