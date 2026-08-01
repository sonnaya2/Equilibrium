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
  UNDEAD_ARMY_DEFAULT,
  ZOMBIE_AUTO_INTERVAL,
  ZOMBIE_FIRST_AUTO_TICKS,
  ZOMBIE_POISON_FIRST_TICKS,
  applyConjureCast,
  conjureActive,
  conjureCanCast,
  dismissConjure,
  newConjures,
  skeletonRageMult,
  spiritAutoFired,
  spiritAutoPending,
  spiritPoisonFired,
  spiritPoisonPending,
  summonConjure,
  summonConjures,
  findConjure,
  hasAutoTrack,
  type ActiveConjure,
} from "./conjures";

/** Walks a spirit's auto track like the event queue would: fire, advance, repeat. */
function collectAutos(spirit: ActiveConjure, throughTick: number) {
  const events: { tick: number; mult: number }[] = [];
  let s = spirit;
  while (hasAutoTrack(s) && spiritAutoPending(s) && s.auto.nextTick <= throughTick) {
    events.push({
      tick: s.auto.nextTick,
      mult: s.id === "skeleton_warrior" ? skeletonRageMult(s.rageStacks) : 1,
    });
    s = spiritAutoFired(s);
  }
  return { events, state: s };
}

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
    const skel = findConjure(state, "skeleton_warrior")!;
    expect(skel.untilTick).toBe(ready + CONJURE_UNTIL_OFFSET_TICKS);
    expect(skel.auto.nextTick).toBe(ready + SKELETON_FIRST_AUTO_TICKS);
    expect(skel.rageStacks).toBe(0);
    expect(conjureActive(state, "skeleton_warrior", ready)).toBe(true);
    expect(conjureActive(state, "skeleton_warrior", skel.untilTick)).toBe(false);

    state = summonConjure(state, "vengeful_ghost", ready);
    expect(findConjure(state, "vengeful_ghost")!.auto.nextTick).toBe(
      ready + GHOST_FIRST_AUTO_TICKS,
    );
    state = summonConjure(state, "putrid_zombie", ready);
    const z = findConjure(state, "putrid_zombie")!;
    expect(z.auto.nextTick).toBe(ready + ZOMBIE_FIRST_AUTO_TICKS);
    expect(z.poison.nextTick).toBe(ready + ZOMBIE_POISON_FIRST_TICKS);
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
    const p = findConjure(state, "phantom_guardian")!;
    expect(hasAutoTrack(p)).toBe(false);
    expect(spiritAutoPending(p)).toBe(false);
    expect(collectAutos(p, p.untilTick).events).toHaveLength(0);
  });

  it("lands skeleton autos with progressive rage and never marks crit", () => {
    const state = summonConjure(newConjures(), "skeleton_warrior", 0);
    const { events, state: after } = collectAutos(state.spirits[0]!, 20);
    expect(events.map((e) => e.tick)).toEqual([7, 12, 17]);
    expect(events[0]!.mult).toBe(1);
    expect(events[1]!.mult).toBeCloseTo(skeletonRageMult(1));
    expect(events[2]!.mult).toBeCloseTo(skeletonRageMult(2));
    expect(after.id).toBe("skeleton_warrior");
    if (after.id !== "skeleton_warrior") return;
    expect(after.rageStacks).toBe(3);
    expect(after.auto.nextTick).toBe(7 + 3 * SKELETON_AUTO_INTERVAL);
  });

  it("lands full SP3 skeleton autos (~20 hits) with rage capped at 25", () => {
    const state = summonConjure(newConjures(), "skeleton_warrior", 0);
    const { events } = collectAutos(state.spirits[0]!, CONJURE_UNTIL_OFFSET_TICKS);
    expect(events).toHaveLength(20);
    expect(events.at(-1)!.tick).toBe(102);
    expect(events.at(-1)!.mult).toBeCloseTo(skeletonRageMult(19));
    expect(skeletonRageMult(SKELETON_RAGE_MAX_STACKS)).toBe(1.75);
  });

  it("lands zombie autos + poison on sourced intervals", () => {
    const state = summonConjure(newConjures(), "putrid_zombie", 0);
    const { events } = collectAutos(state.spirits[0]!, 20);
    expect(events.map((e) => e.tick)).toEqual([
      7,
      7 + ZOMBIE_AUTO_INTERVAL,
      7 + 2 * ZOMBIE_AUTO_INTERVAL,
    ]);
    let z = findConjure(state, "putrid_zombie")!;
    const poisonTicks: number[] = [];
    while (spiritPoisonPending(z) && z.poison.nextTick <= 20) {
      poisonTicks.push(z.poison.nextTick);
      z = spiritPoisonFired(z);
    }
    expect(poisonTicks[0]).toBe(ZOMBIE_POISON_FIRST_TICKS);
    expect(poisonTicks).toEqual([9, 12, 15, 18]);
  });

  it("lands ghost autos every 7 ticks from first@6", () => {
    const state = summonConjure(newConjures(), "vengeful_ghost", 0);
    const { events } = collectAutos(state.spirits[0]!, 30);
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
