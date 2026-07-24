import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { calculateAbility } from "./calculateAbility";

const input = { base: 1000, level: 90, accuracy: 1, crit: { chance: 0 } };

describe("calculateAbility", () => {
  it("rolls up multi-hit abilities", () => {
    const assault = MELEE_ABILITIES.find((a) => a.id === "assault")!;
    const r = calculateAbility(assault, input);
    expect(r.hits).toHaveLength(4);
    expect(r.min).toBe(4 * 1300);
    expect(r.max).toBe(4 * 1500);
    expect(r.adrenalineDelta).toBe(-25);
  });

  it("keeps bleed tails crit-ineligible inside a mixed ability", () => {
    const massacre = MELEE_ABILITIES.find((a) => a.id === "massacre")!;
    const r = calculateAbility(massacre, { ...input, crit: { chance: 0, guaranteed: true } });
    expect(r.hits[0].critMin).toBe(1650);
    expect(r.hits[1].critChance).toBe(0);
    expect(r.hits[1].critMin).toBe(r.hits[1].min);
  });
});
