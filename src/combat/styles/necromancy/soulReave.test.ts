import { describe, expect, it } from "vitest";
import { createCastContext } from "../../engine/simulation/simulate";
import { necroInput } from "../../test/fixtures/inputs";
import { activeEquipmentEffects } from "../../shared/equipment";
import { newNecroRotationState, residualSoulCapFor } from "./effects";
import {
  applySoulReaveOnBasic,
  SOUL_REAVE_PASSIVE_ID,
  SOUL_REAVE_STACKS_TO_EMPOWER,
} from "./soulReave";

describe("Soul Reave pure helpers", () => {
  it("stacks 0→1→2→3→4 then grant on next resets to 0", () => {
    expect(SOUL_REAVE_STACKS_TO_EMPOWER).toBe(4);
    expect(SOUL_REAVE_PASSIVE_ID).toBe("soul-reave");

    let stacks = 0;
    const steps: { stacks: number; grantSoulOnLand: boolean }[] = [];
    for (let i = 0; i < 6; i++) {
      const r = applySoulReaveOnBasic(stacks);
      steps.push(r);
      stacks = r.stacks;
    }
    expect(steps).toEqual([
      { stacks: 1, grantSoulOnLand: false },
      { stacks: 2, grantSoulOnLand: false },
      { stacks: 3, grantSoulOnLand: false },
      { stacks: 4, grantSoulOnLand: false },
      { stacks: 0, grantSoulOnLand: true },
      { stacks: 1, grantSoulOnLand: false },
    ]);
  });

  it("clamps pre-cast stacks into 0..4", () => {
    expect(applySoulReaveOnBasic(-5)).toEqual({ stacks: 1, grantSoulOnLand: false });
    expect(applySoulReaveOnBasic(99)).toEqual({ stacks: 0, grantSoulOnLand: true });
  });
});

describe("Soul Reave cast + land wiring", () => {
  const devourerFromSlots = activeEquipmentEffects({
    style: "necromancy",
    equipmentSlots: { mainhand: "item:devourers-guard" },
  });

  const devourerEffects = {
    ...devourerFromSlots,
    // Guaranteed passive for mechanic tests even if catalogue lag drops passiveId.
    passiveIds: [...new Set([...devourerFromSlots.passiveIds, SOUL_REAVE_PASSIVE_ID])],
  };

  it("equipment resolves soul-reave from Devourer's Guard", () => {
    expect(devourerFromSlots.passiveIds).toContain(SOUL_REAVE_PASSIVE_ID);
  });

  it("4 basics build stacks 1..4 with no soul; 5th grants 1 residual soul on land", () => {
    const ctx = createCastContext({
      ...necroInput,
      equipmentEffects: devourerEffects,
    });
    const basic = ctx.byId.get("necromancy_basic")!;

    for (let i = 0; i < 4; i++) {
      ctx.performCast(basic, ctx.getState().tick, false);
      expect(ctx.getState().necromancy.resources.soulReaveStacks).toBe(i + 1);
      expect(ctx.getState().necromancy.resources.soulReaveGrantOnLand).toBe(false);
      expect(ctx.getState().necromancy.resources.residualSouls).toBe(0);
    }

    // 5th basic: ready consumed; stacks reset; grant armed at cast; soul on land/finish.
    ctx.performCast(basic, ctx.getState().tick, false);
    expect(ctx.getState().necromancy.resources.soulReaveStacks).toBe(0);
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(1);
    expect(ctx.getState().necromancy.resources.soulReaveGrantOnLand).toBe(false);
  });

  it("without passive, basics never stack or grant souls", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    for (let i = 0; i < 5; i++) {
      ctx.performCast(basic, ctx.getState().tick, false);
    }
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    expect(ctx.getState().necromancy.resources.soulReaveStacks).toBe(0);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(0);
    expect(ctx.getState().necromancy.resources.soulReaveGrantOnLand).toBe(false);
  });

  it("Soul Sap does not build Soul Reave stacks", () => {
    const ctx = createCastContext({
      ...necroInput,
      equipmentEffects: devourerEffects,
    });
    const sap = ctx.byId.get("soul_sap")!;
    for (let i = 0; i < 4; i++) {
      ctx.performCast(sap, ctx.getState().tick, false);
    }
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    expect(ctx.getState().necromancy.resources.soulReaveStacks).toBe(0);
    // Soul Sap itself still grants residual souls via ability.soulGain.
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(3);
  });

  it("grants respect residual soul cap", () => {
    expect(residualSoulCapFor(newNecroRotationState())).toBe(3);
    expect(residualSoulCapFor(newNecroRotationState({ lantern: true }))).toBe(5);

    const ctx = createCastContext({
      ...necroInput,
      equipmentEffects: devourerEffects,
    });
    const basic = ctx.byId.get("necromancy_basic")!;
    const sap = ctx.byId.get("soul_sap")!;

    for (let i = 0; i < 3; i++) ctx.performCast(sap, ctx.getState().tick, false);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(3);

    for (let i = 0; i < 5; i++) ctx.performCast(basic, ctx.getState().tick, false);
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(3);
    expect(ctx.getState().necromancy.resources.soulReaveGrantOnLand).toBe(false);
  });

  it("10 basics with passive yield 2 residual souls from Soul Reave alone", () => {
    const ctx = createCastContext({
      ...necroInput,
      equipmentEffects: devourerEffects,
    });
    const basic = ctx.byId.get("necromancy_basic")!;
    for (let i = 0; i < 10; i++) {
      ctx.performCast(basic, ctx.getState().tick, false);
    }
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(2);
    expect(ctx.getState().necromancy.resources.soulReaveStacks).toBe(0);
  });
});
