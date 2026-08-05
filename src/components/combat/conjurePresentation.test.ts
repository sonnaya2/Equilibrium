import { describe, expect, it } from "vitest";
import {
  conjureCastUntilTick,
  conjurePactAssumptionNote,
  conjureUntilOffsetTicks,
  formatConjureCastDurationNote,
  formatRemainingDurationNote,
  isConjureSummonAbilityId,
  rotationHasConjureCast,
  spiritEffectDisplayName,
} from "./conjurePresentation";

describe("conjurePresentation", () => {
  it("derives SP3 exclusive until offset (105 default; First Necro 1.25 -> 130)", () => {
    expect(conjureUntilOffsetTicks()).toBe(105);
    expect(conjureUntilOffsetTicks(1)).toBe(105);
    expect(conjureUntilOffsetTicks(1.25)).toBe(130);
    expect(conjureCastUntilTick(0)).toBe(105);
    expect(conjureCastUntilTick(10, 1.25)).toBe(140);
  });

  it("labels conjure summon abilities and spirit ledger ids", () => {
    expect(isConjureSummonAbilityId("conjure_undead_army")).toBe(true);
    expect(isConjureSummonAbilityId("command_putrid_zombie")).toBe(false);
    expect(spiritEffectDisplayName("spirit_skeleton_warrior")).toBe("Skeleton Warrior auto");
    expect(spiritEffectDisplayName("spirit_putrid_zombie_poison")).toBe("Putrid Zombie poison");
    expect(spiritEffectDisplayName("touch_of_death")).toBeNull();
  });

  it("formats cast duration and remaining spirit life for timeline rows", () => {
    expect(formatConjureCastDurationNote(0)).toBe("until t105 · 63.0s");
    expect(formatConjureCastDurationNote(3, 1.25)).toBe("until t133 · 78.0s");
    expect(formatRemainingDurationNote(50, 55)).toBe("55 ticks left · ends t105");
  });

  it("detects conjure casts for assumptions chrome", () => {
    expect(rotationHasConjureCast([{ abilityId: "touch_of_death" }])).toBe(false);
    expect(
      rotationHasConjureCast([
        { abilityId: "conjure_undead_army" },
        { abilityId: "necromancy_basic" },
      ]),
    ).toBe(true);
    expect(conjurePactAssumptionNote()).toMatch(/cast\+105/);
    expect(conjurePactAssumptionNote()).toMatch(/no separate despawn/);
    expect(conjurePactAssumptionNote()).toMatch(/Command Putrid Zombie/);
  });
});
