import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { baseInput } from "../../test/fixtures/inputs";
import { createRuntime } from "../runtime/runtime";
import { prepareSimulationCast } from "../cast";
import { rotationOf } from "./contracts";
import { simulate } from "./simulate";

/**
 * Foundational simulation invariants. Prefer these over many narrow historical
 * regressions when the contract is global (time, rejection, integers, finite scores).
 */
describe("simulation invariants", () => {
  it("time never moves backwards across cast ticks", () => {
    const s = simulate({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      rotation: rotationOf("attack", "rend", "attack", "dismember"),
    });
    expect(s.ok).toBe(true);
    let prev = -1;
    for (const cast of s.casts) {
      expect(Number.isInteger(cast.tick), cast.abilityId).toBe(true);
      expect(cast.tick).toBeGreaterThanOrEqual(prev);
      prev = cast.tick;
    }
    for (const ev of s.events) {
      expect(Number.isInteger(ev.tick)).toBe(true);
      expect(ev.tick).toBeGreaterThanOrEqual(0);
    }
  });

  it("rejected prepare mutates nothing beyond the advanced tick", () => {
    const rt = createRuntime({ ...baseInput, abilities: MELEE_ABILITIES });
    const assault = rt.byId.get("assault")!;
    const before = structuredClone(rt.state);
    const preparation = prepareSimulationCast(rt, assault, 0);
    expect(preparation.ok).toBe(false);
    expect(rt.state).toEqual(before);
    expect(rt.queue.length).toBe(0);
    expect(rt.casts).toHaveLength(0);
    expect(rt.state.cooldowns["assault"]).toBeUndefined();
  });

  it("manual adrenaline shortfall fails honestly without a committed ultimate", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("overpower") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("overpower needs 60% adrenaline");
    expect(s.casts ?? []).toHaveLength(0);
  });

  it("discrete event ticks and cast counters are integers", () => {
    const s = simulate({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      rotation: rotationOf("attack", "dismember", "rend"),
    });
    expect(s.ok).toBe(true);
    expect(Number.isInteger(s.casts.length)).toBe(true);
    expect(Number.isInteger(s.events.length)).toBe(true);
    expect(Number.isInteger(s.ticks)).toBe(true);
    for (const cast of s.casts) {
      expect(Number.isInteger(cast.tick)).toBe(true);
    }
    for (const key of Object.keys(s.damageByTick)) {
      expect(Number.isInteger(Number(key))).toBe(true);
    }
  });

  it("summaries contain no NaN or Infinity damage totals", () => {
    const s = simulate({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      rotation: rotationOf("attack", "rend", "dismember"),
    });
    expect(s.ok).toBe(true);
    expect(Number.isFinite(s.totalExpected)).toBe(true);
    expect(Number.isNaN(s.totalExpected)).toBe(false);
    for (const v of Object.values(s.damageByTick)) {
      expect(Number.isFinite(v)).toBe(true);
    }
    for (const v of Object.values(s.perAbility)) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("fixed inputs yield a stable trajectory", () => {
    const rotation = rotationOf("attack", "rend", "attack", "dismember", "attack");
    const a = simulate({ ...baseInput, rotation });
    const b = simulate({ ...baseInput, rotation });
    expect(a.ok && b.ok).toBe(true);
    expect(a.casts.map((c) => `${c.tick}:${c.abilityId}`)).toEqual(
      b.casts.map((c) => `${c.tick}:${c.abilityId}`),
    );
    expect(a.totalExpected).toBe(b.totalExpected);
  });
});
