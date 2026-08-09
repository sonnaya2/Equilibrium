import { describe, expect, it } from "vitest";
import { withCombatStyle } from "./loadout/model";
import { DEFAULT_LOADOUT } from "./loadout/model";
import {
  applyTargetPreset,
  filterTargetPresetOptions,
  isTargetModifiedFromPreset,
  listTargetPresetOptions,
  resetTargetToPreset,
} from "./targetPresetUi";

describe("targetPresetUi", () => {
  it("lists searchable presets including KBD alias", () => {
    const options = listTargetPresetOptions();
    expect(options.length).toBeGreaterThanOrEqual(10);
    const kbd = options.find((o) => o.id === "boss:king-black-dragon");
    expect(kbd).toBeDefined();
    expect(filterTargetPresetOptions(options, "kbd").map((o) => o.id)).toContain(
      "boss:king-black-dragon",
    );
    expect(filterTargetPresetOptions(options, "amascut").map((o) => o.id)).toContain(
      "boss:amascut",
    );
  });

  it("applies KBD stats for ranged style", () => {
    const target = applyTargetPreset("boss:king-black-dragon", "ranged", null);
    expect(target).toMatchObject({
      targetPresetId: "boss:king-black-dragon",
      defenceLevel: 60,
      armour: 1132,
      affinity: 50,
    });
  });

  it("marks modified when affinity is edited, reset restores", () => {
    const base = applyTargetPreset("boss:amascut", "melee", null)!;
    expect(isTargetModifiedFromPreset(base, "melee")).toBe(false);
    const edited = { ...base, affinity: 70 };
    expect(isTargetModifiedFromPreset(edited, "melee")).toBe(true);
    const reset = resetTargetToPreset(edited, "melee");
    expect(reset.affinity).toBe(55);
    expect(isTargetModifiedFromPreset(reset, "melee")).toBe(false);
  });

  it("keeps custom target when preset id is unknown", () => {
    const custom = {
      defenceLevel: 99,
      armour: 1,
      affinity: 55,
      targetPresetId: "boss:does-not-exist",
    };
    expect(isTargetModifiedFromPreset(custom, "melee")).toBe(true);
    expect(applyTargetPreset("boss:missing", "melee", custom)).toBe(custom);
  });

  it("restyles affinity on style change when preset is unmodified", () => {
    const target = applyTargetPreset("boss:king-black-dragon", "melee", null)!;
    expect(target.affinity).toBe(60);
    const next = withCombatStyle({ ...DEFAULT_LOADOUT, style: "melee", target }, "ranged");
    expect(next.target?.affinity).toBe(50);
    const modified = withCombatStyle(
      { ...DEFAULT_LOADOUT, style: "melee", target: { ...target, affinity: 55 } },
      "ranged",
    );
    expect(modified.target?.affinity).toBe(55);
  });

  it("restyles style Aff with hasApplicableWeakness still set (KBD melee 60 -> ranged 50)", () => {
    // Mark scenario must not bake weakness into stored Aff; restyle uses style column only.
    const target = applyTargetPreset("boss:king-black-dragon", "melee", {
      defenceLevel: 1,
      armour: 0,
      affinity: 55,
      hasApplicableWeakness: true,
    })!;
    expect(target.affinity).toBe(60);
    expect(target.hasApplicableWeakness).toBe(true);
    const next = withCombatStyle({ ...DEFAULT_LOADOUT, style: "melee", target }, "ranged");
    expect(next.target?.affinity).toBe(50);
    expect(next.target?.hasApplicableWeakness).toBe(true);
    expect(isTargetModifiedFromPreset(next.target!, "ranged")).toBe(false);
  });
});
