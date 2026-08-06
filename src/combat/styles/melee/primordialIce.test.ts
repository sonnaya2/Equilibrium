import { describe, expect, it } from "vitest";
import {
  LENG_BOUNDLESS_CHILL_CHANCE,
  LENG_ENDLESS_FROST_CHANCE,
  PRIMORDIAL_ICE_CAP,
  icyTempestHits,
} from "./effects";
import {
  PRIMORDIAL_ICE_DURATION_TICKS,
  activeFrostbladesMass,
  applyLengLandToDistribution,
  emptyPrimordialIce,
  expirePrimordialIce,
  expectedStacksFromAtoms,
  massSum,
  type LengAtom,
  type PrimordialIceDistribution,
  unitPrimordialIce,
} from "./primordialIce";
import { FROSTBLADES_DURATION_TICKS, lengLandTableFor } from "./lengRng";
import { resolveIcyTempest } from "./icyTempest";

type OracleAtom = LengAtom;

function oracleNormalize(atoms: readonly OracleAtom[], tick: number): OracleAtom[] {
  const merged = new Map<string, OracleAtom>();
  for (const atom of atoms) {
    const stacksLive = atom.stacksExpireAtTick > tick;
    const stacks = stacksLive
      ? Math.max(0, Math.min(PRIMORDIAL_ICE_CAP, Math.floor(atom.stacks)))
      : 0;
    const next = {
      weight: atom.weight,
      stacks,
      stacksExpireAtTick: stacksLive && stacks > 0 ? atom.stacksExpireAtTick : 0,
      frostbladesExpireAtTick:
        atom.frostbladesExpireAtTick > tick ? atom.frostbladesExpireAtTick : 0,
    };
    const key = `${next.stacks}|${next.stacksExpireAtTick}|${next.frostbladesExpireAtTick}`;
    const previous = merged.get(key);
    merged.set(key, previous ? { ...previous, weight: previous.weight + next.weight } : next);
  }
  return [...merged.values()].sort(
    (a, b) =>
      a.stacks - b.stacks ||
      a.stacksExpireAtTick - b.stacksExpireAtTick ||
      a.frostbladesExpireAtTick - b.frostbladesExpireAtTick,
  );
}

function oracleLand(
  atoms: readonly OracleAtom[],
  hasEndlessFrost: boolean,
  hasBoundlessChill: boolean,
  tick: number,
): OracleAtom[] {
  const ef = hasEndlessFrost
    ? [
        { weight: LENG_ENDLESS_FROST_CHANCE, add: 1, frost: false },
        { weight: 1 - LENG_ENDLESS_FROST_CHANCE, add: 0, frost: false },
      ]
    : [{ weight: 1, add: 0, frost: false }];
  const bc = hasBoundlessChill
    ? [
        { weight: LENG_BOUNDLESS_CHILL_CHANCE, add: 1, frost: true },
        { weight: 1 - LENG_BOUNDLESS_CHILL_CHANCE, add: 0, frost: false },
      ]
    : [{ weight: 1, add: 0, frost: false }];
  const live = oracleNormalize(atoms, tick);
  const out: OracleAtom[] = [];
  for (const atom of live) {
    for (const a of ef) {
      for (const b of bc) {
        const add = a.add + b.add;
        out.push({
          weight: atom.weight * a.weight * b.weight,
          stacks: Math.min(PRIMORDIAL_ICE_CAP, atom.stacks + add),
          stacksExpireAtTick:
            add > 0 ? tick + PRIMORDIAL_ICE_DURATION_TICKS : atom.stacksExpireAtTick,
          frostbladesExpireAtTick: b.frost
            ? tick + FROSTBLADES_DURATION_TICKS
            : atom.frostbladesExpireAtTick,
        });
      }
    }
  }
  return oracleNormalize(out, tick);
}

function atomKey(atom: LengAtom): string {
  return `${atom.weight.toPrecision(14)}:${atom.stacks}:${atom.stacksExpireAtTick}:${atom.frostbladesExpireAtTick}`;
}

function expectAtomsEqual(
  actual: PrimordialIceDistribution,
  expected: readonly OracleAtom[],
): void {
  expect(actual.atoms.map(atomKey)).toEqual(expected.map(atomKey));
}

function legacySharedStackTimer(
  stackMass: readonly number[],
  expiresAtTick: number,
  tick: number,
): { stackMass: number[]; expiresAtTick: number } {
  const out = new Array<number>(PRIMORDIAL_ICE_CAP + 1).fill(0);
  let canGain = false;
  for (let stacks = 0; stacks <= PRIMORDIAL_ICE_CAP; stacks++) {
    const weight = stackMass[stacks] ?? 0;
    out[stacks] += weight * (1 - LENG_ENDLESS_FROST_CHANCE);
    out[Math.min(PRIMORDIAL_ICE_CAP, stacks + 1)] += weight * LENG_ENDLESS_FROST_CHANCE;
    if (weight > 0 && stacks < PRIMORDIAL_ICE_CAP) canGain = true;
  }
  return {
    stackMass: out,
    expiresAtTick: canGain ? tick + PRIMORDIAL_ICE_DURATION_TICKS : expiresAtTick,
  };
}

describe("sparse Leng atom oracle", () => {
  it("confirms the shared stack timer bug with a minimal partial-refresh reproduction", () => {
    const start: OracleAtom[] = [
      { weight: 0.9, stacks: 1, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
      { weight: 0.1, stacks: 1, stacksExpireAtTick: 200, frostbladesExpireAtTick: 0 },
    ];
    const tick = 90;
    const actual = applyLengLandToDistribution(
      { atoms: start },
      lengLandTableFor(true, false)!,
      tick,
    );
    const expected = oracleLand(start, true, false, tick);
    expectAtomsEqual(actual, expected);

    const legacy = legacySharedStackTimer([0, 0.9, ...Array(9).fill(0)], 100, tick);
    expect(legacy.expiresAtTick).toBe(290);
    expect(actual.atoms.some((atom) => atom.stacks === 1 && atom.stacksExpireAtTick === 100)).toBe(
      true,
    );
    expect(actual.atoms.some((atom) => atom.stacks === 1 && atom.stacksExpireAtTick === 200)).toBe(
      true,
    );
  });

  it("keeps Frostblades failure arms on their original cohort", () => {
    const start: OracleAtom[] = [
      { weight: 0.98, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 100 },
      { weight: 0.02, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 200 },
    ];
    const actual = applyLengLandToDistribution(
      { atoms: start },
      lengLandTableFor(false, true)!,
      90,
    );
    expectAtomsEqual(actual, oracleLand(start, false, true, 90));
    expect(actual.atoms.some((atom) => atom.frostbladesExpireAtTick === 100)).toBe(true);
    expect(actual.atoms.some((atom) => atom.frostbladesExpireAtTick === 200)).toBe(true);
    expect(actual.atoms.some((atom) => atom.frostbladesExpireAtTick === 105)).toBe(true);
  });

  it("matches the independent oracle across repeated cohort creation and simultaneous procs", () => {
    let actual = emptyPrimordialIce();
    let expected: OracleAtom[] = [...actual.atoms];
    for (const tick of [0, 3, 6, 130, 133]) {
      actual = applyLengLandToDistribution(actual, lengLandTableFor(true, true)!, tick);
      expected = oracleLand(expected, true, true, tick);
      expectAtomsEqual(actual, expected);
      expect(massSum(actual.atoms)).toBeCloseTo(1, 12);
    }
  });

  it("refreshes stack expiry on a successful capped application", () => {
    const start = unitPrimordialIce(PRIMORDIAL_ICE_CAP, 50);
    const actual = applyLengLandToDistribution(start, lengLandTableFor(true, false)!, 0);
    expect(actual.atoms).toEqual([
      { weight: 0.9, stacks: 10, stacksExpireAtTick: 50, frostbladesExpireAtTick: 0 },
      { weight: 0.1, stacks: 10, stacksExpireAtTick: 200, frostbladesExpireAtTick: 0 },
    ]);
  });

  it("uses half-open expiry boundaries independently", () => {
    const dist = {
      atoms: [{ weight: 1, stacks: 4, stacksExpireAtTick: 10, frostbladesExpireAtTick: 11 }],
    };
    expect(expirePrimordialIce(dist, 9).atoms[0]).toEqual(dist.atoms[0]);
    expect(expirePrimordialIce(dist, 10).atoms[0]).toEqual({
      weight: 1,
      stacks: 0,
      stacksExpireAtTick: 0,
      frostbladesExpireAtTick: 11,
    });
    expect(expirePrimordialIce(dist, 11).atoms[0]).toEqual({
      weight: 1,
      stacks: 0,
      stacksExpireAtTick: 0,
      frostbladesExpireAtTick: 0,
    });
  });

  it("merges identical atoms without renormalizing and preserves integer stacks", () => {
    const dist = expirePrimordialIce(
      {
        atoms: [
          { weight: 0.2, stacks: 2, stacksExpireAtTick: 100, frostbladesExpireAtTick: 200 },
          { weight: 0.3, stacks: 2, stacksExpireAtTick: 100, frostbladesExpireAtTick: 200 },
          { weight: 0.5, stacks: 10.9, stacksExpireAtTick: 100, frostbladesExpireAtTick: 200 },
        ],
      },
      0,
    );
    expect(dist.atoms).toEqual([
      { weight: 0.5, stacks: 2, stacksExpireAtTick: 100, frostbladesExpireAtTick: 200 },
      { weight: 0.5, stacks: 10, stacksExpireAtTick: 100, frostbladesExpireAtTick: 200 },
    ]);
    expect(massSum(dist.atoms)).toBe(1);
    expect(dist.atoms.every((atom) => Number.isInteger(atom.stacks))).toBe(true);
  });

  it("keeps Icy Tempest exact after mixed refresh/no-refresh outcomes", () => {
    const dist = {
      atoms: [
        { weight: 0.75, stacks: 1, stacksExpireAtTick: 120, frostbladesExpireAtTick: 0 },
        { weight: 0.25, stacks: 3, stacksExpireAtTick: 210, frostbladesExpireAtTick: 140 },
      ],
    };
    const resolved = resolveIcyTempest(dist, 20, false);
    expect(resolved.outcomes).toEqual([
      {
        probability: 0.75,
        stacksConsumed: 1,
        requirement: 30,
        spend: 18,
        hits: [{ band: { minPct: 133, maxPct: 157 } }, { band: { minPct: 193, maxPct: 227 } }],
        postCastPrimordialIce: {
          atoms: [{ weight: 1, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 0 }],
        },
      },
      {
        probability: 0.25,
        stacksConsumed: 3,
        requirement: 30,
        spend: 0,
        hits: [{ band: { minPct: 169, maxPct: 201 } }, { band: { minPct: 229, maxPct: 271 } }],
        postCastPrimordialIce: {
          atoms: [{ weight: 1, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 140 }],
        },
      },
    ]);
    expect(resolved.expectedStacks).toBeCloseTo(1.5, 12);
  });

  it("expires stale probability during a long run instead of carrying it forward", () => {
    const dist = {
      atoms: [
        { weight: 0.4, stacks: 5, stacksExpireAtTick: 120, frostbladesExpireAtTick: 0 },
        { weight: 0.6, stacks: 5, stacksExpireAtTick: 1000, frostbladesExpireAtTick: 0 },
      ],
    };
    const at121 = expirePrimordialIce(dist, 121);
    expect(expectedStacksFromAtoms(at121.atoms)).toBeCloseTo(3, 12);
    expect(at121.atoms.some((atom) => atom.stacks === 5 && atom.stacksExpireAtTick === 120)).toBe(
      false,
    );
    expect(activeFrostbladesMass(at121, 121)).toBe(0);
  });

  it("does not alter the unit state through a no-passive path", () => {
    const start = emptyPrimordialIce();
    expect(lengLandTableFor(false, false)).toBeNull();
    expect(start).toEqual(emptyPrimordialIce());
    expect(icyTempestHits(0)[0]!.band.minPct).toBe(115);
  });
});
