import { describe, expect, it } from "vitest";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import {
  findConjure,
  hasAutoTrack,
  newConjures,
  SPIRIT_POISON_ABILITY_ID,
  spiritPoisonPending,
  summonConjure,
  type ConjureId,
} from "../../styles/necromancy/conjures";
import { commitCast, prepareSimulationCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { snapshotRuntime } from "../simulation/branch";
import { rotationOf, type CastContextInput } from "../simulation/contracts";
import { createCastContext, simulate, type SimulateInput } from "../simulation/simulate";

/**
 * Conjure capability invariants: the poison aura belongs to the Putrid Zombie
 * alone, and no other spirit can acquire one by being summoned, re-summoned,
 * commanded, or cloned into a branch.
 */

const necroInput: Omit<SimulateInput, "rotation"> & CastContextInput = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: NECROMANCY_ABILITIES,
  context: { style: "necromancy" },
};

const poisonEvents = (s: { events: readonly { abilityId: string }[] }) =>
  s.events.filter((e) => e.abilityId === SPIRIT_POISON_ABILITY_ID);

const conjureRotation = (abilityId: string) =>
  rotationOf(
    ...Array(3).fill("necromancy_basic"),
    abilityId,
    ...Array(30).fill("necromancy_basic"),
  );

describe("only the Putrid Zombie has a poison track", () => {
  it("the zombie alone schedules poison hits", () => {
    const s = simulate({ ...necroInput, rotation: conjureRotation("conjure_putrid_zombie") });
    expect(s.ok).toBe(true);
    expect(poisonEvents(s).length).toBeGreaterThan(0);
  });

  it.each<[string, ConjureId]>([
    ["conjure_skeleton_warrior", "skeleton_warrior"],
    ["conjure_vengeful_ghost", "vengeful_ghost"],
    ["conjure_phantom_guardian", "phantom_guardian"],
  ])("%s schedules none", (abilityId, conjureId) => {
    const s = simulate({ ...necroInput, rotation: conjureRotation(abilityId) });
    expect(s.ok).toBe(true);
    expect(poisonEvents(s)).toHaveLength(0);
    // The state model cannot even express it.
    const spirit = findConjure(summonConjure(newConjures(), conjureId, 0), conjureId)!;
    expect(spiritPoisonPending(spirit)).toBe(false);
    expect("poison" in spirit).toBe(false);
  });

  it("Undead Army creates exactly one poison track", () => {
    const army = simulate({ ...necroInput, rotation: conjureRotation("conjure_undead_army") });
    const zombieOnly = simulate({
      ...necroInput,
      rotation: conjureRotation("conjure_putrid_zombie"),
    });
    expect(army.ok).toBe(true);
    expect(poisonEvents(army)).toHaveLength(poisonEvents(zombieOnly).length);
  });

  it("commanding another spirit cannot start a poison track", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    for (let i = 0; i < 3; i++) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(ctx.byId.get("conjure_skeleton_warrior")!, ctx.getState().tick, false);
    for (let i = 0; i < 3; i++) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(ctx.byId.get("command_skeleton_warrior")!, ctx.getState().tick, false);
    for (let i = 0; i < 10; i++) ctx.performCast(basic, ctx.getState().tick, false);
    const s = ctx.finish();
    expect(s.events.some((e) => e.family === "command")).toBe(true);
    expect(poisonEvents(s)).toHaveLength(0);
  });

  it("re-summoning a skeleton over an expired one still has no poison", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    const conjure = ctx.byId.get("conjure_skeleton_warrior")!;
    ctx.performCast(conjure, 0, false);
    while (ctx.getState().tick < 120) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(conjure, ctx.getState().tick, false);
    for (let i = 0; i < 10; i++) ctx.performCast(basic, ctx.getState().tick, false);
    expect(poisonEvents(ctx.finish())).toHaveLength(0);
  });
});

describe("spirit capabilities stay attached to their own conjure", () => {
  it("rage and the auto track belong only to the spirits that have them", () => {
    for (const id of ["skeleton_warrior", "vengeful_ghost", "putrid_zombie"] as const) {
      const spirit = findConjure(summonConjure(newConjures(), id, 0), id)!;
      expect(hasAutoTrack(spirit)).toBe(true);
      expect("rageStacks" in spirit).toBe(id === "skeleton_warrior");
    }
    const phantomState = summonConjure(newConjures(), "phantom_guardian", 0);
    const phantom = findConjure(phantomState, "phantom_guardian")!;
    expect(hasAutoTrack(phantom)).toBe(false);
    expect("rageStacks" in phantom).toBe(false);
  });

  it("Skeleton Rage builds on the skeleton and never on its army-mates", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    for (let i = 0; i < 3; i++) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(ctx.byId.get("conjure_undead_army")!, ctx.getState().tick, false);
    while (ctx.getState().tick < 40) ctx.performCast(basic, ctx.getState().tick, false);
    const conjures = ctx.getState().necromancy.conjures;
    expect(findConjure(conjures, "skeleton_warrior")!.rageStacks).toBeGreaterThan(0);
    // Nothing else in the army has anywhere to put a rage stack.
    expect(conjures.spirits.filter((s) => "rageStacks" in s)).toHaveLength(1);
  });
});

describe("branch cloning preserves conjure track state", () => {
  it("a clone keeps the zombie's poison track and resolves it independently", () => {
    const rt = createRuntime(necroInput);
    for (let i = 0; i < 3; i++) {
      const attempt = prepareSimulationCast(rt, rt.byId.get("necromancy_basic")!, rt.state.tick);
      if (attempt.ok) commitCast(rt, attempt.prepared, false);
    }
    const attempt = prepareSimulationCast(rt, rt.byId.get("conjure_undead_army")!, rt.state.tick);
    expect(attempt.ok).toBe(true);
    if (attempt.ok) commitCast(rt, attempt.prepared, false);

    const clone = snapshotRuntime(rt);
    // Identical pending events, including the single poison track.
    expect(clone.queue.signature()).toBe(rt.queue.signature());
    const pendingPoison = (runtime: typeof rt) =>
      runtime.queue.pending().filter((e) => e.abilityId === SPIRIT_POISON_ABILITY_ID);
    expect(pendingPoison(clone)).toHaveLength(1);
    expect(pendingPoison(rt)).toHaveLength(1);

    const zombie = findConjure(clone.state.necromancy.conjures, "putrid_zombie")!;
    expect(zombie.poison.nextTick).toBe(
      findConjure(rt.state.necromancy.conjures, "putrid_zombie")!.poison.nextTick,
    );
    expect(clone.state.necromancy.conjures.spirits.filter((s) => "poison" in s)).toHaveLength(1);
  });
});
