import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import {
  abilityCastCycleSeconds,
  abilityExpectedDamage,
  abilityTtkLabel,
  abilityTtkSeconds,
  formatKph,
  formatTtkSeconds,
  killsPerHour,
  runTtkSeconds,
} from "./abilityTtkPresentation";

const slash: AbilitySpec = {
  id: "test:slash",
  name: "Slash",
  style: "melee",
  category: "basic",
  hits: [{ band: { minPct: 100, maxPct: 100 } }],
  cooldownSeconds: 3,
};

describe("abilityTtkPresentation", () => {
  it("scales band midpoint by base and Damage Potential", () => {
    // base 1000, 100% band, DP 0.5 -> 500
    expect(abilityExpectedDamage(1000, slash, 0.5)).toBe(500);
  });

  it("uses cooldownSeconds for cycle", () => {
    expect(abilityCastCycleSeconds(slash)).toBe(3);
    expect(abilityCastCycleSeconds({ ...slash, cooldownSeconds: undefined })).toBeCloseTo(1.8, 10);
  });

  it("ceil-casts then multiplies cycle for TTK", () => {
    // 1000 LP, 400 dmg/cast, 3s cycle -> 3 casts * 3s = 9s
    expect(
      abilityTtkSeconds({
        expectedDamagePerCast: 400,
        maximumLifePoints: 1000,
        cycleSeconds: 3,
      }),
    ).toBe(9);
  });

  it("returns null without LP or damage", () => {
    expect(
      abilityTtkSeconds({
        expectedDamagePerCast: 400,
        maximumLifePoints: null,
        cycleSeconds: 3,
      }),
    ).toBeNull();
    expect(formatTtkSeconds(null)).toBe("—");
  });

  it("formats compact TTK labels", () => {
    expect(abilityTtkLabel(1000, slash, 1, 3000)).toBe("9s");
    expect(formatTtkSeconds(75)).toBe("1:15");
  });

  it("run TTK is LP / dps; KPH is 3600 / TTK", () => {
    // 100_000 LP at 10_000 dps -> 10s TTK -> 360 KPH
    expect(runTtkSeconds(100_000, 10_000)).toBe(10);
    expect(killsPerHour(10)).toBe(360);
    expect(formatKph(360)).toBe("360");
    expect(runTtkSeconds(null, 10_000)).toBeNull();
    expect(runTtkSeconds(100_000, 0)).toBeNull();
    expect(formatKph(null)).toBe("—");
  });
});
