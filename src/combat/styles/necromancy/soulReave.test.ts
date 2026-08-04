import { describe, expect, it } from "vitest";
import type { ItemPassiveId } from "../../data/records";
import { createCastContext } from "../../engine/simulation/simulate";
import { necroInput } from "../../test/fixtures/inputs";
import {
  activeEquipmentEffects,
  type ActiveEquipmentEffects,
} from "../../shared/equipment";
import { newNecroRotationState, residualSoulCapFor } from "./effects";
import {
  applySoulReaveOnBasic,
  SOUL_REAVE_PASSIVE_ID,
  SOUL_REAVE_STACKS_TO_EMPOWER,
} from "./soulReave";

function soulReaveEffects(
  passiveIds: ItemPassiveId[] = [SOUL_REAVE_PASSIVE_ID],
): ActiveEquipmentEffects {
  return {
    ...activeEquipmentEffects({ style: "necromancy" }),
    passiveIds,
  };
}

describe("Soul Reave pure helpers", () => {
  it("stacks 0..2 without grant; at 3 empowers and resets", () => {
    expect(SOUL_REAVE_STACKS_TO_EMPOWER).toBe(3);
    expect(SOUL_REAVE_PASSIVE_ID).toBe("soul-reave");

    expect(applySoulReaveOnBasic(0)).toEqual({ stacks: 1, grantSoulOnLand: false });
    expect(applySoulReaveOnBasic(1)).toEqual({ stacks: 2, grantSoulOnLand: false });
    expect(applySoulReaveOnBasic(2)).toEqual({ stacks: 3, grantSoulOnLand: false });
    expect(applySoulReaveOnBasic(3)).toEqual({ stacks: 0, grantSoulOnLand: true });
  });

  it("clamps out-of-range stacks", () => {
    expect(applySoulReaveOnBasic(-5)).toEqual({ stacks: 1, grantSoulOnLand: false });
    expect(applySoulReaveOnBasic(99)).toEqual({ stacks: 0, grantSoulOnLand: true });
  });
});

describe("Soul Reave cast + land wiring", () => {
  it("each necro basic +1 stack; 4th basic grants +1 residual soul on land", () => {
    const ctx = createCastContext({
      ...necroInput,
      equipmentEffects: soulReaveEffects(),
    });
    const basic = ctx.byId.get("necromancy_basic")!;

    ctx.performCast(basic, 0, false);
    expect(ctx.getState().necromancy.resources.soulReaveStacks).toBe(1);
    expect(ctx.getState().necromancy.resources.soulReaveGrantOnLand).toBe(false);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(0);

    ctx.performCast(basic, ctx.getState().tick, false);
    expect(ctx.getState().necromancy.resources.soulReaveStacks).toBe(2);

    ctx.performCast(basic, ctx.getState().tick, false);
    expect(ctx.getState().necromancy.resources.soulReaveStacks).toBe(3);
    expect(ctx.getState().necromancy.resources.soulReaveGrantOnLand).toBe(false);

    // Empowered basic: stacks reset and grant armed at cast; soul on land/finish.
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
      equipmentEffects: soulReaveEffects(),
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
      equipmentEffects: soulReaveEffects(),
    });
    const basic = ctx.byId.get("necromancy_basic")!;
    const sap = ctx.byId.get("soul_sap")!;

    for (let i = 0; i < 3; i++) ctx.performCast(sap, ctx.getState().tick, false);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(3);

    for (let i = 0; i < 4; i++) ctx.performCast(basic, ctx.getState().tick, false);
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(3);
    expect(ctx.getState().necromancy.resources.soulReaveGrantOnLand).toBe(false);
  });

  it("8 basics with passive yield 2 residual souls from Soul Reave alone", () => {
    const ctx = createCastContext({
      ...necroInput,
      equipmentEffects: soulReaveEffects(),
    });
    const basic = ctx.byId.get("necromancy_basic")!;
    for (let i = 0; i < 8; i++) {
      ctx.performCast(basic, ctx.getState().tick, false);
    }
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(2);
    expect(ctx.getState().necromancy.resources.soulReaveStacks).toBe(0);
  });
});
