import { describe, expect, it } from "vitest";
import { LENG_BOUNDLESS_CHILL_CHANCE, PRIMORDIAL_ICE_CAP } from "./effects";
import {
  applyLengLandToMass,
  evolveLengMass,
  expectedLengFromOutcomes,
  expectedLengLandState,
  expectedStacks,
  foldExpiredFrost,
  frostActiveMass,
  lengKeyFromFrostUntil,
  massEntries,
  massFromOutcomes,
  massMapsClose,
  massTotal,
  materializeSingleLandMass,
  packLengKey,
  singleLandMass,
  unitLengMass,
  unpackLengKey,
  LENG_KEY_COUNT,
} from "./lengDistribution";
import {
  FROSTBLADES_DURATION_TICKS,
  foldLengOutcomesByFutureState,
  lengLandTableFor,
  materializeLengLandOutcomes,
} from "./lengRng";

const tableEFBC = lengLandTableFor(true, true)!;
const tableEF = lengLandTableFor(true, false)!;
const tableBC = lengLandTableFor(false, true)!;

function expectMassClose(a: ReturnType<typeof unitLengMass>, b: ReturnType<typeof unitLengMass>) {
  expect(massMapsClose(a, b, 1e-12)).toBe(true);
  expect(massTotal(a)).toBeCloseTo(massTotal(b), 12);
}

describe("lengDistribution keys", () => {
  it("packs stacks 0..CAP and frost bit into 0..KEY_COUNT-1", () => {
    expect(LENG_KEY_COUNT).toBe((PRIMORDIAL_ICE_CAP + 1) * 2);
    for (let s = 0; s <= PRIMORDIAL_ICE_CAP; s++) {
      for (const frost of [false, true]) {
        const packed = packLengKey(s, frost);
        expect(packed).toBeGreaterThanOrEqual(0);
        expect(packed).toBeLessThan(LENG_KEY_COUNT);
        expect(unpackLengKey(packed)).toEqual({ stacks: s, frostActive: frost });
      }
    }
  });

  it("lengKeyFromFrostUntil normalizes expired frost to inactive", () => {
    expect(lengKeyFromFrostUntil(3, 0, 10)).toBe(packLengKey(3, false));
    expect(lengKeyFromFrostUntil(3, 10, 10)).toBe(packLengKey(3, false));
    expect(lengKeyFromFrostUntil(3, 11, 10)).toBe(packLengKey(3, true));
  });
});

describe("foldExpiredFrost", () => {
  it("moves active frost mass onto inactive same stacks and conserves total", () => {
    const mass = new Map([
      [packLengKey(2, true), 0.4],
      [packLengKey(2, false), 0.1],
      [packLengKey(5, true), 0.5],
    ]);
    const folded = foldExpiredFrost(mass);
    expect(massTotal(folded)).toBeCloseTo(1, 12);
    expect(folded.get(packLengKey(2, false))).toBeCloseTo(0.5, 12);
    expect(folded.get(packLengKey(5, false))).toBeCloseTo(0.5, 12);
    expect(folded.has(packLengKey(2, true))).toBe(false);
    expect(frostActiveMass(folded)).toBe(0);
  });
});

describe("single-land mass vs materializeLengLandOutcomes", () => {
  const ticks = [0, 7, 20];

  it("matches class weights from each start state (frost inactive)", () => {
    for (const table of [tableEFBC, tableEF, tableBC]) {
      for (let stacks = 0; stacks <= PRIMORDIAL_ICE_CAP; stacks++) {
        for (const tick of ticks) {
          const fromMass = singleLandMass(stacks, false, table);
          const fromMat = materializeSingleLandMass(table, stacks, 0, tick);
          expectMassClose(fromMass, fromMat);
          expect(massTotal(fromMass)).toBeCloseTo(1, 12);
        }
      }
    }
  });

  it("matches class weights when frost already active (carry and chill)", () => {
    for (const table of [tableEFBC, tableEF, tableBC]) {
      for (let stacks = 0; stacks <= PRIMORDIAL_ICE_CAP; stacks++) {
        for (const tick of ticks) {
          // Active but not necessarily equal to this land's frostOpen.
          const frostCarry = tick + 1;
          const fromMass = singleLandMass(stacks, true, table);
          const fromCarry = materializeSingleLandMass(table, stacks, frostCarry, tick);
          expectMassClose(fromMass, fromCarry);

          // frostUntil already equals frostOpen: chill is a no-op on the window.
          const frostOpen = tick + FROSTBLADES_DURATION_TICKS;
          const fromOpen = materializeSingleLandMass(table, stacks, frostOpen, tick);
          expectMassClose(fromMass, fromOpen);
          expect(massTotal(fromMass)).toBeCloseTo(1, 12);
        }
      }
    }
  });

  it("dual EF×BC from 0 inactive: known EF/BC product weights by stacks + frost", () => {
    const out = singleLandMass(0, false, tableEFBC);
    // P(+0 no chill)=0.9*0.98, P(+1 no chill)=0.1*0.98, P(+0 chill)=0, ...
    // stackAdd: EF+BC; chill always +1 stack via BC when chill fires.
    // arms: EF0 BC0 -> +0 frostF; EF1 BC0 -> +1 frostF; EF0 BC1 -> +1 frostT; EF1 BC1 -> +2 frostT
    expect(out.get(packLengKey(0, false))).toBeCloseTo(0.9 * 0.98, 12);
    expect(out.get(packLengKey(1, false))).toBeCloseTo(0.1 * 0.98, 12);
    expect(out.get(packLengKey(1, true))).toBeCloseTo(0.9 * 0.02, 12);
    expect(out.get(packLengKey(2, true))).toBeCloseTo(0.1 * 0.02, 12);
    expect(frostActiveMass(out)).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 12);
    expect(massTotal(out)).toBeCloseTo(1, 12);
  });

  it("at stack cap all mass stays at CAP; chill still opens frost", () => {
    const out = singleLandMass(PRIMORDIAL_ICE_CAP, false, tableEFBC);
    for (const { key, weight } of massEntries(out)) {
      expect(key.stacks).toBe(PRIMORDIAL_ICE_CAP);
      if (weight > 0) {
        // only CAP keys present
      }
    }
    expect(out.get(packLengKey(PRIMORDIAL_ICE_CAP, false))).toBeCloseTo(
      1 - LENG_BOUNDLESS_CHILL_CHANCE,
      12,
    );
    expect(out.get(packLengKey(PRIMORDIAL_ICE_CAP, true))).toBeCloseTo(
      LENG_BOUNDLESS_CHILL_CHANCE,
      12,
    );
  });

  it("massFromOutcomes matches fold of raw materialize rows", () => {
    const tick = 5;
    const rows = materializeLengLandOutcomes(tableEFBC, 3, 0, tick);
    const a = massFromOutcomes(rows, tick);
    const b = materializeSingleLandMass(tableEFBC, 3, 0, tick);
    expectMassClose(a, b);
  });
});

describe("mass conservation over N lands", () => {
  it("total mass stays 1 after many lands from every start key", () => {
    for (let stacks = 0; stacks <= PRIMORDIAL_ICE_CAP; stacks++) {
      for (const frost of [false, true]) {
        for (const n of [0, 1, 5, 20, 50]) {
          const mass = evolveLengMass({ stacks, frostActive: frost }, tableEFBC, n);
          expect(massTotal(mass)).toBeCloseTo(1, 10);
          for (const w of mass.values()) {
            expect(w).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it("conserves mass with frost expiry between lands", () => {
    const mass = evolveLengMass(
      { stacks: 0, frostActive: false },
      tableEFBC,
      30,
      { expireFrostBetweenLands: true },
    );
    expect(massTotal(mass)).toBeCloseTo(1, 10);
    // Between lands frost always folded off; only chill of the last land can open it.
    expect(frostActiveMass(mass)).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 10);
  });

  it("applyLengLandToMass on mixed mass conserves total", () => {
    let mass = new Map([
      [packLengKey(0, false), 0.25],
      [packLengKey(2, true), 0.25],
      [packLengKey(7, false), 0.5],
    ]);
    expect(massTotal(mass)).toBeCloseTo(1, 12);
    for (let i = 0; i < 15; i++) {
      mass = applyLengLandToMass(mass, tableEFBC);
      expect(massTotal(mass)).toBeCloseTo(1, 10);
    }
  });

  it("E[stacks] rises under cap then saturates toward CAP", () => {
    const e0 = expectedStacks(unitLengMass(0, false));
    const e1 = expectedStacks(evolveLengMass({ stacks: 0, frostActive: false }, tableEFBC, 1));
    const e10 = expectedStacks(evolveLengMass({ stacks: 0, frostActive: false }, tableEFBC, 10));
    const e200 = expectedStacks(evolveLengMass({ stacks: 0, frostActive: false }, tableEFBC, 200));
    expect(e0).toBe(0);
    expect(e1).toBeCloseTo(0.12, 10); // EF 0.1 + BC 0.02
    expect(e10).toBeGreaterThan(e1);
    expect(e200).toBeGreaterThan(e10);
    expect(e200).toBeLessThanOrEqual(PRIMORDIAL_ICE_CAP + 1e-9);
    expect(e200).toBeGreaterThan(PRIMORDIAL_ICE_CAP - 0.5);
  });
});

describe("search-spine helpers", () => {
  it("massEntries lists sorted packed keys", () => {
    const mass = singleLandMass(0, false, tableEFBC);
    const entries = massEntries(mass);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]!.packed).toBeGreaterThan(entries[i - 1]!.packed);
    }
    expect(entries.reduce((s, e) => s + e.weight, 0)).toBeCloseTo(1, 12);
  });

  it("evolve from mass map matches repeated apply", () => {
    const start = singleLandMass(1, true, tableEFBC);
    const viaEvolve = evolveLengMass(start, tableEFBC, 3);
    let manual = start;
    for (let i = 0; i < 3; i++) manual = applyLengLandToMass(manual, tableEFBC);
    expectMassClose(viaEvolve, manual);
  });
});

describe("expectedLengLandState (score-only EV)", () => {
  it("matches discrete outcome E[stacks] from integer start", () => {
    for (let stacks = 0; stacks <= PRIMORDIAL_ICE_CAP; stacks++) {
      for (const tick of [0, 7, 20]) {
        for (const frost of [0, tick + 1, tick + FROSTBLADES_DURATION_TICKS]) {
          const outcomes = foldLengOutcomesByFutureState(
            materializeLengLandOutcomes(tableEFBC, stacks, frost, tick),
            tick,
          );
          const fromOut = expectedLengFromOutcomes(outcomes, tick);
          const fromEv = expectedLengLandState(tableEFBC, stacks, frost, tick);
          expect(fromEv.stacks).toBeCloseTo(fromOut.stacks, 10);
          expect(fromEv.frostUntil).toBeCloseTo(fromOut.frostUntil, 10);
        }
      }
    }
  });

  it("accumulates fractional stacks across lands under cap", () => {
    let s = 0;
    let f = 0;
    for (let i = 0; i < 5; i++) {
      const next = expectedLengLandState(tableEFBC, s, f, i * 3);
      s = next.stacks;
      f = next.frostUntil;
    }
    expect(s).toBeCloseTo(5 * 0.12, 8);
    expect(s).toBeLessThan(1);
  });
});
