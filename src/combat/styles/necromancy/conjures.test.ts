import { describe, expect, it } from "vitest";
import { mulFloor } from "../../core/rounding";
import { MODERNISATION_WIKI } from "../../data/sources";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate, type RotationSummary } from "../../engine/simulation/simulate";
import { necroInput } from "../../test/fixtures/inputs";
import type { CombatModifier } from "../../types";
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
  applyGhostCommand,
  applyPutridCommandState,
  conjureActive,
  conjureCanCast,
  dismissConjure,
  newConjures,
  skeletonRageMult,
  spiritAutoFired,
  spiritAutoPending,
  spiritPoisonBound,
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
  const events: { tick: number; rageStacks: number }[] = [];
  let s = spirit;
  while (hasAutoTrack(s) && spiritAutoPending(s) && s.auto.nextTick <= throughTick) {
    events.push({
      tick: s.auto.nextTick,
      rageStacks: s.id === "skeleton_warrior" ? s.rageStacks : 0,
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
    expect(events.map((event) => event.rageStacks)).toEqual([0, 1, 2]);
    expect(skeletonRageMult(0)).toBe(1);
    expect(skeletonRageMult(1)).toBe(1.03);
    expect(skeletonRageMult(2)).toBe(1.06);
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
    expect(events.at(-1)!.rageStacks).toBe(19);
    expect(skeletonRageMult(25)).toBe(1.75);
    expect(skeletonRageMult(26)).toBe(1.75);
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

  it("conjureCanCast rejects ghost command once already commanding", () => {
    const ghost = summonConjure(newConjures(), "vengeful_ghost", 0);
    expect(conjureCanCast("command_vengeful_ghost", ghost, 0)).toBe(true);
    const commanded = applyGhostCommand(ghost);
    expect(conjureCanCast("command_vengeful_ghost", commanded, 0)).toBe(false);
  });

  it("command putrid caps poison through chat and keeps the slot until explode", () => {
    // Wiki: command@18 -> poison through 21, explode 22; auto@19 suppressed.
    const summoned = summonConjure(newConjures(), "putrid_zombie", 0);
    let z = findConjure(summoned, "putrid_zombie")!;
    while (spiritPoisonPending(z) && z.poison.nextTick < 18) {
      z = spiritPoisonFired(z);
    }
    // Autos 7 and 13 already landed; next would be 19 (post-command -> parked).
    while (spiritAutoPending(z) && z.auto.nextTick < 18) {
      z = spiritAutoFired(z) as typeof z;
    }
    expect(z.poison.nextTick).toBe(18);
    expect(z.auto.nextTick).toBe(19);
    const commanded = applyPutridCommandState({ spirits: [z] }, 18);
    const after = findConjure(commanded, "putrid_zombie")!;
    expect(after.poisonThroughTick).toBe(21);
    expect(after.explodeAtTick).toBe(22);
    expect(spiritPoisonBound(after)).toBe(21);
    // untilTick still 105: slot occupied until explode lands and dismisses.
    expect(conjureActive(commanded, "putrid_zombie", 21)).toBe(true);
    expect(conjureActive(commanded, "putrid_zombie", 22)).toBe(true);
    expect(conjureCanCast("command_putrid_zombie", commanded, 18)).toBe(false);
    expect(conjureCanCast("conjure_putrid_zombie", commanded, 18)).toBe(false);

    const poisonTicks: number[] = [];
    let track = after;
    while (spiritPoisonPending(track)) {
      poisonTicks.push(track.poison.nextTick);
      track = spiritPoisonFired(track);
    }
    expect(poisonTicks).toEqual([18, 21]);
    expect(spiritAutoPending(after)).toBe(false);

    // End-of-life command: explode past untilTick still occupies the slot.
    const late = applyPutridCommandState(
      summonConjure(newConjures(), "putrid_zombie", 0),
      104,
    );
    const lateZ = findConjure(late, "putrid_zombie")!;
    expect(lateZ.explodeAtTick).toBe(108);
    expect(lateZ.untilTick).toBe(105);
    expect(conjureActive(late, "putrid_zombie", 105)).toBe(true);
    expect(conjureActive(late, "putrid_zombie", 107)).toBe(true);
    expect(conjureActive(late, "putrid_zombie", 108)).toBe(false);
  });
});

describe("conjure damage potential and modifier routing", () => {
  it("spirit autos always deal 100% of their damage potential", () => {
    const rotation = rotationOf("conjure_skeleton_warrior", ...Array(10).fill("necromancy_basic"));
    const full = simulate({ ...necroInput, rotation });
    const halved = simulate({ ...necroInput, accuracy: 0.5, rotation });
    expect(halved.perAbility["spirit_skeleton_warrior"]).toBeCloseTo(
      full.perAbility["spirit_skeleton_warrior"]!,
      10,
    );
    // Damage Potential is floored for each integer roll rather than applied to the mean.
    expect(halved.perAbility["necromancy_basic"]).toBeCloseTo(4997.512437810946, 10);
  });

  it("commands also use full damage potential", () => {
    const rotation = rotationOf(
      "conjure_skeleton_warrior",
      "command_skeleton_warrior",
      ...Array(6).fill("necromancy_basic"),
    );
    const full = simulate({ ...necroInput, rotation });
    const halved = simulate({ ...necroInput, accuracy: 0.5, rotation });
    expect(halved.perAbility["command_skeleton_warrior"]).toBeCloseTo(
      full.perAbility["command_skeleton_warrior"]!,
      10,
    );
  });

  const globalBuff: CombatModifier = {
    id: "test:global",
    stage: "onCast",
    priority: 0,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, 1.1) }),
    source: MODERNISATION_WIKI,
  };
  const prayerBuff: CombatModifier = {
    id: "prayer:test",
    stage: "ability",
    priority: 10,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, 1.2) }),
    source: MODERNISATION_WIKI,
  };

  it("spirit autos take global modifiers but never the player's prayers", () => {
    const rotation = rotationOf("conjure_skeleton_warrior", ...Array(10).fill("necromancy_basic"));
    const plain = simulate({ ...necroInput, rotation });
    const buffed = simulate({ ...necroInput, modifiers: [globalBuff], rotation });
    const prayed = simulate({ ...necroInput, modifiers: [globalBuff, prayerBuff], rotation });
    const spirit = (s: RotationSummary) => s.perAbility["spirit_skeleton_warrior"] ?? 0;
    expect(spirit(buffed)).toBeGreaterThan(spirit(plain));
    expect(spirit(prayed)).toBeCloseTo(spirit(buffed), 10);
  });

  it("array and function modifier forms give spirits identical damage (manual/Revolution parity)", () => {
    const rotation = rotationOf("conjure_skeleton_warrior", ...Array(10).fill("necromancy_basic"));
    const asArray = simulate({ ...necroInput, modifiers: [globalBuff], rotation });
    const asFunction = simulate({ ...necroInput, modifiers: () => [globalBuff], rotation });
    expect(asFunction.perAbility["spirit_skeleton_warrior"]).toBeCloseTo(
      asArray.perAbility["spirit_skeleton_warrior"]!,
      10,
    );
    expect(asFunction.totalExpected).toBeCloseTo(asArray.totalExpected, 10);
  });
});
