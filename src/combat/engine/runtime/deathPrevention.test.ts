import { describe, expect, it } from "vitest";
import {
  applyPreventablePlayerDamage,
  clearDeathPrevention,
  deathPreventionActive,
  makeDeathPrevention,
} from "./deathPrevention";

describe("deathPrevention", () => {
  const vit = { currentLifePoints: 100, maximumLifePoints: 10_000 };

  it("revives once with provisional full-max policy", () => {
    const prevention = makeDeathPrevention({
      sourceId: "sliver_of_edicts_activate",
      charges: 1,
      untilTick: 28,
      policy: "full-max",
    });
    const first = applyPreventablePlayerDamage(vit, prevention, 200, 5);
    expect(first.died).toBe(false);
    expect(first.revived).toBe(true);
    expect(first.vitality.currentLifePoints).toBe(10_000);
    expect(first.deathPrevention.charges).toBe(0);

    const second = applyPreventablePlayerDamage(
      first.vitality,
      first.deathPrevention,
      50_000,
      6,
    );
    expect(second.died).toBe(true);
    expect(second.revived).toBe(false);
  });

  it("does not revive outside the window", () => {
    const prevention = makeDeathPrevention({
      sourceId: "x",
      charges: 1,
      untilTick: 28,
    });
    expect(deathPreventionActive(prevention, 28)).toBe(false);
    const r = applyPreventablePlayerDamage(vit, prevention, 200, 28);
    expect(r.died).toBe(true);
    expect(r.revived).toBe(false);
  });

  it("clears unused charges on expire helper", () => {
    const prevention = makeDeathPrevention({ sourceId: "x", charges: 1, untilTick: 28 });
    expect(clearDeathPrevention(prevention).charges).toBe(0);
  });
});
