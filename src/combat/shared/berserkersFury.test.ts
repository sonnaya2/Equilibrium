import { describe, expect, it } from "vitest";
import {
  BERSERKERS_FURY_MAX_BONUS,
  getBerserkersFuryBonus,
  getBerserkersFuryBonusFromPercent,
  lifePointsFromHealthPercent,
  sanitizeHealthPercent,
  berserkersFuryModifier,
} from "./berserkersFury";
import { mulFloor } from "../core/rounding";

describe("sanitizeHealthPercent", () => {
  it("defaults non-finite values to 50", () => {
    expect(sanitizeHealthPercent(Number.NaN)).toBe(50);
    expect(sanitizeHealthPercent(Number.POSITIVE_INFINITY)).toBe(50);
  });

  it("clamps to 0-100", () => {
    expect(sanitizeHealthPercent(-3)).toBe(0);
    expect(sanitizeHealthPercent(150)).toBe(100);
    expect(sanitizeHealthPercent(50)).toBe(50);
  });
});

describe("getBerserkersFuryBonus", () => {
  // Wiki calculator defaults maxhp=10100.
  const max = 10_100;

  it("is 0 at full health and above max (overheal)", () => {
    expect(getBerserkersFuryBonus({ currentLifePoints: max, maximumLifePoints: max })).toBe(0);
    expect(getBerserkersFuryBonus({ currentLifePoints: max + 500, maximumLifePoints: max })).toBe(
      0,
    );
  });

  it("returns 0 for invalid maxima", () => {
    expect(getBerserkersFuryBonus({ currentLifePoints: 1, maximumLifePoints: 0 })).toBe(0);
    expect(getBerserkersFuryBonus({ currentLifePoints: 1, maximumLifePoints: Number.NaN })).toBe(0);
  });

  it("matches wiki 0.5% band just below max", () => {
    // floor(100%*max)=max -> upper shrinks to max-1; floor(91%*10100)=9191
    expect(getBerserkersFuryBonus({ currentLifePoints: max - 1, maximumLifePoints: max })).toBe(
      0.005,
    );
    expect(getBerserkersFuryBonus({ currentLifePoints: 9191, maximumLifePoints: max })).toBe(0.005);
  });

  it("steps to 1.0% below the 91% floor", () => {
    expect(getBerserkersFuryBonus({ currentLifePoints: 9190, maximumLifePoints: max })).toBe(0.01);
  });

  it("is +3.0% at exactly 50% of max (default planner health)", () => {
    const current = lifePointsFromHealthPercent(max, 50);
    expect(current).toBe(5050);
    expect(getBerserkersFuryBonus({ currentLifePoints: current, maximumLifePoints: max })).toBe(
      0.03,
    );
    expect(
      getBerserkersFuryBonusFromPercent({
        currentHealthPercent: 50,
        maximumLifePoints: max,
      }),
    ).toBe(0.03);
  });

  it("reaches +5.0% in the [1%, 11%) band and +5.5% below 1%", () => {
    const onePct = Math.floor(0.01 * max); // 101
    expect(getBerserkersFuryBonus({ currentLifePoints: onePct, maximumLifePoints: max })).toBe(
      0.05,
    );
    expect(getBerserkersFuryBonus({ currentLifePoints: onePct - 1, maximumLifePoints: max })).toBe(
      BERSERKERS_FURY_MAX_BONUS,
    );
    expect(getBerserkersFuryBonus({ currentLifePoints: 1, maximumLifePoints: max })).toBe(
      BERSERKERS_FURY_MAX_BONUS,
    );
  });

  it("uses discrete 0.5% steps (no linear missing-health interpolation)", () => {
    // 60% of 10100 = 6060 -> [51%, 61%) = 2.5%, not 0.4*5.5%
    const at60 = lifePointsFromHealthPercent(max, 60);
    expect(getBerserkersFuryBonus({ currentLifePoints: at60, maximumLifePoints: max })).toBe(0.025);
    const linearWrong = (1 - 0.6) * 0.055;
    expect(linearWrong).not.toBe(0.025);
  });

  it("covers all eleven display steps on a round max", () => {
    const round = 10_000;
    const samples: Array<[number, number]> = [
      [10_000, 0],
      [9999, 0.005],
      [9100, 0.005],
      [9099, 0.01],
      [8100, 0.01],
      [5000, 0.03],
      [100, 0.05],
      [99, 0.055],
      [1, 0.055],
    ];
    for (const [current, expected] of samples) {
      expect(getBerserkersFuryBonus({ currentLifePoints: current, maximumLifePoints: round })).toBe(
        expected,
      );
    }
  });
});

describe("berserkersFuryModifier", () => {
  it("returns null for non-positive bonus", () => {
    expect(berserkersFuryModifier(0)).toBeNull();
    expect(berserkersFuryModifier(-0.01)).toBeNull();
  });

  it("multiplies at roll stage and skips bleeds", () => {
    const mod = berserkersFuryModifier(0.03);
    expect(mod).not.toBeNull();
    expect(mod!.stage).toBe("roll");
    expect(mod!.applies({ style: "melee" })).toBe(true);
    expect(mod!.applies({ style: "melee", dotKind: "bleed" })).toBe(false);
    expect(mod!.applies({ style: "melee", dotKind: "burn" })).toBe(true);
    expect(mod!.apply({ damage: 1000 }, { style: "melee" }).damage).toBe(mulFloor(1000, 1.03));
  });
});
