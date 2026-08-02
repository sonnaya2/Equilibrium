import { describe, expect, it } from "vitest";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { necroInput as necroFixtureInput } from "../../test/fixtures/inputs";
import { abilityById, lastCast } from "../../test/helpers/summary";
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
import {
  createCastContext,
  simulate,
  type RotationSummary,
  type SimulateInput,
} from "../simulation/simulate";

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

describe("conjure summoning and auto contribution", () => {
  it("conjure skeleton summons and spirit autos contribute EV (never crit)", () => {
    const s = simulate({
      ...necroFixtureInput,
      rotation: rotationOf("conjure_skeleton_warrior", ...Array(20).fill("necromancy_basic")),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].abilityId).toBe("conjure_skeleton_warrior");
    expect(s.casts[0].result.expected).toBe(0);
    expect(s.perAbility["spirit_skeleton_warrior"]).toBeGreaterThan(0);
    expect(s.damageByTick[7]).toBeGreaterThan(0);
    expect(s.totalExpected).toBeGreaterThan(s.casts.reduce((n, c) => n + c.result.expected, 0));
  });

  it("First Necromancer conjureBasicDamageMult scales spirit basic autos (not poison)", () => {
    const rot = rotationOf("conjure_skeleton_warrior", ...Array(20).fill("necromancy_basic"));
    const base = simulate({ ...necroFixtureInput, rotation: rot });
    const boosted = simulate({
      ...necroFixtureInput,
      rotation: rot,
      conjureBasicDamageMult: 1.35, // 5-piece First Necro
    });
    expect(base.ok && boosted.ok).toBe(true);
    const baseSpirit = base.perAbility["spirit_skeleton_warrior"] ?? 0;
    const boostSpirit = boosted.perAbility["spirit_skeleton_warrior"] ?? 0;
    expect(baseSpirit).toBeGreaterThan(0);
    expect(boostSpirit / baseSpirit).toBeCloseTo(1.35, 5);

    const zRot = rotationOf("conjure_putrid_zombie", ...Array(12).fill("necromancy_basic"));
    const zBase = simulate({ ...necroFixtureInput, rotation: zRot });
    const zBoost = simulate({ ...necroFixtureInput, rotation: zRot, conjureBasicDamageMult: 1.35 });
    const poisonBase = zBase.perAbility["spirit_putrid_zombie_poison"] ?? 0;
    const poisonBoost = zBoost.perAbility["spirit_putrid_zombie_poison"] ?? 0;
    expect(poisonBase).toBeGreaterThan(0);
    expect(poisonBoost / poisonBase).toBeCloseTo(1, 5);
    const autoBase = zBase.perAbility["spirit_putrid_zombie"] ?? 0;
    const autoBoost = zBoost.perAbility["spirit_putrid_zombie"] ?? 0;
    expect(autoBase).toBeGreaterThan(0);
    expect(autoBoost / autoBase).toBeCloseTo(1.35, 5);
  });

  it("First Necromancer set(5) extends the Spirit Pact lifetime by 25%", () => {
    const plain = createCastContext(necroFixtureInput);
    plain.performCast(plain.byId.get("conjure_skeleton_warrior")!, 0, false);
    expect(findConjure(plain.getState().necromancy.conjures, "skeleton_warrior")!.untilTick).toBe(
      105,
    );

    const boosted = createCastContext({ ...necroFixtureInput, conjureDurationMult: 1.25 });
    boosted.performCast(boosted.byId.get("conjure_skeleton_warrior")!, 0, false);
    expect(findConjure(boosted.getState().necromancy.conjures, "skeleton_warrior")!.untilTick).toBe(
      130,
    );
  });

  it("command skeleton requires an active conjure", () => {
    const blocked = simulate({
      ...necroFixtureInput,
      rotation: rotationOf("command_skeleton_warrior"),
    });
    expect(blocked.ok).toBe(false);

    const ok = simulate({
      ...necroFixtureInput,
      rotation: rotationOf("conjure_skeleton_warrior", "command_skeleton_warrior"),
    });
    expect(ok.ok).toBe(true);
    expect(lastCast(ok).abilityId).toBe("command_skeleton_warrior");
    expect(lastCast(ok).result.hits.every((h) => h.critChance === 0)).toBe(true);
  });

  it("conjure undead army summons three spirits with auto EV", () => {
    const ctx = createCastContext(necroFixtureInput);
    const army = abilityById(NECROMANCY_ABILITIES, "conjure_undead_army");
    ctx.performCast(army, 0, false);
    const ids = ctx
      .getState()
      .necromancy.conjures.spirits.map((s) => s.id)
      .sort();
    expect(ids).toEqual(["putrid_zombie", "skeleton_warrior", "vengeful_ghost"]);

    const s = simulate({
      ...necroFixtureInput,
      rotation: rotationOf("conjure_undead_army", ...Array(15).fill("necromancy_basic")),
    });
    expect(s.ok).toBe(true);
    expect(s.perAbility["spirit_skeleton_warrior"]).toBeGreaterThan(0);
    expect(s.perAbility["spirit_vengeful_ghost"]).toBeGreaterThan(0);
    expect(s.perAbility["spirit_putrid_zombie"]).toBeGreaterThan(0);
  });

  it("keeps Putrid Zombie's 30s conjure cooldown independent of command and expiry", () => {
    const ctx = createCastContext(necroFixtureInput);
    ctx.performCast(ctx.byId.get("conjure_putrid_zombie")!, 0, false);
    expect(ctx.getState().cooldowns.conjure_putrid_zombie).toBe(50);
    const untilTick = findConjure(ctx.getState().necromancy.conjures, "putrid_zombie")!.untilTick;
    expect(ctx.performCast(ctx.byId.get("command_putrid_zombie")!, 3, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.conjure_putrid_zombie).toBe(50);

    const expiry = createCastContext(necroFixtureInput);
    expiry.performCast(expiry.byId.get("conjure_putrid_zombie")!, 0, false);
    expiry.advanceTo(untilTick);
    expect(expiry.getState().cooldowns.conjure_putrid_zombie).toBe(50);
  });

  it("starts the Zombie conjure cooldown when Undead Army supplies a missing Zombie only", () => {
    const fresh = createCastContext(necroFixtureInput);
    fresh.performCast(fresh.byId.get("conjure_undead_army")!, 0, false);
    expect(fresh.getState().cooldowns.conjure_putrid_zombie).toBe(50);

    const active = createCastContext(necroFixtureInput);
    active.performCast(active.byId.get("conjure_putrid_zombie")!, 0, false);
    active.performCast(active.byId.get("conjure_undead_army")!, 3, false);
    expect(active.getState().cooldowns.conjure_putrid_zombie).toBe(50);
  });
});

describe("Command Skeleton Warrior scheduling", () => {
  function skeletonEvents(s: RotationSummary) {
    return {
      autos: s.events.filter((e) => e.family === "conjureAuto"),
      commands: s.events.filter((e) => e.family === "command"),
    };
  }

  it("the command is locked for 6 ticks after summoning (initial 3.6s cooldown)", () => {
    const ctx = createCastContext(necroFixtureInput);
    ctx.performCast(ctx.byId.get("conjure_skeleton_warrior")!, 0, false);
    expect(ctx.firstLegalTick("command_skeleton_warrior")).toBe(6);
  });

  it("wiki example: command at 6 — RAAAR auto at 7, hits 8-17, autos resume 19, 24", () => {
    const ctx = createCastContext(necroFixtureInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    ctx.performCast(ctx.byId.get("conjure_skeleton_warrior")!, 0, false);
    ctx.performCast(
      ctx.byId.get("command_skeleton_warrior")!,
      ctx.firstLegalTick("command_skeleton_warrior"),
      false,
    );
    expect(ctx.getState().tick).toBe(9);
    while (ctx.getState().tick <= 26) ctx.performCast(basic, ctx.getState().tick, false);
    // Rage after the resumed auto at 24: 1 (auto at 7) + 10 (command) + 2 (autos).
    expect(findConjure(ctx.getState().necromancy.conjures, "skeleton_warrior")!.rageStacks).toBe(
      13,
    );
    const s = ctx.finish();
    const { autos, commands } = skeletonEvents(s);
    expect(autos.map((e) => e.tick).slice(0, 3)).toEqual([7, 19, 24]);
    expect(autos.some((e) => e.tick === 12 || e.tick === 17)).toBe(false); // suppressed
    expect(commands.map((e) => e.tick)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(commands.map((e) => e.hitIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // Rage: auto at 7 deals the plain 250 band; each command hit builds a stack
    // (damage first), so the 19-tick auto lands at 11 stacks (1.33x).
    expect(autos[0].damage.expected).toBeCloseTo(250);
    expect(commands[0].damage.expected).toBeCloseTo(257);
    expect(autos[1].damage.expected).toBeCloseTo(332);
  });

  it("wiki example: command at 11 — auto on the RAAAR tick fires, mid-command autos suppressed", () => {
    const ctx = createCastContext(necroFixtureInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    ctx.performCast(ctx.byId.get("conjure_skeleton_warrior")!, 0, false);
    for (let i = 0; i < 2; i++) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(ctx.byId.get("command_skeleton_warrior")!, 11, false);
    while (ctx.getState().tick <= 30) ctx.performCast(basic, ctx.getState().tick, false);
    const s = ctx.finish();
    const { autos, commands } = skeletonEvents(s);
    // Autos at 7 and 12 (the RAAAR tick) fire; 17/22 are suppressed; resume 24.
    expect(autos.map((e) => e.tick).slice(0, 4)).toEqual([7, 12, 24, 29]);
    expect(commands.map((e) => e.tick)).toEqual([13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
  });

  it("a repeat command mutates the schedule again (25-tick cooldown)", () => {
    const ctx = createCastContext(necroFixtureInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    ctx.performCast(ctx.byId.get("conjure_skeleton_warrior")!, 0, false);
    ctx.performCast(
      ctx.byId.get("command_skeleton_warrior")!,
      ctx.firstLegalTick("command_skeleton_warrior"),
      false,
    );
    expect(ctx.firstLegalTick("command_skeleton_warrior")).toBe(31);
    while (ctx.getState().tick <= 28) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(
      ctx.byId.get("command_skeleton_warrior")!,
      ctx.firstLegalTick("command_skeleton_warrior"),
      false,
    );
    // The second command cast at 31: RAAAR 32, hits 33-42 below.
    while (ctx.getState().tick <= 46) ctx.performCast(basic, ctx.getState().tick, false);
    const s = ctx.finish();
    const { commands } = skeletonEvents(s);
    expect(commands.map((e) => e.tick)).toEqual([
      8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
    ]);
  });

  it("command hits land up to 2 ticks past the skeleton's expiry, never more", () => {
    const ctx = createCastContext(necroFixtureInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    ctx.performCast(ctx.byId.get("conjure_skeleton_warrior")!, 0, false);
    while (ctx.getState().tick < 96) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(ctx.byId.get("command_skeleton_warrior")!, 98, false);
    while (ctx.getState().tick <= 112) ctx.performCast(basic, ctx.getState().tick, false);
    const s = ctx.finish();
    const { autos, commands } = skeletonEvents(s);
    // Expiry is tick 105: command hits land 100..107, the 102 auto is suppressed,
    // and nothing schedules past the +2 tail.
    expect(commands.map((e) => e.tick)).toEqual([100, 101, 102, 103, 104, 105, 106, 107]);
    expect(autos.every((e) => e.tick !== 102)).toBe(true);
    expect(autos.every((e) => e.tick < 105)).toBe(true);
  });
});
