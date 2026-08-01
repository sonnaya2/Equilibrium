import { describe, expect, it } from "vitest";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { newChannelledMight } from "../../styles/magic/effects";
import { createRuntime } from "../runtime/runtime";
import type { CastContextInput } from "../simulation/contracts";
import { commitCast, prepareSimulationCast } from ".";
import { applyCastEffects, applyCompletionEffects, castEffectContext } from "./effects";
import { scheduleCastEvents } from "./schedule";

/**
 * The cast lifecycle boundary: preparation is read-only, a rejected cast spends
 * nothing, and effects that need a completed channel are applied only after
 * occupancy has elapsed.
 */

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
    expect(rt.state.bleedChainNext).toBeNull();
    expect(rt.state.bleedChainUntilTick).toBe(0);
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
    expect(rt.state.magicFx.channelledMight).toEqual(newChannelledMight());

    applyCompletionEffects(castEffectContext(rt, prepared));
    expect(rt.state.magicFx.channelledMight.startsAtTick).toBe(
      prepared.candidate + prepared.occupancyTicks,
    );
  });
});
