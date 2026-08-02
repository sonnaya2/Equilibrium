import { describe, expect, it } from "vitest";
import { rangedInput } from "../../test/fixtures/inputs";
import { rotationOf } from "../simulation/contracts";
import { simulate } from "../simulation/simulate";

describe("Searing Winds component accounting", () => {
  it("event total reconciles with parent + attached component detail", () => {
    const s = simulate({ ...rangedInput, rotation: rotationOf("galeshot", "ranged_attack") });
    expect(s.ok).toBe(true);
    const attack = s.events.find((e) => e.abilityId === "ranged_attack")!;
    expect(attack.damage.expected).toBeCloseTo(1200);
    const cast = s.casts[1]!;
    expect(cast.result.hits).toHaveLength(1);
    expect(cast.result.hits[0].expected).toBeCloseTo(1000);
    expect(cast.result.expected).toBeCloseTo(1200);
    expect(attack.damage.expected).toBeCloseTo(cast.result.hits[0].expected + 200);
  });
  it("does not add proc rolls for the bonus", () => {
    const s = simulate({
      ...rangedInput,
      ammo: "deathspore",
      rotation: rotationOf("galeshot", ...Array(9).fill("ranged_attack"), "corruption_shot"),
    });
    const hits = s.events.filter((e) => e.procEligible && !e.attached && e.family === "hit");
    expect(hits).toHaveLength(10);
  });
});
