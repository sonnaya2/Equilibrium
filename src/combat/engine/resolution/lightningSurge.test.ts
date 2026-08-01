import { describe, expect, it } from "vitest";
import { rotationOf } from "../simulation/contracts";
import { simulate } from "../simulation/simulate";
import { magicInput } from "../../test/fixtures/inputs";

describe("Lightning Surge proc event", () => {
  it("schedules Instability's Lightning Surge as a proc event at sourceHitTick+1 (EV, non-recursive)", () => {
    const s = simulate({
      ...magicInput,
      crit: { chance: 1 },
      rotation: rotationOf(...Array(6).fill("magic_attack"), "instability", "magic_attack"),
    });
    expect(s.ok).toBe(true);
    const instabilitySeq = s.casts.findIndex((c) => c.abilityId === "instability");
    const followSeq = s.casts.findIndex((c, i) => i > instabilitySeq);
    // The granting cast fires no surge: exactly one hit event, no proc.
    expect(s.events.filter((e) => e.sourceCast === instabilitySeq).map((e) => e.family)).toEqual([
      "hit",
    ]);
    const followEvents = s.events.filter((e) => e.sourceCast === followSeq);
    expect(followEvents.map((e) => e.family)).toEqual(["hit", "proc"]);
    const surge = followEvents[1];
    expect(surge.tick).toBe(s.casts[followSeq].tick + 1);
    expect(surge.procEligible).toBe(false);
    expect(surge.recursionAllowed).toBe(false);
    expect(surge.damage.expected).toBeCloseTo(1199.7512437810944, 10);
    expect(surge.damage.min).toBe(0);
    expect(surge.damage.max).toBe(0);
    // Hit events reconcile with the cast record; the surge EV lands in expected.
    expect(s.casts[followSeq].result.expected).toBeCloseTo(2699.502487562189, 10);
    expect(s.casts[followSeq].result.hits).toHaveLength(1);
    expect(s.damageByTick[s.casts[followSeq].tick + 1]).toBeCloseTo(1199.7512437810944, 10);
  });
});
