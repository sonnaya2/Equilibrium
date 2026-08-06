import { describe, expect, it } from "vitest";
import {
  applyIncomingPlayerDamage,
  applyPlayerHeal,
  clampCurrentLife,
  setMaximumLifePoints,
} from "./playerVitality";

describe("playerVitality", () => {
  it("heals up to max and records overheal", () => {
    const r = applyPlayerHeal({ currentLifePoints: 8_000, maximumLifePoints: 10_000 }, 10_000);
    expect(r.healed).toBe(2_000);
    expect(r.overheal).toBe(8_000);
    expect(r.attempted).toBe(10_000);
    expect(r.vitality.currentLifePoints).toBe(10_000);
  });

  it("applies full heal when room exists", () => {
    const r = applyPlayerHeal({ currentLifePoints: 1_000, maximumLifePoints: 20_000 }, 10_000);
    expect(r.healed).toBe(10_000);
    expect(r.overheal).toBe(0);
    expect(r.vitality.currentLifePoints).toBe(11_000);
  });

  it("clamps current when max drops", () => {
    const next = setMaximumLifePoints(
      { currentLifePoints: 12_000, maximumLifePoints: 15_000 },
      10_000,
    );
    expect(next).toEqual({ currentLifePoints: 10_000, maximumLifePoints: 10_000 });
    expect(clampCurrentLife({ currentLifePoints: 5_000, maximumLifePoints: 4_000 })).toEqual({
      currentLifePoints: 4_000,
      maximumLifePoints: 4_000,
    });
  });

  it("marks wouldDie when life reaches 0", () => {
    const r = applyIncomingPlayerDamage({ currentLifePoints: 500, maximumLifePoints: 10_000 }, 500);
    expect(r.wouldDie).toBe(true);
    expect(r.vitality.currentLifePoints).toBe(0);
    expect(r.taken).toBe(500);
  });
});
