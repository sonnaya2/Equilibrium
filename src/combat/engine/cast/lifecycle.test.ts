import { describe, expect, it } from "vitest";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { newChannelledMight } from "../../styles/magic/effects";
import { createRuntime } from "../runtime/runtime";
import type { CastContextInput } from "../simulation/contracts";
import { rotationOf } from "../simulation/contracts";
import { createCastContext, simulate } from "../simulation/simulate";
import { baseInput } from "../../test/fixtures/inputs";
import { abilityById } from "../../test/helpers/summary";
import { commitCast, prepareSimulationCast } from ".";
import { applyCastEffects, applyCompletionEffects, castEffectContext } from "./effects";
import { scheduleCastEvents } from "./schedule";

const magicInput: CastContextInput = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MAGIC_ABILITIES,
  context: { style: "magic" },
};

const meleeInput: CastContextInput = {
  ...magicInput,
  abilities: MELEE_ABILITIES,
  context: { style: "melee" },
};

describe("preparation purity", () => {
  it("preparing a cast changes nothing beyond the canonical advance", () => {
    const rt = createRuntime(meleeInput);
    const attack = rt.byId.get("attack")!;
    const before = rt.state;
    const preparation = prepareSimulationCast(rt, attack, 7);
    expect(preparation.ok).toBe(true);
    expect(rt.state.tick).toBe(7);
    expect({ ...rt.state, tick: before.tick }).toEqual(before);
    expect(rt.queue.length).toBe(0);
    expect(rt.casts).toHaveLength(0);
    expect(rt.nextCastSeq).toBe(0);
  });

  it("preparing twice at the same tick yields the same prepared cast", () => {
    const rt = createRuntime(meleeInput);
    const flurry = rt.byId.get("flurry")!;
    for (let i = 0; i < 4; i++) {
      const attempt = prepareSimulationCast(rt, rt.byId.get("attack")!, rt.state.tick);
      expect(attempt.ok).toBe(true);
      if (attempt.ok) commitCast(rt, attempt.prepared, false);
    }
    const first = prepareSimulationCast(rt, flurry, rt.state.tick);
    const second = prepareSimulationCast(rt, flurry, rt.state.tick);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    // Bloodlust is spent at commit, so a second preparation still sees the
    // stacks and resolves the identical empowered variant.
    expect(second.prepared.transitions).toEqual(first.prepared.transitions);
    expect(second.prepared.working).toEqual(first.prepared.working);
    expect(second.prepared.spend).toBe(first.prepared.spend);
  });
});

describe("rejected casts spend nothing", () => {
  it("an unaffordable cast schedules no events and starts no cooldown", () => {
    const rt = createRuntime(meleeInput);
    const assault = rt.byId.get("assault")!;
    const before = rt.state;
    const preparation = prepareSimulationCast(rt, assault, 0);
    expect(preparation.ok).toBe(false);
    expect(rt.state).toEqual(before);
    expect(rt.queue.length).toBe(0);
    expect(rt.casts).toHaveLength(0);
    expect(rt.nextSeq).toBe(0);
    expect(rt.nextCastSeq).toBe(0);
    expect(rt.state.cooldowns["assault"]).toBeUndefined();
  });

  it("a bleed recast without its live predecessor grants no chain stage", () => {
    const rt = createRuntime(meleeInput);
    const slaughter = rt.byId.get("slaughter")!;
    const preparation = prepareSimulationCast(rt, slaughter, 0);
    expect(preparation.ok).toBe(false);
    expect(rt.state.melee.bleedChainNext).toBeNull();
    expect(rt.state.melee.bleedChainUntilTick).toBe(0);
  });
});

describe("completion effects wait for the channel", () => {
  it("Asphyxiate grants Channelled Might only after its occupancy elapses", () => {
    const rt = createRuntime(magicInput);
    const asphyxiate = rt.byId.get("asphyxiate")!;
    for (let i = 0; i < 3; i++) {
      const attempt = prepareSimulationCast(rt, rt.byId.get("magic_attack")!, rt.state.tick);
      expect(attempt.ok).toBe(true);
      if (attempt.ok) commitCast(rt, attempt.prepared, false);
    }
    const preparation = prepareSimulationCast(rt, asphyxiate, rt.state.tick);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) return;
    const { prepared } = preparation;

    scheduleCastEvents(rt, prepared, false);
    applyCastEffects(rt, prepared);
    // Cast-start transitions alone must not award the channel's completion buff.
    expect(rt.state.magic.channelledMight).toEqual(newChannelledMight());

    applyCompletionEffects(castEffectContext(rt, prepared));
    expect(rt.state.magic.channelledMight.startsAtTick).toBe(
      prepared.candidate + prepared.occupancyTicks,
    );
  });
});

describe("channel occupancy — manual completes channels", () => {
  it("Assault then another ability: the follow-up starts at castTick+8, not +3, with full channel damage", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "assault", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 17]);
    expect(s.perAbility["assault"]).toBeCloseTo(4 * 1400);
    const assaultEvents = s.events.filter((e) => e.abilityId === "assault");
    expect(assaultEvents.map((e) => e.tick)).toEqual([10, 12, 14, 16]);
    expect(assaultEvents.every((e) => e.family === "hit" && !e.attached)).toBe(true);
  });

  it("Rapid Fire then another ability: follow-up at castTick+8 with full channel damage", () => {
    const s = simulate({
      ...baseInput,
      abilities: RANGED_ABILITIES,
      context: { style: "ranged" },
      rotation: rotationOf(
        "ranged_attack",
        "ranged_attack",
        "ranged_attack",
        "rapid_fire",
        "ranged_attack",
      ),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 17]);
    expect(s.perAbility["rapid_fire"]).toBeCloseTo(8 * 800);
  });

  it("Asphyxiate then another ability: follow-up at castTick+7 with full channel damage", () => {
    const s = simulate({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      rotation: rotationOf(
        "magic_attack",
        "magic_attack",
        "magic_attack",
        "asphyxiate",
        "magic_attack",
      ),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 16]);
    expect(s.perAbility["asphyxiate"]).toBeCloseTo(4 * 1300);
  });
});

describe("atomic cast transition — rejection through the simulator", () => {
  it("a rejected cast (insufficient adrenaline) leaves state byte-identical", () => {
    const ctx = createCastContext(baseInput);
    ctx.performCast(abilityById(MELEE_ABILITIES, "attack"), 0, false);
    ctx.performCast(abilityById(MELEE_ABILITIES, "attack"), 3, false);
    const before = JSON.stringify(ctx.getState());
    const attempt = ctx.performCast(abilityById(MELEE_ABILITIES, "overpower"), 6, false);
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.error).toContain("adrenaline");
    expect(JSON.stringify(ctx.getState())).toBe(before);
    const s = ctx.finish();
    expect(s.casts).toHaveLength(2);
  });

  it("a rejected cast (unmet residual-soul requirement) leaves state byte-identical", () => {
    const ctx = createCastContext({
      ...baseInput,
      abilities: NECROMANCY_ABILITIES,
      context: { style: "necromancy" },
    });
    const before = JSON.stringify(ctx.getState());
    const attempt = ctx.performCast(abilityById(NECROMANCY_ABILITIES, "soul_strike"), 0, false);
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.error).toContain("residual souls");
    expect(JSON.stringify(ctx.getState())).toBe(before);
    expect(ctx.finish().casts).toHaveLength(0);
  });
});
