import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { createCastContext, simulate } from "../simulation/simulate";
import { rotationOf } from "../simulation/contracts";
import { baseInput } from "../../test/fixtures/inputs";
import { abilityById } from "../../test/helpers/summary";
import { GREATER_BARGE_OPENER_IDLE_TICKS, prepareCast } from "./prepare";
import { createRuntime } from "../runtime/runtime";

describe("Greater Barge opener idle policy", () => {
  it("defaults opener idle to GREATER_BARGE_OPENER_IDLE_TICKS (0)", () => {
    expect(GREATER_BARGE_OPENER_IDLE_TICKS).toBe(0);
    const s = simulate({ ...baseInput, rotation: rotationOf("greater_barge") });
    expect(s.ok).toBe(true);
    expect(s.casts[0].result.min).toBe(750);
    expect(s.casts[0].result.max).toBe(950);
  });
  it("honours optional precombatIdleTicks", () => {
    const rt = createRuntime({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      precombatIdleTicks: 10,
    } as Parameters<typeof createRuntime>[0] & { precombatIdleTicks: number });
    const prepared = prepareCast(rt, abilityById(MELEE_ABILITIES, "greater_barge"), 0);
    expect(prepared.working.hits[0]!.band).toEqual({ minPct: 125, maxPct: 165 });
  });
});

describe("Bloodlust missing-HP precondition", () => {
  it("does not spend stacks when target HP is unavailable", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const flurry = ctx.byId.get("flurry")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(4);
    expect(ctx.performCast(flurry, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(4);
  });
});
