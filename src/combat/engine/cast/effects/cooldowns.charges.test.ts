import { describe, expect, it } from "vitest";
import { secondsToTicks } from "../../../core/ticks";
import { MAGIC_ABILITIES } from "../../../styles/magic/abilities";
import { MELEE_ABILITIES } from "../../../styles/melee/abilities";
import { RANGED_ABILITIES } from "../../../styles/ranged/abilities";
import { abilityBehaviorFingerprint } from "../../../shared/abilityFingerprint";
import { baseInput, magicInput, rangedInput } from "../../../test/fixtures/inputs";
import { commitCast, prepareSimulationCast } from "../../cast";
import { cloneRuntime, createRuntime } from "../../runtime/runtime";
import { readyChargeCount, maxChargesFor } from "../../runtime/state";
import { rotationOf } from "../../simulation/contracts";
import { simulateRevolution } from "../../simulation/revolution";
import { createCastContext, simulate } from "../../simulation/simulate";
import type { AbilitySpec } from "../../../pipeline/calculateAbility";

const CD_15 = secondsToTicks(15); // 25
const GCD = 3;

function castAbility(
  rt: ReturnType<typeof createRuntime>,
  ability: AbilitySpec,
  readyTick: number,
): boolean {
  const prep = prepareSimulationCast(rt, ability, readyTick);
  if (!prep.ok) return false;
  commitCast(rt, prep.prepared, false);
  return true;
}

describe("stun-basic charges (Backhand / Binding Shot / Impact)", () => {
  it("specs declare max 2 at secondChargeLevel 54", () => {
    for (const [id, list] of [
      ["backhand", MELEE_ABILITIES],
      ["binding_shot", RANGED_ABILITIES],
      ["impact", MAGIC_ABILITIES],
    ] as const) {
      const ability = list.find((a) => a.id === id)!;
      expect(ability.charges).toEqual({ max: 2, secondChargeLevel: 54 });
      expect(maxChargesFor(ability, 99)).toBe(2);
      expect(maxChargesFor(ability, 54)).toBe(2);
      expect(maxChargesFor(ability, 53)).toBe(1);
    }
  });

  it("fingerprint includes charges config", () => {
    const withCharges = MELEE_ABILITIES.find((a) => a.id === "backhand")!;
    const without = { ...withCharges, charges: undefined };
    expect(abilityBehaviorFingerprint(withCharges)).not.toBe(abilityBehaviorFingerprint(without));
    expect(abilityBehaviorFingerprint(withCharges)).toContain('"charges"');
  });

  it("Backhand: two casts on GCD, then blocked until first charge recovers", () => {
    const ctx = createCastContext(baseInput);
    const backhand = ctx.byId.get("backhand")!;

    expect(ctx.performCast(backhand, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.backhand).toBeUndefined();
    expect(ctx.getState().charges.backhand).toEqual([CD_15]);
    expect(readyChargeCount(ctx.getState(), "backhand", 2, ctx.getState().tick)).toBe(1);

    expect(ctx.firstLegalTick("backhand")).toBe(GCD);
    expect(ctx.performCast(backhand, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().charges.backhand).toEqual([CD_15, GCD + CD_15]);
    expect(readyChargeCount(ctx.getState(), "backhand", 2, ctx.getState().tick)).toBe(0);

    // performCast waits for firstLegalTick; at tick 6 both charges recovering.
    expect(ctx.getState().tick).toBe(GCD * 2);
    expect(ctx.firstLegalTick("backhand")).toBe(CD_15);
    expect(readyChargeCount(ctx.getState(), "backhand", 2, ctx.getState().tick)).toBe(0);

    expect(ctx.performCast(backhand, CD_15, false).ok).toBe(true);
    const after = ctx.getState();
    expect(readyChargeCount(after, "backhand", 2, after.tick)).toBe(1);
    expect(after.charges.backhand!.length).toBe(2);
    expect(after.charges.backhand![0]).toBe(GCD + CD_15);
  });

  it("independent recovery: second charge usable while first recovers", () => {
    const ctx = createCastContext(baseInput);
    const backhand = ctx.byId.get("backhand")!;
    ctx.performCast(backhand, 0, false);
    expect(ctx.getState().charges.backhand).toEqual([CD_15]);

    ctx.performCast(backhand, GCD, false);
    const recovering = ctx.getState().charges.backhand!;
    expect(recovering[0]).toBe(CD_15);
    expect(recovering[1]).toBe(GCD + CD_15);
    expect(recovering[0]).not.toBe(recovering[1]);
  });

  it("level < 54: single charge only", () => {
    const ctx = createCastContext({ ...baseInput, level: 53 });
    const backhand = ctx.byId.get("backhand")!;
    expect(maxChargesFor(backhand, 53)).toBe(1);
    expect(ctx.performCast(backhand, 0, false).ok).toBe(true);
    expect(ctx.getState().charges.backhand).toEqual([CD_15]);
    // Only one charge: not legal again until recovery (GCD alone is insufficient).
    expect(ctx.getState().tick).toBe(GCD);
    expect(ctx.firstLegalTick("backhand")).toBe(CD_15);
    expect(readyChargeCount(ctx.getState(), "backhand", 1, ctx.getState().tick)).toBe(0);
  });

  it("Binding Shot and Impact share the same charge recovery shape", () => {
    for (const [id, input] of [
      ["binding_shot", rangedInput],
      ["impact", magicInput],
    ] as const) {
      const ctx = createCastContext(input);
      const ability = ctx.byId.get(id)!;
      expect(ctx.performCast(ability, 0, false).ok).toBe(true);
      expect(ctx.getState().cooldowns[id]).toBeUndefined();
      expect(ctx.getState().charges[id]).toEqual([CD_15]);
      expect(ctx.performCast(ability, GCD, false).ok).toBe(true);
      expect(ctx.firstLegalTick(id)).toBe(CD_15);
    }
  });

  it("ordinary cooldowns still use single-slot map (Assault spot check)", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const assault = ctx.byId.get("assault")!;
    expect(ctx.performCast(assault, 0, false).ok).toBe(true);
    expect(ctx.getState().charges.assault).toBeUndefined();
    // Assault channel occupies 8 ticks; CD is 6s from cast start.
    expect(ctx.getState().cooldowns.assault).toBe(secondsToTicks(6));
    expect(ctx.firstLegalTick("assault")).toBe(secondsToTicks(6));
  });

  it("Sunshine group ordinary CD unchanged", () => {
    const ctx = createCastContext({
      ...magicInput,
      startingAdrenaline: 100,
      abilities: MAGIC_ABILITIES,
    });
    const sunshine = ctx.byId.get("sunshine")!;
    expect(ctx.performCast(sunshine, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.sunshine).toBe(secondsToTicks(60));
    expect(ctx.getState().charges.sunshine).toBeUndefined();
  });

  it("charge snapshot isolation: structuredClone keeps recovering lists independent", () => {
    const rt = createRuntime(baseInput);
    const backhand = rt.byId.get("backhand")!;
    expect(castAbility(rt, backhand, 0)).toBe(true);
    const snap = cloneRuntime(rt);
    snap.state = {
      ...snap.state,
      charges: { backhand: [99, 100] },
    };
    expect(rt.state.charges.backhand).toEqual([CD_15]);
    expect(snap.state.charges.backhand).toEqual([99, 100]);
  });

  it("Revolution can spend both Backhand charges before the first recovers", () => {
    const backhand = MELEE_ABILITIES.find((a) => a.id === "backhand")!;
    const s = simulateRevolution({
      ...baseInput,
      style: "melee",
      bar: [backhand],
      durationTicks: 20,
    });
    expect(s.ok).toBe(true);
    const bh = s.casts.filter((c) => c.abilityId === "backhand");
    expect(bh.length).toBeGreaterThanOrEqual(2);
    expect(bh[0]!.tick).toBe(0);
    expect(bh[1]!.tick).toBe(GCD);
    if (bh[2]) expect(bh[2].tick).toBeGreaterThanOrEqual(CD_15);
  });

  it("manual dual Backhand matches revo charge spacing", () => {
    const manual = simulate({
      ...baseInput,
      rotation: rotationOf("backhand", "backhand"),
    });
    expect(manual.ok).toBe(true);
    expect(manual.casts.map((c) => c.tick)).toEqual([0, GCD]);
  });
});
