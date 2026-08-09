import { describe, expect, it } from "vitest";
import { abilityBehaviorFingerprint } from "../shared/abilityFingerprint";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";

describe("BotLG ability identity", () => {
  it("includes the native recast interval in ability behavior identity", () => {
    const balance = RANGED_ABILITIES.find((ability) => ability.id === "balance_by_force")!;
    expect(abilityBehaviorFingerprint(balance)).toContain('"minimumAutomaticRecastTicks":50');
    expect(abilityBehaviorFingerprint({ ...balance, minimumAutomaticRecastTicks: 51 })).not.toBe(
      abilityBehaviorFingerprint(balance),
    );
  });
});
