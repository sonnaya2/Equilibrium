import { describe, expect, it } from "vitest";
import {
  COMMAND_PUTRID_ST_ASSUMPTION_NOTE,
  conjureCastUntilTick,
  conjureEventTypeLabel,
  conjurePactAssumptionNote,
  conjureStAreaAssumptionRows,
  conjureUntilOffsetTicks,
  ensureNecromancyConjureOnBar,
  formatConjureByEffectLabel,
  formatConjureCastDurationNote,
  formatRemainingDurationNote,
  isConjureCommandAbilityId,
  isConjureDamageEvent,
  isConjureEffectRow,
  isConjureSummonAbilityId,
  isSpiritLedgerId,
  NECRO_BAR_CONJURE_FALLBACK,
  rotationHasAbilityId,
  rotationHasConjureCast,
  spiritEffectDisplayName,
  UNDEAD_ARMY_ASSUMPTION_NOTE,
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
    expect(isConjureCommandAbilityId("command_putrid_zombie")).toBe(true);
    expect(isSpiritLedgerId("spirit_skeleton_warrior")).toBe(true);
    expect(isSpiritLedgerId("spirit_putrid_zombie_poison")).toBe(true);
    expect(isSpiritLedgerId("touch_of_death")).toBe(false);
    expect(spiritEffectDisplayName("spirit_skeleton_warrior")).toBe("Skeleton Warrior auto");
    expect(spiritEffectDisplayName("spirit_putrid_zombie_poison")).toBe("Putrid Zombie poison");
    expect(spiritEffectDisplayName("touch_of_death")).toBeNull();
  });

  it("marks conjure effect rows, damage events, and timeline types", () => {
    expect(isConjureEffectRow("spirit_skeleton_warrior")).toBe(true);
    expect(isConjureEffectRow("command_skeleton_warrior")).toBe(true);
    expect(isConjureEffectRow("conjure_undead_army")).toBe(true);
    expect(isConjureEffectRow("touch_of_death")).toBe(false);
    expect(isConjureEffectRow("x", "conjure-or-familiar")).toBe(true);
    expect(formatConjureByEffectLabel("spirit_skeleton_warrior", undefined, "Skeleton")).toBe(
      "Conjure · Skeleton",
    );
    expect(formatConjureByEffectLabel("touch_of_death", undefined, "Touch")).toBe("Touch");

    expect(isConjureDamageEvent({ family: "conjureAuto", abilityId: "spirit_skeleton_warrior" })).toBe(
      true,
    );
    expect(isConjureDamageEvent({ family: "command", abilityId: "command_skeleton_warrior" })).toBe(
      true,
    );
    expect(isConjureDamageEvent({ family: "hit", abilityId: "touch_of_death" })).toBe(false);
    expect(conjureEventTypeLabel({ family: "poison", abilityId: "spirit_putrid_zombie_poison" })).toBe(
      "Conjure poison",
    );
    expect(conjureEventTypeLabel({ family: "conjureAuto" })).toBe("Conjure auto");
    expect(conjureEventTypeLabel({ family: "command" })).toBe("Conjure command");
    expect(conjureEventTypeLabel({ family: "hit", abilityId: "slice" })).toBeNull();
  });

  it("formats cast duration and remaining spirit life for timeline rows", () => {
    expect(formatConjureCastDurationNote(0)).toBe("until t105 · 63.0s");
    expect(formatConjureCastDurationNote(3, 1.25)).toBe("until t133 · 78.0s");
    expect(formatRemainingDurationNote(50, 55)).toBe("55t left (~33.0s) · ends t105");
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

  it("surfaces putrid ST explode and army default-three honesty only when those casts run", () => {
    expect(conjureStAreaAssumptionRows(undefined)).toEqual([]);
    expect(conjureStAreaAssumptionRows([{ abilityId: "touch_of_death" }])).toEqual([]);
    expect(rotationHasAbilityId([{ abilityId: "command_putrid_zombie" }], "command_putrid_zombie")).toBe(
      true,
    );

    const putridOnly = conjureStAreaAssumptionRows([{ abilityId: "command_putrid_zombie" }]);
    expect(putridOnly).toEqual([["Command Putrid Zombie", COMMAND_PUTRID_ST_ASSUMPTION_NOTE]]);
    expect(putridOnly[0]![1]).toMatch(/ST model/i);
    expect(putridOnly[0]![1]).toMatch(/primary target only/i);
    expect(putridOnly[0]![1]).not.toMatch(/\d+%\s*(?:to|on)\s+(?:nearby|other|area)/i);

    const armyOnly = conjureStAreaAssumptionRows([{ abilityId: "conjure_undead_army" }]);
    expect(armyOnly).toEqual([["Conjure Undead Army", UNDEAD_ARMY_ASSUMPTION_NOTE]]);
    expect(armyOnly[0]![1]).toMatch(/Skeleton Warrior/);
    expect(armyOnly[0]![1]).toMatch(/customisation not modeled/i);
    expect(armyOnly[0]![1]).not.toMatch(/phantom/i);

    const both = conjureStAreaAssumptionRows([
      { abilityId: "conjure_undead_army" },
      { abilityId: "command_putrid_zombie" },
    ]);
    expect(both).toHaveLength(2);
    expect(both.map(([label]) => label)).toEqual([
      "Command Putrid Zombie",
      "Conjure Undead Army",
    ]);
  });

  it("assumption note strings stay aligned with ability supportNotes", async () => {
    const { NECROMANCY_ABILITIES } = await import("@/combat/styles/necromancy/abilities");
    const putrid = NECROMANCY_ABILITIES.find((a) => a.id === "command_putrid_zombie")!;
    const army = NECROMANCY_ABILITIES.find((a) => a.id === "conjure_undead_army")!;
    expect(putrid.supportNote).toBe(COMMAND_PUTRID_ST_ASSUMPTION_NOTE);
    expect(army.supportNote).toBe(UNDEAD_ARMY_ASSUMPTION_NOTE);
  });

  it("apply bar without conjure -> after normalize has army or skeleton", () => {
    const without = ensureNecromancyConjureOnBar(
      ["touch_of_death", "soul_sap", "volley_of_souls"],
      "necromancy",
    );
    expect(without.some((id) => id === "conjure_undead_army" || id === "conjure_skeleton_warrior")).toBe(
      true,
    );
    expect(without[0]).toBe(NECRO_BAR_CONJURE_FALLBACK);
    expect(without.slice(1)).toEqual(["touch_of_death", "soul_sap", "volley_of_souls"]);

    const withSkel = ensureNecromancyConjureOnBar(
      ["conjure_skeleton_warrior", "touch_of_death"],
      "necromancy",
    );
    expect(withSkel).toEqual(["conjure_skeleton_warrior", "touch_of_death"]);

    expect(ensureNecromancyConjureOnBar(["slice", "fury"], "melee")).toEqual(["slice", "fury"]);
  });
});
