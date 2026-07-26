import { describe, expect, it } from "vitest";
import {
  CONJURE_IDS,
  CONJURE_UNTIL_OFFSET_TICKS,
  CONJURES_CANNOT_CRIT,
  GHOST_AUTO_INTERVAL,
  GHOST_FIRST_AUTO_TICKS,
  SKELETON_AUTO_INTERVAL,
  SKELETON_FIRST_AUTO_TICKS,
  SKELETON_RAGE_MAX_STACKS,
  SPIRIT_AUTO_ABILITY_ID,
  SPIRIT_POISON_ABILITY_ID,
  UNDEAD_ARMY_DEFAULT,
  ZOMBIE_AUTO_INTERVAL,
  ZOMBIE_FIRST_AUTO_TICKS,
  ZOMBIE_POISON_FIRST_TICKS,
  applyConjureCast,
  conjureActive,
  conjureCanCast,
  dismissConjure,
  newConjures,
  processSpiritAutos,
  skeletonRageMult,
  summonConjure,
  summonConjures,
} from "./conjures";

describe("conjures", () => {
  it("lists the four sourced spirits and the no-crit engine rule", () => {
    expect(CONJURE_IDS).toEqual([
      "skeleton_warrior",
      "vengeful_ghost",
      "putrid_zombie",
      "phantom_guardian",
    ]);
    expect(CONJURES_CANNOT_CRIT).toBe(true);
  });

  it("summons with SP3 untilTick and first auto timers", () => {
    const ready = 0;
    let state = summonConjure(newConjures(), "skeleton_warrior", ready);
    expect(state.spirits).toHaveLength(1);
    const skel = state.spirits[0]!;
    expect(skel.untilTick).toBe(ready + CONJURE_UNTIL_OFFSET_TICKS);
    expect(skel.nextAutoTick).toBe(ready + SKELETON_FIRST_AUTO_TICKS);
    expect(skel.rageStacks).toBe(0);
    expect(conjureActive(state, "skeleton_warrior", ready)).toBe(true);
    expect(conjureActive(state, "skeleton_warrior", skel.untilTick)).toBe(false);

    state = summonConjure(state, "vengeful_ghost", ready);
    expect(state.spirits.find((s) => s.id === "vengeful_ghost")!.nextAutoTick).toBe(
      ready + GHOST_FIRST_AUTO_TICKS,
    );
    state = summonConjure(state, "putrid_zombie", ready);
    const z = state.spirits.find((s) => s.id === "putrid_zombie")!;
    expect(z.nextAutoTick).toBe(ready + ZOMBIE_FIRST_AUTO_TICKS);
    expect(z.nextPoisonTick).toBe(ready + ZOMBIE_POISON_FIRST_TICKS);
  });

  it("refreshing a summon replaces timers; dismiss removes cleanly", () => {
    let state = summonConjure(newConjures(), "skeleton_warrior", 0);
    state = summonConjure(state, "skeleton_warrior", 10);
    expect(state.spirits).toHaveLength(1);
    expect(state.spirits[0]!.untilTick).toBe(10 + CONJURE_UNTIL_OFFSET_TICKS);
    state = dismissConjure(state, "skeleton_warrior");
    expect(conjureActive(state, "skeleton_warrior")).toBe(false);
  });

  it("army default summons skeleton + ghost + zombie (not phantom)", () => {
    const state = applyConjureCast(newConjures(), "conjure_undead_army", 0);
    expect(state.spirits.map((s) => s.id).sort()).toEqual([...UNDEAD_ARMY_DEFAULT].sort());
    expect(conjureActive(state, "phantom_guardian")).toBe(false);
  });

  it("phantom guardian has no auto schedule", () => {
    const state = summonConjure(newConjures(), "phantom_guardian", 0);
    const p = state.spirits[0]!;
    expect(p.nextAutoTick).toBe(p.untilTick);
    const { events } = processSpiritAutos(state, 0, p.untilTick);
    expect(events).toHaveLength(0);
  });

  it("lands skeleton autos with progressive rage and never marks crit", () => {
    const state = summonConjure(newConjures(), "skeleton_warrior", 0);
    const { events, state: after } = processSpiritAutos(state, 0, 20);
    // hits at 7, 12, 17
    expect(events.map((e) => e.tick)).toEqual([7, 12, 17]);
    expect(events.every((e) => e.critEligible === false)).toBe(true);
    expect(events.every((e) => e.abilityId === SPIRIT_AUTO_ABILITY_ID.skeleton_warrior)).toBe(true);
    expect(events[0]!.mult).toBe(1);
    expect(events[1]!.mult).toBeCloseTo(skeletonRageMult(1));
    expect(events[2]!.mult).toBeCloseTo(skeletonRageMult(2));
    expect(after.spirits[0]!.rageStacks).toBe(3);
    expect(after.spirits[0]!.nextAutoTick).toBe(7 + 3 * SKELETON_AUTO_INTERVAL);
  });

  it("lands full SP3 skeleton autos (~20 hits) with rage capped at 25", () => {
    const state = summonConjure(newConjures(), "skeleton_warrior", 0);
    const { events } = processSpiritAutos(state, 0, CONJURE_UNTIL_OFFSET_TICKS);
    // first 7, last 102: (102-7)/5 + 1 = 20
    expect(events).toHaveLength(20);
    expect(events.at(-1)!.tick).toBe(102);
    expect(events.at(-1)!.mult).toBeCloseTo(skeletonRageMult(19));
    expect(skeletonRageMult(SKELETON_RAGE_MAX_STACKS)).toBe(1.75);
  });

  it("lands zombie autos + poison on sourced intervals", () => {
    const state = summonConjure(newConjures(), "putrid_zombie", 0);
    const { events } = processSpiritAutos(state, 0, 20);
    const autos = events.filter((e) => e.abilityId === SPIRIT_AUTO_ABILITY_ID.putrid_zombie);
    const poison = events.filter((e) => e.abilityId === SPIRIT_POISON_ABILITY_ID);
    expect(autos.map((e) => e.tick)).toEqual([7, 7 + ZOMBIE_AUTO_INTERVAL, 7 + 2 * ZOMBIE_AUTO_INTERVAL]);
    expect(poison[0]!.tick).toBe(ZOMBIE_POISON_FIRST_TICKS);
    expect(poison.every((e) => e.critEligible === false)).toBe(true);
  });

  it("lands ghost autos every 7 ticks from first@6", () => {
    const state = summonConjure(newConjures(), "vengeful_ghost", 0);
    const { events } = processSpiritAutos(state, 0, 30);
    expect(events.map((e) => e.tick)).toEqual([6, 13, 20, 27]);
    expect(events[0]!.tick).toBe(GHOST_FIRST_AUTO_TICKS);
    expect(events[1]!.tick - events[0]!.tick).toBe(GHOST_AUTO_INTERVAL);
  });

  it("conjureCanCast gates commands and re-summons", () => {
    const empty = newConjures();
    expect(conjureCanCast("command_skeleton_warrior", empty, 0)).toBe(false);
    expect(conjureCanCast("conjure_skeleton_warrior", empty, 0)).toBe(true);

    const skel = summonConjure(empty, "skeleton_warrior", 0);
    expect(conjureCanCast("command_skeleton_warrior", skel, 0)).toBe(true);
    expect(conjureCanCast("conjure_skeleton_warrior", skel, 0)).toBe(false);

    const army = summonConjures(empty, UNDEAD_ARMY_DEFAULT, 0);
    expect(conjureCanCast("conjure_undead_army", army, 0)).toBe(false);
    const partial = dismissConjure(army, "vengeful_ghost");
    expect(conjureCanCast("conjure_undead_army", partial, 0)).toBe(true);
  });
});
