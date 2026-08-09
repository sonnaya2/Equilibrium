import { describe, expect, it } from "vitest";
import { resolveIcyTempest } from "./icyTempest";
import { PRIMORDIAL_ICE_CAP } from "./effects";

const mixedZeroThree = {
  atoms: [
    { weight: 0.5, stacks: 0, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
    { weight: 0.5, stacks: 3, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
  ],
};

function oracleHits(stacks: number) {
  return [
    { band: { minPct: 115 + 18 * stacks, maxPct: 135 + 22 * stacks } },
    { band: { minPct: 175 + 18 * stacks, maxPct: 205 + 22 * stacks } },
  ];
}

function oraclePostCast(frostbladesExpireAtTick = 0) {
  return {
    atoms: [{ weight: 1, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick }],
  };
}

function outcomeFor(
  probability: number,
  stacksConsumed: number,
  ringOfVigour = false,
  frostbladesExpireAtTick = 0,
) {
  const baseSpend = Math.max(0, 30 - 12 * stacksConsumed);
  const spend = ringOfVigour ? baseSpend - Math.floor(baseSpend * 0.1) : baseSpend;
  const requirement = ringOfVigour ? 27 : 30;
  return {
    probability,
    stacksConsumed,
    requirement,
    spend,
    hits: oracleHits(stacksConsumed),
    postCastPrimordialIce: oraclePostCast(frostbladesExpireAtTick),
  };
}

describe("Icy Tempest coupled outcome oracle", () => {
  it("keeps 0/3 stack damage coupled to each sampled spend outcome", () => {
    const resolved = resolveIcyTempest(mixedZeroThree, 0, false);
    expect(resolved.outcomes).toEqual([outcomeFor(0.5, 0), outcomeFor(0.5, 3)]);
  });

  it("matches the independent oracle for every unit stack count", () => {
    for (let stacks = 0; stacks <= PRIMORDIAL_ICE_CAP; stacks++) {
      expect(
        resolveIcyTempest({ atoms: [{ ...mixedZeroThree.atoms[0], weight: 1, stacks }] }, 0, false)
          .outcomes,
      ).toEqual([outcomeFor(1, stacks)]);
    }
  });

  it("keeps adjacent stacks distinct and preserves equal-spend damage differences", () => {
    const resolved = resolveIcyTempest(
      {
        atoms: [
          { weight: 0.2, stacks: 1, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
          { weight: 0.3, stacks: 2, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
          { weight: 0.25, stacks: 3, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
          { weight: 0.25, stacks: 4, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
        ],
      },
      0,
      false,
    );
    expect(resolved.outcomes).toEqual([
      outcomeFor(0.2, 1),
      outcomeFor(0.3, 2),
      outcomeFor(0.25, 3),
      outcomeFor(0.25, 4),
    ]);
    expect(resolved.outcomes[2]!.spend).toBe(resolved.outcomes[3]!.spend);
    expect(resolved.outcomes[2]!.hits).not.toEqual(resolved.outcomes[3]!.hits);
    expect(resolved.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)).toBe(1);
  });

  it("applies Ring of Vigour after stack reduction and preserves the requirement", () => {
    const resolved = resolveIcyTempest(
      { atoms: [{ weight: 1, stacks: 1, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 }] },
      0,
      true,
    );
    expect(resolved.outcomes).toEqual([outcomeFor(1, 1, true)]);
    expect(resolved.outcomes[0]!.requirement).toBe(27);
    expect(resolved.outcomes[0]!.spend).toBe(17);
  });

  it("does not merge equal damage outcomes with different future Frostblades state", () => {
    const resolved = resolveIcyTempest(
      {
        atoms: [
          { weight: 0.4, stacks: 2, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
          { weight: 0.6, stacks: 2, stacksExpireAtTick: 100, frostbladesExpireAtTick: 200 },
        ],
      },
      0,
      false,
    );
    expect(resolved.outcomes).toEqual([outcomeFor(0.4, 2), outcomeFor(0.6, 2, false, 200)]);
  });

  it("preserves probability mass and is invariant under atom reordering", () => {
    const atoms = [
      { weight: 0.15, stacks: 0, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
      { weight: 0.35, stacks: 3, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
      { weight: 0.5, stacks: 7, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
    ];
    const first = resolveIcyTempest({ atoms }, 0, false);
    const second = resolveIcyTempest({ atoms: [...atoms].reverse() }, 0, false);
    expect(first.outcomes).toEqual(second.outcomes);
    expect(first.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)).toBe(1);
    const partial = resolveIcyTempest({ atoms: atoms.slice(0, 2) }, 0, false);
    expect(partial.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(
      0.5,
    );
  });
});
